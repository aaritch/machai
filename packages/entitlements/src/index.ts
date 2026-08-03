import {
  ENTITLING_STATUSES,
  FREE_ENTITLEMENTS,
  type Bureau,
  type Entitlements,
  type SubscriptionStatus,
} from '@machai/types';

/**
 * EntitlementService — the single authority on what a user may do.
 *
 * Contract (project plan C.3): given a user's active subscription taken from
 * MIRRORED data, return the capability set. A free or absent subscription
 * yields the empty set. This is the only place capability is decided, so web
 * and worker ask it rather than re-deriving the rules.
 *
 * It deliberately takes plain data and returns plain data — no database, no
 * Stripe, no network. That is what makes it exhaustively testable and what
 * guarantees no live Stripe call ever lands in the request path (TASK-04
 * security scenario).
 */

export interface SubscriptionSnapshot {
  status: SubscriptionStatus | null;
  planEntitlements: Entitlements | null;
  currentPeriodEnd: Date | null;
}

/**
 * `past_due` keeps full access during the grace window: Stripe's Smart Retries
 * are still working the payment, and cutting a paying customer off mid-retry
 * generates support load for a charge that usually succeeds (spec §10.7).
 * Terminal states drop to the free set immediately.
 */
export function resolveEntitlements(snapshot: SubscriptionSnapshot | null): Entitlements {
  if (!snapshot?.status || !snapshot.planEntitlements) return FREE_ENTITLEMENTS;
  if (!ENTITLING_STATUSES.includes(snapshot.status)) return FREE_ENTITLEMENTS;
  return snapshot.planEntitlements;
}

export function isEntitling(status: SubscriptionStatus | null): boolean {
  return status !== null && ENTITLING_STATUSES.includes(status);
}

/** True when billing needs the user's attention but access continues. */
export function isInGracePeriod(status: SubscriptionStatus | null): boolean {
  return status === 'past_due';
}

export function canPullFromBureau(entitlements: Entitlements, bureau: Bureau): boolean {
  return entitlements.bureausAllowed.includes(bureau);
}

export function canAccessMarketplaceItem(entitlements: Entitlements, accessLevel: number): boolean {
  return entitlements.marketplaceAccessLevel >= accessLevel;
}

export type PullDenialReason =
  | 'no_entitlement'
  | 'bureau_not_allowed'
  | 'allowance_exceeded'
  | 'email_unverified'
  | 'kyb_not_verified';

export interface PullEligibilityInput {
  entitlements: Entitlements;
  bureau: Bureau;
  pullsUsedThisMonth: number;
  emailVerified: boolean;
  kybVerified: boolean;
}

export interface PullEligibility {
  allowed: boolean;
  reason?: PullDenialReason;
  message?: string;
  remaining: number;
}

/**
 * Every precondition for a live report pull, in one place (TASK-05 pull flow).
 *
 * Order matters for the message the user sees: check the cheapest, most
 * actionable gate first so someone with an unverified email is told to verify
 * it rather than being shown an upsell.
 */
export function checkPullEligibility(input: PullEligibilityInput): PullEligibility {
  const remaining = Math.max(0, input.entitlements.reportsPerMonth - input.pullsUsedThisMonth);

  if (!input.emailVerified) {
    return {
      allowed: false,
      reason: 'email_unverified',
      message: 'Verify your email address before pulling a report.',
      remaining,
    };
  }
  if (input.entitlements.reportsPerMonth === 0) {
    return {
      allowed: false,
      reason: 'no_entitlement',
      message: 'Live report pulls require an active plan.',
      remaining: 0,
    };
  }
  if (!canPullFromBureau(input.entitlements, input.bureau)) {
    return {
      allowed: false,
      reason: 'bureau_not_allowed',
      message: 'Your plan does not include this bureau.',
      remaining,
    };
  }
  if (!input.kybVerified) {
    return {
      allowed: false,
      reason: 'kyb_not_verified',
      message: 'Your business must finish verification before we can request its file.',
      remaining,
    };
  }
  if (remaining <= 0) {
    return {
      allowed: false,
      reason: 'allowance_exceeded',
      message: `You have used all ${input.entitlements.reportsPerMonth} report pulls for this month.`,
      remaining: 0,
    };
  }

  return { allowed: true, remaining };
}

/** 'YYYY-MM' key for the monthly allowance counter. */
export function allowancePeriod(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export { FREE_ENTITLEMENTS };
