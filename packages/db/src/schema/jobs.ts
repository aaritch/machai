import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Postgres-backed job queue.
 *
 * BullMQ on Redis is the primary transport (spec §3.1). This table is the
 * fallback driver, used when REDIS_URL is absent, and it exists for a practical
 * reason: it makes the whole system runnable with Postgres alone. A developer
 * can clone, set one environment variable, and watch a job round-trip from web
 * to worker — which is TASK-01's happy path.
 *
 * Claiming uses `FOR UPDATE SKIP LOCKED`, so several workers can consume
 * concurrently without handing the same job to two of them.
 */
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    queue: text('queue').notNull(),
    /**
     * Deduplication key. A second enqueue with the same id is dropped, which is
     * what makes "enqueued twice, consumed once" hold (TASK-01 edge case).
     */
    jobKey: text('job_key').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    /** Set into the future for delayed jobs and for retry backoff. */
    runAfter: timestamp('run_after', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: text('locked_by'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    /** Terminal failure. Rows here are the dead-letter path and alert on. */
    deadLetteredAt: timestamp('dead_lettered_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('jobs_key_key').on(t.jobKey),
    index('jobs_claim_idx').on(t.queue, t.status, t.runAfter),
    index('jobs_dead_letter_idx').on(t.deadLetteredAt),
  ],
);
