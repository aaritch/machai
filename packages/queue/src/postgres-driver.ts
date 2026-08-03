import { and, eq, getDb, jobs, sql } from '@machai/db';
import type { EnqueueOptions, QueueName } from '@machai/types';
import { backoffMs, type JobProducer } from './driver';

export interface ClaimedJob<T = unknown> {
  id: string;
  queue: QueueName;
  jobKey: string;
  payload: T;
  attempts: number;
}

/**
 * Postgres-backed driver.
 *
 * The claim query is the interesting part:
 *
 *   SELECT ... WHERE status='pending' AND run_after <= now()
 *   ORDER BY run_after FOR UPDATE SKIP LOCKED LIMIT n
 *
 * `SKIP LOCKED` is what makes this safe with several workers: a row already
 * locked by another transaction is passed over rather than waited on, so two
 * workers never claim the same job and neither blocks.
 */
export class PostgresQueueDriver implements JobProducer {
  readonly name = 'postgres' as const;

  async enqueue(
    queue: QueueName,
    jobKey: string,
    payload: unknown,
    options: EnqueueOptions = {},
  ): Promise<boolean> {
    const db = getDb();
    const runAfter = new Date(Date.now() + (options.delayMs ?? 0));

    const inserted = await db
      .insert(jobs)
      .values({
        queue,
        jobKey,
        payload: payload as never,
        runAfter,
        maxAttempts: options.attempts ?? 5,
      })
      // The unique index on job_key is the deduplication mechanism. A duplicate
      // enqueue loses the race and returns no rows.
      .onConflictDoNothing({ target: jobs.jobKey })
      .returning({ id: jobs.id });

    return inserted.length > 0;
  }

  async claim(queue: QueueName, limit: number, workerId: string): Promise<ClaimedJob[]> {
    const db = getDb();

    const rows = await db.execute<{
      id: string;
      queue: string;
      job_key: string;
      payload: unknown;
      attempts: number;
    }>(sql`
      WITH due AS (
        SELECT id FROM jobs
        WHERE queue = ${queue}
          AND status = 'pending'
          AND run_after <= now()
        ORDER BY run_after
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE jobs
      SET status = 'running',
          locked_at = now(),
          locked_by = ${workerId},
          attempts = jobs.attempts + 1
      FROM due
      WHERE jobs.id = due.id
      RETURNING jobs.id, jobs.queue, jobs.job_key, jobs.payload, jobs.attempts
    `);

    return [...rows].map((row) => ({
      id: row.id,
      queue: row.queue as QueueName,
      jobKey: row.job_key,
      payload: row.payload,
      attempts: row.attempts,
    }));
  }

  async complete(jobId: string): Promise<void> {
    await getDb()
      .update(jobs)
      .set({ status: 'completed', completedAt: new Date(), lockedAt: null, lockedBy: null })
      .where(eq(jobs.id, jobId));
  }

  async fail(jobId: string, error: string): Promise<{ deadLettered: boolean }> {
    const db = getDb();
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!row) return { deadLettered: false };

    const exhausted = row.attempts >= row.maxAttempts;

    await db
      .update(jobs)
      .set(
        exhausted
          ? {
              status: 'dead_letter',
              deadLetteredAt: new Date(),
              lastError: error.slice(0, 1000),
              lockedAt: null,
              lockedBy: null,
            }
          : {
              status: 'pending',
              runAfter: new Date(Date.now() + backoffMs(row.attempts)),
              lastError: error.slice(0, 1000),
              lockedAt: null,
              lockedBy: null,
            },
      )
      .where(eq(jobs.id, jobId));

    return { deadLettered: exhausted };
  }

  /**
   * Returns jobs stuck in `running` past the lock timeout to `pending`.
   *
   * A worker that is killed mid-job leaves its rows locked forever otherwise.
   * The worker calls this on a timer.
   */
  async reclaimStalled(olderThanMs = 5 * 60_000): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const reclaimed = await getDb()
      .update(jobs)
      .set({ status: 'pending', lockedAt: null, lockedBy: null })
      .where(and(eq(jobs.status, 'running'), sql`${jobs.lockedAt} < ${cutoff}`))
      .returning({ id: jobs.id });
    return reclaimed.length;
  }

  async close(): Promise<void> {
    // The database pool is owned by @machai/db and shared with the app.
  }
}
