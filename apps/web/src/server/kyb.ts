import 'server-only';
import {
  businesses,
  decryptField,
  eq,
  getDb,
  isDatabaseConfigured,
  representatives,
  writeAudit,
} from '@machai/db';
import { getKybAdapter } from '@machai/kyb';
import { AUDIT_ACTIONS, logger } from '@machai/observability';
import type { VerificationStatus } from '@machai/types';

/**
 * Business identity verification (spec §6.4).
 *
 * The EIN is decrypted at the last possible moment, handed to the adapter, and
 * never held anywhere else — not in a job payload, not in a log line, not on
 * the business row in plaintext.
 *
 * Failure behaviour matters here: a provider outage leaves the business
 * `pending` and retryable rather than `rejected`. Hard-failing verification
 * because a third party was down would lock a legitimate customer out of the
 * product with no path forward (TASK-02 failure scenario).
 */
export async function requestKybVerification(businessId: string): Promise<VerificationStatus> {
  if (!isDatabaseConfigured()) return 'unverified';

  try {
    const db = getDb();
    const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    if (!business) return 'unverified';

    const [rep] = await db
      .select()
      .from(representatives)
      .where(eq(representatives.businessId, businessId))
      .limit(1);

    await db
      .update(businesses)
      .set({ verificationStatus: 'pending', updatedAt: new Date() })
      .where(eq(businesses.id, businessId));

    await writeAudit({
      actorId: business.ownerUserId,
      action: AUDIT_ACTIONS.KYB_REQUESTED,
      entityType: 'business',
      entityId: businessId,
    });

    const decision = await getKybAdapter().verify({
      businessId,
      legalName: business.legalName,
      dbaName: business.dbaName,
      ein: await decryptField(business.einEncrypted),
      entityType: business.entityType,
      streetAddress: business.streetAddress,
      city: business.city,
      state: business.state,
      zip: business.zip,
      phone: business.phone,
      representative: {
        firstName: rep?.firstName ?? '',
        lastName: rep?.lastName ?? '',
        email: rep?.email ?? '',
        ownershipPercentage: Number(rep?.ownershipPercentage ?? 0),
      },
    });

    await db
      .update(businesses)
      .set({
        verificationStatus: decision.status,
        verificationNotes: decision.reason,
        verifiedAt: decision.status === 'verified' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, businessId));

    await writeAudit({
      actorId: business.ownerUserId,
      action: AUDIT_ACTIONS.KYB_DECIDED,
      entityType: 'business',
      entityId: businessId,
      // The outcome and the reason, never the EIN that produced it.
      metadata: { status: decision.status, retryable: decision.retryable },
    });

    return decision.status;
  } catch (error) {
    logger.error('kyb verification failed', { businessId, error });
    return 'pending';
  }
}

/** Staff decision from the admin queue. */
export async function recordManualKybDecision(input: {
  businessId: string;
  staffUserId: string;
  status: Extract<VerificationStatus, 'verified' | 'rejected'>;
  notes: string;
}): Promise<void> {
  await getDb()
    .update(businesses)
    .set({
      verificationStatus: input.status,
      verificationNotes: input.notes,
      verifiedAt: input.status === 'verified' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, input.businessId));

  await writeAudit({
    actorId: input.staffUserId,
    action: AUDIT_ACTIONS.ADMIN_KYB_DECIDED,
    entityType: 'business',
    entityId: input.businessId,
    metadata: { status: input.status },
  });
}

/**
 * Re-triggers verification when a KYB-relevant field changes.
 *
 * Without this, verification drifts from reality: a business verified under one
 * legal name could silently change it and keep the verified badge (TASK-02
 * caveat).
 */
export async function invalidateVerification(businessId: string, reason: string): Promise<void> {
  await getDb()
    .update(businesses)
    .set({
      verificationStatus: 'pending',
      verificationNotes: `Re-verification required: ${reason}`,
      verifiedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, businessId));

  await requestKybVerification(businessId);
}
