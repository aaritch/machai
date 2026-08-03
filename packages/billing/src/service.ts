import type Stripe from 'stripe';
import { appUrl } from '@machai/config';
import { getStripe } from './client';

/**
 * BillingService — the operations the app performs against Stripe.
 *
 * Each returns a plain result the caller persists. Nothing here touches the
 * database; nothing here decides entitlement.
 */

export interface EnsureCustomerInput {
  userId: string;
  email: string;
  name?: string | null;
  existingCustomerId?: string | null;
}

/**
 * Returns the Stripe Customer for a user, creating one if needed.
 *
 * The `userId` metadata is what lets a webhook find its way back to a local
 * user when the event carries only a customer id.
 */
export async function ensureCustomer(input: EnsureCustomerInput): Promise<string> {
  const stripe = getStripe();

  if (input.existingCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(input.existingCustomerId);
      if (!existing.deleted) return existing.id;
    } catch {
      // Fall through and create a new one. A stored id can go stale if the
      // customer was deleted in the Stripe dashboard.
    }
  }

  const customer = await stripe.customers.create({
    email: input.email,
    name: input.name ?? undefined,
    metadata: { userId: input.userId },
  });
  return customer.id;
}

export interface CheckoutSessionInput {
  customerId: string;
  priceId: string;
  userId: string;
  planCode: string;
  /** Where Stripe returns the browser. UX only — never a source of truth. */
  successPath?: string;
  cancelPath?: string;
}

/**
 * Opens a hosted Checkout Session in subscription mode.
 *
 * Card details go straight to Stripe, which is what keeps PCI scope at SAQ A
 * (spec §13.4). The success URL is decoration: entitlements flip on a verified
 * webhook, never on this redirect (TASK-04 caveat).
 */
export async function createCheckoutSession(
  input: CheckoutSessionInput,
): Promise<{ id: string; url: string }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: input.customerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: `${appUrl}${input.successPath ?? '/dashboard/billing'}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}${input.cancelPath ?? '/dashboard/billing'}?checkout=cancelled`,
    client_reference_id: input.userId,
    subscription_data: { metadata: { userId: input.userId, planCode: input.planCode } },
    metadata: { userId: input.userId, planCode: input.planCode },
    allow_promotion_codes: true,
    // Sales tax across US states, if enabled on the account (spec §10.9).
    automatic_tax: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    billing_address_collection: 'required',
  });

  if (!session.url) throw new Error('Stripe returned a Checkout Session without a URL');
  return { id: session.id, url: session.url };
}

/**
 * Opens a Customer Portal session.
 *
 * Card updates, plan changes, cancellation, and invoice history are all
 * delegated here rather than rebuilt (spec §10.4) — including the proration
 * behaviour, which the Portal must be configured for: upgrade-now-prorated,
 * downgrade-at-cycle-end (spec §9.2).
 */
export async function createPortalSession(
  customerId: string,
  returnPath = '/dashboard/billing',
): Promise<{ url: string }> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}${returnPath}`,
  });
  return { url: session.url };
}

export interface OneOffCheckoutInput {
  customerId: string;
  priceId: string;
  userId: string;
  productId: string;
}

/** One-off product purchase — Checkout in `payment` mode (spec §10.8). */
export async function createOneOffCheckoutSession(
  input: OneOffCheckoutInput,
): Promise<{ id: string; url: string }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: input.customerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/purchases?purchase=success`,
    cancel_url: `${appUrl}/dashboard/products?purchase=cancelled`,
    client_reference_id: input.userId,
    metadata: { userId: input.userId, productId: input.productId },
    automatic_tax: { enabled: true },
  });
  if (!session.url) throw new Error('Stripe returned a Checkout Session without a URL');
  return { id: session.id, url: session.url };
}

/**
 * Re-reads authoritative state from Stripe.
 *
 * Backs the Refresh control and the reconciliation job. When the mirror and
 * Stripe disagree, Stripe wins (spec §10.6, TASK-04 "mirror drift").
 */
export async function fetchSubscriptionState(customerId: string): Promise<{
  subscription: Stripe.Subscription | null;
  invoices: Stripe.Invoice[];
  paymentMethod: { brand: string; last4: string } | null;
}> {
  const stripe = getStripe();

  const [subscriptions, invoiceList, customer] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 }),
    stripe.invoices.list({ customer: customerId, limit: 50 }),
    stripe.customers.retrieve(customerId, { expand: ['invoice_settings.default_payment_method'] }),
  ]);

  // Prefer a live subscription over a cancelled one when both exist.
  const subscription =
    subscriptions.data.find((s) => ['active', 'trialing', 'past_due'].includes(s.status)) ??
    subscriptions.data[0] ??
    null;

  let paymentMethod: { brand: string; last4: string } | null = null;
  if (!('deleted' in customer)) {
    const pm = customer.invoice_settings?.default_payment_method;
    if (pm && typeof pm !== 'string' && pm.card) {
      paymentMethod = { brand: pm.card.brand, last4: pm.card.last4 };
    }
  }

  return { subscription, invoices: invoiceList.data, paymentMethod };
}
