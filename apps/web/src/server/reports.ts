import 'server-only';
import {
  and,
  asc,
  creditReports,
  desc,
  eq,
  getDb,
  isDatabaseConfigured,
  scoreHistory,
  writeAudit,
} from '@machai/db';
import { getPullableBureaus } from '@machai/config';
import { allowancePeriod, checkPullEligibility } from '@machai/entitlements';
import { AUDIT_ACTIONS, logger } from '@machai/observability';
import { enqueue } from '@machai/queue';
import {
  AppError,
  BUREAU_LABELS,
  BUREAU_SCORE_SCALES,
  ERROR_CODES,
  QUEUE_NAMES,
  reportPullIdempotencyKey,
  type Bureau,
  type Entitlements,
  type ReportStatus,
} from '@machai/types';
import { getSignedDownloadUrl, isStorageConfigured } from '@machai/storage';
import { auditEntitlementDenial } from '@/server/auth/guards';
import type { SessionUser } from '@machai/types';

/**
 * Report pulls — Direction A (TASK-05).
 *
 * The request path does the CHECKING; the worker does the calling. That split
 * is what keeps a slow bureau from blocking a Vercel function (spec §15.2) and
 * what makes the pull retryable without the user resubmitting.
 */

export interface BureauCard {
  bureau: Bureau;
  label: string;
  scoreScale: string;
  allowed: boolean;
  latest: {
    id: string;
    status: ReportStatus;
    score: number | null;
    scoreBand: string | null;
    pulledAt: Date | null;
    hasPdf: boolean;
    failureMessage: string | null;
  } | null;
}

export async function getBureauCards(
  businessId: string | null,
  entitlements: Entitlements,
): Promise<BureauCard[]> {
  const pullable = getPullableBureaus();

  const latestByBureau = new Map<Bureau, BureauCard['latest']>();
  if (businessId && isDatabaseConfigured()) {
    const rows = await getDb()
      .select()
      .from(creditReports)
      .where(eq(creditReports.businessId, businessId))
      .orderBy(desc(creditReports.createdAt));

    for (const row of rows) {
      if (latestByBureau.has(row.bureau)) continue;
      latestByBureau.set(row.bureau, {
        id: row.id,
        status: row.status,
        score: row.score,
        scoreBand: row.scoreBand,
        pulledAt: row.pulledAt,
        hasPdf: Boolean(row.pdfStorageKey),
        failureMessage: row.failureMessage,
      });
    }
  }

  return pullable.map((bureau) => ({
    bureau,
    label: BUREAU_LABELS[bureau],
    scoreScale: BUREAU_SCORE_SCALES[bureau].label,
    allowed: entitlements.bureausAllowed.includes(bureau),
    latest: latestByBureau.get(bureau) ?? null,
  }));
}

export interface PullRequestInput {
  user: SessionUser;
  businessId: string;
  bureau: Bureau;
  entitlements: Entitlements;
  pullsUsedThisMonth: number;
  kybVerified: boolean;
}

/**
 * Queues a live report pull.
 *
 * Two guards worth noting:
 *
 *  - Eligibility is checked here AND re-checked in the worker. The gap between
 *    enqueue and execution is real, and a subscription can lapse inside it.
 *  - The idempotency key is per business/bureau/DAY, and the unique index does
 *    the enforcing. A double-click cannot bill the data provider twice
 *    (TASK-05 edge case).
 */
export async function requestReportPull(input: PullRequestInput): Promise<{
  status: 'queued' | 'already_running';
  reportId: string;
}> {
  const eligibility = checkPullEligibility({
    entitlements: input.entitlements,
    bureau: input.bureau,
    pullsUsedThisMonth: input.pullsUsedThisMonth,
    emailVerified: Boolean(input.user.emailVerifiedAt),
    kybVerified: input.kybVerified,
  });

  if (!eligibility.allowed) {
    await auditEntitlementDenial(input.user, 'business', input.businessId, eligibility.reason ?? 'unknown');
    await writeAudit({
      actorId: input.user.id,
      action: AUDIT_ACTIONS.REPORT_PULL_BLOCKED,
      entityType: 'business',
      entityId: input.businessId,
      metadata: { bureau: input.bureau, reason: eligibility.reason ?? null },
    });
    throw new AppError(
      eligibility.reason === 'allowance_exceeded'
        ? ERROR_CODES.ALLOWANCE_EXCEEDED
        : eligibility.reason === 'email_unverified'
          ? ERROR_CODES.EMAIL_UNVERIFIED
          : eligibility.reason === 'kyb_not_verified'
            ? ERROR_CODES.KYB_REQUIRED
            : ERROR_CODES.ENTITLEMENT_REQUIRED,
      eligibility.message ?? 'This pull is not available on your plan.',
    );
  }

  const idempotencyKey = reportPullIdempotencyKey(input.businessId, input.bureau);

  const inserted = await getDb()
    .insert(creditReports)
    .values({
      businessId: input.businessId,
      bureau: input.bureau,
      status: 'pending',
      idempotencyKey,
      requestedByUserId: input.user.id,
      scoreScale: BUREAU_SCORE_SCALES[input.bureau].label,
    })
    .onConflictDoNothing({ target: creditReports.idempotencyKey })
    .returning({ id: creditReports.id });

  if (inserted.length === 0) {
    const [existing] = await getDb()
      .select({ id: creditReports.id })
      .from(creditReports)
      .where(eq(creditReports.idempotencyKey, idempotencyKey))
      .limit(1);
    return { status: 'already_running', reportId: existing?.id ?? '' };
  }

  const reportId = inserted[0]?.id ?? '';

  await enqueue(QUEUE_NAMES.reportPull, `report-pull:${idempotencyKey}`, {
    businessId: input.businessId,
    bureau: input.bureau,
    requestedByUserId: input.user.id,
    idempotencyKey,
  });

  await writeAudit({
    actorId: input.user.id,
    action: AUDIT_ACTIONS.REPORT_PULL_REQUESTED,
    entityType: 'credit_report',
    entityId: reportId,
    metadata: { bureau: input.bureau },
  });

  logger.info('report pull queued', { bureau: input.bureau, reportId });
  return { status: 'queued', reportId };
}

export async function getScoreHistory(businessId: string) {
  if (!isDatabaseConfigured()) return [];
  return getDb()
    .select({
      bureau: scoreHistory.bureau,
      score: scoreHistory.score,
      recordedOn: scoreHistory.recordedOn,
    })
    .from(scoreHistory)
    .where(eq(scoreHistory.businessId, businessId))
    .orderBy(asc(scoreHistory.recordedOn));
}

export async function getReport(reportId: string, businessId: string) {
  const [row] = await getDb()
    .select()
    .from(creditReports)
    .where(and(eq(creditReports.id, reportId), eq(creditReports.businessId, businessId)))
    .limit(1);
  return row ?? null;
}

/**
 * Mints a short-lived download URL for a report PDF.
 *
 * Ownership must be established by the caller. The issuance itself is audited,
 * because a signed URL is a bearer token — anyone holding it can read the file
 * until it expires (spec §13.5).
 */
export async function issueReportPdfUrl(
  user: SessionUser,
  reportId: string,
  businessId: string,
): Promise<string | null> {
  const report = await getReport(reportId, businessId);
  if (!report?.pdfStorageKey) return null;
  if (!isStorageConfigured()) return null;

  const url = await getSignedDownloadUrl(report.pdfStorageKey);

  await writeAudit({
    actorId: user.id,
    action: AUDIT_ACTIONS.REPORT_PDF_URL_ISSUED,
    entityType: 'credit_report',
    entityId: reportId,
    metadata: { bureau: report.bureau },
  });

  return url;
}

export function allowanceSummary(entitlements: Entitlements, used: number) {
  return {
    used,
    total: entitlements.reportsPerMonth,
    remaining: Math.max(0, entitlements.reportsPerMonth - used),
    period: allowancePeriod(),
  };
}
