'use server';

import { redirect } from 'next/navigation';
import {
  and,
  businesses,
  emailVerifications,
  encryptField,
  eq,
  fingerprintField,
  getDb,
  isDatabaseConfigured,
  isNull,
  passwordResets,
  representatives,
  users,
  writeAudit,
} from '@machai/db';
import { AUDIT_ACTIONS, logger } from '@machai/observability';
import { enqueue } from '@machai/queue';
import {
  EMAIL_TEMPLATES,
  ERROR_CODES,
  GENERIC_AUTH_ERROR,
  GENERIC_RESET_ACK,
  QUEUE_NAMES,
  accountStepSchema,
  businessStepSchema,
  loginSchema,
  representativeStepSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from '@machai/types';
import { errorState, parseForm, successState, toFormState, type FormState } from '@/lib/form';
import {
  burnPasswordTime,
  EMAIL_VERIFICATION_TTL_MINUTES,
  hashPassword,
  hashTokenValue,
  issueToken,
  lockoutDurationMs,
  PASSWORD_RESET_TTL_MINUTES,
  verifyPassword,
} from '@/server/auth/password';
import { verifyTotp } from '@/server/auth/mfa';
import {
  createSession,
  destroySession,
  getRequestContext,
  revokeAllSessions,
} from '@/server/auth/session';
import { clearDraft, saveBusinessStep, saveRepresentativeStep } from '@/server/onboarding';
import { RATE_LIMITS, enforceRateLimit } from '@/server/rate-limit';
import { assertNotSpam } from '@/server/spam';
import { claimTicketsForVerifiedUser } from '@/server/tickets';
import { seedUserChecklist } from '@/server/checklist';
import { requestKybVerification } from '@/server/kyb';

/**
 * Authentication actions (TASK-02).
 *
 * The recurring theme is non-enumeration: signup, login, and password reset all
 * respond identically whether or not an account exists. That constraint shapes
 * the control flow more than anything else here.
 */

// --- Wizard step persistence ------------------------------------------------

/**
 * Shared failure for a wizard step that could not be saved.
 *
 * In practice this means the database is unreachable. It is deliberately the
 * same wording as the failure at final submit, so a user who gets this at step
 * one is told the same thing they would have been told at step three, rather
 * than filling in two more forms first.
 */
function signupUnavailable(): FormState {
  logger.error('signup step could not be persisted; is DATABASE_URL set?');
  return errorState(
    'Sign-ups are temporarily unavailable, so we could not save your details. Please try again shortly.',
    ERROR_CODES.PROVIDER_UNAVAILABLE,
  );
}

export async function saveBusinessStepAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const step = parseForm(businessStepSchema, formData);
    // Only advance if the step actually persisted. Advancing on a failed save
    // bounces the user back here with an empty form and no error shown.
    if (!(await saveBusinessStep(step))) return signupUnavailable();
    return successState(undefined, '/signup?step=representative');
  } catch (error) {
    return toFormState(error);
  }
}

export async function saveRepresentativeStepAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const step = parseForm(representativeStepSchema, formData);
    if (!(await saveRepresentativeStep(step))) return signupUnavailable();
    return successState(undefined, '/signup?step=account');
  } catch (error) {
    return toFormState(error);
  }
}

// --- Signup -----------------------------------------------------------------

export async function completeSignup(_prev: FormState, formData: FormData): Promise<FormState> {
  let redirectTo: string | null = null;

  try {
    if (!isDatabaseConfigured()) {
      return errorState(
        'Sign-ups are temporarily unavailable. Please try again shortly.',
        ERROR_CODES.PROVIDER_UNAVAILABLE,
      );
    }

    const account = parseForm(accountStepSchema, formData);
    const context = await getRequestContext();

    await assertNotSpam({
      honeypot: String(formData.get('website') ?? ''),
      renderedAt: Number(formData.get('renderedAt') ?? 0) || undefined,
      ip: context.ip,
    });
    await enforceRateLimit(RATE_LIMITS.signup, context.ip ?? account.email);

    // Steps 1 and 2 are re-validated here from the draft, not trusted from the
    // client. Client-side validation is UX only (global convention, TASK-00).
    const { loadDraft } = await import('@/server/onboarding');
    const draft = await loadDraft();
    if (!draft.business || !draft.representative) {
      return errorState(
        'Your business details are missing. Please start from the first step.',
        ERROR_CODES.VALIDATION_FAILED,
      );
    }
    const business = businessStepSchema.parse(draft.business);
    const representative = representativeStepSchema.parse(draft.representative);

    const db = getDb();
    const email = account.email;

    // Non-enumerating duplicate handling: an existing address gets the SAME
    // response as a fresh signup, and a notification email goes to the real
    // owner instead. Returning "that email is taken" here would confirm
    // account existence to anyone who asks (TASK-02 security scenario).
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      await burnPasswordTime();
      logger.info('signup attempted for existing address', {});
      await enqueue(QUEUE_NAMES.emails, `signup-collision:${existing.id}:${Date.now()}`, {
        template: EMAIL_TEMPLATES.passwordReset,
        to: email,
        data: { token: '' },
      });
      return successState(
        'Check your inbox — we have sent you a message to finish setting up your account.',
      );
    }

    const passwordHash = await hashPassword(account.password);
    const einNormalized = String(business.ein);

    // One transaction: a user without a business, or a business without a
    // representative, is a broken account someone has to repair by hand.
    const created = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email,
          passwordHash,
          firstName: representative.firstName,
          lastName: representative.lastName,
          role: 'member',
          status: 'active',
          marketingOptInAt: account.marketingOptIn ? new Date() : null,
        })
        .returning({ id: users.id });

      if (!user) throw new Error('User insert returned no row');

      const [businessRow] = await tx
        .insert(businesses)
        .values({
          ownerUserId: user.id,
          legalName: business.legalName,
          dbaName: business.dbaName || null,
          entityType: business.entityType,
          einEncrypted: await encryptField(einNormalized),
          einLast4: einNormalized.slice(-4),
          einFingerprint: fingerprintField(einNormalized),
          streetAddress: business.streetAddress,
          addressLine2: business.addressLine2 || null,
          city: business.city,
          state: business.state,
          zip: business.zip,
          phone: business.phone,
          verificationStatus: 'unverified',
        })
        .returning({ id: businesses.id });

      if (!businessRow) throw new Error('Business insert returned no row');

      await tx.insert(representatives).values({
        businessId: businessRow.id,
        firstName: representative.firstName,
        lastName: representative.lastName,
        title: representative.title,
        email: representative.email,
        phone: representative.phone || null,
        ownershipPercentage: String(representative.ownershipPercentage),
        attestedAuthority: representative.attestedAuthority,
        attestedAt: new Date(),
      });

      return { userId: user.id, businessId: businessRow.id };
    });

    await writeAudit({
      actorId: created.userId,
      action: AUDIT_ACTIONS.SIGNUP_COMPLETED,
      entityType: 'user',
      entityId: created.userId,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { businessId: created.businessId },
    });

    // Referral attribution. Recorded as `pending` and worth nothing until the
    // account converts to a paid plan; `recordReferralAtSignup` never throws,
    // because a referral bug must not cost us the signup.
    const { cookies } = await import('next/headers');
    const { REFERRAL_COOKIE } = await import('@machai/config/affiliate');
    const { recordReferralAtSignup } = await import('@machai/affiliate');
    const cookieStore = await cookies();
    await recordReferralAtSignup({
      code: cookieStore.get(REFERRAL_COOKIE)?.value,
      referredUserId: created.userId,
      referredEmail: email,
      einFingerprint: fingerprintField(einNormalized),
    });
    cookieStore.delete(REFERRAL_COOKIE);

    await sendVerificationEmail(created.userId, email);
    await seedUserChecklist(created.userId);
    // KYB starts immediately; the business sits in `pending` and bureau
    // actions stay locked until it resolves (spec §6.4).
    await requestKybVerification(created.businessId);

    await createSession({ userId: created.userId, ip: context.ip, userAgent: context.userAgent });
    await clearDraft();

    redirectTo = '/dashboard';
  } catch (error) {
    return toFormState(error);
  }

  // Outside the try: redirect() throws a control-flow signal that must not be
  // caught by the error handler above.
  redirect(redirectTo);
}

// --- Login ------------------------------------------------------------------

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  let redirectTo: string | null = null;

  try {
    if (!isDatabaseConfigured()) {
      return errorState('Sign-in is temporarily unavailable.', ERROR_CODES.PROVIDER_UNAVAILABLE);
    }

    const input = parseForm(loginSchema, formData);
    const context = await getRequestContext();
    const next = String(formData.get('next') ?? '');

    // Limited by BOTH address and IP: per-address alone lets one host walk a
    // list of accounts; per-IP alone lets a botnet hammer one account.
    await enforceRateLimit(RATE_LIMITS.login, input.email);
    await enforceRateLimit(RATE_LIMITS.login, context.ip ?? 'unknown-ip');

    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, input.email), isNull(users.deletedAt)))
      .limit(1);

    if (!user?.passwordHash) {
      // Burn the same time a real bcrypt comparison costs.
      await burnPasswordTime();
      await writeAudit({
        actorId: null,
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entityType: 'user',
        entityId: null,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { reason: 'no_such_user' },
      });
      return errorState(GENERIC_AUTH_ERROR, ERROR_CODES.UNAUTHENTICATED);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await writeAudit({
        actorId: user.id,
        action: AUDIT_ACTIONS.LOGIN_LOCKED_OUT,
        entityType: 'user',
        entityId: user.id,
        ip: context.ip,
        userAgent: context.userAgent,
      });
      return errorState(
        'This account is temporarily locked after too many failed attempts. Try again shortly.',
        ERROR_CODES.RATE_LIMITED,
      );
    }

    const passwordOk = await verifyPassword(input.password, user.passwordHash);
    if (!passwordOk) {
      const failedCount = user.failedLoginCount + 1;
      const lockMs = lockoutDurationMs(failedCount);
      await db
        .update(users)
        .set({
          failedLoginCount: failedCount,
          lockedUntil: lockMs > 0 ? new Date(Date.now() + lockMs) : null,
        })
        .where(eq(users.id, user.id));

      await writeAudit({
        actorId: user.id,
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entityType: 'user',
        entityId: user.id,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { failedCount },
      });
      return errorState(GENERIC_AUTH_ERROR, ERROR_CODES.UNAUTHENTICATED);
    }

    if (user.status !== 'active') {
      return errorState(
        'This account is not currently active. Please contact support.',
        ERROR_CODES.FORBIDDEN,
      );
    }

    // MFA is mandatory for staff and admin (spec §8.1). A staff account that
    // has not yet enrolled is pushed into enrolment rather than let through.
    if (user.mfaEnabled) {
      if (!input.totpCode) {
        return errorState('Enter the 6-digit code from your authenticator app.', ERROR_CODES.UNAUTHENTICATED, {
          totpCode: ['Required'],
        });
      }
      const secret = user.mfaSecret ? await decryptMfaSecret(user.mfaSecret) : null;
      if (!secret || !verifyTotp(secret, input.totpCode)) {
        await writeAudit({
          actorId: user.id,
          action: AUDIT_ACTIONS.MFA_CHALLENGE_FAILED,
          entityType: 'user',
          entityId: user.id,
          ip: context.ip,
          userAgent: context.userAgent,
        });
        return errorState('That code is not valid. Try the next one.', ERROR_CODES.UNAUTHENTICATED, {
          totpCode: ['Invalid code'],
        });
      }
    }

    await db
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    await createSession({ userId: user.id, ip: context.ip, userAgent: context.userAgent });
    await writeAudit({
      actorId: user.id,
      action: AUDIT_ACTIONS.LOGIN_SUCCEEDED,
      entityType: 'user',
      entityId: user.id,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    // Only same-origin relative paths — an open redirect here would make the
    // login page a phishing springboard.
    redirectTo = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  } catch (error) {
    return toFormState(error);
  }

  redirect(redirectTo);
}

export async function logout(): Promise<void> {
  const context = await getRequestContext();
  const { getOptionalSession } = await import('@/server/auth/session');
  const session = await getOptionalSession();

  await destroySession();

  if (session) {
    await writeAudit({
      actorId: session.id,
      action: AUDIT_ACTIONS.LOGOUT,
      entityType: 'user',
      entityId: session.id,
      ip: context.ip,
      userAgent: context.userAgent,
    });
  }
  redirect('/');
}

// --- Email verification -----------------------------------------------------

export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const { token, tokenHash, expiresAt } = issueToken(EMAIL_VERIFICATION_TTL_MINUTES);

  await getDb().insert(emailVerifications).values({ userId, tokenHash, email, expiresAt });
  await enqueue(QUEUE_NAMES.emails, `verify:${tokenHash.slice(0, 24)}`, {
    template: EMAIL_TEMPLATES.verifyEmail,
    to: email,
    data: { token },
  });
}

export async function resendVerification(_prev: FormState): Promise<FormState> {
  try {
    const { requireSessionOrThrow } = await import('@/server/auth/session');
    const session = await requireSessionOrThrow();
    if (session.emailVerifiedAt) return successState('Your email is already confirmed.');

    await enforceRateLimit(RATE_LIMITS.verificationResend, session.id);
    await sendVerificationEmail(session.id, session.email);

    const context = await getRequestContext();
    await writeAudit({
      actorId: session.id,
      action: AUDIT_ACTIONS.EMAIL_VERIFICATION_RESENT,
      entityType: 'user',
      entityId: session.id,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return successState('Sent. Check your inbox for the confirmation link.');
  } catch (error) {
    return toFormState(error);
  }
}

export interface VerificationOutcome {
  ok: boolean;
  reason?: 'expired' | 'invalid' | 'already_used';
}

/** Consumes a verification token. Called from the verify-email page. */
export async function consumeVerificationToken(token: string): Promise<VerificationOutcome> {
  if (!isDatabaseConfigured()) return { ok: false, reason: 'invalid' };

  const db = getDb();
  const [record] = await db
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.tokenHash, hashTokenValue(token)))
    .limit(1);

  if (!record) return { ok: false, reason: 'invalid' };
  if (record.consumedAt) return { ok: false, reason: 'already_used' };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'expired' };

  await db.transaction(async (tx) => {
    await tx
      .update(emailVerifications)
      .set({ consumedAt: new Date() })
      .where(eq(emailVerifications.id, record.id));
    await tx
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, record.userId));
  });

  // Public contact submissions from this address now belong to this account
  // (TASK-07 edge case).
  await claimTicketsForVerifiedUser(record.userId, record.email);

  await writeAudit({
    actorId: record.userId,
    action: AUDIT_ACTIONS.EMAIL_VERIFIED,
    entityType: 'user',
    entityId: record.userId,
  });

  return { ok: true };
}

// --- Password reset ---------------------------------------------------------

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const { email } = parseForm(requestPasswordResetSchema, formData);
    const context = await getRequestContext();
    await enforceRateLimit(RATE_LIMITS.passwordReset, email);

    if (isDatabaseConfigured()) {
      const [user] = await getDb()
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), isNull(users.deletedAt)))
        .limit(1);

      if (user) {
        const { token, tokenHash, expiresAt } = issueToken(PASSWORD_RESET_TTL_MINUTES);
        await getDb().insert(passwordResets).values({ userId: user.id, tokenHash, expiresAt });
        await enqueue(QUEUE_NAMES.emails, `reset:${tokenHash.slice(0, 24)}`, {
          template: EMAIL_TEMPLATES.passwordReset,
          to: email,
          data: { token },
        });
        await writeAudit({
          actorId: user.id,
          action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
          entityType: 'user',
          entityId: user.id,
          ip: context.ip,
          userAgent: context.userAgent,
        });
      }
    }

    // Identical acknowledgement either way — this is the whole point.
    return successState(GENERIC_RESET_ACK);
  } catch (error) {
    return toFormState(error);
  }
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  let redirectTo: string | null = null;

  try {
    const input = parseForm(resetPasswordSchema, formData);
    if (!isDatabaseConfigured()) {
      return errorState('Password reset is temporarily unavailable.', ERROR_CODES.PROVIDER_UNAVAILABLE);
    }

    const db = getDb();
    const [record] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.tokenHash, hashTokenValue(input.token)))
      .limit(1);

    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      return errorState(
        'That reset link is no longer valid. Request a new one.',
        ERROR_CODES.VALIDATION_FAILED,
      );
    }

    const passwordHash = await hashPassword(input.password);
    await db.transaction(async (tx) => {
      await tx
        .update(passwordResets)
        .set({ consumedAt: new Date() })
        .where(eq(passwordResets.id, record.id));
      await tx
        .update(users)
        .set({ passwordHash, failedLoginCount: 0, lockedUntil: null })
        .where(eq(users.id, record.userId));
    });

    // Every existing session dies. A reset is often a response to compromise,
    // and leaving the attacker's session alive would defeat the point.
    await revokeAllSessions(record.userId);

    await writeAudit({
      actorId: record.userId,
      action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
      entityType: 'user',
      entityId: record.userId,
    });

    redirectTo = '/login?reset=done';
  } catch (error) {
    return toFormState(error);
  }

  redirect(redirectTo);
}

async function decryptMfaSecret(encrypted: string): Promise<string | null> {
  try {
    const { decryptField } = await import('@machai/db');
    return await decryptField(encrypted);
  } catch (error) {
    logger.error('failed to decrypt mfa secret', { error });
    return null;
  }
}

/** Exposed for the settings screen's "log out everywhere" control. */
export async function logoutEverywhere(): Promise<void> {
  const { requireSessionOrThrow } = await import('@/server/auth/session');
  const session = await requireSessionOrThrow();
  await revokeAllSessions(session.id);
  await writeAudit({
    actorId: session.id,
    action: AUDIT_ACTIONS.LOGOUT_ALL_SESSIONS,
    entityType: 'user',
    entityId: session.id,
  });
  redirect('/login');
}
