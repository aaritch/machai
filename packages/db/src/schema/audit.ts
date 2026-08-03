import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity';

/**
 * Append-only record of sensitive actions (spec §4.16, §13.5).
 *
 * There is no update or delete path in the application layer — entries are
 * written and never touched again. Grant the application role INSERT and SELECT
 * only on this table so the guarantee is enforced by Postgres, not by
 * convention (see docs/runbooks/database-roles.md).
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Null for unauthenticated actors (failed logins, public form abuse). */
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    /**
     * Ids, counts, and enum values ONLY.
     *
     * The audit log is read freely during investigations, so it must never be
     * the place an EIN or report payload ends up. The write helper in
     * ../audit.ts re-scrubs this before insert as a backstop.
     */
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null>>(),
  },
  (t) => [
    index('audit_log_actor_idx').on(t.actorId),
    index('audit_log_action_idx').on(t.action),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_created_idx').on(t.createdAt),
  ],
);

/**
 * Rate-limit and lockout counters.
 *
 * Redis is the fast path; this table is the durable fallback so limits still
 * apply when Redis is unavailable. Losing rate limiting during a cache outage
 * is exactly when it matters most.
 */
export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    /** `${scope}:${identifier}` — e.g. `login:user@example.com`. */
    key: text('key').primaryKey(),
    count: text('count').notNull().default('0'),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('rate_limit_expires_idx').on(t.expiresAt)],
);
