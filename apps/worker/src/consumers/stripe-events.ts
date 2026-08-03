import { getStripe, mapWebhookEvent } from '@machai/billing';
import { applyBillingEvent } from '@machai/billing-sync';
import { eq, getDb, processedWebhookEvents, sql } from '@machai/db';
import { logger } from '@machai/observability';
import { enqueue } from '@machai/queue';
import type { StripeEventJob } from '@machai/types';

/**
 * Stripe event consumer (spec §10.6).
 *
 * The web endpoint already verified the signature and claimed the event id, so
 * this handler is trusted to run — but it re-FETCHES the event from Stripe
 * rather than trusting a payload carried through the queue. Two reasons: the
 * queue payload stays tiny, and re-fetching means the handler always applies
 * Stripe's current view rather than a snapshot that may be minutes stale by the
 * time a retry runs.
 */
export async function handleStripeEvent(payload: StripeEventJob): Promise<void> {
  const log = logger.child({ consumer: 'stripe-events', eventType: payload.eventType });
  const db = getDb();

  const [record] = await db
    .select()
    .from(processedWebhookEvents)
    .where(eq(processedWebhookEvents.stripeEventId, `stripe:${payload.eventId}`))
    .limit(1);

  if (record?.processedAt) {
    log.info('stripe event already processed; skipping');
    return;
  }

  await db
    .update(processedWebhookEvents)
    .set({ attempts: sql`${processedWebhookEvents.attempts} + 1` })
    .where(eq(processedWebhookEvents.stripeEventId, `stripe:${payload.eventId}`));

  try {
    const event = await getStripe().events.retrieve(payload.eventId);
    await applyBillingEvent(mapWebhookEvent(event), {
      enqueue: (queue, jobKey, data) =>
        enqueue(queue as never, jobKey, data as never),
    });

    await db
      .update(processedWebhookEvents)
      .set({ processedAt: new Date(), lastError: null })
      .where(eq(processedWebhookEvents.stripeEventId, `stripe:${payload.eventId}`));

    log.info('stripe event applied', { eventId: payload.eventId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(processedWebhookEvents)
      .set({ lastError: message.slice(0, 1000) })
      .where(eq(processedWebhookEvents.stripeEventId, `stripe:${payload.eventId}`));

    // Rethrow so the queue retries with backoff and eventually dead-letters.
    // Swallowing here would lose a billing state change permanently.
    throw error;
  }
}
