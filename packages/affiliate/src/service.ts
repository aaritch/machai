import {
  AFFILIATE_PROGRAM,
  isValidReferralCode,
  type AffiliateProgramConfig,
} from '@machai/config';
import {
  affiliateReferrals,
  affiliates,
  and,
  businesses,
  count,
  eq,
  getDb,
  gte,
  isNull,
  lt,
  sql,
  users,
  writeAudit,
} from '@machai/db';
import { AUDIT_ACTIONS, logger } from '@machai/observability';
import { generateReferralCode, normalizeReferralCode } from './code';

/**
 * Affiliate service.
 *
 * The money-relevant rule: a referral is created at signup as `pending` and
 * earns nothing. It only becomes `qualified` when the referred account starts a
 * paid plan, and only becomes `payable` after the hold window closes without a
 * reversal. Nothing here can pay out on a free signup.
 */

export interface AffiliateRecord {
  id: string;
  userId: string;
  code: string;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  payoutEmail: string | null;
}

// --- Enrolment ---------------------------------------------------------------

export async function getAffiliateForUser(userId: string): Promise<AffiliateRecord | null> {
  const [row] = await getDb().select().from(affiliates).where(eq(affiliates.userId, userId)).limit(1);
  return row ? toRecord(row) : null;
}

export async function getAffiliateByCode(code: string): Promise<AffiliateRecord | null> {
  const normalized = normalizeReferralCode(code);
  if (!isValidReferralCode(normalized)) return null;
  const [row] = await getDb()
    .select()
    .from(affiliates)
    .where(eq(affiliates.code, normalized))
    .limit(1);
  return row ? toRecord(row) : null;
}

export interface ApplyInput {
  userId: string;
  payoutEmail: string;
  applicationNote?: string | null;
  config?: AffiliateProgramConfig;
}

/**
 * Creates an affiliate account.
 *
 * Idempotent: applying twice returns the existing record rather than minting a
 * second code, because a user who double-submits should not end up with two
 * links and a split referral history.
 */
export async function applyForAffiliate(input: ApplyInput): Promise<AffiliateRecord> {
  const config = input.config ?? AFFILIATE_PROGRAM;
  const existing = await getAffiliateForUser(input.userId);
  if (existing) return existing;

  const status = config.requiresApproval ? 'pending' : 'active';

  // Retry on the (vanishingly unlikely) code collision rather than trusting one
  // draw against a unique index.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const inserted = await getDb()
      .insert(affiliates)
      .values({
        userId: input.userId,
        code,
        status,
        payoutEmail: input.payoutEmail,
        applicationNote: input.applicationNote ?? null,
        approvedAt: status === 'active' ? new Date() : null,
      })
      .onConflictDoNothing()
      .returning();

    const row = inserted[0];
    if (row) {
      await writeAudit({
        actorId: input.userId,
        action: AUDIT_ACTIONS.AFFILIATE_APPLIED,
        entityType: 'affiliate',
        entityId: row.id,
        metadata: { status },
      });
      return toRecord(row);
    }

    // A conflict on user_id means a concurrent apply won; return theirs.
    const raced = await getAffiliateForUser(input.userId);
    if (raced) return raced;
  }

  throw new Error('Could not allocate a referral code');
}

export async function setAffiliateStatus(input: {
  affiliateId: string;
  status: 'active' | 'suspended' | 'rejected';
  staffUserId: string;
  reason?: string | null;
}): Promise<void> {
  await getDb()
    .update(affiliates)
    .set({
      status: input.status,
      approvedAt: input.status === 'active' ? new Date() : null,
      approvedByUserId: input.status === 'active' ? input.staffUserId : null,
      suspendedReason: input.reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(affiliates.id, input.affiliateId));

  await writeAudit({
    actorId: input.staffUserId,
    action:
      input.status === 'active'
        ? AUDIT_ACTIONS.AFFILIATE_APPROVED
        : AUDIT_ACTIONS.AFFILIATE_SUSPENDED,
    entityType: 'affiliate',
    entityId: input.affiliateId,
    metadata: { status: input.status },
  });
}

// --- Attribution -------------------------------------------------------------

export type AttributionOutcome =
  | { recorded: true; referralId: string; flagged: boolean }
  | { recorded: false; reason: AttributionRejection };

export type AttributionRejection =
  | 'no_code'
  | 'unknown_code'
  | 'affiliate_not_active'
  | 'self_referral'
  | 'already_attributed';

/**
 * Records a pending referral at signup.
 *
 * Never throws into the signup path. A referral that cannot be attributed is a
 * lost commission; a signup that fails because of a referral bug is a lost
 * customer, which is strictly worse.
 */
export async function recordReferralAtSignup(input: {
  code: string | null | undefined;
  referredUserId: string;
  referredEmail: string;
  einFingerprint?: string | null;
  config?: AffiliateProgramConfig;
}): Promise<AttributionOutcome> {
  const config = input.config ?? AFFILIATE_PROGRAM;

  try {
    if (!input.code) return { recorded: false, reason: 'no_code' };

    const affiliate = await getAffiliateByCode(input.code);
    if (!affiliate) return { recorded: false, reason: 'unknown_code' };
    if (affiliate.status !== 'active') {
      return { recorded: false, reason: 'affiliate_not_active' };
    }

    // Self-referral, by account and by address. Paying someone to refer
    // themselves is not a referral program.
    if (affiliate.userId === input.referredUserId) {
      await auditRejection(affiliate.id, input.referredUserId, 'self_referral');
      return { recorded: false, reason: 'self_referral' };
    }
    const [affiliateUser] = await getDb()
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, affiliate.userId))
      .limit(1);
    if (affiliateUser && affiliateUser.email === input.referredEmail.toLowerCase()) {
      await auditRejection(affiliate.id, input.referredUserId, 'self_referral');
      return { recorded: false, reason: 'self_referral' };
    }

    const flag = await assessFlags({
      affiliateId: affiliate.id,
      einFingerprint: input.einFingerprint,
      config,
    });

    const inserted = await getDb()
      .insert(affiliateReferrals)
      .values({
        affiliateId: affiliate.id,
        referredUserId: input.referredUserId,
        codeUsed: affiliate.code,
        status: 'pending',
        commissionCents: 0,
        currency: config.currency,
        flaggedForReview: flag !== null,
        flagReason: flag,
      })
      // The unique index on referred_user_id makes attribution first-write-wins.
      .onConflictDoNothing({ target: affiliateReferrals.referredUserId })
      .returning({ id: affiliateReferrals.id });

    const row = inserted[0];
    if (!row) return { recorded: false, reason: 'already_attributed' };

    await writeAudit({
      actorId: null,
      action: AUDIT_ACTIONS.REFERRAL_RECORDED,
      entityType: 'affiliate_referral',
      entityId: row.id,
      metadata: { affiliateId: affiliate.id, flagged: flag !== null },
    });
    if (flag) {
      await writeAudit({
        actorId: null,
        action: AUDIT_ACTIONS.REFERRAL_FLAGGED,
        entityType: 'affiliate_referral',
        entityId: row.id,
        metadata: { reason: flag },
      });
    }

    return { recorded: true, referralId: row.id, flagged: flag !== null };
  } catch (error) {
    logger.error('failed to record referral; signup continues', { error });
    return { recorded: false, reason: 'no_code' };
  }
}

/**
 * Patterns that warrant a human look before money moves.
 *
 * Flagged referrals still qualify normally — they just will not become payable
 * without a staff decision. Blocking them outright would punish a genuinely
 * successful affiliate for being successful.
 */
async function assessFlags(input: {
  affiliateId: string;
  einFingerprint?: string | null;
  config: AffiliateProgramConfig;
}): Promise<string | null> {
  const db = getDb();
  const since = new Date(Date.now() - 24 * 3600 * 1000);

  const [today] = await db
    .select({ value: count() })
    .from(affiliateReferrals)
    .where(
      and(
        eq(affiliateReferrals.affiliateId, input.affiliateId),
        gte(affiliateReferrals.signedUpAt, since),
      ),
    );

  if ((today?.value ?? 0) >= input.config.dailyReferralReviewThreshold) {
    return `More than ${input.config.dailyReferralReviewThreshold} referrals in 24 hours`;
  }

  // The same EIN arriving twice means either a duplicate registration or a
  // fabricated one. The fingerprint is an HMAC, so this compares without
  // decrypting anything.
  if (input.einFingerprint) {
    const [duplicate] = await db
      .select({ value: count() })
      .from(businesses)
      .where(and(eq(businesses.einFingerprint, input.einFingerprint), isNull(businesses.deletedAt)));
    if ((duplicate?.value ?? 0) > 1) {
      return 'Referred business shares an EIN with an existing account';
    }
  }

  return null;
}

// --- Qualification and reversal ---------------------------------------------

/**
 * Called when a referred account starts paying.
 *
 * This is the ONLY path that attaches a commission. It is idempotent: Stripe
 * emits several subscription updates per cycle, and a referral must not qualify
 * twice.
 */
export async function qualifyReferralForUser(
  referredUserId: string,
  config: AffiliateProgramConfig = AFFILIATE_PROGRAM,
): Promise<{ qualified: boolean }> {
  try {
    const db = getDb();
    const now = new Date();
    const payableAt = new Date(now.getTime() + config.holdDays * 24 * 3600 * 1000);

    // Only a `pending` referral can qualify — the WHERE clause is the
    // idempotency guard, so a repeated event updates nothing.
    const updated = await db
      .update(affiliateReferrals)
      .set({
        status: 'qualified',
        commissionCents: config.commissionCents,
        currency: config.currency,
        qualifiedAt: now,
        payableAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(affiliateReferrals.referredUserId, referredUserId),
          eq(affiliateReferrals.status, 'pending'),
        ),
      )
      .returning({ id: affiliateReferrals.id, affiliateId: affiliateReferrals.affiliateId });

    const row = updated[0];
    if (!row) return { qualified: false };

    await writeAudit({
      actorId: null,
      action: AUDIT_ACTIONS.REFERRAL_QUALIFIED,
      entityType: 'affiliate_referral',
      entityId: row.id,
      metadata: {
        affiliateId: row.affiliateId,
        commissionCents: config.commissionCents,
        holdDays: config.holdDays,
      },
    });

    logger.info('referral qualified on paid conversion', { referralId: row.id });
    return { qualified: true };
  } catch (error) {
    // A failure here must not break billing. The reconcile path can re-run it.
    logger.error('failed to qualify referral', { error });
    return { qualified: false };
  }
}

/**
 * Reverses a commission that turned out not to be earned — a refund, a dispute,
 * or a subscription that ended inside the hold window.
 *
 * Only touches referrals that have not been paid yet. Clawing back settled
 * money is a business decision, not something this function should do silently.
 */
export async function reverseReferralForUser(
  referredUserId: string,
  reason: string,
): Promise<{ reversed: boolean }> {
  try {
    const updated = await getDb()
      .update(affiliateReferrals)
      .set({
        status: 'reversed',
        reversedAt: new Date(),
        reversalReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(affiliateReferrals.referredUserId, referredUserId),
          sql`${affiliateReferrals.status} IN ('qualified', 'payable')`,
        ),
      )
      .returning({ id: affiliateReferrals.id });

    const row = updated[0];
    if (!row) return { reversed: false };

    await writeAudit({
      actorId: null,
      action: AUDIT_ACTIONS.REFERRAL_REVERSED,
      entityType: 'affiliate_referral',
      entityId: row.id,
      metadata: { reason },
    });
    logger.info('referral reversed', { referralId: row.id, reason });
    return { reversed: true };
  } catch (error) {
    logger.error('failed to reverse referral', { error });
    return { reversed: false };
  }
}

/**
 * Promotes qualified referrals whose hold has elapsed. Runs on the worker.
 *
 * Flagged referrals are deliberately excluded — that is the entire point of the
 * flag.
 */
export async function promoteHeldReferrals(): Promise<number> {
  const promoted = await getDb()
    .update(affiliateReferrals)
    .set({ status: 'payable', updatedAt: new Date() })
    .where(
      and(
        eq(affiliateReferrals.status, 'qualified'),
        eq(affiliateReferrals.flaggedForReview, false),
        lt(affiliateReferrals.payableAt, new Date()),
      ),
    )
    .returning({ id: affiliateReferrals.id });

  for (const row of promoted) {
    await writeAudit({
      actorId: null,
      action: AUDIT_ACTIONS.REFERRAL_BECAME_PAYABLE,
      entityType: 'affiliate_referral',
      entityId: row.id,
    });
  }

  if (promoted.length > 0) {
    logger.info('referrals became payable', { count: promoted.length });
  }
  return promoted.length;
}

// --- Reporting ---------------------------------------------------------------

export interface AffiliateSummary {
  pending: number;
  qualified: number;
  payable: number;
  paid: number;
  reversed: number;
  /** Cents held in the hold window. */
  heldCents: number;
  /** Cents ready to pay. */
  payableCents: number;
  /** Cents already settled. */
  paidCents: number;
}

export async function getAffiliateSummary(affiliateId: string): Promise<AffiliateSummary> {
  const rows = await getDb()
    .select({
      status: affiliateReferrals.status,
      total: count(),
      cents: sql<number>`coalesce(sum(${affiliateReferrals.commissionCents}), 0)::int`,
    })
    .from(affiliateReferrals)
    .where(eq(affiliateReferrals.affiliateId, affiliateId))
    .groupBy(affiliateReferrals.status);

  const summary: AffiliateSummary = {
    pending: 0,
    qualified: 0,
    payable: 0,
    paid: 0,
    reversed: 0,
    heldCents: 0,
    payableCents: 0,
    paidCents: 0,
  };

  for (const row of rows) {
    summary[row.status] = row.total;
    if (row.status === 'qualified') summary.heldCents = row.cents;
    if (row.status === 'payable') summary.payableCents = row.cents;
    if (row.status === 'paid') summary.paidCents = row.cents;
  }

  return summary;
}

export async function listReferrals(affiliateId: string, limit = 100) {
  return getDb()
    .select({
      id: affiliateReferrals.id,
      status: affiliateReferrals.status,
      commissionCents: affiliateReferrals.commissionCents,
      signedUpAt: affiliateReferrals.signedUpAt,
      qualifiedAt: affiliateReferrals.qualifiedAt,
      payableAt: affiliateReferrals.payableAt,
      paidAt: affiliateReferrals.paidAt,
      reversalReason: affiliateReferrals.reversalReason,
      flaggedForReview: affiliateReferrals.flaggedForReview,
    })
    .from(affiliateReferrals)
    .where(eq(affiliateReferrals.affiliateId, affiliateId))
    .orderBy(sql`${affiliateReferrals.signedUpAt} DESC`)
    .limit(limit);
}

async function auditRejection(
  affiliateId: string,
  referredUserId: string,
  reason: AttributionRejection,
): Promise<void> {
  await writeAudit({
    actorId: null,
    action: AUDIT_ACTIONS.REFERRAL_REJECTED,
    entityType: 'affiliate',
    entityId: affiliateId,
    metadata: { reason, referredUserId },
  });
}

function toRecord(row: typeof affiliates.$inferSelect): AffiliateRecord {
  return {
    id: row.id,
    userId: row.userId,
    code: row.code,
    status: row.status,
    payoutEmail: row.payoutEmail,
  };
}
