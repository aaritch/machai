import { NextResponse, type NextRequest } from 'next/server';
import {
  isHandledEvent,
  mapWebhookEvent,
  verifyWebhookSignature,
} from '@machai/billing';
import { applyBillingEvent } from '@machai/billing-sync';
import { eq, getDb, isDatabaseConfigured, processedWebhookEvents, writeAudit } from '@machai/db';
import { AUDIT_ACTIONS, logger } from '@machai/observability';
import { enqueue, hasQueue } from '@machai/queue';
import { AppError, QUEUE_NAMES } from '@machai/types';

/**
 * Stripe webhook endpoint (spec §10.6, §15.2).
 *
 * Three things this must get right, in order:
 *
 *  1. RAW BODY. `constructEvent` hashes the exact bytes Stripe sent. Reading
 *     the body any other way — `req.json()`, or parse-then-restringify —
 *     changes key order and whitespace and the signature check fails. This is
 *     the single most common Stripe-on-Vercel bug, so the raw text is read
 *     first, before anything else touches the request.
 *
 *  2. IDEMPOTENCY. Stripe retries. The insert on `stripeEventId` is the lock:
 *     a duplicate delivery loses the conflict and returns 200 without
 *     re-applying anything.
 *
 *  3. RETURN FAST. Heavy work is enqueued to the worker tier. Stripe times out
 *     at 20 seconds and starts retrying; a slow handler turns one event into
 *     several.
 */

// Node runtime, never edge: signature verification needs Node crypto.
export const runtime = 'nodejs';
// Never cached, never statically analysed — this endpoint mutates billing state.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Step 1: raw bytes, before anything else reads the body.
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;
  try {
    event = verifyWebhookSignature(rawBody, signature);
  } catch (error) {
    // A signature failure is a security event: either a misconfigured secret or
    // someone forging billing state. Alert on it (TASK-08).
    logger.error('stripe webhook signature verification failed', {
      hasSignature: Boolean(signature),
      error,
    });
    await writeAudit({
      actorId: null,
      action: AUDIT_ACTIONS.WEBHOOK_SIGNATURE_REJECTED,
      entityType: 'webhook',
      entityId: null,
      metadata: { hasSignature: Boolean(signature) },
    });
    const status = error instanceof AppError ? error.status : 400;
    return NextResponse.json({ error: 'signature verification failed' }, { status });
  }

  if (!isDatabaseConfigured()) {
    // Returning 500 makes Stripe retry, which is what we want — the event is
    // not lost, it is redelivered once the database is back.
    logger.error('stripe webhook received with no database configured', { eventId: event.id });
    return NextResponse.json({ error: 'not ready' }, { status: 500 });
  }

  // Step 2: claim the event. A duplicate delivery stops here.
  const claimed = await getDb()
    .insert(processedWebhookEvents)
    .values({ stripeEventId: `stripe:${event.id}`, eventType: event.type })
    .onConflictDoNothing({ target: processedWebhookEvents.stripeEventId })
    .returning({ id: processedWebhookEvents.id });

  if (claimed.length === 0) {
    logger.info('duplicate stripe webhook ignored', { eventId: event.id, type: event.type });
    return NextResponse.json({ received: true, duplicate: true });
  }

  await writeAudit({
    actorId: null,
    action: AUDIT_ACTIONS.WEBHOOK_RECEIVED,
    entityType: 'webhook',
    entityId: null,
    metadata: { eventType: event.type },
  });

  if (!isHandledEvent(event.type)) {
    await markProcessed(event.id);
    return NextResponse.json({ received: true, handled: false });
  }

  // Step 3: hand off and return.
  if (hasQueue()) {
    await enqueue(QUEUE_NAMES.stripeEvents, `stripe-event:${event.id}`, {
      eventId: event.id,
      eventType: event.type,
    });
    return NextResponse.json({ received: true, queued: true });
  }

  // No queue configured. Applying inline is a deliberate fallback: dropping a
  // billing event is far worse than a slower response, and these handlers are
  // small database writes rather than long jobs.
  try {
    await applyBillingEvent(mapWebhookEvent(event), { enqueue: () => Promise.resolve(false) });
    await markProcessed(event.id);
    return NextResponse.json({ received: true, queued: false });
  } catch (error) {
    logger.error('failed to apply stripe event inline', { eventId: event.id, error });
    await recordFailure(event.id, error);
    // 500 so Stripe retries. The idempotency row is released below so the
    // retry is not treated as a duplicate.
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}

async function markProcessed(eventId: string): Promise<void> {
  await getDb()
    .update(processedWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(processedWebhookEvents.stripeEventId, `stripe:${eventId}`));
}

/**
 * Records the failure and DELETES the claim row.
 *
 * Without the delete, the failed event would be treated as a duplicate on
 * retry and silently skipped forever — the claim row would have turned a
 * transient error into permanent data loss.
 */
async function recordFailure(eventId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await getDb()
    .delete(processedWebhookEvents)
    .where(eq(processedWebhookEvents.stripeEventId, `stripe:${eventId}`));
  logger.warn('released webhook claim for retry', { eventId, reason: message.slice(0, 200) });
}
