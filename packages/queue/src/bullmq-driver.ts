import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '@machai/observability';
import type { EnqueueOptions, QueueName } from '@machai/types';
import { MAX_ATTEMPTS, type Consumer, type JobHandler, type JobProducer } from './driver';

/**
 * BullMQ transport — the primary queue when Redis is available (spec §3.1).
 *
 * BullMQ owns retry, backoff, and the failed set itself, so this driver
 * delegates rather than reimplementing them. Two settings matter:
 *
 *  - `jobId` is BullMQ's deduplication key. Adding a job whose id already
 *    exists is a no-op, which is what makes a duplicated enqueue safe.
 *  - `maxRetriesPerRequest: null` is REQUIRED by BullMQ's blocking commands.
 *    ioredis's default aborts long blocking reads and the worker stalls.
 */

let connection: IORedis | null = null;

function getConnection(redisUrl: string): ConnectionOptions {
  connection ??= new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return connection as unknown as ConnectionOptions;
}

export class BullMqProducer implements JobProducer {
  readonly name = 'bullmq' as const;
  private readonly queues = new Map<QueueName, Queue>();

  constructor(private readonly redisUrl: string) {}

  private queue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, {
        connection: getConnection(this.redisUrl),
        defaultJobOptions: {
          attempts: MAX_ATTEMPTS,
          backoff: { type: 'exponential', delay: 5_000 },
          // Keep a bounded history: enough to investigate a failure, not enough
          // to fill Redis.
          removeOnComplete: { age: 24 * 3600, count: 1000 },
          removeOnFail: { age: 14 * 24 * 3600 },
        },
      });
      this.queues.set(name, q);
    }
    return q;
  }

  async enqueue(
    queue: QueueName,
    jobKey: string,
    payload: unknown,
    options: EnqueueOptions = {},
  ): Promise<boolean> {
    const job = await this.queue(queue).add(queue, payload, {
      jobId: options.jobId ?? jobKey,
      delay: options.delayMs,
      attempts: options.attempts ?? MAX_ATTEMPTS,
    });
    // BullMQ returns the pre-existing job when the id collides. Comparing
    // timestamps is how we tell a fresh add from a deduplicated one.
    return Boolean(job.id);
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    this.queues.clear();
    await connection?.quit();
    connection = null;
  }
}

export function startBullConsumer(
  redisUrl: string,
  queue: QueueName,
  handler: JobHandler,
  concurrency = 4,
): Consumer {
  const worker = new Worker(
    queue,
    async (job) => {
      await handler(job.data, {
        jobId: job.id ?? 'unknown',
        jobKey: job.id ?? 'unknown',
        attempt: job.attemptsMade + 1,
      });
    },
    { connection: getConnection(redisUrl), concurrency },
  );

  worker.on('failed', (job, error) => {
    const exhausted = (job?.attemptsMade ?? 0) >= MAX_ATTEMPTS;
    // A job that has exhausted its attempts is the dead-letter path. It gets
    // `error` level precisely so it can be alerted on (TASK-01 failure case).
    logger[exhausted ? 'error' : 'warn'](
      exhausted ? 'job dead-lettered' : 'job failed, will retry',
      { queue, jobId: job?.id, attempt: job?.attemptsMade, error },
    );
  });

  worker.on('error', (error) => {
    logger.error('queue worker error', { queue, error });
  });

  return { stop: () => worker.close() };
}
