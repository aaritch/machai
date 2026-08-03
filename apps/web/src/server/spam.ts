import 'server-only';
import { getConfig } from '@machai/config';
import { logger } from '@machai/observability';
import { AppError, ERROR_CODES, MIN_FORM_FILL_MS } from '@machai/types';

/**
 * Bot defences for public forms (spec §13.6, TASK-03).
 *
 * Three layers, because each catches a different class of bot:
 *
 *   Honeypot   — a field real users never see. Naive form-fillers populate
 *                every input they find and give themselves away.
 *   Timing     — humans cannot read a form and submit it in under a couple of
 *                seconds. Catches scripted posts that skip rendering entirely.
 *   CAPTCHA    — Cloudflare Turnstile, when configured. Handles the rest.
 *
 * Rejections are silent to the submitter: telling a bot which check it failed
 * is free tuning advice.
 */

export interface SpamCheckInput {
  /** The honeypot field's submitted value. Any content means a bot. */
  honeypot?: string;
  /** Client timestamp of when the form was rendered. */
  renderedAt?: number;
  captchaToken?: string;
  ip?: string | null;
}

export async function assertNotSpam(input: SpamCheckInput): Promise<void> {
  if (input.honeypot && input.honeypot.trim().length > 0) {
    logger.warn('form submission rejected: honeypot filled', { ip: input.ip });
    throw spamError();
  }

  if (typeof input.renderedAt === 'number' && Number.isFinite(input.renderedAt)) {
    const elapsed = Date.now() - input.renderedAt;
    // A negative elapsed time means a forged or clock-skewed timestamp, which is
    // itself suspicious.
    if (elapsed < MIN_FORM_FILL_MS) {
      logger.warn('form submission rejected: submitted too fast', { elapsed, ip: input.ip });
      throw spamError();
    }
  }

  const config = getConfig();
  if (config.TURNSTILE_SECRET_KEY) {
    const ok = await verifyTurnstile(config.TURNSTILE_SECRET_KEY, input.captchaToken, input.ip);
    if (!ok) {
      logger.warn('form submission rejected: captcha failed', { ip: input.ip });
      throw spamError();
    }
  }
}

function spamError(): AppError {
  return new AppError(
    ERROR_CODES.SPAM_REJECTED,
    'We could not process that submission. Please try again, or email us directly.',
  );
}

async function verifyTurnstile(
  secret: string,
  token: string | undefined,
  ip: string | null | undefined,
): Promise<boolean> {
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    if (!response.ok) {
      // Fail OPEN on a verifier outage: rejecting every legitimate contact
      // submission because Cloudflare is down is the worse failure, and the
      // honeypot plus timing checks are still in force.
      logger.warn('turnstile verification unavailable; allowing submission', {
        status: response.status,
      });
      return true;
    }
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    logger.warn('turnstile verification errored; allowing submission', { error });
    return true;
  }
}
