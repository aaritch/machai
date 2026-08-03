import 'server-only';
import { cache } from 'react';
import {
  and,
  businesses,
  count,
  creditReports,
  desc,
  eq,
  getDb,
  inArray,
  isDatabaseConfigured,
  isNull,
  plans,
  pullAllowanceUsage,
  subscriptions,
  tradelines,
} from '@machai/db';
import { allowancePeriod, isInGracePeriod, resolveEntitlements } from '@machai/entitlements';
import { maskEin } from '@machai/types';
import type {
  BusinessSummary,
  Entitlements,
  OnboardingStep,
  SessionUser,
  SubscriptionSummary,
} from '@machai/types';
import { getOptionalSession } from './auth/session';

/**
 * The per-request account context.
 *
 * Assembled once and memoised with React's `cache`, so a dashboard page whose
 * layout, sidebar, and body all need the subscription state issues one set of
 * queries rather than three.
 *
 * Entitlements are resolved HERE, from mirrored subscription data, and passed
 * down. No component re-derives them, and nothing in the request path calls
 * Stripe (TASK-04 security scenario).
 */

export interface AccountContext {
  user: SessionUser;
  business: BusinessSummary | null;
  businessId: string | null;
  subscription: SubscriptionSummary;
  entitlements: Entitlements;
  /** Billing needs attention but access continues (spec §10.7). */
  inGracePeriod: boolean;
  pullsUsedThisMonth: number;
  onboarding: { steps: OnboardingStep[]; completed: number; total: number };
}

export const getAccountContext = cache(async (): Promise<AccountContext | null> => {
  const user = await getOptionalSession();
  if (!user || !isDatabaseConfigured()) return null;

  const db = getDb();

  // v1 shows one business per user (decision D4); the schema and this query
  // both allow more, so lifting the restriction is a UI change.
  const [business] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.ownerUserId, user.id), isNull(businesses.deletedAt)))
    .orderBy(desc(businesses.createdAt))
    .limit(1);

  const [subRow] = await db
    .select({
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      cardBrand: subscriptions.cardBrand,
      cardLast4: subscriptions.defaultPaymentMethodLast4,
      planCode: plans.code,
      planName: plans.name,
      planPrice: plans.monthlyPriceCents,
      planEntitlements: plans.entitlements,
    })
    .from(subscriptions)
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.userId, user.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  const entitlements = resolveEntitlements(
    subRow
      ? {
          status: subRow.status,
          planEntitlements: subRow.planEntitlements ?? null,
          currentPeriodEnd: subRow.currentPeriodEnd,
        }
      : null,
  );

  const [usage] = await db
    .select({ pullsUsed: pullAllowanceUsage.pullsUsed })
    .from(pullAllowanceUsage)
    .where(
      and(
        eq(pullAllowanceUsage.userId, user.id),
        eq(pullAllowanceUsage.period, allowancePeriod()),
      ),
    )
    .limit(1);

  const businessSummary: BusinessSummary | null = business
    ? {
        id: business.id,
        legalName: business.legalName,
        dbaName: business.dbaName,
        verificationStatus: business.verificationStatus,
        // Masked from the stored last-four. The ciphertext is never decrypted
        // just to render a page header.
        einMasked: maskEin(`00000${business.einLast4}`),
        city: business.city,
        state: business.state,
      }
    : null;

  const hasConnectedBureau = business
    ? await hasAnyReport(business.id)
    : false;

  const steps = deriveOnboardingSteps({
    emailVerified: Boolean(user.emailVerifiedAt),
    hasBusiness: Boolean(business),
    hasPlan: entitlements.reportsPerMonth > 0,
    hasConnectedBureau,
    profileComplete: Boolean(business?.website) || business?.verificationStatus === 'verified',
  });

  return {
    user,
    business: businessSummary,
    businessId: business?.id ?? null,
    subscription: {
      status: subRow?.status ?? null,
      planCode: (subRow?.planCode as SubscriptionSummary['planCode']) ?? null,
      planName: subRow?.planName ?? null,
      monthlyPriceCents: subRow?.planPrice ?? 0,
      currentPeriodEnd: subRow?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subRow?.cancelAtPeriodEnd ?? false,
      cardBrand: subRow?.cardBrand ?? null,
      cardLast4: subRow?.cardLast4 ?? null,
    },
    entitlements,
    inGracePeriod: isInGracePeriod(subRow?.status ?? null),
    pullsUsedThisMonth: usage?.pullsUsed ?? 0,
    onboarding: {
      steps,
      completed: steps.filter((s) => s.complete).length,
      total: steps.length,
    },
  };
});

async function hasAnyReport(businessId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(creditReports)
    .where(
      and(
        eq(creditReports.businessId, businessId),
        inArray(creditReports.status, ['available', 'no_file']),
      ),
    );
  return (row?.value ?? 0) > 0;
}

/**
 * Onboarding steps are DERIVED from real state, never stored as toggles
 * (TASK-07 caveat).
 *
 * A stored flag drifts: "plan chosen" stays green after a cancellation, and the
 * widget quietly starts lying. Computing each step from its source means the
 * display cannot disagree with reality.
 */
export function deriveOnboardingSteps(state: {
  emailVerified: boolean;
  hasBusiness: boolean;
  hasPlan: boolean;
  hasConnectedBureau: boolean;
  profileComplete: boolean;
}): OnboardingStep[] {
  return [
    {
      key: 'verify_email',
      title: 'Verify your email',
      description: 'Confirm your address to unlock subscribing and report pulls.',
      complete: state.emailVerified,
      href: '/dashboard/settings',
    },
    {
      key: 'business_info',
      title: 'Add your business information',
      description: 'Your EIN, entity type, and address form the basis of your file.',
      complete: state.hasBusiness,
      href: '/dashboard/company',
    },
    {
      key: 'choose_plan',
      title: 'Choose a plan',
      description: 'A plan unlocks live bureau reports and monitoring.',
      complete: state.hasPlan,
      href: '/dashboard/billing',
    },
    {
      key: 'connect_bureau',
      title: 'Connect a bureau',
      description: 'Pull your first report to see where your file stands.',
      complete: state.hasConnectedBureau,
      href: '/dashboard/score',
    },
    {
      key: 'complete_profile',
      title: 'Complete your profile',
      description: 'Verified details help bureaus match your business correctly.',
      complete: state.profileComplete,
      href: '/dashboard/company',
    },
  ];
}

/** Counts tracked tradelines, for the dashboard summary. */
export async function countTradelines(businessId: string): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(tradelines)
    .where(and(eq(tradelines.businessId, businessId), isNull(tradelines.deletedAt)));
  return row?.value ?? 0;
}
