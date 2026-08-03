import 'server-only';
import { and, eq, getDb, isDatabaseConfigured, rateLimitCounters, sql } from '@machai/db';
import { logger } from '@machai/observability';
import { AppError, ERROR_CODES } from '@machai/types';

/**
 * Rate limiting for auth endpoints and public forms (spec §13.6).
 *
 * Backed by Postgres rather than memory. In-memory counters are worthless on
 * Vercel: each serverless instance gets its own map, so an attacker spreading
 * requests across instances gets the limit multiplied by the instance count.
 *
 * Redis would be faster, but correctness matters more than latency on a path
 * that runs a handful of times per user — and it means rate limiting does not
 * silently disappear during a cache outage, which is exactly when it is most
 * needed.
 */

export interface RateLimitRule {
  /** Namespace, e.g. 'login' or 'contact'. */
  scope: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  login: { scope: 'login', limit: 10, windowSeconds: 900 },
  signup: { scope: 'signup', limit: 5, windowSeconds: 3600 },
  passwordReset: { scope: 'password-reset', limit: 5, windowSeconds: 3600 },
  verificationResend: { scope: 'verification-resend', limit: 5, windowSeconds: 3600 },
  contact: { scope: 'contact', limit: 5, windowSeconds: 3600 },
  reportPull: { scope: 'report-pull', limit: 10, windowSeconds: 3600 },
  ticketReply: { scope: 'ticket-reply', limit: 30, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Consumes one unit against `identifier` (an email, IP, or user id).
 *
 * Fails OPEN when the database is unavailable. That is a deliberate trade: a
 * database outage would otherwise lock every user out of logging in, and the
 * lockout counters on the user record still bound brute force against any
 * single account.
 */
export async function consumeRateLimit(
  rule: RateLimitRule,
  identifier: string,
): Promise<RateLimitResult> {
  if (!isDatabaseConfigured()) {
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }

  const key = `${rule.scope}:${identifier.toLowerCase()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + rule.windowSeconds * 1000);

  try {
    const db = getDb();

    // Single statement: insert the counter, or bump it if the window is still
    // open, or reset it if the window has passed. Doing this in one round trip
    // avoids the read-then-write race that lets a burst slip past the limit.
    const [row] = await db
      .insert(rateLimitCounters)
      .values({ key, count: '1', windowStartedAt: now, expiresAt })
      .onConflictDoUpdate({
        target: rateLimitCounters.key,
        set: {
          count: sql`CASE WHEN ${rateLimitCounters.expiresAt} < now() THEN '1'
                          ELSE (${rateLimitCounters.count}::int + 1)::text END`,
          windowStartedAt: sql`CASE WHEN ${rateLimitCounters.expiresAt} < now() THEN now()
                                    ELSE ${rateLimitCounters.windowStartedAt} END`,
          expiresAt: sql`CASE WHEN ${rateLimitCounters.expiresAt} < now() THEN ${expiresAt}
                              ELSE ${rateLimitCounters.expiresAt} END`,
        },
      })
      .returning({ count: rateLimitCounters.count, expiresAt: rateLimitCounters.expiresAt });

    const used = Number.parseInt(row?.count ?? '1', 10);
    const allowed = used <= rule.limit;
    const retryAfterSeconds = allowed
      ? 0
      : Math.max(1, Math.ceil(((row?.expiresAt?.getTime() ?? 0) - Date.now()) / 1000));

    return { allowed, remaining: Math.max(0, rule.limit - used), retryAfterSeconds };
  } catch (error) {
    logger.error('rate limit check failed; allowing request', { scope: rule.scope, error });
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }
}

/** Consumes and throws when the limit is exceeded. */
export async function enforceRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  const result = await consumeRateLimit(rule, identifier);
  if (!result.allowed) {
    throw new AppError(
      ERROR_CODES.RATE_LIMITED,
      `Too many attempts. Try again in ${formatRetry(result.retryAfterSeconds)}.`,
    );
  }
}

function formatRetry(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** Housekeeping for the worker's scheduler. */
export async function purgeExpiredRateLimits(): Promise<number> {
  const deleted = await getDb()
    .delete(rateLimitCounters)
    .where(and(sql`${rateLimitCounters.expiresAt} < now()`, eq(sql`true`, sql`true`)))
    .returning({ key: rateLimitCounters.key });
  return deleted.length;
}
