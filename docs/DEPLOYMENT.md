# Deployment

Two deployables, deployed separately, for the reason in spec §15.2: Vercel
functions are stateless and time-limited, and the worker is neither.

---

## 1. Web app → Vercel

### Project settings

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| **Root Directory** | `apps/web` |
| Install command | *(leave default — Vercel detects pnpm workspaces and installs from the repo root)* |
| Build command | *(default: `next build`)* |
| Node version | 22.x |

Root Directory is the one that catches people out. Point it at `apps/web`;
Vercel still installs from the workspace root, so `workspace:*` dependencies
resolve.

### Environment variables

Set these in **Project → Settings → Environment Variables**, per environment.
`.env.example` documents every key.

**Required in production** — the app refuses to boot without them, by design:

```
DATABASE_URL              pooled endpoint
SESSION_SECRET            32+ random bytes
STRIPE_SECRET_KEY         sk_live_… (a test key in production is rejected)
STRIPE_WEBHOOK_SECRET     whsec_…
ENCRYPTION_KEY            32 bytes base64, or set ENCRYPTION_PROVIDER=kms + KMS_KEY_ID
APP_ENV                   production
NEXT_PUBLIC_APP_URL       https://your-domain
```

**Strongly recommended:**

```
DATABASE_URL_UNPOOLED     direct endpoint, for migrations
REDIS_URL                 queue + rate limiting
STORAGE_*                 report PDFs
EMAIL_PROVIDER=resend + RESEND_API_KEY     (production refuses the console provider)
SENTRY_DSN
```

**Leave off until they are true:**

```
REPORTING_LIVE_CREDITSAFE=false
REPORTING_LIVE_EQUIFAX_BUSINESS=false
REPORTING_LIVE_DNB=false
BUREAU_MODE=mock
```

These gate every "reports to X bureau" claim in the product. Turning one on is a
Legal/Compliance decision that follows that bureau approving us as a data
furnisher — see [ADR-0005](adr/0005-direction-b-deferred.md).

### Preview deployments

Vercel builds a preview per PR automatically. Give preview environments their
own database, their own **Stripe test keys**, and `APP_ENV=staging`. Config
rejects a live Stripe key outside production and refuses `BUREAU_MODE=live`
anywhere but production, so a mistake here fails at boot rather than charging a
real card.

### Stripe webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint.
2. URL: `https://your-domain/api/webhooks/stripe`
3. Events: `checkout.session.completed`, `customer.subscription.*`,
   `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`,
   `payment_method.attached`, `payment_method.detached`,
   `payment_intent.succeeded`
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`. Each endpoint has its
   own; test and live differ.

---

## 2. Database

Managed Postgres — Neon or Supabase pair well with Vercel.

```bash
# Use the DIRECT endpoint for migrations, not the pooler.
DATABASE_URL_UNPOOLED=... pnpm db:migrate -- --dry-run
DATABASE_URL_UNPOOLED=... pnpm db:migrate
DATABASE_URL=...          pnpm db:seed
```

Migrations are **never** run by a deploy pipeline. See
[the runbook](runbooks/migrations.md).

Before going live, set up the restricted application role so `audit_log` is
append-only at the database level: [database-roles.md](runbooks/database-roles.md).

---

## 3. Worker → anywhere but Vercel

Decision D8 (Render / Railway / Fly / ECS) is open; the worker is a standard
container so the choice does not affect the code.

```bash
docker build -f apps/worker/Dockerfile -t machai-worker .
docker run -p 3001:3001 --env-file .env machai-worker
```

`deploy-worker.yml` builds and pushes to GHCR on merge to `main`. Wire the
host's deploy action into the `deploy` job's `production-worker` environment
once D8 closes.

The worker needs the same `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`,
`STRIPE_SECRET_KEY`, storage, and email configuration as the web app. Its health
endpoint is `GET /health` on `WORKER_PORT`.

---

## 4. Before you call it live

Working through this list is what separates "it deploys" from "it is safe to
put customers on".

**Infrastructure**

- [ ] Three environments with **isolated** credentials — dev, staging, production
- [ ] Pooled connection string used by the web app; direct one only for migrations
- [ ] Object storage bucket created with **public access blocked**
- [ ] Automated backups on, and a restore drill actually performed
- [ ] Uptime checks on `/api/health` and the worker's `/health`
- [ ] Sentry configured with the PII scrubber wired into `beforeSend`

**Billing**

- [ ] Stripe Products and Prices created; ids in `STRIPE_PRICE_*`; `pnpm db:seed` run
- [ ] Customer Portal configured for upgrade-now-prorated, downgrade-at-cycle-end
- [ ] Stripe Tax enabled if selling across states
- [ ] End-to-end test in test mode: subscribe, upgrade, downgrade, cancel, failed payment

**Security**

- [ ] `ENCRYPTION_PROVIDER=kms` with a real KMS key (not a local key)
- [ ] Restricted database role in place; `audit_log` update/delete revoked
- [ ] Secret scanning green on the default branch
- [ ] Verified an EIN is ciphertext at rest and absent from every log sink

**Legal — none of these are engineering sign-offs**

- [ ] Terms of Service and Privacy Policy replaced with counsel-reviewed text
      (both currently ship with a visible draft banner)
- [ ] Bureau **pull** data agreement signed before `BUREAU_MODE=live`
- [ ] Every `REPORTING_LIVE_*` flag still false unless that bureau has approved
      us as a data furnisher
- [ ] Marketing copy reviewed against the no-guaranteed-outcomes requirement
- [ ] Permissible-purpose posture for report pulls confirmed
