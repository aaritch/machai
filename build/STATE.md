# STATE.md — Build Tracker

Single source of truth for building the Business Credit Platform, task by task. This file is meant to be read at the start of every work session and updated at the end of it. If you are an AI coding agent or a new developer, read this file top to bottom before writing any code.

- Project: Business Credit Platform (Next.js on Vercel + Node worker, PostgreSQL, Redis/BullMQ, Stripe)
- Companion docs: technical-specification.md, project-plan.md, and the TASK-00..TASK-08 files
- Code: the monorepo at the repository root. See README.md and docs/adr/ for how it is built.
- Last updated: 2026-08-03
- Updated by: Claude (initial build)

---

## 1. How to use this file

This is a stateful checklist, not a spec. The spec and task files say WHAT to build; this file tracks WHERE you are and WHAT to do next.

The work loop, every session:

1. Read Section 4 (Task Board) and Section 5 (Current Focus). Pick the top task whose status is NOT STARTED and whose dependencies are all DONE.
2. Open that task's file (for example TASK-04-billing.md). Build strictly against its Implementation details and satisfy its Definition of done.
3. Write the tests listed in that task's Test scenarios (happy, edge, failure, security) as you go. A task is not DONE until those pass.
4. Before finishing the session, update this file: change the task status, fill in the Notes for that task, add any new blockers to Section 6, and record any decision you made in Section 7.
5. Bump "Last updated" and "Updated by" at the top.

Never skip step 4. The value of this file is that the next person (or the next session) can resume with zero context loss.

---

## 2. Status legend

Use these exact labels in the Status column so the file stays greppable.

- NOT STARTED — no work begun
- IN PROGRESS — actively being built; see Notes for how far
- BLOCKED — cannot proceed; the blocker is listed in Section 6
- IN REVIEW — code complete, tests passing, awaiting review or sign-off
- DONE — merged, tests green, Definition of done met

For anything touching credit data or reporting claims, DONE also requires the sign-off noted in the task file (Legal/Compliance where stated).

---

## 3. Project snapshot (facts a builder needs immediately)

- Frontend and light API: apps/web (Next.js App Router) deployed to Vercel.
- Background and scheduled work: apps/worker (always-on Node service) deployed off Vercel (Render/Railway/Fly/ECS). Vercel functions are time-limited and must not run long jobs.
- Data: managed PostgreSQL with connection pooling. Redis for cache, sessions, and the BullMQ job queue. S3/R2 for private files (signed URLs only).
- Payments: Stripe is the source of truth; local subscriptions/invoices tables are a webhook-updated mirror. Entitlements are read from the mirror, never a live Stripe call in the request path.
- Two bureau directions, kept separate: Direction A = pulling reports (buildable now, TASK-05). Direction B = furnishing/reporting to bureaus (gated on legal + bureau approval, TASK-06).
- Non-negotiable invariants: see Section 8.

---

## 4. Task board

Build order follows dependencies. Do not start a task until every task in its Depends on list is DONE.

| ID | Task | Phase | Depends on | Status | Owner |
|----|------|-------|------------|--------|-------|
| TASK-01 | Foundations and infrastructure | 0 | none | IN REVIEW | |
| TASK-02 | Authentication and onboarding wizard | 1 | TASK-01 | IN REVIEW | |
| TASK-03 | Marketing site and help center | 1 | TASK-01 | IN REVIEW | |
| TASK-04 | Stripe billing and subscriptions | 2 | TASK-01, TASK-02 | IN REVIEW | |
| TASK-05 | Credit report pulling and dashboard (Direction A) | 3 | TASK-02, TASK-04 | IN REVIEW (mock client) | |
| TASK-06 | Bureau furnishing pipeline (Direction B) | 4 | TASK-05 + legal and bureau approval | BLOCKED — not started, by design | |
| TASK-07 | Engagement: checklist, achievements, support, marketplace | 1-3 | TASK-02 | IN REVIEW | |
| TASK-08 | Security, compliance, observability (cross-cutting) | all | TASK-01 | IN PROGRESS (ongoing) | |
| Phase 5 | Affiliate program (partial — enrolment, attribution, commissions) | 5 | TASK-02, TASK-04 | IN REVIEW | |

Nothing is DONE. "IN REVIEW" here means code complete against the task file's
Implementation details, with tests passing — but the Definition of done in
Section 9 also requires provisioned environments, a restore-tested backup, and
Legal/Compliance sign-off on anything touching credit data or reporting claims.
None of those have happened. See Section 6.

Suggested critical path to a launchable product: TASK-01, then TASK-02, then TASK-04, then TASK-05. TASK-03 and TASK-07 can run in parallel once TASK-01/TASK-02 land. TASK-08 controls run alongside every task and are verified continuously. TASK-06 is deferred until its external gates clear.

---

## 5. Current focus

The code for TASK-01 through TASK-05, TASK-07, and TASK-08 exists and builds.
What remains is everything that cannot be written in a repository.

**Next actions, in order:**

1. **Provision the managed services.** Postgres (pooled + direct endpoints),
   Redis, and an S3/R2 bucket with public access blocked. Then run
   `pnpm db:migrate` and `pnpm db:seed`. Until this happens the marketing site
   works and nothing else does.
2. **Create the three environments** in Vercel with isolated credentials, and
   set the required variables from `docs/DEPLOYMENT.md`.
3. **Model the plans in Stripe**, put the Price ids in `STRIPE_PRICE_*`, re-seed,
   and run the end-to-end billing test in test mode (subscribe, upgrade,
   downgrade, cancel, failed payment).
4. **Close decision D8** (worker host) and wire the deploy step in
   `.github/workflows/deploy-worker.yml`.
5. **Replace the Terms and Privacy pages** with counsel-reviewed text. Both ship
   with a visible draft banner and must not go live as they are.
6. **Sign the bureau pull data agreement** before `BUREAU_MODE` moves off `mock`.
   This is the gate on TASK-05 going live (Section 6).

Do not start TASK-06. Its gates are unchanged.

---

## 6. Blockers (open)

List anything preventing progress. Remove when resolved (record the resolution in Section 7).

| Task | Blocker | Owner | Opened | Needed to unblock |
|------|---------|-------|--------|-------------------|
| TASK-05 | Bureau/aggregator PULL data agreement not signed | Product/Legal | 2026-08-03 | Signed data contract with a bureau or reseller (permissible-use terms) |
| TASK-06 | Data-furnisher approval not obtained; legitimate arm's-length tradeline source not confirmed; legal review pending | Legal/Compliance | 2026-08-03 | Legal sign-off plus at least one bureau furnisher approval |

| TASK-01/08 | No managed services provisioned (Postgres, Redis, object storage) and no Vercel project | DevOps | 2026-08-03 | Provision them and set the environment variables in docs/DEPLOYMENT.md |
| TASK-04 | No Stripe account connected; plans not modelled in Stripe | Product/DevOps | 2026-08-03 | Create Products and Prices, set `STRIPE_PRICE_*`, re-seed, run the test-mode end-to-end |
| TASK-03 | Terms of Service and Privacy Policy are placeholders | Legal | 2026-08-03 | Counsel-reviewed text replacing both pages (they ship with a visible draft banner) |

Note: TASK-05 can be built against a sandbox/mock bureau client while the agreement is pending, but must not go live until the contract is signed. It is currently built exactly that way — `BUREAU_MODE=mock`, and config refuses `live` outside production.

---

## 7. Decisions log

Record every material decision so future sessions do not relitigate them. These start OPEN (from the spec's open-questions list) and must be resolved before the dependent task begins.

| # | Decision | Status | Resolution | Date |
|---|----------|--------|------------|------|
| D1 | Final plan names, prices, and feature splits | PROVISIONAL | Starter $19 / Professional $49 / Enterprise $99, mirroring the spec §9.1 model. Entitlements are data (`packages/config/src/plans.ts` → `plans` table), so changing them is a seed re-run, not a code change. Confirm before launch. | 2026-08-03 |
| D2 | Bureau data source for pulling: direct contracts vs aggregator/reseller | OPEN | Built against a deterministic mock client (`BUREAU_MODE=mock`), which STATE.md §6 permits while the agreement is pending. Live client skeletons and per-bureau field maps exist; the endpoint paths and payload shapes need the integration docs that come with a signed contract. | 2026-08-03 |
| D3 | KYB provider choice (or manual review queue for v1) | CLOSED | Manual staff review queue for v1, behind a `KybAdapter` interface. Structural checks run automatically and reject obvious garbage; only a human decision returns `verified`. A Middesk adapter is implemented behind the same interface. | 2026-08-03 |
| D4 | Multiple businesses per user in v1, or exactly one | CLOSED | One business per user in the UI. The schema and queries already support many, so lifting the restriction is a UI change, not a migration. | 2026-08-03 |
| D5 | Auth: managed provider (Clerk/Auth.js/Supabase) vs in-house | CLOSED | In-house. bcrypt cost 12, opaque session tokens stored hashed, idle + absolute expiry, TOTP for staff. Rationale and the argon2 trade-off in docs/adr/0002-authentication.md. | 2026-08-03 |
| D6 | Legitimate source of furnished tradelines for Direction B | OPEN | Unchanged and blocking. This is a business and legal decision. No furnishing code exists — see docs/adr/0005-direction-b-deferred.md. | |
| D7 | ORM choice (Prisma vs Drizzle) | CLOSED | Drizzle. No native query engine to ship into serverless and container images, and it emits readable SQL migrations — which matters because migrations here are human-reviewed. docs/adr/0003-orm-and-database.md. | 2026-08-03 |
| D8 | Worker host (Render/Railway/Fly/ECS) | OPEN | Deferred without blocking: the worker ships as a standard container with a health endpoint and graceful shutdown. CI builds and pushes the image; the deploy step is a stub behind a gated GitHub environment. docs/adr/0007-worker-host-and-queue.md. | |

D2 and D8 remain open but are not blocking further work. D6 must be closed, with
legal, before TASK-06 — and TASK-06 must not begin before it is.

---

## 8. Invariants (never violate, regardless of task)

These are the rules every task must respect. If a change would break one of these, stop and escalate.

- Authorization and money/credit truth are server-side. Client-side gating is cosmetic; the backend re-checks ownership and entitlement on every sensitive call.
- Every sensitive action writes an audit_log entry that references ids, never sensitive values.
- EIN and any SSN fields are encrypted at rest (KMS field-level) and never appear in logs, analytics, error traces, or plaintext columns.
- The product promise is EIN only, no SSN. Do not collect full SSNs unless a specific integration forces it, and then only with legal review and isolation.
- Stripe is the billing source of truth. Never mark a user paid from a client redirect; only verified, signature-checked, idempotent webhooks change billing state.
- Any external system that can retry (webhooks, jobs) is handled idempotently.
- Every "reports to X bureau" claim is driven by a per-bureau reporting_live flag and rendered only when that flag is on. No claim ahead of an approved furnisher agreement.
- No guaranteed-outcome marketing (no promised score increases or funding).
- Private files (report PDFs, uploads) are reachable only via signed, expiring URLs.
- Long or scheduled work runs on the worker tier, never inside a Vercel function.

---

## 9. Definition of done (applies to every task)

A task is DONE only when all of the following hold. This is in addition to the task-specific Definition of done in its own file.

- Server-side validation and authorization enforced (not only client-side).
- Ownership and entitlement checks pass and are audited.
- Sensitive fields encrypted and absent from logs.
- Tests exist and pass for all four buckets in the task file: happy path, edge, failure, security. Critical flows also have end-to-end tests.
- The relevant runbook or architecture decision record is updated.
- For anything touching credit data or reporting claims, Legal/Compliance has signed off.
- This STATE.md is updated: status changed, notes filled, blockers and decisions recorded.

---

## 10. Per-task state detail

One block per task. Keep the Notes current; this is where resume-context lives. Leave the scaffolding in place even when NOT STARTED.

### TASK-01 — Foundations and infrastructure
- Status: IN REVIEW
- Depends on: none | Blocks: all
- File: TASK-01-foundations.md
- Environments up (dev/staging/prod): **no — none provisioned**
- Notes: pnpm + Turborepo monorepo with `apps/web`, `apps/worker`, and 13 shared
  packages. Drizzle schema covering all of spec §4 (27 tables) with a generated
  migration. Idempotent seed. CI runs install, typecheck, lint, test, build,
  gitleaks, and `pnpm audit`. Worker Dockerfile with health endpoint and
  graceful shutdown. Two additions to the planned tree — `packages/queue` and
  `packages/billing-sync` — explained in docs/adr/0001. Queue has both a BullMQ
  and a Postgres driver so a job round-trips without Redis provisioned.
- Verified: monorepo builds; `pnpm typecheck`, `pnpm lint`, `pnpm test` (106
  tests) and `pnpm build` all pass; config fails fast on missing production keys
  (tested); migration runner blocks destructive statements.
- Not verified: no Postgres, Redis, storage, or Vercel project exists yet, so
  "all three environments deploy" and the live job round-trip are unproven.

### TASK-02 — Authentication and onboarding wizard
- Status: IN REVIEW
- Depends on: TASK-01 | Blocks: TASK-04, TASK-05, TASK-07
- File: TASK-02-auth-onboarding.md
- Decisions closed: D3 (manual KYB queue), D5 (in-house auth), D4 (one business)
- Notes: Three-step resumable wizard; the EIN inside a saved draft is encrypted
  before the draft row is written. Signup runs in one transaction. Signup,
  login, and reset are non-enumerating — login burns an equivalent bcrypt
  comparison on a missing user so the timing does not distinguish. Progressive
  lockout, bounded so it cannot be used to deny service. TOTP implemented
  directly; MFA enforced for staff at access time, not only at login.
- Verified: EIN normalization and the ownership/attestation contradiction; EIN
  ciphertext, tamper-detection, and non-recoverability; password hashing,
  salting, and lockout escalation; TOTP including drift and wrong-secret cases.
- Not verified end-to-end: the full signup → verify → dashboard flow needs a
  database and an email provider.

### TASK-03 — Marketing site and help center
- Status: IN REVIEW
- Depends on: TASK-01 | Consulted: Legal (claims)
- File: TASK-03-marketing-help.md
- Notes: `reporting_live` gating **is** wired and is the only sanctioned source
  of bureau claim copy — `getReportingClaim()` returns null when no bureau is
  approved, so rendering nothing is the path of least resistance. Contact form
  creates a real ticket before the autoresponder is queued, so a mail outage
  costs the acknowledgement rather than the enquiry. Honeypot + timing +
  optional Turnstile. Pricing reads the `plans` table with a seed-catalog
  fallback so a fresh deploy shows correct prices rather than an error.
- Verified: claim gating with flags off and with one on; availability copy never
  implies reporting; contact schema limits.
- Outstanding: **Terms and Privacy are placeholders with a visible draft
  banner** and must be replaced by counsel before launch.

### TASK-04 — Stripe billing and subscriptions
- Status: IN REVIEW
- Depends on: TASK-01, TASK-02 | Blocks: TASK-05
- File: TASK-04-billing.md
- Decisions: D1 provisional
- Notes: The raw-body detail is handled — the webhook route reads
  `await request.text()` before anything else touches the request. Idempotency
  is an insert against a unique event id; a failed inline application deletes
  its claim row so a retry is not mistaken for a duplicate. `past_due` stays
  entitling through the grace window and drops to free on Stripe's final
  cancellation. Refresh/reconcile treats Stripe as authoritative.
- Verified: entitlement resolution across every subscription status; the request
  path reads the mirror only.
- Not verified: no Stripe account is connected, so subscribe/upgrade/downgrade/
  cancel/failed-payment have not been run against test mode. This is the largest
  untested surface.

### TASK-05 — Credit report pulling and dashboard (Direction A)
- Status: IN REVIEW (against a mock client)
- Depends on: TASK-02, TASK-04 | Blocked by: D2 and the pull data agreement (Section 6)
- File: TASK-05-reports-dashboard.md
- Notes: Built against `MockBureauClient`, which §6 permits. Pull is idempotent
  per business/bureau/day via a unique index. Eligibility is checked at request
  time **and** re-checked in the worker, because a plan can lapse in between.
  Allowance is consumed on success only — a failed pull costs nothing. `no_file`
  is a first-class state, not an error. Normalization flags unmapped fields
  rather than substituting defaults. Score alerts dedupe per transition. The
  Credit Progress chart uses small multiples, one panel per bureau, because the
  scales differ and a shared axis would be misleading.
- Verified: normalization drift flagging; mock determinism and scale bounds;
  pull eligibility across entitlement, allowance, verification, and KYB.
- **Must not go live** until the pull data agreement is signed and legal has
  confirmed the permissible-purpose posture.

### TASK-06 — Bureau furnishing pipeline (Direction B)
- Status: BLOCKED — deliberately not started
- Depends on: TASK-05 + legal review + at least one bureau furnisher approval (Section 6)
- File: TASK-06-furnishing.md
- Notes: No pipeline exists. `buildSubmissionFile` throws unconditionally, and
  `checkFurnishingEligibility` structurally rejects subscription-derived,
  non-arm's-length, and platform-generated records — written now, before there
  is pressure to ship around it. No monthly run is registered in the scheduler.
  Rationale in docs/adr/0005-direction-b-deferred.md.
- Verified: the guard rejects each disqualified shape, and the builder cannot
  produce a file.

### TASK-07 — Engagement: checklist, achievements, support, marketplace
- Status: IN REVIEW
- Depends on: TASK-02
- File: TASK-07-engagement-support.md
- Notes: Onboarding steps are derived from real state on every render, never
  stored toggles — so "plan chosen" goes back to incomplete after a
  cancellation. Achievement awarding is idempotent by unique index plus
  on-conflict-do-nothing. "All tradelines current" is guarded on a minimum count
  so it is not vacuously awarded. Ticket author type comes from the session role,
  never the form. Public contact submissions are claimed on email verification.
- Verified: criteria evaluation including the vacuous-truth case and state
  reversal; derived onboarding steps.

### TASK-08 — Security, compliance, observability (cross-cutting)
- Status: IN PROGRESS (ongoing by design)
- Depends on: TASK-01 | Runs alongside every task
- File: TASK-08-security-compliance.md
- Notes: Field-level envelope encryption for EIN (local key or KMS). PII
  scrubbing on the only sanctioned logger, proven by tests that assert the value
  is **absent** from output. Append-only audit vocabulary covering auth, EIN and
  report views, plan changes, admin actions, and every bureau interaction —
  ids only, never values. Ownership failures return 404 and audit the attempt.
  Rate limiting is Postgres-backed because in-memory counters are meaningless
  across serverless instances. No `dangerouslySetInnerHTML` anywhere.
- Verified: scrubber (key-name, value-pattern, nesting, cycles, Errors);
  encryption at rest and fail-closed on tampering; config guards against
  cross-environment key leakage.
- **Known gap:** `script-src` still includes `'unsafe-inline'`. Deliberate and
  documented in docs/adr/0006-content-security-policy.md.
- Not done: backups and restore drills, database role hardening (runbook
  written, not applied), and dependency scanning against a real advisory feed.

---

## 11. Changelog

Append one line per working session. Newest at the top.

- 2026-08-06 — Affiliate program (spec §1.3, Phase 5, partial). $10 commission
  earned on a referred account converting to a PAID plan — never on a free
  signup, since signup is free and collects an EIN, which would have funded the
  fabrication vector §6.4 warns about. Qualification fires from the billing
  mirror on the transition into `active` (not `trialing`), so a commission can
  only attach to revenue that arrived. 30-day hold covers refunds and disputes;
  cancellation inside the hold reverses. Self-referral blocked by account and by
  address; one attribution per referred user enforced by unique index; velocity
  and duplicate-EIN patterns flag for staff review. Payout details are an email
  address only — no bank or card data. New: packages/affiliate, three tables,
  /affiliates, /dashboard/affiliate, referral capture in middleware, a
  hold-release job on the worker. 12 tests added (118 total).
  Payout issuing itself is NOT built — balances accrue and are settled
  externally. Nothing tunes the program in the UI yet; AFFILIATE_PROGRAM in
  packages/config is the single place.
- 2026-08-06 — Applied the Nocturne dark restyle from the supplied brand
  direction. Fixed reclaimStalled, which had been throwing on every scheduled
  run and never returning stalled jobs to the queue.
- 2026-08-03 — Initial build. Monorepo scaffolded (TASK-01); marketing site,
  help center, and legal placeholders (TASK-03); auth and the three-step wizard
  (TASK-02); Stripe billing with signature-verified idempotent webhooks
  (TASK-04); credit dashboard, report pulls, progress chart, tradelines,
  disputes against a mock bureau client (TASK-05); checklist, achievements,
  tickets, marketplace (TASK-07); security and observability controls (TASK-08).
  Worker tier with consumers, scheduler, and Dockerfile. 106 tests passing;
  typecheck, lint, and build green. Decisions D3, D4, D5, D7 closed; D1
  provisional; D2, D6, D8 remain open. TASK-06 deliberately not started.
  No services provisioned, no Stripe account connected, no legal sign-off —
  nothing is DONE.
- 2026-08-03 — STATE.md created; all tasks NOT STARTED; TASK-06 BLOCKED pending legal and bureau approval; decisions D1-D8 opened.

---

## 12. Quick reference

- Pick next task: first NOT STARTED row in Section 4 whose dependencies are all DONE and which is not in Section 6.
- Build order (critical path): TASK-01, TASK-02, TASK-04, TASK-05. Parallelizable: TASK-03, TASK-07. Continuous: TASK-08. Deferred: TASK-06.
- Before you code: read the task file and confirm its blocking decisions (Section 7) are closed.
- Before you stop: update status, notes, blockers, decisions, changelog, and the header timestamp.
