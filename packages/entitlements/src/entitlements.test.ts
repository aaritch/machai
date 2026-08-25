import { describe, expect, it } from 'vitest';
import { FREE_ENTITLEMENTS, type Entitlements } from '@machai/types';
import {
  allowancePeriod,
  canAccessMarketplaceItem,
  checkPullEligibility,
  isInGracePeriod,
  resolveEntitlements,
} from './index';

/** TASK-04 / TASK-05 gating scenarios. */

/**
 * A fixture with pulls switched ON.
 *
 * No plan we currently sell includes pulls, but the pull-eligibility logic is
 * still live behind the dashboard, so it still needs testing. Keeping the
 * fixture independent of PLAN_CATALOG means a pricing change cannot silently
 * stop exercising these paths.
 */
const STARTER: Entitlements = {
  bureausReportedTo: ['creditsafe'],
  bureausAllowed: ['creditsafe'],
  reportsPerMonth: 2,
  monitoring: true,
  alerts: true,
  detailedAnalysis: false,
  advancedAnalytics: false,
  supportTier: 'standard',
  marketplaceAccessLevel: 1,
};

describe('resolveEntitlements', () => {
  it('grants the plan set for an active subscription (happy path)', () => {
    expect(
      resolveEntitlements({ status: 'active', planEntitlements: STARTER, currentPeriodEnd: null }),
    ).toEqual(STARTER);
  });

  it('yields the empty set with no subscription', () => {
    expect(resolveEntitlements(null)).toEqual(FREE_ENTITLEMENTS);
  });

  it('keeps access during the past_due grace window (edge)', () => {
    // spec §10.7: Stripe's Smart Retries are still working the payment. Cutting
    // access mid-retry generates support load for a charge that usually
    // succeeds.
    expect(
      resolveEntitlements({ status: 'past_due', planEntitlements: STARTER, currentPeriodEnd: null }),
    ).toEqual(STARTER);
    expect(isInGracePeriod('past_due')).toBe(true);
  });

  it('drops to free on every terminal status (failure)', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete_expired', 'paused'] as const) {
      expect(
        resolveEntitlements({ status, planEntitlements: STARTER, currentPeriodEnd: null }),
      ).toEqual(FREE_ENTITLEMENTS);
    }
  });

  it('yields free when a status exists but the plan does not (failure)', () => {
    expect(
      resolveEntitlements({ status: 'active', planEntitlements: null, currentPeriodEnd: null }),
    ).toEqual(FREE_ENTITLEMENTS);
  });
});

describe('checkPullEligibility', () => {
  const base = {
    entitlements: STARTER,
    bureau: 'creditsafe' as const,
    pullsUsedThisMonth: 0,
    emailVerified: true,
    kybVerified: true,
  };

  it('allows an entitled, verified pull (happy path)', () => {
    const result = checkPullEligibility(base);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('blocks a free account with an upsell reason (security)', () => {
    const result = checkPullEligibility({ ...base, entitlements: FREE_ENTITLEMENTS });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('no_entitlement');
  });

  it('blocks a bureau the plan does not include (security)', () => {
    const result = checkPullEligibility({ ...base, bureau: 'equifax_business' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('bureau_not_allowed');
  });

  it('blocks once the monthly allowance is spent (security)', () => {
    const result = checkPullEligibility({ ...base, pullsUsedThisMonth: 2 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('allowance_exceeded');
    expect(result.remaining).toBe(0);
  });

  it('blocks an unverified email before anything else (edge)', () => {
    // Ordering matters: someone with an unverified email should be told to
    // verify it, not shown an upsell for a plan they already have.
    const result = checkPullEligibility({
      ...base,
      emailVerified: false,
      entitlements: FREE_ENTITLEMENTS,
    });
    expect(result.reason).toBe('email_unverified');
  });

  it('blocks while KYB is unverified (edge)', () => {
    const result = checkPullEligibility({ ...base, kybVerified: false });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('kyb_not_verified');
  });

  it('never reports negative remaining allowance', () => {
    expect(checkPullEligibility({ ...base, pullsUsedThisMonth: 99 }).remaining).toBe(0);
  });
});

describe('marketplace gating', () => {
  it('unlocks at or below the plan access level', () => {
    expect(canAccessMarketplaceItem(STARTER, 0)).toBe(true);
    expect(canAccessMarketplaceItem(STARTER, 1)).toBe(true);
    expect(canAccessMarketplaceItem(STARTER, 2)).toBe(false);
    expect(canAccessMarketplaceItem(FREE_ENTITLEMENTS, 1)).toBe(false);
  });
});

describe('allowance period', () => {
  it('keys by calendar month', () => {
    expect(allowancePeriod(new Date('2026-08-03T12:00:00Z'))).toBe('2026-08');
    expect(allowancePeriod(new Date('2026-08-31T23:59:59Z'))).toBe('2026-08');
    expect(allowancePeriod(new Date('2026-09-01T00:00:00Z'))).toBe('2026-09');
  });
});
