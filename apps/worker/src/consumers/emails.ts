import { sendEmail } from '@machai/emails';
import { logger } from '@machai/observability';
import type { EmailJob } from '@machai/types';

/**
 * Email consumer.
 *
 * Only RETRYABLE failures are rethrown. A rejected address or a malformed
 * request will fail identically on every retry, so rethrowing would burn the
 * whole backoff schedule and then dead-letter for no reason — those are logged
 * and dropped instead.
 */
export async function handleEmail(payload: EmailJob): Promise<void> {
  const log = logger.child({ consumer: 'emails', template: payload.template });

  const result = await sendEmail(payload.template, payload.to, payload.data);

  if (result.ok) {
    log.info('email sent', { providerId: result.providerId ?? null });
    return;
  }

  if (result.retryable) {
    throw new Error(`email send failed (retryable): ${result.error ?? 'unknown'}`);
  }

  log.error('email permanently rejected; not retrying', { error: result.error ?? null });
}
