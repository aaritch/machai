import {
  and,
  businesses,
  creditReports,
  decryptField,
  eq,
  getDb,
  pullAllowanceUsage,
  representatives,
  scoreAlerts,
  scoreHistory,
  subscriptions,
  plans,
  users,
  writeAudit,
  sql,
} from '@machai/db';
import { getBureauClient } from '@machai/bureau-clients';
import { allowancePeriod, checkPullEligibility, resolveEntitlements } from '@machai/entitlements';
import { AUDIT_ACTIONS, logger } from '@machai/observability';
import { enqueue } from '@machai/queue';
import { isStorageConfigured, putObject, reportPdfKey } from '@machai/storage';
import {
  BUREAU_LABELS,
  EMAIL_TEMPLATES,
  QUEUE_NAMES,
  type ReportPullJob,
} from '@machai/types';
import { renderReportPdf } from '../lib/report-pdf';

/**
 * Report pull consumer — the heavy half of Direction A (TASK-05).
 *
 * Runs on the worker precisely because it cannot run on Vercel: a bureau call
 * plus normalization plus PDF rendering exceeds a serverless function's budget
 * and its statelessness (spec §15.2).
 *
 * Ordering here is deliberate and load-bearing:
 *
 *   1. Re-check eligibility. The plan may have lapsed between enqueue and
 *      execution, and the enqueue-time check is not authoritative any more.
 *   2. Call the bureau.
 *   3. Persist the normalized data FIRST, then render the PDF. If rendering
 *      fails the data still lands and the PDF regenerates on retry (TASK-05
 *      failure case).
 *   4. Consume allowance only on SUCCESS. A failed pull must not cost the user
 *      one of their monthly pulls.
 */
export async function handleReportPull(payload: ReportPullJob): Promise<void> {
  const db = getDb();
  const log = logger.child({ consumer: 'report-pull', bureau: payload.bureau });

  const [report] = await db
    .select()
    .from(creditReports)
    .where(eq(creditReports.idempotencyKey, payload.idempotencyKey))
    .limit(1);

  if (!report) {
    log.warn('no report row for idempotency key; nothing to do');
    return;
  }
  if (report.status === 'available' || report.status === 'no_file') {
    // A retry after the work already completed. Return quietly.
    log.info('report already completed; skipping', { reportId: report.id });
    return;
  }

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, payload.businessId))
    .limit(1);

  if (!business) {
    await failReport(report.id, 'not_found', 'The business no longer exists.');
    return;
  }

  // (1) Re-check eligibility against current state.
  const eligibility = await currentEligibility(payload.requestedByUserId, payload.bureau, business.verificationStatus);
  if (!eligibility.allowed) {
    log.warn('pull no longer eligible at execution time', { reason: eligibility.reason });
    await failReport(report.id, eligibility.reason ?? 'not_entitled', eligibility.message ?? 'No longer eligible.');
    return;
  }

  const client = getBureauClient(payload.bureau);
  if (!client) {
    await failReport(report.id, 'not_configured', 'No client is configured for that bureau.');
    return;
  }

  const [rep] = await db
    .select()
    .from(representatives)
    .where(eq(representatives.businessId, business.id))
    .limit(1);
  void rep;

  // (2) Call the bureau. The EIN is decrypted here and nowhere else in this
  // flow — it is never placed in the job payload.
  const result = await client.fetchReport({
    businessId: business.id,
    legalName: business.legalName,
    dbaName: business.dbaName,
    ein: await decryptField(business.einEncrypted),
    streetAddress: business.streetAddress,
    city: business.city,
    state: business.state,
    zip: business.zip,
    phone: business.phone,
  });

  if (!result.ok) {
    if (result.code === 'no_file') {
      // Not an error — a first-class state (TASK-05).
      await db
        .update(creditReports)
        .set({ status: 'no_file', pulledAt: new Date(), failureMessage: result.message, updatedAt: new Date() })
        .where(eq(creditReports.id, report.id));
      await writeAudit({
        actorId: payload.requestedByUserId,
        action: AUDIT_ACTIONS.REPORT_PULL_COMPLETED,
        entityType: 'credit_report',
        entityId: report.id,
        metadata: { bureau: payload.bureau, outcome: 'no_file' },
      });
      await notify(payload.requestedByUserId, EMAIL_TEMPLATES.reportReady, {
        bureauLabel: BUREAU_LABELS[payload.bureau],
      });
      return;
    }

    // Retryable failures throw so the queue's backoff handles them; terminal
    // ones are recorded and the user is told.
    if (result.retryable) {
      log.warn('bureau pull failed, will retry', { code: result.code });
      throw new Error(`bureau pull failed: ${result.code}`);
    }
    await failReport(report.id, result.code, result.message);
    await notify(payload.requestedByUserId, EMAIL_TEMPLATES.reportFailed, {
      bureauLabel: BUREAU_LABELS[payload.bureau],
    });
    return;
  }

  // (3) Persist normalized data before attempting the PDF.
  const normalized = result.report;
  await db
    .update(creditReports)
    .set({
      status: 'available',
      pulledAt: normalized.pulledAt,
      score: normalized.score,
      scoreBand: normalized.scoreBand,
      scoreScale: normalized.scoreScale,
      rawPayload: result.rawPayload as never,
      normalized: normalized as never,
      updatedAt: new Date(),
    })
    .where(eq(creditReports.id, report.id));

  if (normalized.score !== null) {
    const recordedOn = normalized.pulledAt.toISOString().slice(0, 10);
    await db
      .insert(scoreHistory)
      .values({
        businessId: business.id,
        bureau: payload.bureau,
        score: normalized.score,
        recordedOn,
        creditReportId: report.id,
      })
      // One observation per bureau per day — re-running does not duplicate it.
      .onConflictDoNothing();

    await maybeAlertOnChange(business.id, payload.bureau, normalized.score, payload.requestedByUserId);
  }

  // (4) Allowance is consumed only now, on success.
  await db
    .insert(pullAllowanceUsage)
    .values({ userId: payload.requestedByUserId, period: allowancePeriod(), pullsUsed: 1 })
    .onConflictDoUpdate({
      target: [pullAllowanceUsage.userId, pullAllowanceUsage.period],
      set: { pullsUsed: sql`${pullAllowanceUsage.pullsUsed} + 1`, updatedAt: new Date() },
    });

  await writeAudit({
    actorId: payload.requestedByUserId,
    action: AUDIT_ACTIONS.REPORT_PULL_COMPLETED,
    entityType: 'credit_report',
    entityId: report.id,
    // The score is a number, not sensitive content — but the payload never is.
    metadata: { bureau: payload.bureau, outcome: 'available', hasScore: normalized.score !== null },
  });

  // PDF rendering is last and non-fatal: the data is already saved, and a retry
  // regenerates the document.
  if (isStorageConfigured()) {
    try {
      const pdf = await renderReportPdf(normalized, business.legalName);
      const key = reportPdfKey(business.id, report.id);
      await putObject({ key, contentType: 'application/pdf', body: pdf });
      await db
        .update(creditReports)
        .set({ pdfStorageKey: key, updatedAt: new Date() })
        .where(eq(creditReports.id, report.id));
    } catch (error) {
      log.error('pdf rendering failed; report data is saved', { reportId: report.id, error });
    }
  }

  await notify(payload.requestedByUserId, EMAIL_TEMPLATES.reportReady, {
    bureauLabel: BUREAU_LABELS[payload.bureau],
  });

  log.info('report pull completed', { reportId: report.id });
}

async function currentEligibility(
  userId: string,
  bureau: ReportPullJob['bureau'],
  verificationStatus: string,
) {
  const db = getDb();
  const [row] = await db
    .select({
      status: subscriptions.status,
      entitlements: plans.entitlements,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(users.id, userId))
    .limit(1);

  const [usage] = await db
    .select({ pullsUsed: pullAllowanceUsage.pullsUsed })
    .from(pullAllowanceUsage)
    .where(
      and(eq(pullAllowanceUsage.userId, userId), eq(pullAllowanceUsage.period, allowancePeriod())),
    )
    .limit(1);

  return checkPullEligibility({
    entitlements: resolveEntitlements(
      row ? { status: row.status, planEntitlements: row.entitlements ?? null, currentPeriodEnd: null } : null,
    ),
    bureau,
    pullsUsedThisMonth: usage?.pullsUsed ?? 0,
    emailVerified: Boolean(row?.emailVerifiedAt),
    kybVerified: verificationStatus === 'verified',
  });
}

async function failReport(reportId: string, code: string, message: string): Promise<void> {
  await getDb()
    .update(creditReports)
    .set({ status: 'failed', failureCode: code, failureMessage: message, updatedAt: new Date() })
    .where(eq(creditReports.id, reportId));

  await writeAudit({
    actorId: null,
    action: AUDIT_ACTIONS.REPORT_PULL_FAILED,
    entityType: 'credit_report',
    entityId: reportId,
    metadata: { code },
  });
}

/**
 * Sends a score-change alert at most once per transition.
 *
 * The dedupe key encodes both the old and new score, so the unique index makes
 * a repeated evaluation of the same change a no-op — the alert fires once, not
 * on every refresh (TASK-05 failure case).
 */
async function maybeAlertOnChange(
  businessId: string,
  bureau: ReportPullJob['bureau'],
  newScore: number,
  userId: string,
): Promise<void> {
  const db = getDb();
  const [previous] = await db
    .select({ score: scoreHistory.score })
    .from(scoreHistory)
    .where(and(eq(scoreHistory.businessId, businessId), eq(scoreHistory.bureau, bureau)))
    .orderBy(sql`${scoreHistory.recordedOn} DESC`)
    .limit(2);

  if (!previous || previous.score === newScore) return;

  const dedupeKey = `${businessId}:${bureau}:${previous.score}:${newScore}`;
  const inserted = await db
    .insert(scoreAlerts)
    .values({ businessId, bureau, previousScore: previous.score, newScore, dedupeKey })
    .onConflictDoNothing({ target: scoreAlerts.dedupeKey })
    .returning({ id: scoreAlerts.id });

  if (inserted.length === 0) return;

  await notify(userId, EMAIL_TEMPLATES.scoreAlert, {
    bureauLabel: BUREAU_LABELS[bureau],
    previousScore: previous.score,
    newScore,
    delta: newScore - previous.score,
  });
}

async function notify(
  userId: string,
  template: (typeof EMAIL_TEMPLATES)[keyof typeof EMAIL_TEMPLATES],
  data: Record<string, string | number | boolean | null>,
): Promise<void> {
  const [user] = await getDb()
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return;
  await enqueue(QUEUE_NAMES.emails, `${template}:${userId}:${Date.now()}`, {
    template,
    to: user.email,
    data,
  });
}
