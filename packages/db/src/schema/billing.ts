import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Entitlements } from '@machai/types';
import { invoiceStatusEnum, subscriptionStatusEnum } from './enums';
import { businesses, users } from './identity';

const base = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Plans (spec §4.4). Mirrors Stripe Products/Prices locally so pricing pages
 * and gating never depend on a live Stripe call.
 */
export const plans = pgTable(
  'plans',
  {
    ...base,
    code: text('code').notNull(),
    name: text('name').notNull(),
    tagline: text('tagline').notNull().default(''),
    description: text('description').notNull().default(''),
    monthlyPriceCents: integer('monthly_price_cents').notNull(),
    currency: text('currency').notNull().default('usd'),
    stripeProductId: text('stripe_product_id'),
    stripePriceId: text('stripe_price_id'),
    /** Display strings for the pricing card. */
    features: jsonb('features').$type<string[]>().notNull().default([]),
    /** Machine-readable gating flags — the only thing authorization reads. */
    entitlements: jsonb('entitlements').$type<Entitlements>().notNull(),
    isContactSales: boolean('is_contact_sales').notNull().default(false),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [uniqueIndex('plans_code_key').on(t.code), index('plans_active_idx').on(t.isActive)],
);

/**
 * Local mirror of Stripe's subscription object (spec §4.5).
 *
 * Stripe is the source of truth; this table is the fast read the app gates on.
 * Only webhook handlers and the explicit reconcile path write here.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    ...base,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'set null' }),
    planId: uuid('plan_id').references(() => plans.id),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    status: subscriptionStatusEnum('status').notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    /** Display only — never used to authorize anything. */
    defaultPaymentMethodLast4: text('default_payment_method_last4'),
    cardBrand: text('card_brand'),
    /** When the mirror last agreed with Stripe; surfaces drift. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('subscriptions_stripe_sub_key').on(t.stripeSubscriptionId),
    index('subscriptions_user_idx').on(t.userId),
    index('subscriptions_status_idx').on(t.status),
  ],
);

/** Billing history for the invoices panel (spec §4.6). */
export const invoices = pgTable(
  'invoices',
  {
    ...base,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    stripeInvoiceId: text('stripe_invoice_id').notNull(),
    amountDueCents: integer('amount_due_cents').notNull().default(0),
    amountPaidCents: integer('amount_paid_cents').notNull().default(0),
    currency: text('currency').notNull().default('usd'),
    status: invoiceStatusEnum('status').notNull(),
    hostedInvoiceUrl: text('hosted_invoice_url'),
    invoicePdfUrl: text('invoice_pdf_url'),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('invoices_stripe_id_key').on(t.stripeInvoiceId),
    index('invoices_user_idx').on(t.userId),
  ],
);

/**
 * The idempotency store for inbound webhooks.
 *
 * Stripe retries deliveries; without this a duplicate would double-apply state
 * changes (TASK-04 edge case). Insert-with-conflict on `stripeEventId` is the
 * lock — a second delivery loses the race and is dropped.
 */
export const processedWebhookEvents = pgTable(
  'processed_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** `stripe:evt_...` — namespaced so other providers can share the table. */
    stripeEventId: text('stripe_event_id').notNull(),
    eventType: text('event_type').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    /** Set when the handler exhausted retries; drives the dead-letter alert. */
    failedAt: timestamp('failed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [uniqueIndex('processed_webhook_events_key').on(t.stripeEventId)],
);

/** One-off catalog items, distinct from the subscription (spec §4.15). */
export const products = pgTable(
  'products',
  {
    ...base,
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    priceCents: integer('price_cents').notNull().default(0),
    currency: text('currency').notNull().default('usd'),
    stripePriceId: text('stripe_price_id'),
    isActive: boolean('is_active').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (t) => [uniqueIndex('products_slug_key').on(t.slug)],
);

export const purchases = pgTable(
  'purchases',
  {
    ...base,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('usd'),
    status: text('status').notNull().default('pending'),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }),
  },
  (t) => [
    index('purchases_user_idx').on(t.userId),
    uniqueIndex('purchases_payment_intent_key').on(t.stripePaymentIntentId),
  ],
);

/** Enterprise "Contact Sales" leads (spec §10.5). Staff provision manually. */
export const enterpriseLeads = pgTable('enterprise_leads', {
  ...base,
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  companyName: text('company_name').notNull(),
  message: text('message'),
  status: text('status').notNull().default('new'),
  handledByUserId: uuid('handled_by_user_id').references(() => users.id),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
}));
