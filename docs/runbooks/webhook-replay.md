# Runbook — Stripe webhook failures and replay

## How the path works

1. Stripe POSTs to `/api/webhooks/stripe`.
2. The handler reads the **raw body** and verifies the signature.
3. It claims the event by inserting into `processed_webhook_events` — the unique
   index on the event id is the deduplication lock.
4. It enqueues to the `stripe-events` queue and returns 2xx fast.
5. The worker re-fetches the event from Stripe and applies it to the mirror.

## Symptom: signature verification failures

Look for `billing.webhook.signature_rejected` in `audit_log`, or
`stripe webhook signature verification failed` in the logs.

Almost always one of:

- **Wrong `STRIPE_WEBHOOK_SECRET`.** Each endpoint in the Stripe dashboard has
  its own secret, and test and live mode differ. Check which endpoint is firing.
- **The body was parsed before verification.** `constructEvent` hashes the exact
  bytes Stripe sent. If someone changes the route to use `req.json()`, every
  signature fails. The raw read must stay first.
- **Genuine forgery.** If the secret is right and the body is raw, treat it as a
  security event and escalate.

## Symptom: a subscription looks wrong in the app

Stripe is the source of truth; the mirror is a cache.

1. Have the user press **Refresh** on `/dashboard/billing`, or run
   `reconcileFromStripe(userId)`. This re-reads Stripe and overwrites the mirror.
2. If it corrects itself, a webhook was missed. Check the Stripe dashboard's
   webhook delivery log for failures around that time.

## Symptom: events are queued but never applied

Check `processed_webhook_events` for rows with `processed_at IS NULL` and a
rising `attempts`:

```sql
SELECT stripe_event_id, event_type, attempts, last_error, received_at
FROM processed_webhook_events
WHERE processed_at IS NULL
ORDER BY received_at DESC
LIMIT 50;
```

`last_error` tells you why. Fix the cause, then replay from the Stripe dashboard
(Developers → Webhooks → the event → Resend). Replaying is safe — the handlers
are idempotent.

## Replaying an event that was claimed but failed

The inline fallback path deletes its claim row on failure precisely so a retry
is not mistaken for a duplicate. If you need to force a replay of an event whose
claim row is present and `processed_at` is set, delete the row first:

```sql
DELETE FROM processed_webhook_events WHERE stripe_event_id = 'stripe:evt_...';
```

Then resend from Stripe. Only do this when you have established that the event
was *not* applied — otherwise you will double-apply it.

## Never do this

Do not mark a user as paid by hand to "fix" a webhook problem. Entitlements are
derived from the mirror, and the mirror is derived from Stripe. Editing the
middle of that chain produces a state that the next reconcile silently reverts,
and an entitlement nobody can explain.
