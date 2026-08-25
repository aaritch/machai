import { promoteHeldReferrals } from '@machai/affiliate';
import { logger } from '@machai/observability';
import { PostgresQueueDriver } from '@machai/queue';

/**
 * Scheduled work (spec §15.2).
 *
 * Vercel Cron can trigger a schedule, but the work itself belongs here — a
 * sweep across every account is not something to attempt inside a function's
 * time limit.
 *
 * Intervals rather than cron expressions: this is a long-lived process, the
 * cadences are coarse, and an interval needs no extra dependency. Each task
 * catches its own errors so one failure cannot stop the scheduler.
 */

const HOUR = 3_600_000;

export interface ScheduledTask {
  name: string;
  intervalMs: number;
  /** Delay before the first run, so boot is not a thundering herd. */
  initialDelayMs: number;
  run: () => Promise<void>;
}

export const TASKS: ScheduledTask[] = [
  {
    name: 'release-affiliate-holds',
    // Daily. Moves qualified referrals whose hold has elapsed to `payable`.
    // Flagged referrals are skipped by design — they need a staff decision.
    intervalMs: 24 * HOUR,
    initialDelayMs: 3 * 60_000,
    run: async () => {
      const promoted = await promoteHeldReferrals();
      if (promoted > 0) logger.info('affiliate holds released', { count: promoted });
    },
  },
  {
    name: 'reclaim-stalled-jobs',
    // A worker killed mid-job leaves its rows locked. Without this they would
    // sit in `running` forever and never retry.
    intervalMs: HOUR,
    initialDelayMs: 5 * 60_000,
    run: async () => {
      const driver = new PostgresQueueDriver();
      const reclaimed = await driver.reclaimStalled();
      if (reclaimed > 0) logger.warn('reclaimed stalled jobs', { count: reclaimed });
    },
  },
];

export function startScheduler(): { stop: () => void } {
  const timers: NodeJS.Timeout[] = [];

  for (const task of TASKS) {
    const run = async () => {
      try {
        await task.run();
      } catch (error) {
        // One failing task must never take down the scheduler.
        logger.error('scheduled task failed', { task: task.name, error });
      }
    };

    const startTimer = setTimeout(() => {
      void run();
      timers.push(setInterval(() => void run(), task.intervalMs));
    }, task.initialDelayMs);

    timers.push(startTimer);
    logger.info('scheduled task registered', {
      task: task.name,
      intervalHours: task.intervalMs / HOUR,
    });
  }

  return {
    stop: () => {
      for (const timer of timers) {
        clearTimeout(timer);
        clearInterval(timer);
      }
    },
  };
}

/**
 * Direction B's monthly reporting run would be registered here — TASK-06.
 *
 * It is deliberately absent. Registering a disabled pipeline invites someone to
 * flip it on; there is nothing to flip. See
 * packages/bureau-clients/src/furnishing.ts.
 */
