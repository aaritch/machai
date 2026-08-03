# TASK-01 — Foundations & infrastructure

**Phase:** 0 · **Owner:** DevOps + Backend lead · **Depends on:** none · **Blocks:** everything

## Objective

Stand up the monorepo, environments, managed services, and CI/CD so that every later task has a place to run, a database to write to, a queue to enqueue on, and a pipeline that deploys safely. When this task is done, a developer can clone, install, run all apps locally, open a PR, and see it deploy to a preview.

## Scope

**In:** monorepo scaffolding, shared packages skeletons, Postgres + Redis + object storage provisioning, secrets management, three environments, CI (checks) and CD (deploys), error tracking/monitoring, base migration + seed harness.
**Out:** any feature logic (auth, billing, reports) — those are their own tasks. This task only proves the plumbing.

## Implementation details

**Monorepo.** Initialize a Turborepo with pnpm workspaces containing `apps/web`, `apps/worker`, and the `packages/*` skeletons from the file tree (`db`, `types`, `billing`, `bureau-clients`, `entitlements`, `emails`, `ui`, `config`, `kyb`, `observability`). Each package exports nothing meaningful yet but compiles. Establish the task pipeline (build, lint, typecheck, test) with caching so CI is fast.

**Web app skeleton.** `apps/web` boots as a Next.js App Router project with the marketing and dashboard route groups present but placeholder. A middleware file exists as the hook point for later auth/entitlement gating. Confirm it deploys to Vercel with a preview URL.

**Worker skeleton.** `apps/worker` boots as a long-running Node service with a health endpoint and an empty queue consumer that logs on start. It deploys to the chosen always-on host (Render/Railway/Fly/ECS), not Vercel. Verify it connects to Redis and Postgres.

**Database.** Provision managed Postgres (Neon or Supabase) with a pooled connection string. Wire the ORM (Prisma or Drizzle) in `packages/db`, add the first migration (even if just an `audit_log` and `plans` table), and a seed script harness. Confirm both `web` and `worker` can read/write through the shared client.

**Redis + queue.** Provision managed Redis (Upstash). Define the queue abstraction in the worker with a typed job registry, an idempotency store (processed-id set), retry with exponential backoff, and a dead-letter destination. Prove a round-trip: enqueue a no-op job from `web`, consume it in `worker`.

**Object storage.** Create a private S3/R2 bucket. Access is only via signed URLs; no public read. Verify upload + signed-download from the worker.

**Secrets & config.** Populate `.env.example` with every key later tasks will need (database, Redis, storage, Stripe, bureau/aggregator, email, KMS, auth provider). Real secrets live in Vercel encrypted env vars (web) and the worker host's secret store. `packages/config` centralizes runtime config loading and fails fast if a required key is missing.

**Environments.** Create `dev`, `staging`, `prod`, each with isolated credentials. Non-prod uses Stripe/bureau sandbox keys exclusively. Document the promotion path.

**CI/CD.** CI on every PR: install, typecheck, lint, unit tests, dependency + secret scanning. CD: Vercel preview per PR and prod on merge for `web`; a separate build/deploy for `worker`. Database migrations run as a **gated, reviewed** step — never auto-apply destructive changes on deploy.

**Observability.** Wire Sentry (or equivalent) into both apps with a PII-scrubbing beforeSend filter. Add uptime checks on the web app and worker health endpoint. Establish structured logging in `packages/observability` with a hard rule that EIN/SSN/report fields are never logged.

## Data touched

`audit_log` (created), `plans` (created + seed harness). No user data yet.

## Test scenarios

**Happy path**
- Given a clean clone, when a dev runs install + dev, then `web` and `worker` both start and connect to Postgres and Redis.
- Given a PR, when CI runs, then typecheck/lint/test/scan all execute and a Vercel preview URL is produced.
- Given a no-op job enqueued from `web`, when the worker is running, then it consumes the job exactly once and logs completion.

**Edge**
- Given a job that is enqueued twice with the same id, when consumed, then it runs once (idempotency store blocks the duplicate).
- Given an object uploaded to storage, when a signed URL is requested, then download succeeds and an unsigned URL is rejected.

**Failure**
- Given a required env var is missing, when an app boots, then it fails fast with a clear message (not a silent runtime error later).
- Given the queue handler throws, when retries are exhausted, then the job lands in the dead-letter path and an alert fires.
- Given a migration is destructive, when a deploy runs, then it is blocked pending manual approval.

**Security**
- Given a log line containing an EIN-like value, when emitted, then the scrubber redacts it (verified by a test asserting the value never appears in output).
- Given a secret in code, when CI runs, then secret scanning fails the build.

## Caveats

- **Serverless connection storms.** Vercel functions open many short-lived DB connections; without pooling (PgBouncer/Neon pooler) you will exhaust Postgres connections under load. Use the pooled endpoint from the web app.
- **Vercel is not a worker host.** Do not run the monthly reporting or report-pull jobs inside Vercel functions — they exceed function time limits. The separate worker tier exists precisely for this.
- **One Stripe/bureau key per environment.** A production key leaking into staging is a serious incident. Enforce via separate secret stores, not convention.
- **Migrations are the sharpest edge.** Gate them. An auto-applied destructive migration on deploy can drop data before anyone notices.
- **Turborepo caching can hide failures** if inputs are misconfigured — verify a real change actually reruns the affected tasks.

## Definition of done

All three environments deploy; web + worker run locally and remotely; a job round-trips idempotently; migrations are gated; secrets are absent from the repo and scrubbed from logs; CI enforces typecheck/lint/test/scan on every PR.
