import { createServer } from 'node:http';
import { getConfig, loadEnvFile } from '@machai/config';
import { closeDb, isDatabaseConfigured } from '@machai/db';
import { createLogger } from '@machai/observability';
import { queueTransportName, startConsumer, type Consumer } from '@machai/queue';
import { QUEUE_NAMES } from '@machai/types';
import { handleEmail } from './consumers/emails';
import { handleKyb } from './consumers/kyb';
import { handleMonitoring } from './consumers/monitoring';
import { handleReportPull } from './consumers/report-pull';
import { handleStripeEvent } from './consumers/stripe-events';
import { startScheduler } from './scheduler/index';

/**
 * Worker entrypoint.
 *
 * Owns everything slow, scheduled, or long-running (project plan C.1): report
 * pulls, monitoring sweeps, Stripe event application, emails, and KYB retries.
 * It serves no user requests and is not the source of truth for auth.
 *
 * Deployed OFF Vercel — see the Dockerfile.
 */

// The worker runs under tsx rather than Next, so the root .env — where one
// exists, as in local development — has to be loaded explicitly. In a container
// the environment comes from the platform and this is a no-op.
loadEnvFile();

const logger = createLogger({ service: 'worker' });

async function main(): Promise<void> {
  const config = getConfig();

  // Fail fast rather than idling: a worker with no database can consume nothing
  // and its health check should say so loudly at boot.
  if (!isDatabaseConfigured()) {
    logger.error('DATABASE_URL is not set; the worker has nothing to consume');
    process.exit(1);
  }

  logger.info('worker starting', {
    environment: config.APP_ENV,
    queueTransport: queueTransportName(),
    bureauMode: config.BUREAU_MODE,
  });

  const consumers: Consumer[] = [
    // Concurrency is tuned per queue: emails are cheap and parallelise well,
    // while report pulls hit a rate-limited paid API and are kept narrow.
    startConsumer(QUEUE_NAMES.stripeEvents, (payload) => handleStripeEvent(payload as never), 4),
    startConsumer(QUEUE_NAMES.reportPull, (payload) => handleReportPull(payload as never), 2),
    startConsumer(QUEUE_NAMES.monitoring, (payload) => handleMonitoring(payload as never), 2),
    startConsumer(QUEUE_NAMES.emails, (payload) => handleEmail(payload as never), 8),
    startConsumer(QUEUE_NAMES.kyb, (payload) => handleKyb(payload as never), 2),
  ];

  const scheduler = startScheduler();

  const server = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          status: 'ok',
          service: 'worker',
          environment: config.APP_ENV,
          queueTransport: queueTransportName(),
        }),
      );
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not found' }));
  });

  server.listen(config.WORKER_PORT, () => {
    logger.info('health endpoint listening', { port: config.WORKER_PORT });
  });

  /**
   * Graceful shutdown.
   *
   * Container platforms send SIGTERM and then SIGKILL after a grace period.
   * Stopping consumers first lets in-flight jobs finish rather than being
   * killed mid-write — an interrupted handler is exactly the case retries are
   * least able to reason about.
   */
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutting down', { signal });

    scheduler.stop();
    server.close();
    await Promise.allSettled(consumers.map((consumer) => consumer.stop()));
    await closeDb();

    logger.info('shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // An unhandled rejection leaves the process in an unknown state. Log it and
  // let the platform restart us rather than continuing to consume jobs.
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled rejection', { reason });
    void shutdown('unhandledRejection');
  });
}

main().catch((error) => {
  logger.error('worker failed to start', { error });
  process.exit(1);
});
