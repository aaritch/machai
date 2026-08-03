import 'server-only';
import { and, businesses, eq, getDb, isNull } from '@machai/db';
import { writeAudit } from '@machai/db';
import { AUDIT_ACTIONS, type AuditAction } from '@machai/observability';
import {
  AppError,
  ERROR_CODES,
  notFoundOrForbidden,
  type SessionUser,
  type UserRole,
} from '@machai/types';
import { getRequestContext } from './session';

/**
 * Authorization guards.
 *
 * The cardinal rule (project plan C.1): authorization and money/credit truth
 * live server-side. Frontend gating is cosmetic; the backend re-checks
 * ownership AND entitlement on every sensitive call and writes an audit entry.
 *
 * Every guard here audits its FAILURES, not just its successes. A denied
 * request is the more interesting signal — it is what an enumeration attempt
 * looks like.
 */

/**
 * Confirms the caller owns this business.
 *
 * Returns 404 rather than 403 on failure: a 403 confirms the id exists, which
 * turns the endpoint into an enumeration oracle. The audit entry records the
 * real reason.
 */
export async function requireBusinessOwnership(
  user: SessionUser,
  businessId: string,
): Promise<BusinessRecord> {
  const [business] = await getDb()
    .select()
    .from(businesses)
    .where(and(eq(businesses.id, businessId), isNull(businesses.deletedAt)))
    .limit(1);

  const owned = business?.ownerUserId === user.id;
  // Staff can read any business for support purposes, and that read is audited
  // as an admin action rather than a normal one.
  const staffOverride = !owned && (user.role === 'staff' || user.role === 'admin');

  if (!business || (!owned && !staffOverride)) {
    await audit(AUDIT_ACTIONS.OWNERSHIP_CHECK_FAILED, user.id, 'business', businessId, {
      exists: Boolean(business),
    });
    throw notFoundOrForbidden('That business could not be found.');
  }

  if (staffOverride) {
    await audit(AUDIT_ACTIONS.ADMIN_USER_VIEWED, user.id, 'business', businessId, {
      reason: 'staff_access',
    });
  }

  return business;
}

export type BusinessRecord = typeof businesses.$inferSelect;

/** Role gate for the admin surface. MFA is enforced separately, below. */
export async function requireRole(user: SessionUser, roles: UserRole[]): Promise<void> {
  if (!roles.includes(user.role)) {
    await audit(AUDIT_ACTIONS.ROLE_CHECK_FAILED, user.id, 'user', user.id, {
      required: roles.join(','),
      actual: user.role,
    });
    throw notFoundOrForbidden('Not found.');
  }
}

/**
 * Staff and admin accounts must have MFA enrolled (spec §8.1).
 *
 * Checked at the point of access rather than only at login, so an account
 * promoted to staff cannot keep using a session established before the
 * requirement applied.
 */
export async function requireStaffWithMfa(user: SessionUser): Promise<void> {
  await requireRole(user, ['staff', 'admin']);
  if (!user.mfaEnabled) {
    await audit(AUDIT_ACTIONS.ROLE_CHECK_FAILED, user.id, 'user', user.id, {
      reason: 'mfa_not_enrolled',
    });
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      'Staff accounts must enrol in two-factor authentication before using the admin area.',
    );
  }
}

/** Records an entitlement denial. The decision itself belongs to the service. */
export async function auditEntitlementDenial(
  user: SessionUser,
  entityType: string,
  entityId: string | null,
  reason: string,
): Promise<void> {
  await audit(AUDIT_ACTIONS.ENTITLEMENT_CHECK_FAILED, user.id, entityType, entityId, { reason });
}

async function audit(
  action: AuditAction,
  actorId: string | null,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<void> {
  const context = await getRequestContext();
  await writeAudit({
    actorId,
    action,
    entityType,
    entityId,
    ip: context.ip,
    userAgent: context.userAgent,
    metadata,
  });
}

export { audit as auditAction };
