# ADR-0005 — Direction B (bureau furnishing) is not built

**Status:** Accepted · **Date:** 2026-08-03 · **Owner:** Legal/Compliance
**Relates to:** TASK-06 (BLOCKED), decision D6 (OPEN)

## Context

The product concept includes reporting business payment activity *to* commercial
bureaus. Spec §12 is unambiguous about what that requires and what it forbids.

Two disqualifiers, published by Equifax for commercial data furnishers and
echoed by the other bureaus' quality policies:

1. Furnishers that report tradelines **on themselves** are not accepted.
2. Furnishers that report **"pay for tradelines"** are not accepted.

A platform where a business pays a subscription and in exchange the platform
reports a tradeline that improves that business's file is, on its face, both of
those things.

## Decision

**No furnishing pipeline exists in this codebase.** Not disabled — absent.

What does exist:

- `packages/bureau-clients/src/furnishing.ts` documents the `FurnishingBuilder`
  contract and **throws unconditionally** from `buildSubmissionFile`.
- `checkFurnishingEligibility` encodes the two disqualifiers structurally: a
  record derived from the subscription, or not arm's-length, or marked
  `platform_reported`, is rejected with a reason. It is written now, before
  there is any pressure to ship around it.
- A per-bureau `reporting_live` flag gates every "reports to X" statement in the
  product. `getReportingClaim()` in `packages/config` is the only sanctioned
  source of that copy, and it returns `null` when no bureau is approved — so the
  path of least resistance is to render nothing.
- No monthly reporting run is registered in the scheduler. Registering a
  disabled pipeline invites someone to enable it.

## The preconditions for revisiting this

All of these, in this order:

1. Legal review of the furnishing model (FCRA, CROA, FTC posture).
2. A confirmed **legitimate, arm's-length source** of tradelines — real credit
   extended and repaid, not a subscription artefact. This is decision D6 and it
   is a business decision, not an engineering one.
3. Per-bureau application, credentialing, and a signed furnishing agreement.
   Weeks to months, per bureau. There is no self-service API.

## Consequences

- Direction A (pulling reports, monitoring, scoring, tradeline tracking,
  checklist, disputes) is complete and is a legitimate, launchable product on
  its own — which is exactly what spec §12.3 recommends.
- Marketing cannot accidentally claim reporting: the copy helpers make the
  truthful rendering the default and the overstated one impossible.
- The `platform_reported` tradeline source exists in the schema so TASK-06 has a
  home. **Nothing in this codebase writes it.**
