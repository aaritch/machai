import { getConfig } from '@machai/config';
import { logger } from '@machai/observability';
import type { VerificationStatus } from '@machai/types';

/**
 * KYB — Know Your Business verification (spec §6.4).
 *
 * The reality this exists to address: anyone can type any EIN into a form.
 * Without verification, users can build "credit" for businesses they do not
 * control, which is a fraud and compliance problem — not a polish item
 * (TASK-02 caveat).
 *
 * Decision D3 closes on `manual`: a staff review queue for v1. That is a real
 * control, not a stub — the business sits in `pending` and bureau actions stay
 * locked until a human decides. Swapping in Middesk or Baselayer later is a
 * config change, because callers only ever see this adapter's shapes.
 */

export interface KybSubject {
  businessId: string;
  legalName: string;
  dbaName: string | null;
  /** Decrypted at the call site and never logged or persisted by this module. */
  ein: string;
  entityType: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  representative: {
    firstName: string;
    lastName: string;
    email: string;
    ownershipPercentage: number;
  };
}

export interface KybDecision {
  status: VerificationStatus;
  /** Shown to staff and stored on the business; never provider-specific JSON. */
  reason: string;
  /** True when the caller should retry later rather than treat this as final. */
  retryable: boolean;
}

export interface KybAdapter {
  readonly name: string;
  verify(subject: KybSubject): Promise<KybDecision>;
}

/**
 * v1 default: queue for staff review.
 *
 * Runs the cheap automated checks that need no provider — the ones that catch
 * obvious garbage — then hands everything else to a human. It never returns
 * `verified` on its own; only a staff decision does that.
 */
class ManualReviewAdapter implements KybAdapter {
  readonly name = 'manual';

  async verify(subject: KybSubject): Promise<KybDecision> {
    const problems = runStructuralChecks(subject);

    if (problems.length > 0) {
      return {
        status: 'rejected',
        reason: `Automated checks failed: ${problems.join('; ')}`,
        retryable: false,
      };
    }

    return {
      status: 'pending',
      reason: 'Queued for staff review.',
      retryable: false,
    };
  }
}

/**
 * Provider-backed verification. Present so the seam is real rather than
 * hypothetical; requires KYB_API_KEY and a provider contract to activate.
 */
class ProviderAdapter implements KybAdapter {
  readonly name = 'middesk';

  constructor(private readonly apiKey: string) {}

  async verify(subject: KybSubject): Promise<KybDecision> {
    const problems = runStructuralChecks(subject);
    if (problems.length > 0) {
      return { status: 'rejected', reason: `Automated checks failed: ${problems.join('; ')}`, retryable: false };
    }

    try {
      const response = await fetch('https://api.middesk.com/v1/businesses', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: subject.legalName,
          tax_id: subject.ein,
          addresses: [
            {
              address_line1: subject.streetAddress,
              city: subject.city,
              state: subject.state,
              postal_code: subject.zip,
            },
          ],
        }),
      });

      if (!response.ok) {
        // A provider outage must NOT hard-fail the business. Queue and retry
        // (TASK-02 failure scenario).
        logger.warn('kyb provider returned an error status', { status: response.status });
        return {
          status: 'pending',
          reason: 'Verification provider unavailable; queued for retry.',
          retryable: true,
        };
      }

      const body = (await response.json()) as { status?: string };
      if (body.status === 'approved') {
        return { status: 'verified', reason: 'Verified by provider.', retryable: false };
      }
      if (body.status === 'rejected') {
        return { status: 'rejected', reason: 'Provider could not verify this business.', retryable: false };
      }
      return { status: 'pending', reason: 'Provider review in progress.', retryable: true };
    } catch (error) {
      logger.error('kyb provider request failed', { error });
      return {
        status: 'pending',
        reason: 'Verification provider unreachable; queued for retry.',
        retryable: true,
      };
    }
  }
}

/**
 * Checks that need no provider and catch the obviously invalid.
 *
 * The EIN prefix check is deliberately narrow: it rejects patterns the IRS does
 * not issue, and nothing more. Anything cleverer would produce false rejections
 * of legitimate businesses, which is the more expensive error here.
 */
function runStructuralChecks(subject: KybSubject): string[] {
  const problems: string[] = [];
  const digits = subject.ein.replace(/\D/g, '');

  if (digits.length !== 9) problems.push('EIN is not nine digits');
  if (/^(\d)\1{8}$/.test(digits)) problems.push('EIN is a repeated digit');
  if (digits.startsWith('00')) problems.push('EIN prefix 00 is not issued');
  if (subject.legalName.trim().length < 2) problems.push('Legal name is too short');
  if (subject.representative.ownershipPercentage <= 0) {
    problems.push('Representative reports no ownership');
  }
  return problems;
}

let cached: KybAdapter | null = null;

export function getKybAdapter(): KybAdapter {
  if (cached) return cached;
  const config = getConfig();
  cached =
    config.KYB_PROVIDER === 'middesk' && config.KYB_API_KEY
      ? new ProviderAdapter(config.KYB_API_KEY)
      : new ManualReviewAdapter();
  return cached;
}

export function resetKybAdapterForTest(): void {
  cached = null;
}

export { runStructuralChecks };
