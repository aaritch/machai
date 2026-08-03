import { getConfig } from '@machai/config';
import { isDatabaseConfigured } from '@machai/db';
import { logger } from '@machai/observability';
import type { EnqueueOptions, JobPayloadMap, QueueName } from '@machai/types';
import { BullMqProducer, startBullConsumer } from './bullmq-driver';
import type { Consumer, JobHandler, JobProducer } from './driver';
import { PostgresQueueDriver } from './postgres-driver';

export * from './driver';
export { PostgresQueueDriver, type ClaimedJob } from './postgres-driver';

/**
 * Transport selection.
 *
 * Redis is the intended transport. Postgres is the fallback so the system runs
 * — and a job genuinely round-trips from web to worker — with only a database
 * provisioned. Choosing at runtime rather than at build time means the same
 * artifact works in both shapes.
 */
let producer: JobProducer | null = null;

export function getProducer(): JobProducer | null {
  if (producer) return producer;
  const config = getConfig();

  if (config.REDIS_URL) {
    producer = new BullMqProducer(config.REDIS_URL);
    return producer;
  }
  if (isDatabaseConfigured()) {
    producer = new PostgresQueueDriver();
    return producer;
  }
  return null;
}

/**
 * Enqueues a typed job.
 *
 * Returns false when the job was deduplicated OR when no transport is
 * available. Callers needing that distinction check `hasQueue()` — most do not,
 * because "already queued" and "queued now" are both success to the user.
 *
 * This never throws. A queue outage must not take down the request that
 * triggered it; the reconciliation paths exist for exactly that reason.
 */
export async function enqueue<Q extends QueueName>(
  queue: Q,
  jobKey: string,
  payload: JobPayloadMap[Q],
  options: EnqueueOptions = {},
): Promise<boolean> {
  const p = getProducer();
  if (!p) {
    logger.warn('job dropped: no queue transport configured', { queue, jobKey });
    return false;
  }
  try {
    return await p.enqueue(queue, jobKey, payload, options);
  } catch (error) {
    logger.error('failed to enqueue job', { queue, jobKey, error });
    return false;
  }
}

export function hasQueue(): boolean {
  return getProducer() !== null;
}

export function queueTransportName(): 'bullmq' | 'postgres' | 'none' {
  return getProducer()?.name ?? 'none';
}

/**
 * Starts consuming a queue. Worker-tier only — the web app must never call this
 * (project plan C.1: apps/web must not run long or scheduled work).
 */
export function startConsumer(queue: QueueName, handler: JobHandler, concurrency = 4): Consumer {
  const config = getConfig();
  if (config.REDIS_URL) {
    return startBullConsumer(config.REDIS_URL, queue, handler, concurrency);
  }
  return startPollingConsumer(queue, handler, concurrency);
}

/**
 * Polling consumer for the Postgres transport.
 *
 * Deliberately simple: claim a batch, run each, mark done or fail. The claim
 * query's `FOR UPDATE SKIP LOCKED` does the concurrency-safety work, so this
 * loop needs no locking logic of its own.
 */
function startPollingConsumer(queue: QueueName, handler: JobHandler, batchSize: number): Consumer {
  const driver = new PostgresQueueDriver();
  const workerId = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  let running = true;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (!running) return;
    try {
      const claimed = await driver.claim(queue, batchSize, workerId);
      for (const job of claimed) {
        try {
          await handler(job.payload, { jobId: job.id, jobKey: job.jobKey, attempt: job.attempts });
          await driver.complete(job.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const { deadLettered } = await driver.fail(job.id, message);
          logger[deadLettered ? 'error' : 'warn'](
            deadLettered ? 'job dead-lettered' : 'job failed, will retry',
            { queue, jobId: job.id, attempt: job.attempts, error },
          );
        }
      }
    } catch (error) {
      logger.error('queue poll failed', { queue, error });
    } finally {
      if (running) timer = setTimeout(() => void tick(), 2_000);
    }
  };

  void tick();

  return {
    async stop() {
      running = false;
      if (timer) clearTimeout(timer);
      await driver.close();
    },
  };
}

export function resetQueueForTest(): void {
  producer = null;
}
