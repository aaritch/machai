import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';

/**
 * Affiliate program (spec §1.3, Phase 5).
 *
 * A commission is earned when a referred business starts a PAID plan. The free
 * tier creates no subscription, so it can never trigger one.
 */

export const affiliateStatusEnum = pgEnum('affiliate_status', [
  'pending',
  'active',
  'suspended',
  'rejected',
]);

/**
 * Referral lifecycle:
 *
 *   pending   signed up through the link, has not converted
 *   qualified converted to a paid plan; inside the hold window
 *   payable   hold elapsed, no reversal — safe to pay
 *   paid      included in a settled payout
 *   reversed  refunded, disputed, churned inside the hold, or fraud
 *
 * `reversed` is terminal and deliberate: a commission that was never really
 * earned should stay visible as a reversal rather than being deleted, so the
 * affiliate's history reconciles.
 */
export const referralStatusEnum = pgEnum('referral_status', [
  'pending',
  'qualified',
  'payable',
  'paid',
  'reversed',
]);

export const payoutStatusEnum = pgEnum('affiliate_payout_status', [
  'pending',
  'processing',
  'paid',
  'failed',
]);

const base = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const affiliates = pgTable(
  'affiliates',
  {
    ...base,
    /** One affiliate account per user. */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The shareable code. Appears in URLs, so it is public by nature. */
    code: text('code').notNull(),
    status: affiliateStatusEnum('status').notNull().default('pending'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    suspendedReason: text('suspended_reason'),
    /**
     * Where to send money. An email address only — deliberately NO bank or card
     * details. Payouts are issued through an external process, so this table
     * never becomes a store of payment credentials (spec §13.1: data we do not
     * collect cannot leak).
     */
    payoutEmail: text('payout_email'),
    /** How the applicant says they will promote. Read by staff at approval. */
    applicationNote: text('application_note'),
  },
  (t) => [
    uniqueIndex('affiliates_user_key').on(t.userId),
    uniqueIndex('affiliates_code_key').on(t.code),
    index('affiliates_status_idx').on(t.status),
  ],
);

export const affiliateReferrals = pgTable(
  'affiliate_referrals',
  {
    ...base,
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliates.id, { onDelete: 'cascade' }),
    /**
     * The referred account. UNIQUE — one attribution per person, ever. Without
     * this constraint the same user could be claimed by several affiliates, or
     * by the same one twice.
     */
    referredUserId: uuid('referred_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The code as used, retained even if the affiliate's code later changes. */
    codeUsed: text('code_used').notNull(),
    status: referralStatusEnum('status').notNull().default('pending'),
    /** Snapshotted at qualification, so retuning the program cannot rewrite history. */
    commissionCents: integer('commission_cents').notNull().default(0),
    currency: text('currency').notNull().default('usd'),
    signedUpAt: timestamp('signed_up_at', { withTimezone: true }).notNull().defaultNow(),
    qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
    /** When the hold expires and the commission becomes payable. */
    payableAt: timestamp('payable_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    reversalReason: text('reversal_reason'),
    payoutId: uuid('payout_id'),
    /**
     * Set when the referral tripped a velocity or pattern check. Flagged
     * referrals still qualify — they simply do not become payable without a
     * staff decision.
     */
    flaggedForReview: boolean('flagged_for_review').notNull().default(false),
    flagReason: text('flag_reason'),
  },
  (t) => [
    uniqueIndex('affiliate_referrals_referred_user_key').on(t.referredUserId),
    index('affiliate_referrals_affiliate_idx').on(t.affiliateId, t.status),
    index('affiliate_referrals_status_idx').on(t.status),
    index('affiliate_referrals_payable_idx').on(t.payableAt),
  ],
);

export const affiliatePayouts = pgTable(
  'affiliate_payouts',
  {
    ...base,
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliates.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('usd'),
    referralCount: integer('referral_count').notNull().default(0),
    status: payoutStatusEnum('status').notNull().default('pending'),
    /** External payment reference. Not a credential. */
    reference: text('reference'),
    issuedByUserId: uuid('issued_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
  },
  (t) => [index('affiliate_payouts_affiliate_idx').on(t.affiliateId, t.status)],
);

export const affiliatesRelations = relations(affiliates, ({ one, many }) => ({
  user: one(users, { fields: [affiliates.userId], references: [users.id] }),
  referrals: many(affiliateReferrals),
  payouts: many(affiliatePayouts),
}));

export const affiliateReferralsRelations = relations(affiliateReferrals, ({ one }) => ({
  affiliate: one(affiliates, {
    fields: [affiliateReferrals.affiliateId],
    references: [affiliates.id],
  }),
  referredUser: one(users, {
    fields: [affiliateReferrals.referredUserId],
    references: [users.id],
  }),
}));
