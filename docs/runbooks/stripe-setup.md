# Runbook — Connecting Stripe

The application code is complete: Checkout, the Customer Portal, signature-verified
idempotent webhooks, and the subscription/invoice mirror all exist (TASK-04).
What follows is configuration only.

**Do this in test mode first.** Everything below works identically with test
keys, and `packages/config` refuses to boot a live key outside production, so a
mistake fails at startup rather than charging a real card.

---

## 1. Create the Products and Prices

Stripe Dashboard → **Product catalogue** → *Add product*. Three of them, each
with a **recurring monthly** price:

| Product name | Price | Recurrence |
|---|---|---|
| Foundation | $25.00 USD | Monthly |
| Growth | $45.00 USD | Monthly |
| Premier | $99.00 USD | Monthly |

After saving each one, open it and copy the **Price ID** — it looks like
`price_1Abc...`. Note it is the *price* ID, not the product ID (`prod_...`);
using the product ID is the most common mistake here and Checkout will reject it.

## 2. Copy the API keys

Dashboard → **Developers → API keys**.

- **Secret key** (`sk_test_...`) → `STRIPE_SECRET_KEY`
- **Publishable key** (`pk_test_...`) → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

The secret key is shown once. If you lose it, roll it rather than hunting for it.

## 3. Create the webhook endpoint

Dashboard → **Developers → Webhooks** → *Add endpoint*.

- **URL:** `https://machai-web.vercel.app/api/webhooks/stripe`
- **Events to send** — exactly these twelve:

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
invoice.paid
invoice.payment_failed
invoice.finalized
payment_method.attached
payment_method.detached
payment_intent.succeeded
```

Save, then copy the **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.

Each endpoint has its own signing secret, and test and live differ. Using the
wrong one makes every webhook fail signature verification — see
`webhook-replay.md`.

## 4. Configure the Customer Portal

Dashboard → **Settings → Billing → Customer portal**. The application delegates
card updates, plan changes, and cancellation here rather than rebuilding them,
so the portal's own settings are what customers experience.

Set it to match what the pricing page promises (`PRORATION_NOTE`):

- Allow customers to **update payment methods** — on
- Allow customers to **cancel subscriptions** — on, *at end of billing period*
- Allow customers to **switch plans** — on, with **proration** on upgrade
- Add the three products above to the plan-switching list

## 5. Set the variables

Eight in total. In the Vercel dashboard (**Settings → Environment Variables**,
Production), or by CLI:

```bash
vercel env add STRIPE_SECRET_KEY production --value sk_test_... --sensitive --yes
```

Note the CLI needs `--value`; a piped value is silently stored as an empty
string.

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STRIPE_PRICE_STARTER` | Foundation's price ID |
| `STRIPE_PRICE_PROFESSIONAL` | Growth's price ID |
| `STRIPE_PRICE_ENTERPRISE` | Premier's price ID |

The three `STRIPE_PRICE_*` names keep their original plan codes deliberately —
those are the internal identifiers, and they do not churn when display names
change. Foundation is `starter`, Growth is `professional`, Premier is
`enterprise`.

## 6. Seed and deploy

```bash
pnpm db:seed        # writes the price IDs into the plans table
vercel --prod --force --yes
```

The seed is what connects a plan row to its Stripe price. Until it runs with the
variables set, Checkout returns "This plan is not yet connected to billing."

## 7. Verify before taking real money

Use Stripe's test cards (`4242 4242 4242 4242`, any future expiry, any CVC).

- [ ] Subscribe to Foundation → Checkout completes → the billing page shows
      **Active** and the plan name
- [ ] The webhook shows **succeeded** in the Stripe dashboard's event log
- [ ] `subscriptions` and `invoices` rows exist in the database
- [ ] Upgrade Foundation → Growth in the Portal → charged prorated immediately
- [ ] Downgrade Growth → Foundation → takes effect next cycle, not immediately
- [ ] Cancel → access continues to period end
- [ ] Failed payment (`4000 0000 0000 0341`) → status `past_due`, the
      update-card banner appears, access continues through the grace window
- [ ] Press **Refresh** on the billing page → mirror re-syncs from Stripe

## 8. Going live

Repeat steps 1–5 with live-mode keys. **Live mode has its own products, prices,
webhook endpoint, and signing secret** — nothing carries over from test.

Before you switch, note `docs/DEPLOYMENT.md`: production also needs
`DATABASE_URL`, `SESSION_SECRET`, and `ENCRYPTION_KEY` set, and `APP_ENV` set to
`production`. Set `APP_ENV` last — it is the switch that makes the app refuse to
boot without the others, which is the behaviour you want but will fail the
deploy until the rest are in place.

---

## Security

**Never paste a secret key into a chat, an issue, or a commit.** `.gitignore`
and `.vercelignore` both exclude `.env`, and CI runs gitleaks over full history,
but the cheapest control is not putting it anywhere it does not belong.

If a key is exposed, roll it in the dashboard rather than reasoning about who
saw it — Developers → API keys → *Roll key*. The old key stops working
immediately.

The same applies to the account password itself. Stripe moves real money, so
2FA on the account is not optional in practice.
