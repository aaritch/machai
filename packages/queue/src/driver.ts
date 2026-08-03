import type { EnqueueOptions, QueueName } from '@machai/types';

/**
 * Queue contracts (project plan C.3).
 *
 * Producing and consuming are separate interfaces on purpose. The web app only
 * ever produces — it must never import a consumer — and the two transports
 * differ in how consumption works: BullMQ pushes jobs to a Worker, while the
 * Postgres driver is polled. Splitting the interfaces lets each be honest about
 * its shape instead of forcing one into the other.
 *
 * Both transports give at-least-once delivery. Handlers must be idempotent.
 */

export interface JobProducer {
  readonly name: 'bullmq' | 'postgres';
  /** Returns false when the job was deduplicated against an existing key. */
  enqueue(
    queue: QueueName,
    jobKey: string,
    payload: unknown,
    options?: EnqueueOptions,
  ): Promise<boolean>;
  close(): Promise<void>;
}

export interface JobContext {
  jobId: string;
  jobKey: string;
  attempt: number;
}

export type JobHandler<T = unknown> = (payload: T, context: JobContext) => Promise<void>;

export interface Consumer {
  /** Resolves when the consumer has shut down cleanly. */
  stop(): Promise<void>;
}

/** Exponential backoff with a cap, so a broken provider is retried politely. */
export function backoffMs(attempt: number): number {
  const base = 5_000;
  const capped = Math.min(base * 2 ** Math.max(0, attempt - 1), 15 * 60_000);
  // Jitter prevents a thundering herd when many jobs fail at the same instant.
  return Math.round(capped * (0.75 + Math.random() * 0.5));
}

export const MAX_ATTEMPTS = 5;
