import { getConfig } from '@machai/config';
import { logger } from '@machai/observability';
import type { EmailTemplateKey } from '@machai/types';
import { renderTemplate, type RenderedEmail, type TemplateData } from './templates';

export * from './templates';

/**
 * Email provider adapter.
 *
 * Contract (project plan C.1): this package renders and sends. It does NOT
 * decide *when* to send — callers trigger it. That separation keeps send
 * decisions in the feature modules where the business rules live.
 */

export interface SendResult {
  ok: boolean;
  providerId?: string;
  /** True when the caller should retry — a queue failure, not a bad address. */
  retryable: boolean;
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(to: string, email: RenderedEmail): Promise<SendResult>;
}

/**
 * Development provider. Writes the rendered email to the log instead of
 * sending, so local signup flows work with no provider account.
 */
class ConsoleProvider implements EmailProvider {
  readonly name = 'console';

  async send(to: string, email: RenderedEmail): Promise<SendResult> {
    logger.info('email (console provider — not delivered)', {
      to,
      subject: email.subject,
      // The body can contain a verification link, which is exactly what a
      // developer needs here and exactly what must never appear in production
      // logs. This provider is unavailable in production by construction.
      body: email.text,
    });
    return { ok: true, providerId: 'console', retryable: false };
  }
}

class ResendProvider implements EmailProvider {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(to: string, email: RenderedEmail): Promise<SendResult> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [to],
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      });

      if (!response.ok) {
        // 4xx means the request itself is wrong — retrying sends it again and
        // fails again. Only 5xx and network faults are worth a retry.
        const retryable = response.status >= 500 || response.status === 429;
        logger.warn('email provider rejected send', { status: response.status, retryable });
        return { ok: false, retryable, error: `provider status ${response.status}` };
      }

      const body = (await response.json()) as { id?: string };
      return { ok: true, providerId: body.id, retryable: false };
    } catch (error) {
      logger.error('email provider request failed', { error });
      return { ok: false, retryable: true, error: 'provider unreachable' };
    }
  }
}

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const config = getConfig();

  if (config.EMAIL_PROVIDER === 'resend' && config.RESEND_API_KEY) {
    cached = new ResendProvider(config.RESEND_API_KEY, config.EMAIL_FROM);
    return cached;
  }

  if (config.isProduction) {
    // Better to fail loudly at boot than to silently swallow verification
    // emails in production.
    throw new Error(
      'No email provider configured in production. Set EMAIL_PROVIDER=resend and RESEND_API_KEY.',
    );
  }

  cached = new ConsoleProvider();
  return cached;
}

/** Renders and sends in one step. Callers pass ids and names, never secrets. */
export async function sendEmail(
  template: EmailTemplateKey,
  to: string,
  data: TemplateData,
): Promise<SendResult> {
  const rendered = renderTemplate(template, data);
  return getEmailProvider().send(to, rendered);
}

export function resetEmailProviderForTest(): void {
  cached = null;
}
