# ADR-0004 — Degrading gracefully when services are unprovisioned

**Status:** Accepted · **Date:** 2026-08-03

## Context

TASK-01 provisions Postgres, Redis, object storage, Stripe, and an email
provider. None of those exist at the moment someone first clones this repo or
first connects it to Vercel — and the marketing site is the top of the
acquisition funnel.

The naive behaviour is an error page on `/pricing` until every service is wired.

## Decision

Each subsystem has a defined behaviour when it is absent, chosen so the failure
lands where it costs least.

| Subsystem | Absent behaviour | Why |
|---|---|---|
| Database | Marketing renders from the seed catalog; auth and dashboard are unavailable | A prospect should never see an error page; a member should never see stale data |
| Redis | Queue falls back to the Postgres driver | One fewer service to provision before a job round-trips |
| Queue (both) | Stripe webhooks apply INLINE | Dropping a billing event is worse than a slower response |
| Object storage | Report data saved, PDF skipped | The data is the product; the PDF regenerates on retry |
| Stripe | Checkout returns a typed "not configured" error | Honest and actionable, not a stack trace |
| Email | Console provider in development; **hard failure at boot in production** | Silently swallowing verification emails in production is unacceptable |
| Bureau credentials | Mock client (`BUREAU_MODE=mock`) | Lets TASK-05 be built while the data agreement is unsigned (STATE.md §6) |

## The rule this follows

Degrade where the failure is cosmetic. Fail loudly where the failure is
material. Production refuses to boot without the keys that hold the security
boundary — `SESSION_SECRET`, `ENCRYPTION_KEY`, `STRIPE_WEBHOOK_SECRET` — because
running without them is worse than not running.

## Consequences

- `pnpm build` and `pnpm test` need no external service, so CI is fast and
  hermetic.
- The plan-catalog fallback means the pricing page can drift from the `plans`
  table if the seed is never run. `/api/health` reports which subsystems are
  live, and the fallback only engages when the table is absent or empty.
