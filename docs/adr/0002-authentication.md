# ADR-0002 — In-house authentication

**Status:** Accepted · **Date:** 2026-08-03 · **Closes:** decision D5

## Context

Spec §8.1 recommends a managed auth provider (Auth.js, Clerk, Supabase Auth)
"unless there's a strong reason to build in-house". TASK-02 adds the counter-
weight: "Managed-auth lock-in — confirm data-export and migration paths before
committing; auth is painful to swap later."

## Decision

Build in-house, against the requirements the spec lists rather than a vendor's
feature set.

- **Hashing: bcrypt at cost 12.** Argon2id is the stronger primitive, but every
  Node binding for it is native, and native modules break across Vercel's build
  image, an Alpine worker container, and Windows development machines.
  `bcryptjs` is pure JavaScript, behaves identically everywhere, and cost 12 is
  within OWASP guidance. Revisit if a pure-WASM argon2 becomes boring.
- **Sessions: opaque random token in an httpOnly cookie**, SHA-256 hashed in
  `sessions`. A database leak does not yield live sessions.
- **Two expiries.** Idle (slides, default 60 min) and absolute (fixed, default
  30 days). They expire for different reasons and conflating them means picking
  the wrong trade-off for one of them.
- **`SameSite=Lax`, not `Strict`.** Strict breaks the return leg from Stripe
  Checkout and from emailed verification links — the user comes back signed out
  at the worst possible moment. Lax still blocks cross-site POSTs, and Server
  Actions add their own origin check.
- **TOTP implemented directly.** ~40 lines of well-specified arithmetic
  (RFC 6238). A dependency in the auth path is a supply-chain surface, and
  there is nothing here to get creatively wrong.

## Non-enumeration is a design constraint, not a message tweak

Signup, login, and password reset respond identically whether or not an account
exists. That shapes the control flow:

- Login burns an equivalent bcrypt comparison when the user is not found, so the
  timing does not distinguish the cases.
- Signup with an existing address returns the same success copy as a fresh
  signup and emails the real owner instead.
- Password reset always returns the same acknowledgement.

## Consequences

- We own rotation, lockout, and MFA — all implemented, all tested.
- No vendor migration risk, and no per-MAU cost.
- If the product later needs SSO or social login, that is a real build rather
  than a provider toggle.
