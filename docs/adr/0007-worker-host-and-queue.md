# ADR-0007 — Worker host and queue transport

**Status:** Partly deferred · **Date:** 2026-08-03 · **Relates to:** decision D8 (OPEN)

## Worker host: deferred, containerised

Decision D8 (Render vs Railway vs Fly vs ECS) is still open, and nothing in the
worker depends on the answer. So the worker ships as a standard container
(`apps/worker/Dockerfile`) with:

- a `/health` endpoint for the platform's checks,
- `SIGTERM` handling that stops consumers, drains in-flight jobs, and closes the
  pool before exiting,
- a non-root user.

`deploy-worker.yml` builds and pushes the image to GHCR on merge. The deploy
step is a stub gated behind a `production-worker` GitHub environment — wire the
host's action there once D8 closes.

What is **not** negotiable: the worker does not run on Vercel. Report pulls,
monitoring sweeps, and PDF generation exceed serverless time limits and need
process state (spec §15.2).

## Queue transport: Redis primary, Postgres fallback

The spec calls for BullMQ on Redis. That is implemented and is the transport
whenever `REDIS_URL` is set.

A **Postgres-backed driver** is also implemented and is used when Redis is
absent. The reason is practical: TASK-01's happy path is "a developer clones,
runs install, and watches a job round-trip from web to worker." Requiring a
Redis instance before that works adds a provisioning step to the very first
thing a new developer does.

The Postgres driver claims jobs with:

```sql
SELECT id FROM jobs
WHERE queue = $1 AND status = 'pending' AND run_after <= now()
ORDER BY run_after
FOR UPDATE SKIP LOCKED
LIMIT $2
```

`SKIP LOCKED` is what makes it safe with several workers: a row already locked
by another transaction is passed over rather than waited on, so two workers
never claim the same job and neither blocks.

Both drivers provide the same contract: deduplication by job key, retry with
exponential backoff and jitter, and a dead-letter path.

## Consequences

- Redis is the right production choice — lower latency, better introspection —
  and remains the default when configured.
- The Postgres driver needs `reclaim-stalled-jobs` on a timer, because a worker
  killed mid-job leaves its rows locked. That task is registered in the
  scheduler.
- Both transports give at-least-once delivery. **Every handler must be
  idempotent**, and each one is written that way.
