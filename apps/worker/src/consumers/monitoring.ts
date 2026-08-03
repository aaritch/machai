import {
  and,
  businesses,
  eq,
  getDb,
  isNull,
  plans,
  subscriptions,
  users,
} from '@machai/db';
import { resolveEntitlements } from '@machai/entitlements';
import { logger } from '@machai/observability';
import { enqueue } from '@machai/queue';
import { QUEUE_NAMES, reportPullIdempotencyKey, type MonitoringJob } from '@machai/types';

/**
 * Scheduled score monitoring (spec §7.2, TASK-05).
 *
 * Enqueues a normal report pull rather than calling the bureau directly, so
 * monitoring inherits the same metering, idempotency, and eligibility checks
 * as a user-initiated pull. A monitoring run that bypassed the allowance would
 * be the easiest way to accidentally run up a data-provider bill.
 */
export async function handleMonitoring(payload: MonitoringJob): Promise<void> {
  const log = logger.child({ consumer: 'monitoring', bureau: payload.bureau });

  const [business] = await getDb()
    .select({ id: businesses.id, ownerUserId: businesses.ownerUserId })
    .from(businesses)
    .where(and(eq(businesses.id, payload.businessId), isNull(businesses.deletedAt)))
    .limit(1);

  if (!business) return;

  await enqueue(
    QUEUE_NAMES.reportPull,
    `monitor:${payload.businessId}:${payload.bureau}:${new Date().toISOString().slice(0, 10)}`,
    {
      businessId: business.id,
      bureau: payload.bureau,
      requestedByUserId: business.ownerUserId,
      idempotencyKey: reportPullIdempotencyKey(business.id, payload.bureau),
    },
  );

  log.info('monitoring pull enqueued', { businessId: business.id });
}

/**
 * Selects the businesses due for a monitoring refresh.
 *
 * Only accounts whose plan actually includes monitoring — checking a file for
 * someone not paying for monitoring costs money and delivers nothing.
 */
export async function findMonitoringTargets(): Promise<
  { businessId: string; bureaus: MonitoringJob['bureau'][] }[]
> {
  const rows = await getDb()
    .select({
      businessId: businesses.id,
      verificationStatus: businesses.verificationStatus,
      status: subscriptions.status,
      entitlements: plans.entitlements,
    })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerUserId))
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .where(isNull(businesses.deletedAt));

  const targets: { businessId: string; bureaus: MonitoringJob['bureau'][] }[] = [];

  for (const row of rows) {
    if (row.verificationStatus !== 'verified') continue;
    const entitlements = resolveEntitlements(
      row.status ? { status: row.status, planEntitlements: row.entitlements ?? null, currentPeriodEnd: null } : null,
    );
    if (!entitlements.monitoring || entitlements.bureausAllowed.length === 0) continue;
    targets.push({ businessId: row.businessId, bureaus: entitlements.bureausAllowed });
  }

  return targets;
}
