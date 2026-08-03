import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { entityTypeEnum, userRoleEnum, userStatusEnum, verificationStatusEnum } from './enums';

/** Every table carries id/created_at/updated_at; user-facing rows soft-delete. */
const base = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/** The login identity. One human = one user (spec §4.1). */
export const users = pgTable(
  'users',
  {
    ...base,
    /**
     * Stored lowercased. The spec suggests `citext`; a plain unique index on a
     * normalized value achieves the same thing without requiring the extension
     * to be installable on every managed Postgres (ADR-0003).
     */
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    role: userRoleEnum('role').notNull().default('member'),
    status: userStatusEnum('status').notNull().default('active'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    /** Encrypted at rest via the same envelope helper as EIN. */
    mfaSecret: text('mfa_secret'),
    /** Optional marketing consent from the signup checkbox (spec §6.3). */
    marketingOptInAt: timestamp('marketing_opt_in_at', { withTimezone: true }),
    /** Counts consecutive failures; reset on success. Drives lockout. */
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('users_email_key').on(t.email), index('users_role_idx').on(t.role)],
);

/**
 * The business profile credit is being built for (spec §4.2).
 *
 * Separate table because one user MAY own several businesses. v1 restricts to
 * one (decision D4) but the schema does not, so lifting the restriction is a
 * UI change rather than a migration.
 */
export const businesses = pgTable(
  'businesses',
  {
    ...base,
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    legalName: text('legal_name').notNull(),
    dbaName: text('dba_name'),
    entityType: entityTypeEnum('entity_type').notNull(),
    /**
     * AES-256-GCM ciphertext — NEVER plaintext (spec §13.2, STATE.md §8).
     * Written and read only through packages/db/src/encryption.
     */
    einEncrypted: text('ein_encrypted').notNull(),
    /**
     * Last four digits only, for display and support lookup. Four digits are
     * not enough to reconstruct the EIN, so this stays unencrypted and keeps
     * the UI from needing a decrypt on every list render.
     */
    einLast4: text('ein_last4').notNull(),
    /**
     * HMAC of the normalized EIN. Lets us detect duplicate registrations
     * without ever comparing plaintext or storing a reversible value.
     */
    einFingerprint: text('ein_fingerprint').notNull(),
    streetAddress: text('street_address').notNull(),
    addressLine2: text('address_line_2'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    zip: text('zip').notNull(),
    phone: text('phone').notNull(),
    website: text('website'),
    industryNaics: text('industry_naics'),
    verificationStatus: verificationStatusEnum('verification_status')
      .notNull()
      .default('unverified'),
    verificationNotes: text('verification_notes'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('businesses_owner_idx').on(t.ownerUserId),
    index('businesses_verification_idx').on(t.verificationStatus),
    index('businesses_ein_fingerprint_idx').on(t.einFingerprint),
  ],
);

/**
 * The authorized person (spec §4.3). Kept apart from `users` because the legal
 * representative is a business-role concept, and attestation data attaches here.
 *
 * Note what is absent: no SSN column, not even last-four. The product promise is
 * EIN only (STATE.md §8), and a column that does not exist cannot leak.
 */
export const representatives = pgTable(
  'representatives',
  {
    ...base,
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    title: text('title').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    ownershipPercentage: numeric('ownership_percentage', { precision: 5, scale: 2 }).notNull(),
    attestedAuthority: boolean('attested_authority').notNull().default(false),
    attestedAt: timestamp('attested_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('representatives_business_idx').on(t.businessId)],
);

/**
 * Server-side sessions (spec §8.1).
 *
 * The cookie holds an opaque random token; only its SHA-256 hash is stored, so
 * a database leak does not hand over live sessions. Absolute and idle timeouts
 * are separate columns because they expire for different reasons.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    absoluteExpiresAt: timestamp('absolute_expires_at', { withTimezone: true }).notNull(),
    idleExpiresAt: timestamp('idle_expires_at', { withTimezone: true }).notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_key').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
  ],
);

/** Single-use, expiring, hashed email-verification tokens (spec §6.5). */
export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    email: text('email').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('email_verifications_token_hash_key').on(t.tokenHash),
    index('email_verifications_user_idx').on(t.userId),
  ],
);

/** Same shape and same rules as verification tokens (spec §8.1). */
export const passwordResets = pgTable(
  'password_resets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('password_resets_token_hash_key').on(t.tokenHash),
    index('password_resets_user_idx').on(t.userId),
  ],
);

/**
 * Resumable wizard state (spec §6, "progress saved after each step").
 *
 * Holds the Business and Representative steps only. The Account step contains
 * the password and is never persisted before submit.
 */
export const onboardingDrafts = pgTable(
  'onboarding_drafts',
  {
    ...base,
    /** Anonymous drafts key off a cookie id; the user does not exist yet. */
    draftKey: text('draft_key').notNull(),
    /**
     * The EIN inside this JSON is encrypted before the draft is written — a
     * half-finished signup must not create a plaintext EIN anywhere.
     */
    businessStep: text('business_step'),
    representativeStep: text('representative_step'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex('onboarding_drafts_key_key').on(t.draftKey)],
);

export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
  sessions: many(sessions),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, { fields: [businesses.ownerUserId], references: [users.id] }),
  representatives: many(representatives),
}));

export const representativesRelations = relations(representatives, ({ one }) => ({
  business: one(businesses, {
    fields: [representatives.businessId],
    references: [businesses.id],
  }),
}));

export const NOW = sql`now()`;
