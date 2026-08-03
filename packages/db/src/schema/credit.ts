import { relations } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Bureau, NormalizedReport } from '@machai/types';
import {
  bureauEnum,
  disputeStatusEnum,
  reportStatusEnum,
  tradelineAccountTypeEnum,
  tradelinePaymentStatusEnum,
  tradelineSourceEnum,
} from './enums';
import { businesses, users } from './identity';

const base = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/** A pulled report snapshot (spec §4.7) — Direction A only. */
export const creditReports = pgTable(
  'credit_reports',
  {
    ...base,
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    bureau: bureauEnum('bureau').notNull(),
    pulledAt: timestamp('pulled_at', { withTimezone: true }),
    score: integer('score'),
    scoreBand: text('score_band'),
    /** '0–100', '0–650' — stored per report so a scale change is visible. */
    scoreScale: text('score_scale'),
    /**
     * The full provider response, retained for audit and re-parsing. Never
     * discarded: if a bureau changes its format we re-normalize from this
     * rather than losing the pull (TASK-05 caveat).
     */
    rawPayload: jsonb('raw_payload'),
    normalized: jsonb('normalized').$type<NormalizedReport | null>(),
    /** Storage key, not a URL. Signed URLs are minted per request and expire. */
    pdfStorageKey: text('pdf_storage_key'),
    status: reportStatusEnum('status').notNull().default('pending'),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    /**
     * `${businessId}:${bureau}:${YYYY-MM-DD}` — unique, so two requests on the
     * same day cannot bill the data provider twice.
     */
    idempotencyKey: text('idempotency_key').notNull(),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
  },
  (t) => [
    uniqueIndex('credit_reports_idempotency_key').on(t.idempotencyKey),
    index('credit_reports_business_idx').on(t.businessId, t.bureau),
    index('credit_reports_status_idx').on(t.status),
  ],
);

/** Time series behind the Credit Progress chart (spec §4.8). */
export const scoreHistory = pgTable(
  'score_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    bureau: bureauEnum('bureau').notNull(),
    score: integer('score').notNull(),
    recordedOn: date('recorded_on').notNull(),
    creditReportId: uuid('credit_report_id').references(() => creditReports.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    // One observation per bureau per day keeps the chart honest and makes
    // re-runs idempotent.
    uniqueIndex('score_history_unique_observation').on(t.businessId, t.bureau, t.recordedOn),
    index('score_history_business_idx').on(t.businessId),
  ],
);

/** Tracked credit accounts (spec §4.9). */
export const tradelines = pgTable(
  'tradelines',
  {
    ...base,
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    creditorName: text('creditor_name').notNull(),
    accountType: tradelineAccountTypeEnum('account_type').notNull(),
    dateOpened: date('date_opened'),
    creditLimitCents: integer('credit_limit_cents'),
    highBalanceCents: integer('high_balance_cents'),
    currentBalanceCents: integer('current_balance_cents'),
    paymentStatus: tradelinePaymentStatusEnum('payment_status').notNull().default('current'),
    /** Bureaus this line is observed on. Not a furnishing record. */
    reportedTo: jsonb('reported_to').$type<Bureau[]>().notNull().default([]),
    /**
     * The server always sets this. A client cannot claim `platform_reported`;
     * nothing in this codebase writes that value at all — it exists only so
     * TASK-06 has a home once furnisher approval lands.
     */
    source: tradelineSourceEnum('source').notNull().default('user_added'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('tradelines_business_idx').on(t.businessId)],
);

/**
 * FCRA-aligned dispute intake (spec §14.1).
 *
 * Recorded for both pulled reports and tracked tradelines; the investigation
 * status and outcome are retained per legal's schedule.
 */
export const disputes = pgTable(
  'disputes',
  {
    ...base,
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    filedByUserId: uuid('filed_by_user_id')
      .notNull()
      .references(() => users.id),
    creditReportId: uuid('credit_report_id').references(() => creditReports.id, {
      onDelete: 'set null',
    }),
    tradelineId: uuid('tradeline_id').references(() => tradelines.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    details: text('details').notNull(),
    status: disputeStatusEnum('status').notNull().default('submitted'),
    outcome: text('outcome'),
    /** FCRA investigation clock. Set at intake so the deadline is explicit. */
    dueBy: timestamp('due_by', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('disputes_business_idx').on(t.businessId),
    index('disputes_status_idx').on(t.status),
  ],
);

/**
 * Per-month live-pull metering (TASK-05 "Metering protects your margin").
 *
 * A counter row per user per month. A failed pull must NOT consume allowance,
 * so the counter is incremented on success, not on request.
 */
export const pullAllowanceUsage = pgTable(
  'pull_allowance_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'YYYY-MM'. */
    period: text('period').notNull(),
    pullsUsed: integer('pulls_used').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('pull_allowance_period_key').on(t.userId, t.period)],
);

/**
 * Alert de-duplication (TASK-05 failure case: "an alert is sent once, not
 * repeatedly for the same change").
 */
export const scoreAlerts = pgTable(
  'score_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    bureau: bureauEnum('bureau').notNull(),
    previousScore: integer('previous_score'),
    newScore: integer('new_score').notNull(),
    /** `${businessId}:${bureau}:${prev}:${next}` — one alert per transition. */
    dedupeKey: text('dedupe_key').notNull(),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('score_alerts_dedupe_key').on(t.dedupeKey)],
);

export const creditReportsRelations = relations(creditReports, ({ one, many }) => ({
  business: one(businesses, { fields: [creditReports.businessId], references: [businesses.id] }),
  scorePoints: many(scoreHistory),
}));

export const tradelinesRelations = relations(tradelines, ({ one }) => ({
  business: one(businesses, { fields: [tradelines.businessId], references: [businesses.id] }),
}));
