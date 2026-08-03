# Business Credit Platform — Project Plan, File Tree & Contracts

**Companion to:** *Business Credit Platform — Technical Specification v1.0*
**Stack:** Next.js (Vercel) + Node worker tier · PostgreSQL · Redis/BullMQ · Stripe
**Purpose:** Turn the spec into an executable plan — sequenced todo lists, the anticipated repository structure, and the contracts/responsibilities that keep each part of the system in its lane.
**Date:** 2026-08-03

---

## How to use this document

Three parts. **Part A** is the work plan: phased, checkable todo lists you can paste into an issue tracker. **Part B** is the anticipated file tree for the monorepo, with a one-line note on what each area owns (presented as plain text, not a code block). **Part C** is the contracts-and-responsibilities layer: who owns what, the API surface, the internal interfaces between modules, and the boundaries with third parties. No code — every "contract" is described in terms of inputs, outputs, and obligations so any developer can implement it their own way.

A note on the word **"contract."** In software a contract is the agreed-upon boundary between two parts of a system: what one side promises to accept and return, and what the other side is allowed to assume. Think of it like a restaurant kitchen and the wait staff — the ticket is the contract. The waiter promises a well-formed order; the kitchen promises a dish matching that ticket. Neither needs to know how the other does its job. Part C defines those tickets for every seam in this platform.

---

# PART A — Todo lists (by phase)

Phases mirror the spec's Section 16. Each phase is shippable-ish and ordered so a legitimate, revenue-generating product exists before the hardest piece (bureau furnishing). Check items off in order within a phase; phases can overlap once foundations land.

## Phase 0 — Foundations & scaffolding

- [ ] Decide and record final choices: auth provider, bureau data source, KYB provider, single-vs-multi business in v1 (spec §17).
- [ ] Initialize monorepo (Turborepo + pnpm workspaces); commit `tsconfig.base`, linting, formatting, commit hooks.
- [ ] Stand up `apps/web` (Next.js App Router, TypeScript, Tailwind) with a placeholder home route.
- [ ] Stand up `apps/worker` (Node service) with a health check and an empty queue consumer.
- [ ] Create shared packages skeletons: `db`, `types`, `billing`, `bureau-clients`, `ui`, `config`, `emails`.
- [ ] Provision managed Postgres (Neon/Supabase) with connection pooling; wire the ORM (Prisma or Drizzle) and a first migration.
- [ ] Provision managed Redis (Upstash) for cache/sessions/queue.
- [ ] Provision object storage (S3/R2) bucket with private ACLs and signed-URL access.
- [ ] Set up secrets management (Vercel encrypted env vars + a secrets manager for the worker tier); document required env keys in `.env.example`.
- [ ] Configure CI: install, typecheck, lint, unit tests, dependency + secret scanning on every PR.
- [ ] Configure CD: Vercel preview deploys per PR, production on merge; separate deploy pipeline for the worker tier.
- [ ] Create three environments (dev, staging, prod) with isolated Stripe/bureau/test credentials.
- [ ] Add error tracking (Sentry) with PII scrubbing rules; add uptime monitoring.
- [ ] Publish Terms of Service and Privacy Policy pages (placeholder content pending legal).

## Phase 1 — Marketing site + accounts + onboarding

- [ ] Build the global layout: top nav (Company, Learn, Pricing, Log in, Sign up), footer, design tokens/theme.
- [ ] Home page with hero, "Build business credit in 3 easy steps," bureau strip (config-gated copy), feature highlights, plan teaser, FAQ teaser, CTA.
- [ ] Pricing page: three plan cards + comparison table; Subscribe vs. Contact Sales CTAs.
- [ ] Contact page: info column + "Send us a message" form → creates a support ticket + autoresponder; spam protection.
- [ ] Help center: searchable articles + FAQ, category tiles, "open a ticket" CTA (content via CMS/db).
- [ ] About / Company + "About business credit" educational pillar page(s).
- [ ] Auth: signup, login, logout, email verification, password reset; MFA scaffold (required for staff later).
- [ ] Three-step onboarding wizard: Business → Representative → Account, resumable, with server-side validation of every field (EIN 9 digits, phone 10 digits, required fields per spec §6).
- [ ] KYB verification step (provider integration or manual review queue); set `verification_status`.
- [ ] Dashboard shell: sidebar groups (Core/Tools/Account), greeting, plan status pill, user/business switcher.
- [ ] Home dashboard widgets: "Connect a bureau" card, onboarding checklist ("X of 5"), achievements grid, email-verify prompt.
- [ ] Company Info screen: edit business/representative post-signup (trigger re-verification on key changes).
- [ ] Settings: profile, password, email preferences (marketing consent), notifications, close account.
- [ ] Entitlement middleware stub: gate Tools views behind subscription state (locked/upsell state for free users).

## Phase 2 — Monetization (Stripe)

- [ ] Model plans in Stripe (Products + monthly Prices) and mirror into the local `plans` table.
- [ ] Backend endpoints to create/reuse a Stripe Customer and open a Checkout Session (subscription mode).
- [ ] Wire self-serve Subscribe (Starter/Professional) → Checkout → success/cancel handling.
- [ ] Integrate Stripe Customer Portal for card updates, plan changes, cancellation, invoice history.
- [ ] Webhook endpoint (raw-body signature verification, idempotent, enqueues to worker).
- [ ] Worker handlers for subscription/invoice/payment_method events → update mirrored `subscriptions`/`invoices`; flip entitlements.
- [ ] Subscriptions & Billing UI: summary tiles, payment-method panel, plan options, billing history, refresh.
- [ ] Enterprise "Contact Sales" lead flow → staff-provisioned subscription/invoice.
- [ ] Dunning: past_due handling, "update your card" banner, downgrade-to-free on final failure.
- [ ] One-off Products/Purchases (Payment Intent/Checkout `payment` mode) + "My Purchases" history.
- [ ] Stripe Tax enabled if selling across states; receipts/invoices retained as system of record.
- [ ] End-to-end billing tests against Stripe test mode (subscribe, upgrade, downgrade, cancel, failed payment).

## Phase 3 — Credit data: pulling reports (Direction A) — the launchable product

- [ ] Sign bureau/aggregator data agreements for pulling (Creditsafe / Equifax Business / D&B or reseller).
- [ ] Implement `BureauClient` interface + one client per source behind it.
- [ ] Report-pull job: entitlement check → enqueue → call bureau → normalize → persist `credit_reports` + append `score_history` → render PDF → notify.
- [ ] Business Credit Score screen: per-bureau score cards, scales, last-pulled, "Pull live report," "no file" state.
- [ ] Credit Progress: score history chart with milestone annotations.
- [ ] Tradeline Tracker: add/list tradelines, per-bureau reporting status, nudges.
- [ ] Credit Checklist: seeded steps, completion tracking, points → achievements engine.
- [ ] Monitoring & alerts: scheduled score refresh, change detection, alert emails/notifications.
- [ ] Dispute intake + tracking flow (FCRA-aligned) tied to reports/tradelines.
- [ ] Rate-limit and meter live pulls per plan allowance.
- [ ] **Launch review:** legal/marketing sign-off that all claims match live capabilities.

## Phase 4 — Furnishing (Direction B) — gated, legal-first

- [ ] Legal review of furnishing model + confirmation of a legitimate, arm's-length tradeline source (spec §12).
- [ ] Apply for and complete per-bureau data-furnisher approval; obtain member/contributor numbers.
- [ ] Per-bureau file builders producing each bureau's required submission layout.
- [ ] Monthly reporting pipeline: assemble eligible records → validate → transmit securely → ingest acknowledgments/errors.
- [ ] Reporting tracker UI (Enterprise) + reconciliation of accepted/rejected records.
- [ ] Config-driven `reporting_live` flags gate every "reports to X bureau" claim in marketing and the dashboard.
- [ ] Audit retention for submissions, acknowledgments, and dispute outcomes.

## Phase 5 — Growth

- [ ] Marketplace: courses, vendor lists, resources with plan-gated access.
- [ ] Affiliate program: signup, tracking, payouts.
- [ ] Advanced analytics dashboard (Enterprise).
- [ ] Additional bureaus onboarded through the same `BureauClient`/furnisher abstractions.
- [ ] AI business-plan generator (lender-ready documents).

## Cross-cutting (every phase)

- [ ] Field-level encryption for EIN/SSN; verify no sensitive values reach logs, analytics, or error traces.
- [ ] Append-only audit log on auth, EIN/report views, plan changes, admin actions, bureau interactions.
- [ ] Accessibility (WCAG AA), responsive layouts, and performance budgets on marketing pages.
- [ ] Automated tests: unit (services), integration (API + webhooks), and E2E (signup→subscribe→pull).
- [ ] Backups with tested restores; documented data-retention and deletion paths.
- [ ] Runbooks: incident response, webhook replay, reporting-run failure recovery.

---

# PART B — Anticipated file tree

A Turborepo monorepo. Two deployables — `apps/web` (Next.js on Vercel) and `apps/worker` (always-on Node service off Vercel) — share logic through `packages/*`. The tree below is presented as plain text (not fenced) per request; each line's trailing note says what that area owns. Names are indicative; adapt to your ORM/auth choices.

business-credit-platform/ — monorepo root
&nbsp;&nbsp;package.json — workspace scripts and shared dev dependencies
&nbsp;&nbsp;pnpm-workspace.yaml — declares apps/* and packages/* as workspaces
&nbsp;&nbsp;turbo.json — task pipeline (build, lint, test, typecheck) and caching
&nbsp;&nbsp;tsconfig.base.json — shared TypeScript config extended by every package
&nbsp;&nbsp;.env.example — every required environment variable, documented, no secrets
&nbsp;&nbsp;.gitignore, .editorconfig, .prettierrc, .eslintrc — repo hygiene
&nbsp;&nbsp;README.md — setup, architecture overview, how to run each app
&nbsp;&nbsp;.github/
&nbsp;&nbsp;&nbsp;&nbsp;workflows/
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ci.yml — install, typecheck, lint, test, dependency + secret scan on PRs
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;deploy-worker.yml — build and deploy the worker tier on merge
&nbsp;&nbsp;docs/
&nbsp;&nbsp;&nbsp;&nbsp;technical-specification.md — the spec this plan accompanies
&nbsp;&nbsp;&nbsp;&nbsp;runbooks/ — incident response, webhook replay, reporting-run recovery
&nbsp;&nbsp;&nbsp;&nbsp;adr/ — architecture decision records (one file per major choice)
&nbsp;&nbsp;
&nbsp;&nbsp;apps/
&nbsp;&nbsp;&nbsp;&nbsp;web/ — Next.js App Router application (marketing + dashboard), deploys to Vercel
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;package.json, next.config, tailwind.config, tsconfig
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;middleware — auth/session + entitlement gating at the edge
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;app/
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(marketing)/ — public, SEO-rendered route group
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;page — home ("3 easy steps," bureau strip, plan teaser)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;pricing/ — plan cards + comparison table
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;contact/ — info column + message form
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;help/ — help center list + article pages
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;about/, learn/ — company + educational pillar pages
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;legal/ — terms, privacy
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(auth)/ — login, signup wizard, verify-email, reset-password route group
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(dashboard)/ — authenticated app shell (sidebar + main)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;home/ — greeting, connect-a-bureau, checklist, achievements
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;score/ — per-bureau score cards + pull report
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;progress/ — score history chart
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;tradelines/ — tradeline tracker
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;checklist/ — credit checklist
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;marketplace/ — courses, vendors, resources
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;billing/ — subscriptions & billing (tiles, payment method, plans, history)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;purchases/, products/ — one-off purchases + catalog
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;company/ — company info editor
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;tickets/ — support tickets list + thread
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;settings/ — profile, security/MFA, preferences
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;admin/ — role-gated staff area (users, KYB queue, content, tickets, reporting runs)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;api/ — Next route handlers (thin: session-bound calls + webhooks)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;webhooks/stripe/ — raw-body signature verify, then enqueue
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;webhooks/bureau/ — inbound acknowledgments/notifications (Phase 4)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;checkout/, portal/ — create Stripe Checkout/Portal sessions
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;components/ — presentational + composite UI (cards, tables, forms, wizard steps)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;lib/ — client-side helpers, server actions, fetchers, form schemas
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;server/ — server-only services the route handlers/actions call
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;auth/, billing/, reports/, tickets/, entitlements/ — feature service modules
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;public/ — static assets, logos, og-images
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;tests/ — component + integration + E2E specs
&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;worker/ — always-on Node service (queue consumers + scheduled jobs), off Vercel
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;package.json, tsconfig, Dockerfile — build + deploy for the worker host
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;src/
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;index — boot: connect queue/db, register consumers, start scheduler
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;queues/ — queue names + typed job payload definitions
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;consumers/ — one handler per job type
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;stripe-events/ — process mirrored Stripe webhook events
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;report-pull/ — call bureau, normalize, persist, render PDF, notify
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;monitoring/ — scheduled score refresh + change detection
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;reporting-run/ — Phase 4 monthly furnishing pipeline
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;emails/ — send transactional + alert emails
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;scheduler/ — cron definitions (monthly reporting, dunning follow-ups, refresh)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;lib/ — worker-only utilities (retry, backoff, idempotency store)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;tests/ — consumer + pipeline tests
&nbsp;&nbsp;
&nbsp;&nbsp;packages/
&nbsp;&nbsp;&nbsp;&nbsp;db/ — schema, migrations, and the typed database client
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;schema/ — table definitions (users, businesses, subscriptions, reports, …)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;migrations/ — versioned, reviewed migration files
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;seed/ — seed data (plans, checklist items, achievements, FAQs)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;client — exported query interface used by web + worker
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;encryption/ — field-level encrypt/decrypt for EIN/SSN via KMS
&nbsp;&nbsp;&nbsp;&nbsp;types/ — shared TypeScript types + validation schemas (single source of truth)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;domain/ — entity types (Business, Subscription, NormalizedReport, …)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;dto/ — request/response shapes for the API contracts
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;events/ — job payload + domain event shapes shared with the worker
&nbsp;&nbsp;&nbsp;&nbsp;billing/ — Stripe wrapper (Customers, Checkout, Portal, subscriptions, invoices)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;client — thin, testable Stripe boundary
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;webhooks/ — signature verification + event-to-domain mapping
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;entitlements/ — plan → capability resolution used by web + worker
&nbsp;&nbsp;&nbsp;&nbsp;bureau-clients/ — the BureauClient interface + per-bureau implementations
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;interface — the common contract every bureau client satisfies
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;creditsafe/, equifax-business/, dnb/ — pulling implementations (Direction A)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;furnishing/ — per-bureau submission-file builders (Direction B, Phase 4)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;normalize/ — map raw bureau payloads to NormalizedReport
&nbsp;&nbsp;&nbsp;&nbsp;emails/ — email templates + provider adapter (verification, receipts, alerts)
&nbsp;&nbsp;&nbsp;&nbsp;ui/ — shared design system (tokens, primitives) reused across web areas
&nbsp;&nbsp;&nbsp;&nbsp;config/ — shared eslint/tsconfig/tailwind presets + runtime config loader
&nbsp;&nbsp;&nbsp;&nbsp;kyb/ — Know-Your-Business verification adapter (provider or manual-queue backed)
&nbsp;&nbsp;&nbsp;&nbsp;observability/ — logging, tracing, and PII-scrubbing helpers shared by both apps

**Reading the tree.** Anything under `apps/web/api` and `apps/web/server` is server-only and holds the security boundary — the browser never reaches Stripe or a bureau directly. Anything under `packages/` is shared and must stay free of app-specific assumptions. The worker owns everything slow, scheduled, or long-running; the web app owns request/response and rendering. `packages/types` is the contract hub — when a shape changes there, both apps recompile against it, which is exactly the safety you want.

---

# PART C — Contracts & responsibilities

Three kinds of contract define this system: **module contracts** (what each package/app owns and is forbidden from doing), **API contracts** (the HTTP surface the frontend and integrations call), and **internal interface contracts** (the seams between modules — bureau clients, billing, entitlements, the job queue). Plus a **RACI** so it's clear who is accountable for the risky parts.

## C.1 Module ownership & boundaries

Each module has a single clear job ("owns") and explicit prohibitions ("must not"). The prohibitions are what keep the system honest — they're the guardrails that stop, say, the browser from ever holding a bureau credential.

| Module | Owns | Must not |
|--------|------|----------|
| `apps/web` (client components) | Rendering, forms, client-side UX, calling own API/server actions | Hold any secret key; call Stripe or a bureau directly; be trusted for authorization |
| `apps/web/server` + `api` | Session-bound business logic, authorization, orchestration, webhook receipt | Run long/scheduled jobs; embed bureau file-building; leak sensitive fields to responses |
| `apps/worker` | Slow/scheduled work: report pulls, monitoring, reporting runs, emails, PDF gen | Serve user requests; be the source of truth for auth/session |
| `packages/db` | Schema, migrations, typed queries, field encryption for EIN/SSN | Contain business rules or third-party calls |
| `packages/types` | Shared domain types, DTOs, event/job payload shapes, validation schemas | Import from apps; hold runtime logic or secrets |
| `packages/billing` | All Stripe interaction + webhook verification/mapping | Persist data directly (returns domain objects for callers to store) |
| `packages/bureau-clients` | `BureauClient` interface, per-bureau pull impls, furnishing builders, normalization | Know about HTTP routes, sessions, or Stripe |
| `packages/entitlements` | Resolve a plan into capability flags; single gating authority | Query Stripe live (reads mirrored plan/subscription data) |
| `packages/kyb` | Business/representative verification behind one adapter | Expose provider-specific shapes to callers |
| `packages/emails` | Templates + provider adapter | Decide *when* to send (callers trigger; this only renders/sends) |
| `packages/observability` | Structured logging, tracing, PII scrubbing | Log raw EIN/SSN/report payloads under any circumstance |

**The cardinal rule:** authorization and money/credit truth live server-side. The frontend's gating is cosmetic; the backend re-checks ownership *and* entitlement on every sensitive call and writes an audit entry.

## C.2 API contracts (HTTP surface)

Described as contracts, not code: method, path, purpose, who may call it, and the gate it enforces. Requests and responses use the DTO shapes in `packages/types`. All authenticated routes require a valid session; "entitlement" columns name the capability the backend must confirm before acting. Every route validates input server-side and returns typed errors with stable codes.

### Auth & account

| Method · Path | Purpose | Caller | Gate |
|---|---|---|---|
| POST · /auth/signup | Create user + business + representative (wizard submit) | Public | Rate-limited, spam-checked |
| POST · /auth/login | Start a session | Public | Rate-limited, lockout |
| POST · /auth/logout | End session | Member | Session |
| POST · /auth/verify-email | Consume verification token | Public (token) | Single-use token |
| POST · /auth/resend-verification | Re-send verification email | Member | Rate-limited |
| POST · /auth/request-reset · /auth/reset | Password reset request + completion | Public (token) | Single-use, expiring token |
| POST · /auth/mfa/enroll · /auth/mfa/verify | TOTP enrollment/verification | Member; required for staff | Session |

### Business & profile

| Method · Path | Purpose | Caller | Gate |
|---|---|---|---|
| GET · /businesses/:id | Read owned business profile | Member/owner | Ownership |
| PATCH · /businesses/:id | Edit profile (re-verify on key changes) | Member/owner | Ownership; re-trigger KYB |
| POST · /businesses/:id/kyb | Start/refresh KYB verification | Member/owner or staff | Ownership |
| GET · /businesses/:id/representatives · POST/PATCH | Manage representative record | Member/owner | Ownership |

### Billing & subscriptions

| Method · Path | Purpose | Caller | Gate |
|---|---|---|---|
| GET · /plans | List active plans for pricing/gating | Public | — |
| POST · /billing/checkout-session | Open Stripe Checkout for a plan | Member (verified) | Verified email |
| POST · /billing/portal-session | Open Stripe Customer Portal | Member (has customer) | Ownership |
| GET · /billing/subscription | Read mirrored subscription state | Member | Ownership |
| GET · /billing/invoices | List mirrored invoices + PDF links | Member | Ownership |
| POST · /billing/enterprise-lead | Contact-Sales lead submission | Public/Member | Rate-limited |
| POST · /webhooks/stripe | Receive Stripe events | Stripe only | Signature verify, idempotent |

### Credit data (Direction A)

| Method · Path | Purpose | Caller | Gate |
|---|---|---|---|
| POST · /businesses/:id/reports/pull | Enqueue a live report pull | Member/owner | Entitlement: bureau allowed + monthly allowance |
| GET · /businesses/:id/reports | List report snapshots | Member/owner | Ownership |
| GET · /reports/:id | Read one report + PDF link | Member/owner | Ownership |
| GET · /businesses/:id/score-history | Score time series for chart | Member/owner | Entitlement: monitoring |
| GET/POST/PATCH · /businesses/:id/tradelines | Manage tracked tradelines | Member/owner | Ownership |
| POST · /businesses/:id/disputes | File a dispute; track status | Member/owner | Ownership |

### Engagement & support

| Method · Path | Purpose | Caller | Gate |
|---|---|---|---|
| GET · /checklist · POST · /checklist/:key/complete | Read/advance credit checklist | Member | Session |
| GET · /achievements | Earned + available milestones | Member | Session |
| POST · /contact | Public contact form → ticket | Public | Spam-checked |
| GET/POST · /tickets · /tickets/:id/messages | List/create tickets + replies | Member | Ownership |
| GET · /marketplace · /products · POST · /products/:id/purchase | Browse + one-off purchase | Member | Entitlement/access level |

### Admin (staff only, MFA-required)

| Method · Path | Purpose | Gate |
|---|---|---|
| GET/PATCH · /admin/users · /admin/businesses | Search/manage accounts | Role: staff/admin + audit |
| GET/POST · /admin/kyb-queue | Review manual KYB decisions | Role + audit |
| CRUD · /admin/plans · /admin/content | Manage plans, FAQs, help, marketplace | Role + audit |
| GET · /admin/reporting-runs | Monitor furnishing pipeline (Phase 4) | Role + audit |
| POST · /admin/refunds | Issue Stripe refunds/credits | Role + audit |

## C.3 Internal interface contracts

These are the seams between modules. Each is described by its promise: inputs, outputs, and the invariants the caller may rely on.

**BureauClient (pulling — Direction A).** Promise: given a verified business, return a `NormalizedReport` (score, band, scale, tradelines, public records, risk factors) or a typed failure (`no_file`, `provider_error`, `rate_limited`). Every bureau implementation satisfies the *same* shape so the app never branches on which bureau it is. Invariants: never throws provider-specific errors past the boundary; always attaches the raw payload for audit; is idempotent per (business, bureau, day).

**FurnishingBuilder (writing — Direction B, Phase 4).** Promise: given a set of eligible tradeline records for a period, produce a validated submission file in the target bureau's required layout, plus a manifest of included/excluded records with reasons. Invariants: refuses to include records that fail the bureau's field spec; never fabricates data; output is deterministic for the same input.

**BillingService (Stripe boundary).** Promise: `ensureCustomer(user)`, `createCheckoutSession(user, plan)`, `createPortalSession(user)`, and `mapWebhookEvent(rawEvent)` → domain event. Invariants: verifies webhook signatures against the raw body; is idempotent on Stripe event ids; returns domain objects for callers to persist — it does not write to the database itself.

**EntitlementService.** Promise: given a user's active subscription (from mirrored data), return the capability set — allowed bureaus, monthly pull allowance, monitoring/analytics/support flags. Invariants: a free/absent subscription yields the empty set; it is the *only* place capability is decided, so both web and worker ask it rather than re-deriving rules.

**Job queue contract.** Promise: producers enqueue a typed job (payload shape from `packages/types/events`); the worker consumes exactly-once via an idempotency store, with retry + backoff and a dead-letter path. Invariants: webhook endpoints enqueue and return fast rather than processing inline; a job is safe to retry (handlers are idempotent).

**KYB adapter.** Promise: `verify(business, representative)` → `verified | pending | rejected` + reason, behind one interface whether backed by a provider or a manual staff queue. Invariant: callers never see provider-specific response shapes.

**Encryption contract (`packages/db/encryption`).** Promise: EIN/SSN are written only through encrypt-on-write / decrypt-on-read helpers keyed by KMS. Invariant: plaintext of these fields never lands in columns, logs, analytics, or error traces.

**Data-mirroring contract.** Promise: Stripe is the source of truth for billing; the local `subscriptions`/`invoices` tables are a read cache updated solely by webhook handlers. Invariant: entitlement decisions read the mirror, never a live Stripe call in the request path; the mirror is reconciled if a webhook is missed.

## C.4 Responsibilities (RACI)

R = Responsible (does the work), A = Accountable (owns the outcome), C = Consulted, I = Informed. Roles: **FE** frontend, **BE** backend/worker, **DevOps**, **Sec** security/privacy, **Legal/Compliance**, **PM** product, **Design**.

| Area | R | A | C | I |
|---|---|---|---|---|
| Marketing pages & onboarding UI | FE | PM | Design, Legal | BE |
| Auth, sessions, MFA | BE | BE lead | Sec | PM |
| Stripe billing + webhooks | BE | BE lead | PM, Sec | FE |
| Entitlement gating | BE | BE lead | PM | FE |
| Bureau pulling (Direction A) | BE | BE lead | Legal, PM | Sec |
| Bureau furnishing (Direction B) | BE | **Legal/Compliance** | BE lead, PM | Exec |
| KYB / anti-fraud | BE | Sec | Legal | PM |
| Data encryption & PII handling | BE | Sec | DevOps | Legal |
| Infra, CI/CD, worker tier, backups | DevOps | DevOps lead | BE | PM |
| Marketing/reporting claims accuracy | PM | **Legal/Compliance** | PM, Design | FE, BE |
| Incident response & runbooks | DevOps | DevOps lead | BE, Sec | All |

Two rows are deliberately **accountable to Legal/Compliance, not engineering**: furnishing and public reporting claims. That reflects the reality check in the spec — these are legal decisions that engineering *implements*, not the other way around.

## C.5 Definition of done (applies to every feature)

A feature is done when: server-side validation and authorization are enforced (not just client-side); ownership + entitlement checks pass and are audited; sensitive fields are encrypted and absent from logs; happy-path and failure-path tests exist (unit + integration, plus E2E for critical flows); the relevant runbook/ADR is updated; and — for anything touching credit data or reporting claims — Legal/Compliance has signed off.

---

*End of project plan.*


