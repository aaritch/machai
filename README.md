# Machai — Business Credit Platform

A subscription SaaS that helps small-business owners establish and monitor
**business credit using their EIN**, not their personal SSN. Live bureau
reports, score monitoring, a tradeline tracker, and a credit checklist.

Built against the specification, project plan, and task files in [`build/`](build/).

---

## What is here

| | |
|---|---|
| **Marketing site** | Home, pricing, contact→ticket, help center, education, legal — server-rendered and statically generated |
| **Accounts** | Three-step resumable wizard (Business → Representative → Account), email verification, password reset, TOTP for staff |
| **Billing** | Stripe Checkout, Customer Portal, signature-verified idempotent webhooks, mirrored subscriptions and invoices |
| **Credit data** | Report pulls behind a `BureauClient` abstraction, score history, tradeline tracker, checklist, achievements, dispute intake |
| **Support** | Public contact form and member/staff ticket threads |
| **Worker** | Queue consumers and scheduled jobs, deployed off Vercel |

### What is deliberately not here

**Bureau furnishing (Direction B) is not implemented.** Reporting tradelines
*to* bureaus requires per-bureau data-furnisher approval and legal review, and
neither exists. `buildSubmissionFile` throws unconditionally, and the
eligibility guard structurally rejects the two arrangements bureaus disqualify
furnishers for. Every "reports to X bureau" claim is gated behind a per-bureau
`reporting_live` flag that is off. See
[ADR-0005](docs/adr/0005-direction-b-deferred.md).

---

## Quick start

Requires Node 20+ and pnpm 9.

```bash
pnpm install
cp .env.example .env     # marketing pages work with no further config
pnpm dev
```

Open http://localhost:3000. The public site renders from seed content with no
database attached.

### Full local environment

```bash
# 1. Generate the secrets the app needs
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"

# 2. Point DATABASE_URL at a Postgres instance, then
pnpm db:migrate
pnpm db:seed

# 3. Run both apps
pnpm dev
```

Accounts, the dashboard, and the queue need `DATABASE_URL`. Redis is optional —
the queue falls back to a Postgres-backed driver so a job still round-trips from
web to worker. Bureau calls run against a deterministic mock unless
`BUREAU_MODE=live`, which config refuses outside production.

### Commands

```bash
pnpm dev          # web + worker
pnpm build        # build everything
pnpm typecheck    # tsc across all packages and apps
pnpm lint         # eslint
pnpm test         # vitest — 106 tests, no external services needed
pnpm db:generate  # generate a migration from the schema
pnpm db:migrate   # apply migrations (refuses destructive ones — see the runbook)
pnpm db:seed      # idempotent seed: plans, checklist, achievements, help content
```

---

## Repository shape

```
apps/
  web/       Next.js App Router — marketing + dashboard. Deploys to Vercel.
  worker/    Always-on Node service — queue consumers + scheduler. Deploys OFF Vercel.
packages/
  types/          Domain types, DTOs, Zod schemas, job payloads — the contract hub
  config/         Fail-fast env loading, plan catalog, bureau capability gating
  db/             Drizzle schema, migrations, seed, field-level encryption
  entitlements/   Plan → capability resolution. The single gating authority.
  billing/        Stripe boundary. Returns domain objects; never writes to the DB.
  billing-sync/   Applies billing domain events to the mirror. Shared by both apps.
  bureau-clients/ BureauClient interface, mock + live clients, normalization
  queue/          BullMQ and Postgres drivers behind one producer contract
  kyb/            Know-Your-Business adapter (manual review queue by default)
  emails/         Templates + provider adapter
  storage/        Private object storage, signed URLs only
  observability/  Structured logging with PII scrubbing, audit vocabulary
  ui/             Design-system primitives
docs/
  adr/            Architecture decision records
  runbooks/       Migrations, webhook replay, incident response, database roles
build/            The specification, project plan, task files, and STATE.md
```

---

## Invariants

These hold everywhere. A change that breaks one is a design error, not a
trade-off (STATE.md §8).

- **Authorization is server-side.** Frontend gating is cosmetic; the backend
  re-checks ownership *and* entitlement on every sensitive call, and audits it.
- **EIN is encrypted at rest** with a per-record data key, and never appears in
  logs, analytics, or error traces. Only the last four are stored in the clear.
- **No SSN is collected.** The column does not exist.
- **Stripe is the billing source of truth.** Only signature-verified, idempotent
  webhooks change billing state. Never a client redirect.
- **Anything that can retry is idempotent** — webhooks, jobs, achievement awards,
  report pulls.
- **Private files are reachable only through signed, expiring URLs.**
- **No guaranteed-outcome marketing**, and no bureau reporting claim ahead of an
  approved furnisher agreement.
- **Long or scheduled work runs on the worker tier**, never inside a Vercel
  function.

---

## Testing

```bash
pnpm test
```

106 tests across the four buckets the task files require — happy path, edge,
failure, and security. They cover EIN/phone/ZIP validation and normalization,
encryption round-trips and tamper-detection, the PII scrubber (asserting the
value is *absent* from output), entitlement resolution and pull eligibility,
bureau payload normalization and drift flagging, the furnishing guard,
configuration fail-fast rules, reporting-claim gating, password hashing and
lockout escalation, TOTP, and derived onboarding state.

No external service is required, so CI is hermetic.

---

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). In short: Vercel with Root
Directory `apps/web` for the web app; a container on Render/Railway/Fly/ECS for
the worker; managed Postgres with a pooled endpoint; migrations applied by hand.

---

## Where to start reading

- [`build/STATE.md`](build/STATE.md) — build tracker, task board, open decisions
- [`build/business-credit-platform-spec.md`](build/business-credit-platform-spec.md) — the specification
- [`docs/adr/`](docs/adr/) — why things are the way they are
- `packages/types/src/index.ts` — the vocabulary everything else is written in
