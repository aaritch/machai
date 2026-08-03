import Stripe from 'stripe';
import { getConfig } from '@machai/config';
import { AppError, ERROR_CODES } from '@machai/types';

/**
 * The Stripe boundary.
 *
 * Contract (project plan C.3): this package owns ALL Stripe interaction and
 * returns domain objects for callers to persist — it never writes to the
 * database itself. That separation is what makes billing testable without a
 * database and keeps the mirror's write path in one place.
 */

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const config = getConfig();
  if (!config.STRIPE_SECRET_KEY) {
    throw new AppError(
      ERROR_CODES.PROVIDER_UNAVAILABLE,
      'Billing is not configured. Set STRIPE_SECRET_KEY to enable checkout.',
    );
  }
  cached = new Stripe(config.STRIPE_SECRET_KEY, {
    // Pinned deliberately: an unpinned version means Stripe can change payload
    // shapes under a running deploy. Bump this together with the mappers in
    // ./webhooks.ts, never on its own.
    apiVersion: '2025-02-24.acacia',
    // Stripe's own retry, on top of the queue's. Network blips should not
    // surface as a failed checkout.
    maxNetworkRetries: 2,
    timeout: 15_000,
    appInfo: { name: 'Machai Business Credit Platform' },
  });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(getConfig().STRIPE_SECRET_KEY);
}

export function resetStripeForTest(): void {
  cached = null;
}

export { Stripe };
