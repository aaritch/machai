import type Stripe from 'stripe';
import { getConfig } from '@machai/config';
import { AppError, ERROR_CODES, type InvoiceStatus, type SubscriptionStatus } from '@machai/types';
import { getStripe } from './client';

/**
 * Webhook verification and event→domain mapping.
 *
 * The single most common Stripe-on-Vercel bug is verifying against a parsed and
 * re-serialized body. `constructEvent` hashes the EXACT bytes Stripe sent;
 * `JSON.parse` followed by `JSON.stringify` reorders keys and changes
 * whitespace, and the signature no longer matches. This function therefore
 * takes a raw string and the caller is responsible for reading `await
 * req.text()` before touching the body in any other way (spec §10.6, §15.2).
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): Stripe.Event {
  const config = getConfig();
  if (!config.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(
      ERROR_CODES.PROVIDER_UNAVAILABLE,
      'STRIPE_WEBHOOK_SECRET is not configured; refusing to accept webhooks.',
    );
  }
  if (!signatureHeader) {
    throw new AppError(ERROR_CODES.FORBIDDEN, 'Missing Stripe-Signature header');
  }

  try {
    return getStripe().webhooks.constructEvent(
      rawBody,
      signatureHeader,
      config.STRIPE_WEBHOOK_SECRET,
    );
  } catch (cause) {
    // Never distinguish "bad signature" from "replayed timestamp" to the
    // caller — both mean the same thing: this did not come from Stripe.
    throw new AppError(ERROR_CODES.FORBIDDEN, 'Stripe signature verification failed', { cause });
  }
}

/** Events the worker knows how to apply (spec §10.6, TASK-04). */
export const HANDLED_EVENT_TYPES = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.finalized',
  'payment_method.attached',
  'payment_method.detached',
  'payment_intent.succeeded',
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export function isHandledEvent(type: string): type is HandledEventType {
  return (HANDLED_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * Domain events — what the rest of the system reacts to.
 *
 * Mapping Stripe's shapes into these at the boundary means a Stripe API version
 * bump touches this file and nothing else.
 */
export type DomainBillingEvent =
  | { kind: 'subscription_changed'; data: SubscriptionMirror }
  | { kind: 'subscription_removed'; stripeSubscriptionId: string; customerId: string }
  | { kind: 'invoice_changed'; data: InvoiceMirror }
  | { kind: 'payment_failed'; customerId: string; stripeInvoiceId: string }
  | { kind: 'payment_method_changed'; customerId: string; brand: string | null; last4: string | null }
  | { kind: 'one_off_purchase'; userId: string; productId: string; paymentIntentId: string; amountCents: number }
  | { kind: 'ignored'; reason: string };

export interface SubscriptionMirror {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: SubscriptionStatus;
  stripePriceId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  userId: string | null;
}

export interface InvoiceMirror {
  stripeInvoiceId: string;
  stripeCustomerId: string;
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  status: InvoiceStatus;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  paidAt: Date | null;
}

export function mapWebhookEvent(event: Stripe.Event): DomainBillingEvent {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'payment') {
        const userId = session.metadata?.userId;
        const productId = session.metadata?.productId;
        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? null);
        if (!userId || !productId || !paymentIntentId) {
          return { kind: 'ignored', reason: 'payment session missing metadata' };
        }
        return {
          kind: 'one_off_purchase',
          userId,
          productId,
          paymentIntentId,
          amountCents: session.amount_total ?? 0,
        };
      }
      // Subscription checkouts are fully described by the subscription.created
      // event that accompanies them; applying both would be redundant work.
      return { kind: 'ignored', reason: 'subscription checkout handled by subscription events' };
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
      return { kind: 'subscription_changed', data: mapSubscription(event.data.object as Stripe.Subscription) };

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      return {
        kind: 'subscription_removed',
        stripeSubscriptionId: sub.id,
        customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      };
    }

    case 'invoice.paid':
    case 'invoice.finalized':
      return { kind: 'invoice_changed', data: mapInvoice(event.data.object as Stripe.Invoice) };

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      return {
        kind: 'payment_failed',
        customerId: typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? ''),
        stripeInvoiceId: invoice.id ?? '',
      };
    }

    case 'payment_method.attached':
    case 'payment_method.detached': {
      const pm = event.data.object as Stripe.PaymentMethod;
      const detached = event.type === 'payment_method.detached';
      return {
        kind: 'payment_method_changed',
        customerId: typeof pm.customer === 'string' ? pm.customer : (pm.customer?.id ?? ''),
        brand: detached ? null : (pm.card?.brand ?? null),
        last4: detached ? null : (pm.card?.last4 ?? null),
      };
    }

    default:
      return { kind: 'ignored', reason: `unhandled event type ${event.type}` };
  }
}

function mapSubscription(sub: Stripe.Subscription): SubscriptionMirror {
  const item = sub.items.data[0];
  return {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    status: sub.status as SubscriptionStatus,
    stripePriceId: item?.price?.id ?? null,
    currentPeriodStart: toDate(sub.current_period_start),
    currentPeriodEnd: toDate(sub.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: toDate(sub.canceled_at),
    userId: sub.metadata?.userId ?? null,
  };
}

function mapInvoice(invoice: Stripe.Invoice): InvoiceMirror {
  return {
    stripeInvoiceId: invoice.id ?? '',
    stripeCustomerId:
      typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? ''),
    amountDueCents: invoice.amount_due ?? 0,
    amountPaidCents: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? 'usd',
    status: (invoice.status ?? 'open') as InvoiceStatus,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdfUrl: invoice.invoice_pdf ?? null,
    periodStart: toDate(invoice.period_start),
    periodEnd: toDate(invoice.period_end),
    paidAt: invoice.status === 'paid' ? toDate(invoice.status_transitions?.paid_at) : null,
  };
}

function toDate(seconds: number | null | undefined): Date | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000) : null;
}
