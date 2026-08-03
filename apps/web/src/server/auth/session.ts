import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getConfig } from '@machai/config';
import { and, eq, gt, getDb, isDatabaseConfigured, isNull, sessions, users } from '@machai/db';
import { logger } from '@machai/observability';
import { AppError, ERROR_CODES, type SessionUser } from '@machai/types';

/**
 * Session management (spec §8.1).
 *
 * The cookie carries an opaque random token; the database stores only its
 * SHA-256 hash. A database leak therefore does not hand over live sessions —
 * the same reasoning as password hashing, applied to session tokens.
 *
 * Two independent expiries:
 *   idle     — extends on each request, so an abandoned session dies quietly.
 *   absolute — never extends, so a stolen token has a hard ceiling.
 */

const COOKIE_NAME = 'machai_session';
const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

function cookieOptions(expires: Date) {
  const config = getConfig();
  return {
    httpOnly: true,
    // Lax rather than Strict: Strict breaks the return leg from Stripe Checkout
    // and from emailed verification links, logging the user out at the worst
    // possible moment. Lax still blocks cross-site POSTs, and Server Actions
    // add their own origin check on top.
    sameSite: 'lax' as const,
    secure: config.APP_ENV !== 'development',
    path: '/',
    expires,
  };
}

export interface CreateSessionInput {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export async function createSession(input: CreateSessionInput): Promise<void> {
  const config = getConfig();
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const now = Date.now();
  const idleExpiresAt = new Date(now + config.SESSION_IDLE_TIMEOUT_MINUTES * 60_000);
  const absoluteExpiresAt = new Date(now + config.SESSION_ABSOLUTE_TIMEOUT_HOURS * 3_600_000);

  await getDb().insert(sessions).values({
    userId: input.userId,
    tokenHash: hashToken(token),
    idleExpiresAt,
    absoluteExpiresAt,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, cookieOptions(absoluteExpiresAt));
}

/**
 * Resolves the caller, or null.
 *
 * Never throws on an unconfigured database — marketing pages call this on every
 * render to decide whether to show "Log in" or "Dashboard", and must keep
 * working on a fresh deploy with no database attached.
 */
export async function getOptionalSession(): Promise<SessionUser | null> {
  if (!isDatabaseConfigured()) return null;

  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const now = new Date();
    const [row] = await getDb()
      .select({
        sessionId: sessions.id,
        idleExpiresAt: sessions.idleExpiresAt,
        userId: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
        emailVerifiedAt: users.emailVerifiedAt,
        mfaEnabled: users.mfaEnabled,
        firstName: users.firstName,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, hashToken(token)),
          isNull(sessions.revokedAt),
          gt(sessions.idleExpiresAt, now),
          gt(sessions.absoluteExpiresAt, now),
        ),
      )
      .limit(1);

    if (!row) return null;
    // A suspended or closed account keeps its session row but must not resolve
    // to a caller.
    if (row.status !== 'active') return null;

    await slideIdleWindow(row.sessionId, row.idleExpiresAt);

    return {
      id: row.userId,
      email: row.email,
      role: row.role,
      emailVerifiedAt: row.emailVerifiedAt,
      mfaEnabled: row.mfaEnabled,
      firstName: row.firstName,
    };
  } catch (error) {
    logger.error('session lookup failed', { error });
    return null;
  }
}

/**
 * Extends the idle window, but only once the window is half spent.
 *
 * Writing on every request would mean a database write per page view for no
 * benefit; this keeps the behaviour identical while cutting the writes by
 * roughly half.
 */
async function slideIdleWindow(sessionId: string, currentIdleExpiry: Date): Promise<void> {
  const config = getConfig();
  const windowMs = config.SESSION_IDLE_TIMEOUT_MINUTES * 60_000;
  const remaining = currentIdleExpiry.getTime() - Date.now();
  if (remaining > windowMs / 2) return;

  await getDb()
    .update(sessions)
    .set({ idleExpiresAt: new Date(Date.now() + windowMs), lastSeenAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

/** For pages: redirects to login rather than throwing. */
export async function requireSession(returnTo?: string): Promise<SessionUser> {
  const session = await getOptionalSession();
  if (!session) {
    const target = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login';
    redirect(target);
  }
  return session;
}

/** For server actions and route handlers: throws a typed error. */
export async function requireSessionOrThrow(): Promise<SessionUser> {
  const session = await getOptionalSession();
  if (!session) {
    throw new AppError(ERROR_CODES.UNAUTHENTICATED, 'You need to be signed in to do that.');
  }
  return session;
}

/**
 * Gates the actions that email verification is a precondition for: subscribing,
 * pulling reports, connecting a bureau (spec §6.5).
 */
export async function requireVerifiedSession(): Promise<SessionUser> {
  const session = await requireSessionOrThrow();
  if (!session.emailVerifiedAt) {
    throw new AppError(
      ERROR_CODES.EMAIL_UNVERIFIED,
      'Confirm your email address before doing that.',
    );
  }
  return session;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  store.delete(COOKIE_NAME);
  if (!token || !isDatabaseConfigured()) return;

  await getDb()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.tokenHash, hashToken(token)));
}

/** "Log out everywhere" (spec §8.1). Also used after a password change. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await getDb()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

/**
 * Rotates the session token while keeping the user signed in.
 *
 * Called on privilege change (password change, MFA enrolment) to defeat session
 * fixation: any token an attacker planted stops working (TASK-02 caveat).
 */
export async function rotateSession(userId: string): Promise<void> {
  await destroySession();
  const context = await getRequestContext();
  await createSession({ userId, ip: context.ip, userAgent: context.userAgent });
}

/** Client IP and user agent, for audit entries and rate limiting. */
export async function getRequestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  // Vercel sets x-forwarded-for; the leftmost entry is the client. Everything
  // after it is proxy hops and is not trustworthy for identification.
  const forwarded = h.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
  return { ip, userAgent: h.get('user-agent') };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
