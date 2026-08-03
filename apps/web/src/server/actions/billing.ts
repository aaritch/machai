'use server';

import { redirect } from 'next/navigation';
import {
  createCheckoutSession,
  createOneOffCheckoutSession,
  createPortalSession,
  ensureCustomer,
  isStripeConfigured,
} from '@machai/billing';
import { reconcileFromStripe } from '@machai/billing-sync';
import { desc, eq, getDb, products, subscriptions, writeAudit } from '@machai/db';
import { AUDIT_ACTIONS } from '@machai/observability';
import { ERROR_CODES } from '@machai/types';
import { errorState, successState, toFormState, type FormState } from '@/lib/form';
import { requireVerifiedSession } from '@/server/auth/session';
import { getPlanByCode } from '@/server/plans';
import type { PlanCode } from '@machai/types';

/**
 * Billing actions (TASK-04).
 *
 * None of these grant an entitlement. Checkout opens a Stripe-hosted session
 * and nothing more; the mirror is updated only by verified webhooks, so a user
 * who abandons Checkout — or forges the return URL — gets nothing.
 */

export async function startCheckout(_prev: FormState, formData: FormData): Promise<FormState> {
  let url: string | null = null;

  try {
    // Verified email is a precondition for subscribing (spec §6.5).
    const session = await requireVerifiedSession();

    if (!isStripeConfigured()) {
      return errorState(
        'Checkout is not available yet. Please contact us and we will set this up for you.',
        ERROR_CODES.PROVIDER_UNAVAILABLE,
      );
    }

    const planCode = String(formData.get('planCode') ?? '') as PlanCode;
    const plan = await getPlanByCode(planCode);

    if (!plan) return errorState('That plan is not available.', ERROR_CODES.NOT_FOUND);

    // Enterprise is sales-assisted; there is no self-serve path to those
    // entitlements (spec §10.5). Checked server-side, not just hidden in the UI.
    if (plan.isContactSales) {
      return errorState(
        'This plan is set up by our team. Use the contact form and we will get you started.',
        ERROR_CODES.FORBIDDEN,
      );
    }
    if (!plan.stripePriceId) {
      return errorState(
        'This plan is not yet connected to billing. Please contact support.',
        ERROR_CODES.PROVIDER_UNAVAILABLE,
      );
    }

    const db = getDb();
    const [existing] = await db
      .select({ customerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    const customerId = await ensureCustomer({
      userId: session.id,
      email: session.email,
      name: session.firstName,
      existingCustomerId: existing?.customerId ?? null,
    });

    // A placeholder row so the customer id is recoverable even if the user
    // abandons Checkout — otherwise the next attempt creates a second Stripe
    // Customer for the same person.
    if (!existing) {
      await db
        .insert(subscriptions)
        .values({ userId: session.id, stripeCustomerId: customerId, status: 'incomplete' })
        .onConflictDoNothing();
    }

    const checkout = await createCheckoutSession({
      customerId,
      priceId: plan.stripePriceId,
      userId: session.id,
      planCode: plan.code,
    });

    await writeAudit({
      actorId: session.id,
      action: AUDIT_ACTIONS.CHECKOUT_SESSION_CREATED,
      entityType: 'subscription',
      entityId: null,
      metadata: { planCode: plan.code },
    });

    url = checkout.url;
  } catch (error) {
    return toFormState(error);
  }

  redirect(url);
}

export async function openBillingPortal(): Promise<void> {
  const session = await requireVerifiedSession();
  const [existing] = await getDb()
    .select({ customerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!existing?.customerId) redirect('/dashboard/billing?portal=unavailable');

  const portal = await createPortalSession(existing.customerId);

  await writeAudit({
    actorId: session.id,
    action: AUDIT_ACTIONS.PORTAL_SESSION_CREATED,
    entityType: 'subscription',
    entityId: null,
  });

  redirect(portal.url);
}

/**
 * The Refresh control (spec §7.5).
 *
 * Exists because webhooks can be missed. Re-reads Stripe and overwrites the
 * mirror, treating Stripe as authoritative.
 */
export async function refreshBillingState(_prev: FormState): Promise<FormState> {
  try {
    const session = await requireVerifiedSession();
    if (!isStripeConfigured()) {
      return errorState('Billing is not configured.', ERROR_CODES.PROVIDER_UNAVAILABLE);
    }
    const result = await reconcileFromStripe(session.id);
    return successState(
      result.synced ? 'Billing state re-synced from Stripe.' : 'Nothing to sync yet.',
    );
  } catch (error) {
    return toFormState(error);
  }
}

export async function startProductCheckout(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let url: string | null = null;

  try {
    const session = await requireVerifiedSession();
    if (!isStripeConfigured()) {
      return errorState('Purchases are not available yet.', ERROR_CODES.PROVIDER_UNAVAILABLE);
    }

    const productId = String(formData.get('productId') ?? '');
    const [product] = await getDb()
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product?.isActive) return errorState('That product is not available.', ERROR_CODES.NOT_FOUND);
    if (!product.stripePriceId) {
      return errorState('This product is not connected to billing yet.', ERROR_CODES.PROVIDER_UNAVAILABLE);
    }

    const [existing] = await getDb()
      .select({ customerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    const customerId = await ensureCustomer({
      userId: session.id,
      email: session.email,
      existingCustomerId: existing?.customerId ?? null,
    });

    const checkout = await createOneOffCheckoutSession({
      customerId,
      priceId: product.stripePriceId,
      userId: session.id,
      productId: product.id,
    });

    url = checkout.url;
  } catch (error) {
    return toFormState(error);
  }

  redirect(url);
}
