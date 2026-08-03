# TASK-04 — Stripe billing & subscriptions

**Phase:** 2 · **Owner:** Backend lead · **Depends on:** TASK-01, TASK-02 · **Consulted:** Product, Security

## Objective

Let verified members subscribe to a plan, manage their subscription, and see accurate billing state — with Stripe as the source of truth and the local database as a webhook-updated mirror that entitlement checks read from.

## Scope

**In:** plan modeling in Stripe + local mirror, Checkout (self-serve), Customer Portal, webhook receipt + processing, mirrored subscriptions/invoices, entitlement flip, Subscriptions & Billing UI, Enterprise Contact-Sales flow, dunning, one-off product purchases, Stripe Tax.
**Out:** the report/monitoring features that entitlements unlock (TASK-05), marketing pricing page (TASK-03).

## Implementation details

**Plan modeling.** Create Stripe Products + recurring monthly Prices for Starter/Professional/Enterprise; mirror each into the local `plans` table with `stripe_product_id`, `stripe_price_id`, display fields, and a machine-readable `entitlements` object. The app gates features on the local entitlements, never on live Stripe reads.

**Customer + Checkout.** On first billing action, create (or reuse) one Stripe Customer per user/business. "Subscribe" (Starter/Professional) opens a Stripe-hosted Checkout Session in subscription mode with success/cancel URLs. Card data goes directly to Stripe — the platform never sees raw card numbers (keeps PCI scope at SAQ A).

**Customer Portal.** Card updates, plan changes, cancellation, and invoice history are delegated to the hosted Stripe Customer Portal. "Add Card," "Manage plan," "Cancel" deep-link into a Portal session. Configure the Portal for upgrade-now-with-proration and downgrade-at-next-cycle.

**Webhooks.** A dedicated endpoint receives Stripe events. It must verify the signature against the **raw request body**, be idempotent on event ids, and enqueue processing to the worker rather than doing heavy work inline (return 2xx fast). Worker handlers update `subscriptions`/`invoices` and flip entitlements. Handle at minimum: checkout.session.completed; customer.subscription.created/updated/deleted/paused/resumed; invoice.paid; invoice.payment_failed; invoice.finalized; payment_method.attached/detached.

**Billing UI.** Reproduce the reference: summary tiles (plan price, lifetime total paid, paid-invoice count, status, period end, days remaining) with a Refresh (re-sync from Stripe); "No active subscription" state; payment-method panel (brand + last4 or "Add card"); plan options with the "upgrades prorate immediately, downgrades next cycle" note; billing history (invoice amounts, outcomes, PDF links) with a "No invoices yet" empty state.

**Enterprise.** "Contact Sales" submits a lead; staff provision the subscription (or send a Stripe Invoice for invoice-based billing) and grant Enterprise entitlements via an admin action. No self-serve checkout.

**Dunning.** On payment failure, set status `past_due`, restrict entitlements per the grace policy, and rely on Stripe Smart Retries + reminder emails. On final failure, downgrade to Free. Show a persistent "update your card" banner.

**One-off purchases.** Products/My Purchases use Payment Intents/Checkout in payment mode; record `purchases` on payment success.

**Tax.** Enable Stripe Tax if selling across states; Stripe-hosted invoices/receipts are the billing system of record.

## Data touched

`plans`, `subscriptions`, `invoices`, `purchases`, `audit_log`. (Mirror only — Stripe is source of truth.)

## Test scenarios

**Happy path**
- Given a verified member, when they subscribe to Starter, then Checkout completes, the webhook updates the mirror to `active`, and Starter entitlements unlock.
- Given an active subscriber, when they open the Portal and upgrade, then the change is prorated immediately and reflected in the mirror.
- Given a downgrade, when submitted, then it takes effect at the next cycle (not immediately).
- Given paid invoices, when the billing history loads, then amounts, outcomes, and PDF links render.

**Edge**
- Given a user who abandons Checkout, when they return, then no subscription exists and they can retry cleanly.
- Given a duplicate webhook delivery, when processed, then the event is applied once (idempotent) with no double state change.
- Given an Enterprise lead, when staff provision it, then entitlements match Enterprise without a self-serve Checkout.

**Failure**
- Given a failed renewal, when the webhook arrives, then status becomes `past_due`, entitlements restrict per policy, and the update-card banner shows.
- Given repeated renewal failure, when Stripe finalizes cancellation, then the user is downgraded to Free.
- Given a webhook the worker fails to process, when it errors, then it retries and, if still failing, dead-letters with an alert; a reconciliation job can re-sync from Stripe.
- Given a missed webhook, when the Refresh control is used, then the mirror re-syncs from Stripe to the correct state.

**Security**
- Given a webhook with an invalid/missing signature, when received, then it is rejected (no state change).
- Given a client POST claiming "I paid," when received, then it is ignored — only verified Stripe events change billing state.
- Given a user requesting another user's invoices, when the guard runs, then it is denied and audited.
- Given the request path, when entitlements are checked, then no live Stripe call is made (reads the mirror only).

## Caveats

- **Raw body for signatures.** In Next.js route handlers you must read the raw body before verifying the Stripe signature; a parsed/re-serialized body breaks verification. This is the most common Stripe-on-Vercel bug.
- **Never trust the client for payment state.** The post-checkout redirect is UX only; entitlements flip on verified webhooks, not on the success page.
- **Idempotency is mandatory.** Stripe retries webhooks; without a processed-event store you will double-apply changes.
- **Proration and downgrade timing** must match the UI promise exactly, or users will dispute charges. Test both directions.
- **Mirror drift.** If a webhook is missed, the mirror can lag Stripe. Provide the Refresh/reconcile path and treat Stripe as authoritative when they disagree.
- **PCI scope creep.** Do not proxy or log card fields; keep everything card-related inside Stripe-hosted surfaces to stay in SAQ A.
- **Test-mode vs live keys.** A live key in staging can charge real cards. Isolate per environment.

## Definition of done

Subscribe/upgrade/downgrade/cancel all work against Stripe test mode; webhooks verify signatures, are idempotent, and drive the mirror; entitlements flip correctly and are read from the mirror; billing UI matches the reference; dunning downgrades on final failure; all four test buckets pass.
