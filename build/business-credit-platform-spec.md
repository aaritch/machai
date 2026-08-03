# Business Credit Platform — Technical Specification

**Document type:** Build-ready technical specification
**Target audience:** Professional development team
**Reference/inspiration:** Ruproa (ruproa.com)
**Recommended stack:** Next.js (React) frontend + Node.js API, PostgreSQL, Stripe billing
**Version:** 1.0
**Date:** 2026-08-03

---

## 0. How to read this document

This spec is written for developers who will implement the platform end-to-end. It defines *what* to build and *how the pieces fit*, without prescribing line-level code. Each section is self-contained: a section on the data model, one per feature area, one per third-party integration, and cross-cutting concerns (auth, security, compliance, infrastructure).

Two things are called out explicitly throughout:

1. **MUST / SHOULD / MAY** follow RFC-2119 meaning. "MUST" is a hard requirement; "SHOULD" is a strong recommendation with room for justified deviation; "MAY" is optional.
2. **⚠️ REALITY CHECK** blocks flag places where the obvious product idea collides with legal, contractual, or technical constraints in the real world — most importantly around credit-bureau reporting. Read those blocks before estimating the project. They change scope materially.

---

## 1. Product summary

### 1.1 What the platform is

A subscription SaaS web application that helps small-business owners **establish and monitor business credit** using their business identity (EIN) rather than their personal SSN. Users create a free account, enter their business profile, and subscribe to a monthly plan that unlocks live business-credit reports, a credit score dashboard, monitoring/alerts, and educational tools. Payment is handled by Stripe. The platform positions itself as reporting business payment activity to commercial credit bureaus (Creditsafe and Equifax Business are the two named on the reference site; Dun & Bradstreet is a stated goal — see the reality check in Section 12).

### 1.2 Core user promise

"Build business credit in 3 easy steps." The marketing funnel is: **(1)** create a free EIN-only account and enter your business info, **(2)** subscribe to a plan, **(3)** get monitored/reported and watch your score build over time.

### 1.3 Primary user types

- **Prospect / visitor** — unauthenticated, browsing marketing pages and pricing.
- **Free member** — registered, has entered business info, can see the dashboard shell and checklist but no live bureau data until subscribed.
- **Paid member** — active subscription; unlocks live reports, score monitoring, and plan-specific features.
- **Admin / staff** — internal operators who manage users, support tickets, plans, and (critically) the bureau-reporting pipeline.
- **(Optional) Affiliate** — the reference site runs an affiliate program; treated as an optional Phase-2 module here.

---

## 2. Scope: feature checklist mapped to requirements

Every item the requirements document and the eight reference screenshots call for, mapped to a spec section.

| # | Requirement (from brief / screenshots) | Spec section |
|---|----------------------------------------|--------------|
| 1 | Business information intake (name, DBA, address, EIN, entity type, phone) — *pic1* | §6.1 Onboarding wizard |
| 2 | "Reports to Creditsafe, Equifax, Dun & Bradstreet" messaging | §5.3 Marketing pages, §12 Reality check |
| 3 | "Build business credit in 3 easy steps" section | §5.2 Home page |
| 4 | Accept credit cards | §10 Stripe / payments |
| 5 | Contact section — *pic2* | §5.4 Contact + §7.4 Support tickets |
| 6 | Help center with support & FAQs | §5.5 Help center |
| 7 | Multiple plans with feature lists — *pic4, pic5, pic8* | §9 Plans & pricing |
| 8 | Company / about, "about business credit", pricing sections | §5 Marketing site |
| 9 | Pull credit reports — *pic3* | §7.2 Reports, §11 Bureau data ingestion |
| 10 | Account creation (3-step: Business → Representative → Account) — *pic6* | §6 Onboarding, §8 Auth |
| 11 | Stripe payment connection | §10 Stripe / payments |
| 12 | Subscriptions & billing management UI — *pic3, pic5* | §7.5 Billing, §10 |
| 13 | Authenticated dashboard with sidebar (Home, My Purchases, Products, Business Credit Score, Credit Progress, Tradeline Tracker, Credit Checklist, Marketplace, Subscriptions & Billing, Company Info, Support Tickets, Feedback, Settings) — *pic3, pic7* | §7 Application (dashboard) |
| 14 | Onboarding progress ("Get started · 2 of 5 complete"), achievements, "Connect a bureau", email verification — *pic7* | §6.3, §7.1 |

---

## 3. High-level architecture

### 3.1 Recommended shape

A **decoupled web application** with three logical tiers plus asynchronous workers:

- **Frontend (marketing + app):** Next.js (App Router, React, TypeScript). Server-side rendering for marketing/SEO pages; client-rendered authenticated dashboard behind auth. Tailwind CSS for styling to match the clean, card-based reference UI.
- **Backend API:** Node.js (TypeScript) using a mature framework — **NestJS** is recommended for a team (opinionated modules, dependency injection, guards for auth/roles) or Express/Fastify if the team prefers minimalism. Exposes a versioned REST or tRPC API. This is where all business logic, authorization, and integrations live. The frontend never talks to Stripe or bureaus directly for anything sensitive.
- **Database:** PostgreSQL (managed — e.g., AWS RDS, Neon, or Supabase Postgres). Relational integrity matters here (businesses, subscriptions, reports, tradelines all reference each other).
- **Async workers / queue:** A job runner (**BullMQ on Redis**, or a hosted queue) for anything slow or scheduled: pulling bureau reports, monthly reporting runs, sending emails, generating PDFs, reconciling Stripe events.
- **Object storage:** S3-compatible bucket for generated report PDFs, uploaded documents, and exports.
- **Cache / session store:** Redis (also backs the job queue).

### 3.2 Why decoupled

Because two of the hardest parts of this product — Stripe billing and bureau data exchange — are **event-driven and must be authoritative server-side**. A thin frontend that renders state, plus a backend that owns money and credit data, keeps the security boundary clean. Treat the browser as untrusted.

### 3.3 Environments

MUST maintain at least three: `development`, `staging`, `production`. Stripe and every bureau/data integration MUST run in **test/sandbox mode** everywhere except production. Never share a production Stripe key with a non-production environment.

### 3.4 System context diagram (described)

The browser talks only to the Next.js app and the backend API. The backend API is the single hub that talks outward to: Stripe (billing), the email provider, the object store, and the bureau/data integrations (or, in the realistic v1, a manual/aggregator layer — see §12). Webhooks from Stripe and any data provider arrive at dedicated backend endpoints and are pushed onto the job queue for processing. Scheduled jobs (monthly reporting, report refresh, dunning follow-ups) are triggered by a scheduler feeding the same queue.

---

## 4. Data model

This is the backbone. Below are the core entities, their key fields, and relationships. Field types are indicative (Postgres). All tables MUST have `id` (UUID v4, primary key), `created_at`, `updated_at` (timestamptz). Use soft deletes (`deleted_at`) on user-facing records.

### 4.1 `users`

The login identity. One human = one user.

- `email` (citext, unique, not null)
- `password_hash` (text, null if using passwordless/OAuth only)
- `email_verified_at` (timestamptz, null until verified)
- `role` (enum: `member`, `admin`, `staff`)
- `status` (enum: `active`, `suspended`, `closed`)
- `last_login_at`, `mfa_enabled` (bool), `mfa_secret` (encrypted)

### 4.2 `businesses`

The business profile a user is building credit for. **One user MAY own multiple businesses** (design for it now even if v1 restricts to one), so this is a separate table.

- `owner_user_id` (fk → users)
- `legal_name` (text, not null) — "Business Name"
- `dba_name` (text, null) — "D.B.A / Trade Name"
- `entity_type` (enum: `sole_prop`, `llc`, `s_corp`, `c_corp`, `partnership`, `nonprofit`, `other`) — "Business Entity Type"
- `ein` (text, **encrypted at rest**, stored normalized to 9 digits; see §13 security) — "Tax ID (EIN)"
- `street_address`, `address_line_2`, `city`, `state` (2-char), `zip` (text)
- `phone` (text, normalized to 10 digits)
- `website`, `industry_naics` (optional enrichment)
- `verification_status` (enum: `unverified`, `pending`, `verified`, `rejected`) — whether the business identity has been validated (see §6.4)

### 4.3 `representatives`

The authorized person (step 2 of signup — *pic6* confirms ownership ≥ 25%). Kept separate from `users` because the legal representative is a business-role concept, and KYC/attestation data attaches here.

- `business_id` (fk)
- `first_name`, `last_name`, `title`
- `email`, `phone`
- `ownership_percentage` (numeric)
- `attested_authority` (bool) — "I confirm the registered representative has at least 25% ownership"
- `date_of_birth`, `ssn_last4` (**encrypted**, only if a bureau/KYC flow requires it — avoid collecting full SSN; the product's whole pitch is "EIN only, no SSN")

⚠️ **REALITY CHECK:** The brand promise is "EIN only — no SSN required." Honor it. Do **not** collect full SSNs unless a specific downstream integration contractually forces it, and if it does, isolate that data (§13). Collecting SSNs you don't need is a liability, not a feature.

### 4.4 `plans`

The subscription products offered (Starter, Professional, Enterprise per *pic5/pic8*). These mirror Stripe Prices but are stored locally so marketing pages and gating logic don't depend on a live Stripe call.

- `code` (text, unique: `starter`, `professional`, `enterprise`)
- `name`, `description`, `tagline`
- `monthly_price_cents` (int), `currency` (default `usd`)
- `stripe_product_id`, `stripe_price_id`
- `features` (jsonb array of feature strings shown on pricing cards)
- `entitlements` (jsonb — machine-readable flags; see §9.3)
- `is_contact_sales` (bool — Enterprise uses "Contact Sales" instead of self-serve checkout)
- `display_order`, `is_active`

### 4.5 `subscriptions`

The user's live billing state. This table is a **local mirror of Stripe's subscription object**, updated by webhooks. Stripe is the source of truth for billing; this table is the fast-read cache the app gates features on.

- `user_id` (fk), `business_id` (fk, nullable)
- `plan_id` (fk)
- `stripe_customer_id`, `stripe_subscription_id`
- `status` (enum mirroring Stripe: `trialing`, `active`, `past_due`, `canceled`, `incomplete`, `incomplete_expired`, `unpaid`, `paused`)
- `current_period_start`, `current_period_end`
- `cancel_at_period_end` (bool)
- `default_payment_method_last4`, `card_brand` (display only)

### 4.6 `invoices`

Billing history for the "Billing History" panel (*pic5*: "Recent invoices, payment outcomes, and PDF downloads").

- `user_id`, `stripe_invoice_id`
- `amount_due_cents`, `amount_paid_cents`, `currency`
- `status` (`draft`, `open`, `paid`, `void`, `uncollectible`)
- `hosted_invoice_url`, `invoice_pdf_url`
- `period_start`, `period_end`, `paid_at`

### 4.7 `credit_reports`

A pulled report snapshot from a bureau (*pic3* "Business Credit Score", the "pull your live credit report" feature).

- `business_id` (fk)
- `bureau` (enum: `creditsafe`, `equifax_business`, `dnb`)
- `pulled_at` (timestamptz)
- `score` (int, nullable), `score_band` (text), `score_scale` (text — e.g., "0–100" for Creditsafe, "0–650" for Equifax Business)
- `raw_payload` (jsonb — the full bureau response, retained for audit)
- `pdf_url` (S3 link to a rendered report)
- `status` (`pending`, `available`, `failed`, `no_file` — "no file" = bureau has no record yet)

### 4.8 `score_history`

Time series for the "Credit Progress" chart.

- `business_id`, `bureau`, `score`, `recorded_on` (date). One row per bureau per observation. Drives the progress graph.

### 4.9 `tradelines`

Individual credit accounts tracked for the business (the "Tradeline Tracker" — *pic7* marks it NEW).

- `business_id` (fk)
- `creditor_name`, `account_type` (`net30`, `revolving`, `installment`, `vendor`, `other`)
- `date_opened`, `credit_limit_cents`, `high_balance_cents`, `current_balance_cents`
- `payment_status` (`current`, `late_30`, `late_60`, `late_90`, `collections`)
- `reported_to` (jsonb array of bureaus this line appears on)
- `source` (`user_added`, `platform_reported`, `bureau_observed`)

### 4.10 `checklist_items` and `user_checklist_progress`

The "Credit Checklist" and onboarding "Get started · X of 5" (*pic7*).

- `checklist_items`: `key`, `title`, `description`, `category`, `points`, `display_order`
- `user_checklist_progress`: `user_id`, `checklist_item_id`, `status` (`todo`, `done`), `completed_at`

### 4.11 `achievements` and `user_achievements`

Gamification ("Achievements — 2 of 12 milestones earned", "Perfect Payments" — *pic7*).

- `achievements`: `key`, `title`, `description`, `icon`, `criteria` (jsonb)
- `user_achievements`: `user_id`, `achievement_id`, `earned_at`

### 4.12 `support_tickets` and `ticket_messages`

Support center (*pic2* contact form + "Support Tickets" nav; "Every message becomes a tracked ticket").

- `support_tickets`: `user_id` (nullable for public contact form), `subject`, `category` (`billing`, `reporting`, `onboarding`, `account_access`, `other`), `status` (`open`, `pending`, `resolved`, `closed`), `priority`, `assigned_staff_id`
- `ticket_messages`: `ticket_id`, `author_type` (`member`, `staff`), `author_id`, `body`, `attachments` (jsonb)

### 4.13 `faqs` and `help_articles`

Help center content (§5.5). `faqs`: `question`, `answer`, `category`, `display_order`, `is_published`. `help_articles`: `slug`, `title`, `body_markdown`, `category`, `is_published`.

### 4.14 `marketplace_items`

The "Marketplace" nav (courses, vendor lists, resources). `title`, `type` (`course`, `vendor`, `resource`, `product`), `description`, `price_cents` (nullable if included), `access_level` (which plan unlocks it), `content_ref`.

### 4.15 `products` / `purchases`

"Products" and "My Purchases" nav (*pic7*) — one-off purchases distinct from the subscription (e.g., an AI business plan, a course). `products`: catalog. `purchases`: `user_id`, `product_id`, `stripe_payment_intent_id`, `amount_cents`, `status`, `purchased_at`.

### 4.16 `audit_log`

Append-only record of sensitive actions (login, EIN view, report pull, plan change, admin actions). `actor_id`, `action`, `entity_type`, `entity_id`, `ip`, `user_agent`, `metadata` (jsonb), `created_at`. Required for compliance (§13, §14).

### 4.17 `email_verifications`, `password_resets`, `sessions`

Standard auth support tables (or delegate to an auth provider — §8).

### 4.18 Relationship summary

A `user` owns one or more `businesses`; each business has one or more `representatives`, and accumulates `credit_reports`, `score_history`, and `tradelines`. A `user` has at most one active `subscription` (to a `plan`) plus a history of `invoices` and `purchases`. `support_tickets`, `checklist progress`, and `achievements` hang off the `user`. Everything sensitive is mirrored into `audit_log`.

---

## 5. Marketing site (public / unauthenticated)

Server-rendered for SEO and speed. Clean, card-based, generous whitespace, a single accent color (the reference uses a muted green). Sticky top nav with logo, primary nav links, "Log in" (text) and "Sign up" (filled button) at right — matching *pic2*.

### 5.1 Global navigation

Top nav items (from the reference): **Company** (dropdown: About, Blog, Careers), **Learn** (dropdown: Help Center, guides on business credit), **Pricing**, plus **Log in** and **Sign up**. Footer: Terms, Privacy, Contact, social, and a "Bureaus available with a plan: Creditsafe, Equifax" line (*pic6*).

### 5.2 Home / landing page

Sections, top to bottom:

1. **Hero** — headline built on the core promise ("Your business should stand on its own credit, not your personal score"), subhead, primary CTA ("Create your free account — no card required"), secondary CTA ("See plans").
2. **"Build business credit in 3 easy steps"** — a three-column band: *(1)* Create your EIN-only account & add business info, *(2)* Choose a plan and connect a bureau, *(3)* Get monitored & reported monthly, watch your score grow. Each step: icon, title, one-sentence description.
3. **"Reports to the bureaus"** — logos/labels for Creditsafe, Equifax Business, and (aspirationally) Dun & Bradstreet, with the honest qualifier language required by §12. MUST NOT overstate reporting that isn't live (see compliance note §14.4).
4. **Feature highlights** — dashboard screenshot, score monitoring, alerts, tradeline tracker, checklist, AI business plan, courses.
5. **Plan teaser** — three pricing cards (Starter/Professional/Enterprise) with "See full pricing" link.
6. **Social proof / FAQ teaser / final CTA.**

### 5.3 Pricing page

Full plan comparison (see §9). Three cards with price, tagline, feature checklist, and a CTA per plan: Starter/Professional → "Subscribe" (self-serve Stripe Checkout); Enterprise → "Contact Sales" (lead form). A monthly/annual toggle MAY be added. A detailed feature-comparison table below the cards is recommended.

### 5.4 Contact page (*pic2*)

Two-column layout. Left: heading ("Contact [Brand] — We're Here to Help"), supporting copy, and info blocks — **Email**, **Response time** ("Most inquiries get a reply within 24 hours"), **Hours** ("Mon–Fri, 9:00 AM – 6:00 PM Eastern"), **Support scope** ("Billing, reporting, onboarding, account access, and questions about your file"), and a "What happens after you send this" numbered explainer. Right: **"Send us a message"** form — First name, Last name, Email, Phone (optional), Message; submit button "Send message." Submission MUST create a `support_ticket` (§4.12) and send an autoresponder email. Protect with spam defenses (§13.6).

### 5.5 Help center

Public, searchable knowledge base backed by `help_articles` and `faqs` (§4.13). Organized by category (Getting started, Billing, Credit reporting, Account access, Disputes). A prominent search box, category tiles, popular articles, and a "Still need help? Contact us / Open a ticket" CTA. Authenticated users get a "My tickets" view (§7.4).

### 5.6 About / Company & "About business credit"

Static content pages: company story, mission, team, and an educational pillar page explaining what business credit is, how it differs from personal credit, what the bureaus are, and why EIN-based credit matters. These are SEO assets — treat as CMS-managed markdown (`help_articles` or a headless CMS like Sanity/Contentful if the content team wants WYSIWYG).

---

## 6. Onboarding & account creation

The reference uses a **three-step wizard**: **Business → Representative → Account** (*pic1*, *pic6*, top stepper). Implement as a resumable multi-step flow with progress saved after each step so a user can leave and return.

### 6.1 Step 1 — Business information (*pic1*)

Fields, with validation:

- **Business Name*** — required, 2–120 chars.
- **D.B.A / Trade Name** — optional.
- **Street Address*** — required. **Address Line 2** — optional.
- **City*** — required. **State*** — required (dropdown, 2-letter). **ZIP*** — required (5 or 9 digit, US format).
- **Tax ID (EIN)*** — required, **exactly 9 digits** (the UI hint reads "9 digits only"). Validate format `NN-NNNNNNN`; store normalized. Encrypt at rest (§13).
- **Business Entity Type*** — required (dropdown; enum in §4.2).
- **Phone*** — required, **10 digits** (hint "10 digits only"), US format.
- **Continue** advances to step 2.

Client-side validation for UX; **server-side validation is authoritative** and MUST re-check everything.

### 6.2 Step 2 — Representative

- First name, Last name, Title, Email, Phone.
- Ownership percentage.
- Attestation checkboxes (rendered on the Account step in the reference, but the data belongs to the representative): "I confirm the registered representative has at least 25% ownership."

### 6.3 Step 3 — Account (*pic6*)

- **Email*** (prefilled if captured earlier), **Password***, **Confirm password*** (with show/hide toggles and a strength meter).
- Consent checkboxes: attestation (above), "I agree to the Terms of Service and Privacy Policy" (**required**), "Send me product announcements" (optional, drives marketing-email consent flag).
- **Create Account** button. On success: create `user` (unverified), `business`, `representative`; send verification email; log them in; land on the dashboard with an "email not verified" banner and onboarding checklist.
- "Free to start — no card required." Subscription/checkout is a **separate, later** action, not part of signup.

### 6.4 Business identity verification

After signup, the business SHOULD be verified before any bureau interaction. Options: automated business-entity verification via a KYB provider (e.g., Middesk, Baselayer, or similar) that checks EIN/entity registration; or a manual staff review queue for v1. Set `businesses.verification_status` accordingly. Gate live reporting on `verified`.

⚠️ **REALITY CHECK:** Anyone can type any EIN into a form. Without KYB verification, you risk users building "credit" for businesses they don't control — a fraud and compliance problem. Budget for a KYB step; do not treat it as optional polish.

### 6.5 Email verification

Standard token flow. Unverified users can browse the dashboard shell but MUST NOT be able to subscribe, pull reports, or connect a bureau. The dashboard shows a persistent "Verify your email" prompt (*pic7* onboarding item) with a resend control (rate-limited).

---

## 7. Authenticated application (the dashboard)

A left sidebar + main content shell (*pic3*, *pic7*). Sidebar groups: **Core** (Home, My Purchases, Products), **Tools** (Business Credit Score, Credit Progress, Tradeline Tracker, Credit Checklist, Marketplace), **Account** (Subscriptions & Billing, Company Info, Support Tickets, Feedback, Settings). Footer of sidebar shows the signed-in user/business with a switcher. Every "Tools" data view is **gated by subscription entitlements** (§9.3) — unsubscribed users see a locked state with an upsell.

### 7.1 Home (dashboard landing)

- Greeting ("Good evening, [Name]" — *pic7*), plan status pill ("You're on the Free plan / No card on file").
- **"Connect a bureau"** card when no bureau is connected ("No bureaus are connected"). This is the primary conversion action for free users.
- **Onboarding widget** — "Get started · X of 5 complete" with the checklist (verify email, add business info, choose a plan, connect a bureau, complete profile).
- **Achievements** — "X of 12 milestones earned," badge grid (e.g., "Perfect Payments").
- Score summary tiles (once subscribed): current score per connected bureau, delta since last month, next report date.

### 7.2 Business Credit Score (*pic3* / reports)

- Per-bureau score cards (Creditsafe 0–100, Equifax Business 0–650), each with score, band label, last-pulled date, and a **"Pull / refresh report"** action (rate-limited; consumes a monthly allowance depending on plan).
- A **"Pull your live credit report"** button that enqueues a bureau fetch (§11) and, when complete, produces a downloadable PDF (`credit_reports.pdf_url`) and an on-screen breakdown.
- "No file" empty state when the bureau has no record of the business yet — with guidance on how a file gets established.

### 7.3 Credit Progress, Tradeline Tracker, Credit Checklist

- **Credit Progress** — line chart from `score_history`, per bureau, with milestone annotations.
- **Tradeline Tracker** — table of `tradelines`; users can add accounts they hold (Net-30 vendors, cards, loans), see reported status per bureau, and get nudges ("this account isn't reporting").
- **Credit Checklist** — actionable steps to build credit (get a D-U-N-S number, open Net-30 vendor accounts, separate finances, etc.), each with completion tracking and points feeding achievements.

### 7.4 Support Tickets

Authenticated ticket list (status, subject, last update) + thread view where the member and staff exchange `ticket_messages`. "Open a ticket" form mirrors the categories in §4.12. Public contact-form submissions (§5.4) appear here once the user is matched by email.

### 7.5 Subscriptions & Billing (*pic3*, *pic5*)

Mirrors the reference exactly:

- **Summary tiles:** Plan price, Total paid (lifetime), Paid invoices count, Status (`Active`/`Inactive`), Period end, Days remaining. A **Refresh** control re-syncs from Stripe.
- **"No active subscription"** state with "Choose a plan below to activate business credit monitoring."
- **Payment Method** panel: card on file (brand + last4) or "No payment method on file — Add card." "Add Card" opens Stripe (§10).
- **Plan Options** panel: the three plans with Subscribe / Contact Sales buttons, and the note "Upgrades apply immediately with prorated charges. Downgrades take effect next cycle."
- **Billing History** panel: `invoices` list with amounts, outcomes, and PDF downloads; "No invoices are available yet" empty state.

### 7.6 Company Info, Products / My Purchases, Marketplace, Feedback, Settings

- **Company Info** — edit the `business` and `representative` records post-signup (with re-verification if EIN/legal name changes).
- **Products / My Purchases** — one-off products catalog and purchase history (§4.15).
- **Marketplace** — courses, vendor lists, resources (§4.14), some gated by plan.
- **Feedback** — lightweight form writing to an internal feedback table / ticket.
- **Settings** — profile, password, MFA, email preferences (marketing consent), notification settings, close-account, data export (§14).

---

## 8. Authentication & authorization

### 8.1 Approach

Recommended: use a managed auth layer rather than hand-rolling — **Auth.js (NextAuth), Clerk, or Supabase Auth** integrate cleanly with Next.js on Vercel. If building in-house, follow OWASP ASVS. Requirements either way:

- Email + password with **bcrypt/argon2** hashing (never store plaintext; never log passwords).
- Email verification required before privileged actions (§6.5).
- Password reset via single-use, expiring, hashed tokens.
- **MFA (TOTP)** available and REQUIRED for `admin`/`staff`.
- Sessions via secure, httpOnly, SameSite cookies (or short-lived JWT + refresh). Absolute + idle timeouts. "Log out everywhere" control.
- Rate limiting and lockout on login, reset, and verification endpoints.

### 8.2 Authorization model

Role-based (`member`, `staff`, `admin`) plus **entitlement checks** derived from the active subscription. The backend MUST enforce, on every request, both: (a) the user owns the resource (a user can only read *their* business's reports), and (b) the user's plan entitles them to the action (§9.3). Never trust the frontend's gating — it's cosmetic. Every sensitive read/write goes through a server-side guard and is written to `audit_log`.

### 8.3 Admin surface

A separate admin area (or a role-gated section) for staff to: search/manage users and businesses, review KYB verification queue, manage plans and content (FAQs, help articles, marketplace), handle support tickets, view the bureau-reporting pipeline and reporting runs, and issue refunds/credits (via Stripe). All admin actions audited.

---

## 9. Plans, pricing & entitlements

### 9.1 The three tiers (from *pic5* / *pic8*)

**Ruproa reference pricing, to mirror the model** (your final numbers are your call):

- **Starter — $19/mo.** "Unlock your live credit file. See your report, your score, and what to fix." Features: pull your live business credit report from Creditsafe **or** Equifax Business (user's choice); your real business credit score, updated monthly; score monitoring & alerts when something changes; credit-building tips & resources; standard email support.
- **Professional — $49/mo.** "Ideal for growing businesses seeking funding." Features: live reports from **both** bureaus (Creditsafe & Equifax Business); detailed credit analysis reports; monthly credit-score monitoring; priority phone & chat support.
- **Enterprise — $99/mo.** "Comprehensive solution for established businesses." Features: reports to Creditsafe & Equifax Business **plus each new bureau added**; monthly reporting tracker; advanced analytics dashboard; dedicated account manager; premium bureau reporting; monthly credit-score monitoring; credit-building tips & resources. CTA is **"Contact Sales"** (not self-serve).

> Note: The reference site shows a free/$0 "no active subscription" state as the default; paid tiers unlock the tools. There is also a "Free plan" concept (browse dashboard, checklist, marketplace) with no card required.

### 9.2 Plan behavior rules (from the reference UI)

- **Upgrades** apply immediately with **prorated** charges.
- **Downgrades** take effect at the **next billing cycle**.
- Enterprise is sales-assisted (lead form → manual Stripe setup or invoice billing).

### 9.3 Entitlements (machine-readable gating)

Store an `entitlements` object per plan and check it server-side. Suggested keys:

- `bureaus_allowed`: `["creditsafe"]` (Starter picks one), `["creditsafe","equifax_business"]` (Pro/Enterprise).
- `reports_per_month`: integer allowance for live pulls.
- `monitoring`: bool. `alerts`: bool. `detailed_analysis`: bool. `advanced_analytics`: bool.
- `support_tier`: `standard` | `priority` | `dedicated`.
- `reporting_tracker`: bool (Enterprise).
- `marketplace_access_level`: which items unlock.

The app derives what a user can see/do purely from the active subscription's plan entitlements. Free users get an empty/locked entitlement set.

---

## 10. Payments & billing (Stripe)

The brief requires accepting credit cards and connecting to Stripe. Use **Stripe Billing (Subscriptions)** — do not build custom card handling.

### 10.1 Golden rules

- **Never touch raw card data.** Use Stripe-hosted **Checkout** or **Elements/Payment Element** so card details go directly to Stripe. This keeps you in **PCI-DSS SAQ A** scope (the lightest). Handling raw PANs yourself is a non-starter.
- **Stripe is the source of truth for billing.** Your DB mirrors it via webhooks. Never mark a user "paid" based on a client-side redirect alone.
- All secret keys live server-side only. The publishable key is the only Stripe key the browser sees.

### 10.2 Objects & mapping

- Each `user` (or business) maps to one Stripe **Customer** (`stripe_customer_id`).
- Each `plan` maps to a Stripe **Product** + recurring monthly **Price** (`stripe_price_id`).
- A subscription creates a Stripe **Subscription**; mirror to `subscriptions` (§4.5).
- Invoices mirror to `invoices` (§4.6).

### 10.3 Checkout flow (self-serve: Starter / Professional)

1. User clicks "Subscribe" on a plan.
2. Backend creates (or reuses) the Stripe Customer, then creates a **Checkout Session** in `subscription` mode for that plan's Price, with success/cancel URLs.
3. Redirect to Stripe-hosted Checkout (or embed Payment Element). Card is entered on Stripe.
4. On completion, Stripe fires `checkout.session.completed` and subscription/invoice events → your webhook updates `subscriptions`, `invoices`, and unlocks entitlements.
5. Success page confirms; dashboard now shows "Active."

### 10.4 Managing an existing subscription

Use the **Stripe Customer Portal** (hosted) for card updates, plan changes, cancellation, and invoice history — it removes large amounts of custom UI and handles proration and dunning. "Add Card," "Manage plan," and "Cancel" in the Billing section deep-link into a Portal session. Your Billing summary tiles (§7.5) read from the mirrored data. Configure the Portal to allow upgrade-now / downgrade-next-cycle per §9.2.

### 10.5 Enterprise / Contact Sales

No self-serve checkout. Lead form → sales → staff creates the subscription in Stripe (or sends a Stripe **Invoice** for invoice-based billing). The account is provisioned with Enterprise entitlements manually or via an admin action.

### 10.6 Webhooks (critical)

A dedicated backend endpoint receives Stripe webhooks. It MUST:

- **Verify the webhook signature** using the signing secret (reject anything unsigned/mismatched).
- Be **idempotent** — Stripe retries; process each event id once (store processed event ids).
- Enqueue processing to the job queue rather than doing heavy work inline; return 2xx fast.

Events to handle at minimum: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `customer.subscription.paused/resumed`, `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`, `payment_method.attached/detached`.

⚠️ **Vercel note:** Stripe webhook signature verification needs the **raw request body**. In Next.js route handlers you MUST read the raw body (disable automatic body parsing / use the raw text) before verifying. A parsed/re-serialized body breaks signature checks. See §15.2.

### 10.7 Dunning & failed payments

On `invoice.payment_failed`, set `subscription.status = past_due`, restrict entitlements per your grace policy, and let Stripe's **Smart Retries** + email reminders (or Portal) drive recovery. On repeated failure Stripe moves to `canceled`/`unpaid` → downgrade to Free. Surface a clear "update your card" banner throughout.

### 10.8 One-off purchases

For "Products / My Purchases," use Stripe **Payment Intents** / Checkout in `payment` mode; record `purchases` on `payment_intent.succeeded`.

### 10.9 Tax & compliance

Enable **Stripe Tax** for automatic sales-tax calculation if selling across US states. Keep Stripe-hosted invoices/receipts as the system of record for billing documents.

---

## 11. Credit-bureau data: two directions

There are **two completely different** bureau operations, and conflating them is the #1 mistake in this space. Build them as separate subsystems.

### 11.1 Direction A — Pulling reports (reading data *from* bureaus)

This powers "pull your live credit report" and score display (§7.2). You call a bureau (or an aggregator) with the business's identifiers and get back that business's file/score.

- **Interface:** a `BureauClient` abstraction with one implementation per source (`CreditsafeClient`, `EquifaxBusinessClient`, `DnbClient`), each conforming to a common interface: `fetchReport(business) → NormalizedReport`. This lets the app treat all bureaus uniformly and add new ones without touching the UI.
- **Flow:** user (with entitlement) requests a pull → backend enqueues a job → worker calls the bureau API → response stored in `credit_reports.raw_payload`, normalized fields extracted, `score_history` appended, PDF rendered to S3 → user notified.
- **Normalization:** map each bureau's schema/score scale into your `NormalizedReport` shape (score, band, scale, tradelines, public records, risk factors). Keep the raw payload for audit and re-parsing.
- **Access model:** Direction A generally requires a **commercial contract/reseller agreement** with each bureau (Creditsafe API, Equifax Business API, D&B Direct/D&B API), or going through an aggregator that resells business-credit data. Each has credentialing, per-pull or subscription pricing, and permissible-use rules. Budget procurement time.

### 11.2 Direction B — Reporting tradelines (writing data *to* bureaus)

This is the "we report your payments to the bureaus so your score builds" promise (home page, plan features, "premium bureau reporting"). Here **you** act as a **data furnisher**, submitting payment/tradeline records about businesses to the bureau on a monthly cycle.

- **Format:** Equifax accepts a **standard commercial layout template** for non-financial contributors (Metro 2® is accepted only from financial institutions, and *not* from non-financial contributors). Creditsafe and D&B each have their own trade-data submission programs and formats. Plan for **per-bureau file builders** producing each bureau's required layout.
- **Cadence:** complete files submitted **monthly** (preferred) via the bureau's secure electronic channel.
- **Pipeline:** a scheduled monthly job assembles eligible tradeline records → validates against the bureau's spec → generates the submission file per bureau → transmits securely → ingests the bureau's acknowledgment/error report → updates `tradelines.reported_to` and reporting-run status (surfaced in the Enterprise "monthly reporting tracker").

⚠️ **This is where the hard constraints live. Read §12 before scoping Direction B.**

---

## 12. ⚠️ REALITY CHECK — bureau reporting is the crux of the whole project

You asked for full detail plus an honest reality check. Here it is, because this single area determines whether the product is legitimate, and how long it takes to launch.

### 12.1 Becoming a data furnisher is a gated, contractual process — not an API you sign up for

To furnish business tradeline data you must apply to and be **approved by each bureau individually**, obtain a member/contributor number, sign a data-furnishing/membership agreement, and pass a credentialing/vetting review of your business and the *quality and legitimacy* of your data. Equifax, for example, issues an **Equifax Member Number** only after credentialing, requires electronic monthly submission in their prescribed layout, and (for commercial trade-credit contributors) expects a meaningful volume of records. Creditsafe and D&B run their own trade-data/exchange programs with their own onboarding. **There is no self-service "report to the bureaus" API you can integrate in a sprint.** Onboarding is measured in weeks to months per bureau.

### 12.2 The two disqualifiers that directly threaten this business model

From Equifax's published commercial data-furnisher rules (and echoed by the other bureaus' quality policies):

1. **"Furnishers that report tradelines on themselves are NOT accepted."**
2. **"Furnishers that report 'pay for tradelines' are NOT accepted."**

Read those carefully against the product concept. A platform where a business **pays a monthly subscription and in exchange the platform reports a tradeline that makes that business's credit look better** is, on its face, close to a "pay for tradelines" arrangement — exactly what bureaus reject. If the only "tradeline" being reported is *the subscription itself* (the business paying you), that is *reporting a tradeline on yourself/your own customer* and is also disqualified.

**Implication:** The legitimate version of Direction B is that you report **real, arm's-length credit obligations** — genuine Net-30/trade-credit accounts where you (or vendors in your network) actually extend credit and the business actually owes and repays — not a synthetic tradeline sold as a subscription perk. If the business plan depends on manufacturing tradelines for a fee, it will fail bureau vetting and can expose you to FCRA/FCBA and FTC "credit repair / credit building" scrutiny.

### 12.3 What this means for scope and sequencing

- **Direction A (pulling reports + monitoring) is buildable and legitimate now.** It requires bureau/aggregator data agreements but is a normal commercial integration. Almost every feature the screenshots show — scores, monitoring, alerts, progress charts, checklist, tradeline *tracking*, education, marketplace — lives here. **Launch on Direction A.**
- **Direction B (furnishing) is a separate, longer track** with legal review, per-bureau applications, and a legitimate data source (a real net-terms vendor/lending product, or partnerships with vendors who furnish). Treat it as a **Phase 2+** initiative with counsel involved. Until it's live and approved, marketing MUST NOT claim active reporting to a bureau you don't yet furnish to (§14.4).
- **Get legal counsel** experienced in FCRA, the CROA (Credit Repair Organizations Act — note it centers on *consumer* credit, but "business credit building" marketing has drawn FTC attention), and bureau furnisher obligations **before** launching Direction B or making reporting claims.

### 12.4 Honest marketing constraints

The reference site is careful to name only **Creditsafe and Equifax Business** as what it reports to, and treats additional bureaus as "each new bureau we add." Follow that discipline: only claim what is contractually live, phrase forward-looking bureaus as roadmap, and avoid implying guaranteed score increases. Build a config flag per bureau (`reporting_live: bool`) so the marketing copy and dashboard "Connect a bureau" options are driven by what's actually approved, never hardcoded ahead of approval.

---

## 13. Security & data protection

This app holds EINs, business financials, and credit files — sensitive data with real regulatory weight. Security is not a phase; it's a constraint on every section above.

### 13.1 Data classification

- **Highly sensitive:** EIN, any SSN/SSN-last4 (avoid entirely if possible), full credit reports, bank/financial data. Encrypt at rest with envelope encryption (app-level encryption for the field **plus** disk encryption). Access via least privilege; every read audited.
- **Sensitive:** business profile, representative PII, billing metadata.
- **Operational:** everything else.

### 13.2 Encryption

- TLS 1.2+ everywhere in transit (HSTS on).
- Field-level encryption for EIN/SSN using a KMS-managed key (AWS KMS, GCP KMS, or Vault). Never store these in plaintext columns, logs, analytics, or error trackers.
- Full-disk / at-rest encryption on the database and object store (managed providers give this by default — verify it's on).

### 13.3 Secrets

All API keys (Stripe, bureaus, email, KMS) in a secrets manager / Vercel encrypted environment variables — never in the repo, never in the client bundle. Rotate on a schedule and on staff offboarding.

### 13.4 PCI scope

By using Stripe Checkout/Elements and never transmitting raw card data through your servers, you stay in **PCI-DSS SAQ A**. Document this; don't accidentally break it by proxying card fields.

### 13.5 Access control & audit

Least-privilege roles, MFA for staff/admin, and an append-only `audit_log` for: authentication events, EIN/report views, plan changes, admin actions, data exports, and every bureau interaction. Logs MUST NOT contain the sensitive values themselves — reference by id.

### 13.6 Application security baseline

Follow the OWASP Top 10: parameterized queries (no SQL injection), output encoding (no XSS), CSRF protection on state-changing requests, strict CORS, security headers (CSP, HSTS, X-Frame-Options), server-side input validation on everything, rate limiting on auth and public forms, bot/spam protection (CAPTCHA/hCaptcha + honeypot) on the contact form and signup, and dependency scanning in CI.

### 13.7 Backups & retention

Automated encrypted DB backups with tested restores; documented retention windows for credit data; a data-deletion path for account closure (§14) that also purges from backups on the defined schedule.

---

## 14. Legal & regulatory considerations (build these into the product)

Not legal advice — engineering requirements that a lawyer will confirm.

1. **FCRA obligations.** Handling credit data (both pulling and, especially, furnishing) triggers Fair Credit Reporting Act duties: permissible purpose for pulls, accuracy and dispute-handling duties for furnished data, and a documented **dispute resolution** workflow (the reference site's "dispute resolution tracking"). Build a dispute intake + investigation + response flow tied to `tradelines`/`credit_reports`.
2. **KYB / anti-fraud.** Verify businesses and representatives (§6.4) to avoid enabling identity or credit fraud.
3. **Consumer-protection posture.** "Business credit building" services have drawn FTC scrutiny when they imply guaranteed results or sell synthetic tradelines. Avoid guarantees; substantiate claims; keep disclosures clear.
4. **Truthful reporting claims.** Drive every "reports to X bureau" statement from the `reporting_live` flag (§12.4). No claim without an approved furnisher agreement.
5. **Privacy compliance.** Privacy Policy + Terms (consented at signup — *pic6*), data-subject request handling, marketing-consent tracking (the optional announcements checkbox), and cookie/consent management. Consider CCPA/CPRA and state equivalents.
6. **Records & auditability.** Retain furnishing submissions, acknowledgments, and dispute outcomes for the periods your counsel specifies.

---

## 15. Infrastructure & deployment (Vercel)

The frontend is Next.js on **Vercel** (your stated host). Here's how the whole system maps onto that, including the parts Vercel is *not* the right home for.

### 15.1 What runs on Vercel

- **Next.js app** (marketing SSR/SSG + authenticated dashboard) — Vercel's core strength: global edge CDN, preview deployments per PR, automatic HTTPS, and environment-variable management.
- **Lightweight API via Next.js Route Handlers / Server Actions** — fine for request/response backend logic, auth callbacks, and Stripe Checkout/Portal session creation, running as Vercel Serverless (or Edge) Functions.

### 15.2 What should NOT rely on Vercel serverless alone

Vercel functions are **stateless and time-limited**, which conflicts with parts of this system:

- **Background/scheduled workers** — monthly bureau reporting runs, report pulls, PDF generation, dunning follow-ups. These are long-running and stateful. Use a **separate worker service** (a small always-on Node service on Render/Railway/Fly/AWS ECS) consuming a **Redis/BullMQ** queue, or a managed queue + workers. **Vercel Cron** can *trigger* jobs on a schedule, but the heavy work should run on the worker tier, not inside the cron function.
- **Stripe & data-provider webhooks** — implement the endpoint as a Next.js Route Handler on Vercel, but it MUST read the **raw body** for signature verification (§10.6) and then **enqueue** to the worker tier rather than doing heavy processing within the function's time limit.
- **Persistent connections / long jobs** — anything exceeding function limits belongs on the worker tier.

### 15.3 Managed dependencies

- **Database:** managed Postgres reachable from both Vercel functions and workers — **Neon** or **Supabase** (serverless-friendly Postgres) pair well with Vercel; use connection pooling (PgBouncer / Neon pooler) because serverless creates many short-lived connections.
- **Redis:** managed (Upstash integrates natively with Vercel) for cache, sessions, and the job queue.
- **Object storage:** S3 or Cloudflare R2 for report PDFs and documents (served via signed URLs, never public).
- **Email:** transactional provider (Resend, Postmark, or SES) for verification, receipts, alerts, dunning.
- **Observability:** error tracking (Sentry), uptime monitoring, and structured logging — with PII scrubbing so EINs/reports never reach logs.

### 15.4 CI/CD

Git-based: Vercel auto-deploys previews on PRs and production on merge to `main`. Run tests, linting, type-checks, and dependency/secret scanning in CI before deploy. Database migrations run as a gated step (e.g., Prisma/Drizzle migrations) — never auto-apply destructive migrations on deploy without review.

### 15.5 Suggested repo shape

A monorepo (Turborepo) with: `apps/web` (Next.js on Vercel), `apps/worker` (queue consumers + scheduled jobs, deployed off-Vercel), and `packages/` for shared code — `db` (schema + client), `bureau-clients`, `billing` (Stripe wrappers), `types`, and `ui`. Shared types keep the frontend, API, and workers in lockstep.

---

## 16. Suggested build phases

A pragmatic order that gets a legitimate, revenue-generating product live before the hardest (furnishing) piece.

**Phase 0 — Foundations.** Repo/monorepo, CI/CD to Vercel, Postgres + migrations, auth (signup/login/verify/reset, MFA for staff), base layout and design system, legal pages.

**Phase 1 — Marketing + accounts.** All public pages (home with 3-steps, pricing, contact→tickets, help center, about/education), the 3-step onboarding wizard, business/representative profile, email verification, KYB verification step, dashboard shell with sidebar, onboarding checklist/achievements.

**Phase 2 — Monetization.** Stripe Products/Prices, Checkout, Customer Portal, webhooks + mirrored subscriptions/invoices, entitlement gating, Subscriptions & Billing UI, one-off Products/Purchases.

**Phase 3 — Credit data (Direction A).** Bureau/aggregator data agreements, `BureauClient` implementations, report pulls, score dashboard + history charts, monitoring/alerts, tradeline tracker, PDF reports, dispute intake. **This is a launchable, legitimate product.**

**Phase 4 — Furnishing (Direction B).** Only after legal review and per-bureau furnisher approval: reporting file builders, monthly submission pipeline, acknowledgment ingestion, reporting tracker, and the honest, config-gated "reports to X" marketing.

**Phase 5 — Growth.** Marketplace/courses, affiliate program, advanced analytics (Enterprise), additional bureaus, AI business-plan generator.

---

## 17. Open decisions to confirm before building

1. Final plan names, prices, and exact feature splits (the spec mirrors Ruproa's $19/$49/$99 model — substitute yours).
2. Which bureau data source for Direction A: direct contracts (Creditsafe / Equifax Business / D&B) vs. an aggregator/reseller. This drives cost and timeline.
3. KYB provider choice (§6.4).
4. Whether v1 supports multiple businesses per user or exactly one.
5. Auth: managed (Clerk/Auth.js/Supabase) vs. in-house.
6. The **legitimate source of furnished tradelines** for Phase 4 — the single most important business decision, and a legal one (§12).

---

## 18. Glossary

- **EIN** — Employer Identification Number; the business's federal tax ID (the "SSN for a business").
- **Tradeline** — a credit account (e.g., a Net-30 vendor account) that appears on a credit file.
- **Data furnisher** — an entity approved to submit account data to a credit bureau.
- **Metro 2®** — a standardized credit-reporting file format (consumer-oriented; for business, bureaus often use their own commercial layouts — Equifax does not accept Metro 2 from non-financial commercial contributors).
- **KYB** — Know Your Business; verifying a business's identity/legitimacy (the business analog of KYC).
- **Entitlement** — a machine-readable permission granted by a plan (what a subscriber can do).
- **Dunning** — the automated process of retrying and chasing failed subscription payments.
- **Net-30** — a trade-credit term: pay within 30 days; a common first business tradeline.

---

*End of specification.*



