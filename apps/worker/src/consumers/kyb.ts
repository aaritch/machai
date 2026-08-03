import { businesses, decryptField, eq, getDb, representatives, writeAudit } from '@machai/db';
import { getKybAdapter } from '@machai/kyb';
import { AUDIT_ACTIONS, logger } from '@machai/observability';
import { enqueue } from '@machai/queue';
import { QUEUE_NAMES, type KybJob } from '@machai/types';

/** Attempts after which a business is left pending for staff to pick up. */
const MAX_AUTOMATED_ATTEMPTS = 5;

/**
 * KYB retry consumer.
 *
 * Exists for one scenario: the provider was unavailable at signup. Rather than
 * hard-failing a legitimate business, verification is queued and retried
 * (TASK-02 failure scenario). After a handful of attempts it stops and stays
 * pending — a human decision is better than an infinite retry loop.
 */
export async function handleKyb(payload: KybJob): Promise<void> {
  const log = logger.child({ consumer: 'kyb' });
  const db = getDb();

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, payload.businessId))
    .limit(1);

  if (!business) return;
  if (business.verificationStatus === 'verified' || business.verificationStatus === 'rejected') {
    return;
  }

  const [rep] = await db
    .select()
    .from(representatives)
    .where(eq(representatives.businessId, business.id))
    .limit(1);

  const decision = await getKybAdapter().verify({
    businessId: business.id,
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
    .where(eq(businesses.id, business.id));

  await writeAudit({
    actorId: business.ownerUserId,
    action: AUDIT_ACTIONS.KYB_DECIDED,
    entityType: 'business',
    entityId: business.id,
    metadata: { status: decision.status, attempt: payload.attempt },
  });

  if (decision.retryable && payload.attempt < MAX_AUTOMATED_ATTEMPTS) {
    await enqueue(
      QUEUE_NAMES.kyb,
      `kyb:${business.id}:${payload.attempt + 1}`,
      { businessId: business.id, attempt: payload.attempt + 1 },
      // Back off in hours, not seconds: a provider outage does not resolve in
      // the time an exponential queue backoff would allow.
      { delayMs: Math.min(6, payload.attempt + 1) * 3_600_000 },
    );
  } else if (decision.retryable) {
    log.warn('kyb still unresolved after automated attempts; left for staff review', {
      businessId: business.id,
    });
  }
}
