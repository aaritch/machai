# ADR-0001 — Monorepo shape and stack

**Status:** Accepted · **Date:** 2026-08-03 · **Closes:** part of TASK-01

## Context

The spec (§15.5) calls for a Turborepo monorepo with two deployables — a Next.js
app on Vercel and an always-on Node worker — sharing logic through `packages/*`.
The hard constraint driving this is spec §15.2: Vercel functions are stateless
and time-limited, so report pulls, monthly runs, and PDF generation cannot live
there.

## Decision

pnpm workspaces + Turborepo, `apps/web` and `apps/worker`, with thirteen shared
packages.

Two deviations from the file tree in the project plan, both additive:

- **`packages/queue`** — the plan puts queue definitions under
  `apps/worker/src/queues`, but the web app must also *produce* jobs. A shared
  package keeps the producer contract in one place without the web app
  importing worker code.
- **`packages/billing-sync`** — the plan's C.1 boundary says `packages/billing`
  owns Stripe and "must not persist data directly". Something still has to write
  the mirror, and both tiers need it (the web app for Refresh and reconcile, the
  worker for webhook consumers). Putting it in its own package preserves the
  boundary instead of quietly violating it or duplicating the logic on both
  sides.

`packages/storage` was also added; the plan implies object storage without
naming a home for it.

## Packages ship TypeScript source

Workspace packages export `./src/index.ts` directly rather than a build
artifact. Next compiles them via `transpilePackages`; the worker runs under
`tsx`. This removes a build step and a class of "stale dist" bugs. The cost is
that consumers must be TypeScript-aware, which both of ours are.

## Consequences

- One `pnpm install`, one lockfile, one CI gate.
- Vercel's Root Directory must be set to `apps/web` (see `docs/DEPLOYMENT.md`).
- `packages/types` is the contract hub: a shape change there recompiles both
  apps, which is the intended safety.
- Relative imports inside packages are extensionless rather than `.js`-suffixed.
  drizzle-kit resolves its schema graph through a CJS loader that cannot map a
  `.js` specifier onto a `.ts` file; every other consumer here (Next, tsx,
  Vitest) handles extensionless fine.
