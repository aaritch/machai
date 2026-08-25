# STATE.md — Build Tracker

Single source of truth for building the Business Credit Platform, task by task. This file is meant to be read at the start of every work session and updated at the end of it. If you are an AI coding agent or a new developer, read this file top to bottom before writing any code.

- Project: Business Credit Platform (Next.js on Vercel + Node worker, PostgreSQL, Redis/BullMQ, Stripe)
- Companion docs: technical-specification.md, project-plan.md, and the TASK-00..TASK-08 files
- Code: the monorepo at the repository root. See README.md and docs/adr/ for how it is built.
- Last updated: 2026-08-25
- Updated by: Claude
- **Read §7.1 (Deviations) before trusting any spec section — the product direction changed.**

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
- **Direction A (pulling reports) has been REMOVED from the product** — no plan grants a pull and the code is deleted (V1 in §7.1). Direction B (furnishing) is what the plans sell, and the reporting claims are live — but the submission pipeline is still unbuilt (V3).
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
| TASK-05 | Credit report pulling and dashboard (Direction A) | 3 | TASK-02, TASK-04 | **WITHDRAWN** — removed from the product 2026-08-25 (V1) | |
| TASK-06 | Bureau furnishing pipeline (Direction B) | 4 | legal + bureau approval | **NOT STARTED — but the product now sells it (V3)** | |
| TASK-07 | Engagement: checklist, achievements, support, marketplace | 1-3 | TASK-02 | IN REVIEW | |
| TASK-08 | Security, compliance, observability (cross-cutting) | all | TASK-01 | IN PROGRESS (ongoing) | |
| Phase 5 | Affiliate program (partial — enrolment, attribution, commissions) | 5 | TASK-02, TASK-04 | IN REVIEW | |

Nothing is DONE. "IN REVIEW" here means code complete against the task file's
Implementation details, with tests passing — but the Definition of done in
Section 9 also requires provisioned environments, a restore-tested backup, and
Legal/Compliance sign-off on anything touching credit data or reporting claims.
None of those have happened. See Section 6.

The critical path has changed. TASK-05 is withdrawn, so the path to a working product now runs TASK-01 → TASK-02 → TASK-04 → **TASK-06**, which was the deferred task and is now the product. See §7.1.

---

## 5. Current focus

The product now sells monthly bureau reporting. The marketing, pricing, and
billing for that are live in production; the thing being sold is not built.

**Next actions, in order:**

1. **Build the TASK-06 submission pipeline, or qualify the claim.** The site
   tells businesses we report their activity to three bureaus. Nothing is being
   transmitted — `buildSubmissionFile` throws by design. This is the widest gap
   between what is promised and what exists. (V3 in §7.1.)
2. **Confirm D6 in writing.** Plans advertise a $2,500 / $4,000 net-30 trade
   account. If that is genuine extended credit, the model is the legitimate one
   §12.2 describes and the copy is accurate. If it is a subscription artefact,
   both the copy and the arrangement are a bureau disqualifier. Engineering
   cannot determine which. (V4.)
3. **Finish Stripe.** Products and prices exist nowhere yet; `STRIPE_PRICE_*`,
   the secret key, and the webhook secret are unset in Vercel, so checkout
   cannot complete. `docs/runbooks/stripe-setup.md` has the sequence.
4. **Provision the managed services.** Production currently has no
   `DATABASE_URL`, `SESSION_SECRET`, or `ENCRYPTION_KEY`, and `APP_ENV`
   defaults to `development` — so the fail-fast production guards are inactive.
   Set `APP_ENV=production` last; it is what makes the app refuse to boot
   without the rest.
5. **Replace Terms and Privacy** with counsel-reviewed text. Both still ship
   with a visible draft banner.
6. **Close D8** (worker host) and wire the deploy step in
   `.github/workflows/deploy-worker.yml`.

---

## 6. Blockers (open)

List anything preventing progress. Remove when resolved (record the resolution in Section 7).

| Task | Blocker | Owner | Opened | Needed to unblock |
|------|---------|-------|--------|-------------------|
| TASK-06 | **The site claims we report to three bureaus, but no submission pipeline exists.** `buildSubmissionFile` throws by design and no monthly run is scheduled. | Legal/Compliance + BE | 2026-08-25 | Build the pipeline, or qualify the claim until it exists. See V3 in §7.1. |
| TASK-06 | D6 unresolved: the arm's-length source of furnished tradelines is not confirmed to engineering. Plans now advertise a $2,500/$4,000 net-30 trade account (V4). | Legal/Compliance | 2026-08-03 | Written confirmation that the trade accounts are genuine extended credit, not a subscription artefact (spec §12.2) |

| TASK-01/08 | No managed services provisioned (Postgres, Redis, object storage) and no Vercel project | DevOps | 2026-08-03 | Provision them and set the environment variables in docs/DEPLOYMENT.md |
| TASK-04 | No Stripe account connected; plans not modelled in Stripe | Product/DevOps | 2026-08-03 | Create Products and Prices, set `STRIPE_PRICE_*`, re-seed, run the test-mode end-to-end |
| TASK-03 | Terms of Service and Privacy Policy are placeholders | Legal | 2026-08-03 | Counsel-reviewed text replacing both pages (they ship with a visible draft banner) |

TASK-05's pull data agreement is no longer a blocker — the feature it gated has been removed from the product (V1). `BUREAU_MODE` remains `mock` and nothing calls a bureau.

---

## 7. Decisions log

Record every material decision so future sessions do not relitigate them. These start OPEN (from the spec's open-questions list) and must be resolved before the dependent task begins.

| # | Decision | Status | Resolution | Date |
|---|----------|--------|------------|------|
| D1 | Final plan names, prices, and feature splits | CLOSED | Foundation $25 / Growth $45 / Premier $99, with feature lists rewritten around monthly bureau reporting (2026-08-25). Internal `code` values stay `starter`/`professional`/`enterprise` — they are the DB unique key, the `?plan=` param, and the `STRIPE_PRICE_*` suffix, so they do not churn with display names. See V1 and V4 in §7.1. | 2026-08-25 |
| D2 | Bureau data source for pulling: direct contracts vs aggregator/reseller | OPEN | Built against a deterministic mock client (`BUREAU_MODE=mock`), which STATE.md §6 permits while the agreement is pending. Live client skeletons and per-bureau field maps exist; the endpoint paths and payload shapes need the integration docs that come with a signed contract. | 2026-08-03 |
| D3 | KYB provider choice (or manual review queue for v1) | CLOSED | Manual staff review queue for v1, behind a `KybAdapter` interface. Structural checks run automatically and reject obvious garbage; only a human decision returns `verified`. A Middesk adapter is implemented behind the same interface. | 2026-08-03 |
| D4 | Multiple businesses per user in v1, or exactly one | CLOSED | One business per user in the UI. The schema and queries already support many, so lifting the restriction is a UI change, not a migration. | 2026-08-03 |
| D5 | Auth: managed provider (Clerk/Auth.js/Supabase) vs in-house | CLOSED | In-house. bcrypt cost 12, opaque session tokens stored hashed, idle + absolute expiry, TOTP for staff. Rationale and the argon2 trade-off in docs/adr/0002-authentication.md. | 2026-08-03 |
| D6 | Legitimate source of furnished tradelines for Direction B | OPEN | Unchanged and blocking. This is a business and legal decision. No furnishing code exists — see docs/adr/0005-direction-b-deferred.md. | |
| D7 | ORM choice (Prisma vs Drizzle) | CLOSED | Drizzle. No native query engine to ship into serverless and container images, and it emits readable SQL migrations — which matters because migrations here are human-reviewed. docs/adr/0003-orm-and-database.md. | 2026-08-03 |
| D8 | Worker host (Render/Railway/Fly/ECS) | OPEN | Deferred without blocking: the worker ships as a standard container with a health endpoint and graceful shutdown. CI builds and pushes the image; the deploy step is a stub behind a gated GitHub environment. docs/adr/0007-worker-host-and-queue.md. | |

D2 and D8 remain open but are not blocking further work. D6 must be closed, with
legal, before TASK-06 — and TASK-06 must not begin before it is.

### 7.1 Deviations from the specification

The spec and task files are not edited when the product changes — they record
what was specified. Anything the built product does differently is recorded
here instead. Read this before trusting a spec section at face value.

| # | Deviation | Spec said | Product now | Recorded |
|---|---|---|---|---|
| V1 | **The product direction reversed.** Report *pulling* and monitoring (Direction A) was removed entirely; furnishing (Direction B) is the product. | §12.3: "Direction A is buildable and legitimate now… **Launch on Direction A.**" Direction B was Phase 4, gated. | No plan grants a pull. `/dashboard/score` and `/dashboard/progress`, the `BureauClient` pull path, the report-pull and monitoring workers, and the pull email templates are deleted. Plans sell monthly reporting to the bureaus. | 2026-08-25 |
| V2 | **Furnisher approval asserted for all three bureaus.** `REPORTING_LIVE_*` are true in production. | §12.1: approval is per-bureau, takes weeks to months, and no claim may render ahead of it. | Owner confirmed approval at Creditsafe, Equifax Business, and D&B. The `reporting_live` gate is doing its job — the claim renders because the flags were set, not because it was hardcoded. **Engineering has not seen the agreements.** | 2026-08-25 |
| V3 | **The reporting claim is live ahead of the pipeline.** | §11.2, TASK-06: a monthly submission pipeline assembles, validates, transmits, and reconciles. | The site states we report to three bureaus. **No pipeline exists.** `buildSubmissionFile` still throws by design and no monthly run is scheduled. Nothing is being transmitted. | 2026-08-25 |
| V4 | **Plans include a trade account.** | §9.1 tiers were report-access tiers. | Foundation includes a $2,500 net-30 trade account, Growth $4,000. Written as "net-30 trade account" deliberately — §12.2 disqualifies furnishers who report "pay for tradelines", and the legitimate reading requires credit that is actually extended and repaid. **Not verified by engineering.** | 2026-08-25 |
| V5 | **Premier is self-serve.** | §9.2/§10.5: Enterprise is sales-assisted, CTA "Contact Sales". | `isContactSales: false` — Premier goes through Checkout like the others, so it needs `STRIPE_PRICE_ENTERPRISE` set. | 2026-08-25 |
| V6 | **Monthly reporting tracker removed.** | §9.3 `reporting_tracker` entitlement; §11.2 surfaces reconciliation to Enterprise. | Removed from the plans, the comparison table, and the `Entitlements` type. The UI was never built (it belongs to TASK-06), so the flag was a dead gate. | 2026-08-25 |
| V7 | **"EIN only — no SSN" removed from the marketing.** | §1.2 and §6.3 make it the core promise. | Removed from the hero badge and the shared disclosure. The claim survives in six other places (homepage step 1 and FAQ, About, Privacy Policy, two seeded records), left in place at the owner's request. The schema still has no SSN column. | 2026-08-25 |

**V3 is the one to act on.** A public claim that we report to three bureaus,
with no mechanism behind it, is the gap between marketing and reality that
§12.4 exists to prevent — only inverted from the case it anticipated. Either
build the TASK-06 pipeline or qualify the claim.

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
- Status: **WITHDRAWN** (2026-08-25) — removed from the product, not deferred
- File: TASK-05-reports-dashboard.md
- What happened: the product moved from reading bureau data to furnishing it.
  Pulling was never something we offered, so the UI advertising it was removed
  and the code behind it deleted: `/dashboard/score`, `/dashboard/progress`,
  their components, `server/reports.ts`, the report-pull and monitoring worker
  consumers, the PDF renderer, two queues, and three email templates.
- Deliberately kept: the `credit_reports` / `score_history` / `score_alerts`
  tables (dropping them is a destructive migration for no benefit — they are
  inert), the `REPORT_PULL_*` audit action names (already written to
  `audit_log`; renaming would falsify existing entries), and
  `checkPullEligibility` with its tests (the entitlement layer denying pulls is
  a guarantee worth keeping tested).
- Still true: `BUREAU_MODE=mock`, and config refuses `live` outside production.
  Nothing calls a bureau.

### TASK-06 — Bureau furnishing pipeline (Direction B)
- Status: **NOT STARTED — and the product now sells it**
- Depends on: legal review + per-bureau furnisher approval (§6)
- File: TASK-06-furnishing.md
- This is now the critical path, not a deferred phase. The owner has confirmed
  furnisher approval at all three bureaus and `REPORTING_LIVE_*` are true in
  production, so the site states we report to Creditsafe, Equifax Business, and
  Dun & Bradstreet.
- **Nothing is transmitted.** `buildSubmissionFile` throws unconditionally,
  `checkFurnishingEligibility` still rejects subscription-derived and
  non-arm's-length records by design, and no monthly run is registered in the
  scheduler. The claim is live; the mechanism is not. (V3 in §7.1.)
- Before building: close D6. Plans now advertise a $2,500 / $4,000 net-30 trade
  account (V4), and whether that is genuine extended credit or a subscription
  artefact decides whether the whole model passes bureau vetting (§12.2).
  That is a legal and business determination, not an engineering one.
- Accountable owner remains Legal/Compliance.

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

- 2026-08-25 — **Product direction reversed.** Report pulling and monitoring
  (Direction A) removed entirely — UI, server module, worker consumers, queues,
  and email templates deleted. Furnishing (Direction B) is now what the plans
  sell: `REPORTING_LIVE_*` set true in production on the owner's confirmation of
  furnisher approval at all three bureaus. Plans renamed and repriced —
  Foundation $25 / Growth $45 / Premier $99 — with a $2,500 / $4,000 net-30
  trade account added to the first two, Premier switched to self-serve, and the
  monthly reporting tracker removed. Marketing rewritten throughout: hero,
  3-steps, FAQ, Terms §5, meta description, seeded content, and emails.
  Nocturne restyle applied. Every deviation from the spec is recorded in §7.1 —
  **V3 is the one to act on: the reporting claim is live and the pipeline is
  not built.** Also fixed: empty `REPORTING_LIVE_*` values in Vercel (the CLI
  stores an empty string unless `--value` is passed), the marketing pages baking
  the compliance gate in at build time, and a `.vercelignore` gap that let a
  local `.env` reach a remote build.
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

- **Read §7.1 first.** The product direction reversed on 2026-08-25 and several
  spec sections no longer describe what is built.
- Pick next task: first NOT STARTED row in Section 4 whose dependencies are all DONE and which is not in Section 6.
- Build order (critical path): TASK-01, TASK-02, TASK-04, then **TASK-06** — which was the deferred task and is now the product. TASK-05 is withdrawn. Parallelizable: TASK-03, TASK-07. Continuous: TASK-08.
- Before you code: read the task file, confirm its blocking decisions (Section 7) are closed, and check §7.1 for whether that part of the spec still holds.
- Before you stop: update status, notes, blockers, decisions, changelog, and the header timestamp.
