import {
  and,
  desc,
  eq,
  getDb,
  invoices,
  plans,
  products,
  purchases,
  subscriptions,
  users,
  writeAudit,
} from '@machai/db';
import {
  fetchSubscriptionState,
  type DomainBillingEvent,
  type InvoiceMirror,
  type SubscriptionMirror,
} from '@machai/billing';
import { qualifyReferralForUser, reverseReferralForUser } from '@machai/affiliate';
import { AUDIT_ACTIONS, logger } from '@machai/observability';
import { EMAIL_TEMPLATES, QUEUE_NAMES, type SubscriptionStatus } from '@machai/types';

/**
 * The mirror writer.
 *
 * This exists as its own package because of a deliberate boundary:
 * `@machai/billing` owns Stripe and returns domain objects but must NOT write
 * to the database (project plan C.1). Something still has to persist those
 * objects, and both the web app (Refresh, reconcile) and the worker (webhook
 * consumers) need it — so it lives here, shared, rather than being duplicated
 * on both sides where the two copies would drift.
 *
 * Every function here is idempotent. Stripe retries webhooks, and the
 * reconcile path may run over an event the webhook already applied.
 */

export interface SyncDeps {
  /** Injected so this package does not depend on the queue transport. */
  enqueue?: (queue: string, jobKey: string, payload: unknown) => Promise<boolean>;
}

export async function applyBillingEvent(
  event: DomainBillingEvent,
  deps: SyncDeps = {},
): Promise<void> {
  switch (event.kind) {
    case 'subscription_changed':
      await upsertSubscription(event.data, deps);
      break;
    case 'subscription_removed':
      await markSubscriptionCanceled(event.stripeSubscriptionId);
      break;
    case 'invoice_changed':
      await upsertInvoice(event.data);
      break;
    case 'payment_failed':
      await handlePaymentFailed(event.customerId, deps);
      break;
    case 'payment_method_changed':
      await updatePaymentMethod(event.customerId, event.brand, event.last4);
      break;
    case 'one_off_purchase':
      await recordPurchase(event);
      break;
    case 'ignored':
      logger.debug('billing event ignored', { reason: event.reason });
      break;
  }
}

async function upsertSubscription(data: SubscriptionMirror, deps: SyncDeps): Promise<void> {
  const db = getDb();

  const userId = data.userId ?? (await findUserIdByCustomer(data.stripeCustomerId));
  if (!userId) {
    // Without a local user this event cannot be applied. Log loudly rather than
    // silently dropping billing state — this usually means a Customer was
    // created outside the app.
    logger.error('cannot mirror subscription: no matching user', {
      stripeSubscriptionId: data.stripeSubscriptionId,
    });
    return;
  }

  const planId = data.stripePriceId ? await findPlanIdByPrice(data.stripePriceId) : null;
  const previous = await getExistingStatus(data.stripeSubscriptionId);

  await db
    .insert(subscriptions)
    .values({
      userId,
      planId,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      status: data.status,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      canceledAt: data.canceledAt,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        planId,
        status: data.status,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        canceledAt: data.canceledAt,
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  await writeAudit({
    actorId: userId,
    action: AUDIT_ACTIONS.SUBSCRIPTION_MIRRORED,
    entityType: 'subscription',
    entityId: null,
    metadata: { status: data.status, previousStatus: previous ?? null },
  });

  // Notify only on the transition INTO an active state, not on every update —
  // Stripe emits several updates per billing cycle.
  const becameActive = data.status === 'active' && previous !== 'active';

  /**
   * The affiliate commission is earned HERE and nowhere else.
   *
   * `active` specifically — not `trialing`, which is entitling but has taken no
   * money yet, and not the free tier, which has no subscription row at all. So
   * a commission can only ever be attached once revenue has actually arrived.
   *
   * `qualifyReferralForUser` is idempotent and swallows its own errors: a
   * referral problem must never fail a billing update.
   */
  if (becameActive) {
    await qualifyReferralForUser(userId);
  }

  if (becameActive && deps.enqueue && planId) {
    const [plan] = await db.select({ name: plans.name }).from(plans).where(eq(plans.id, planId)).limit(1);
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (user) {
      await deps.enqueue(QUEUE_NAMES.emails, `sub-active:${data.stripeSubscriptionId}`, {
        template: EMAIL_TEMPLATES.subscriptionActivated,
        to: user.email,
        data: { planName: plan?.name ?? 'your' },
      });
    }
  }
}

async function markSubscriptionCanceled(stripeSubscriptionId: string): Promise<void> {
  const canceled = await getDb()
    .update(subscriptions)
    .set({ status: 'canceled', canceledAt: new Date(), syncedAt: new Date(), updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .returning({ userId: subscriptions.userId });

  // A subscription that ends before its commission is payable was not really a
  // conversion. Only unpaid referrals are reversed; settled money is not clawed
  // back automatically.
  const userId = canceled[0]?.userId;
  if (userId) {
    await reverseReferralForUser(userId, 'Referred subscription ended before the hold elapsed');
  }
}

async function upsertInvoice(data: InvoiceMirror): Promise<void> {
  const userId = await findUserIdByCustomer(data.stripeCustomerId);
  if (!userId) {
    logger.warn('cannot mirror invoice: no matching user', { stripeInvoiceId: data.stripeInvoiceId });
    return;
  }

  await getDb()
    .insert(invoices)
    .values({
      userId,
      stripeInvoiceId: data.stripeInvoiceId,
      amountDueCents: data.amountDueCents,
      amountPaidCents: data.amountPaidCents,
      currency: data.currency,
      status: data.status,
      hostedInvoiceUrl: data.hostedInvoiceUrl,
      invoicePdfUrl: data.invoicePdfUrl,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      paidAt: data.paidAt,
    })
    .onConflictDoUpdate({
      target: invoices.stripeInvoiceId,
      set: {
        amountDueCents: data.amountDueCents,
        amountPaidCents: data.amountPaidCents,
        status: data.status,
        hostedInvoiceUrl: data.hostedInvoiceUrl,
        invoicePdfUrl: data.invoicePdfUrl,
        paidAt: data.paidAt,
        updatedAt: new Date(),
      },
    });

  await writeAudit({
    actorId: userId,
    action: AUDIT_ACTIONS.INVOICE_MIRRORED,
    entityType: 'invoice',
    entityId: null,
    metadata: { status: data.status },
  });
}

/**
 * Marks the subscription past_due and notifies.
 *
 * Entitlements are NOT stripped here: `past_due` remains an entitling status
 * during the grace window while Stripe's Smart Retries work the payment
 * (spec §10.7). The downgrade happens when Stripe finalises the cancellation
 * and sends `customer.subscription.deleted`.
 */
async function handlePaymentFailed(customerId: string, deps: SyncDeps): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ id: subscriptions.id, userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!row) return;

  await db
    .update(subscriptions)
    .set({ status: 'past_due', syncedAt: new Date(), updatedAt: new Date() })
    .where(eq(subscriptions.id, row.id));

  if (deps.enqueue) {
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, row.userId)).limit(1);
    if (user) {
      await deps.enqueue(QUEUE_NAMES.emails, `payment-failed:${row.id}:${Date.now()}`, {
        template: EMAIL_TEMPLATES.paymentFailed,
        to: user.email,
        data: {},
      });
    }
  }
}

async function updatePaymentMethod(
  customerId: string,
  brand: string | null,
  last4: string | null,
): Promise<void> {
  await getDb()
    .update(subscriptions)
    .set({ cardBrand: brand, defaultPaymentMethodLast4: last4, updatedAt: new Date() })
    .where(eq(subscriptions.stripeCustomerId, customerId));
}

async function recordPurchase(event: {
  userId: string;
  productId: string;
  paymentIntentId: string;
  amountCents: number;
}): Promise<void> {
  const [product] = await getDb()
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, event.productId))
    .limit(1);

  await getDb()
    .insert(purchases)
    .values({
      userId: event.userId,
      productId: product?.id ?? null,
      stripePaymentIntentId: event.paymentIntentId,
      amountCents: event.amountCents,
      status: 'paid',
      purchasedAt: new Date(),
    })
    // The payment-intent unique index makes a duplicate delivery a no-op.
    .onConflictDoNothing({ target: purchases.stripePaymentIntentId });
}

/**
 * Re-reads Stripe and overwrites the mirror.
 *
 * Backs the Refresh control and the reconciliation job. When the two disagree,
 * Stripe wins — it is the source of truth (spec §10.6).
 */
export async function reconcileFromStripe(userId: string): Promise<{ synced: boolean }> {
  const db = getDb();
  const [existing] = await db
    .select({ customerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!existing?.customerId) return { synced: false };

  const state = await fetchSubscriptionState(existing.customerId);

  if (state.subscription) {
    const item = state.subscription.items.data[0];
    await upsertSubscription(
      {
        stripeSubscriptionId: state.subscription.id,
        stripeCustomerId: existing.customerId,
        status: state.subscription.status as SubscriptionStatus,
        stripePriceId: item?.price?.id ?? null,
        currentPeriodStart: state.subscription.current_period_start
          ? new Date(state.subscription.current_period_start * 1000)
          : null,
        currentPeriodEnd: state.subscription.current_period_end
          ? new Date(state.subscription.current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: state.subscription.cancel_at_period_end,
        canceledAt: state.subscription.canceled_at
          ? new Date(state.subscription.canceled_at * 1000)
          : null,
        userId,
      },
      {},
    );
  }

  for (const invoice of state.invoices) {
    await upsertInvoice({
      stripeInvoiceId: invoice.id ?? '',
      stripeCustomerId: existing.customerId,
      amountDueCents: invoice.amount_due ?? 0,
      amountPaidCents: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? 'usd',
      status: (invoice.status ?? 'open') as InvoiceMirror['status'],
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdfUrl: invoice.invoice_pdf ?? null,
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      paidAt: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
    });
  }

  if (state.paymentMethod) {
    await updatePaymentMethod(existing.customerId, state.paymentMethod.brand, state.paymentMethod.last4);
  }

  return { synced: true };
}

async function findUserIdByCustomer(customerId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);
  return row?.userId ?? null;
}

async function findPlanIdByPrice(stripePriceId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.stripePriceId, stripePriceId), eq(plans.isActive, true)))
    .limit(1);
  return row?.id ?? null;
}

async function getExistingStatus(stripeSubscriptionId: string): Promise<SubscriptionStatus | null> {
  const [row] = await getDb()
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return row?.status ?? null;
}
