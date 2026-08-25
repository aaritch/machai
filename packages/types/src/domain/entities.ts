import type {
  Bureau,
  PlanCode,
  SubscriptionStatus,
  SupportTier,
  UserRole,
  VerificationStatus,
} from './enums';

/**
 * Domain shapes that cross module boundaries.
 *
 * Row types are inferred from the Drizzle schema in @machai/db — they are not
 * duplicated here. What lives in this file is the vocabulary that the web app,
 * the worker, and the entitlement layer all have to agree on.
 */

/**
 * Machine-readable capability set (spec §9.3).
 *
 * EntitlementService is the ONLY place these are decided. Both web and worker
 * ask it rather than re-deriving the rules, so gating can never disagree
 * between tiers.
 */
export interface Entitlements {
  /**
   * Bureaus this plan's payment activity is FURNISHED to — the product we
   * actually sell. Independent of `bureausAllowed`, which governs reading.
   */
  bureausReportedTo: Bureau[];
  /**
   * Which bureaus this plan may PULL from. Empty on every current plan:
   * reading a customer's file is not something we offer.
   */
  bureausAllowed: Bureau[];
  /** Live pull allowance per calendar month. 0 on every current plan. */
  reportsPerMonth: number;
  monitoring: boolean;
  alerts: boolean;
  detailedAnalysis: boolean;
  advancedAnalytics: boolean;
  supportTier: SupportTier;
  /** Enterprise-only monthly reporting tracker (Direction B surface). */
  reportingTracker: boolean;
  /** Highest marketplace access level unlocked. 0 = free content only. */
  marketplaceAccessLevel: number;
}

/** The empty set a free or lapsed account resolves to. */
export const FREE_ENTITLEMENTS: Entitlements = {
  bureausReportedTo: [],
  bureausAllowed: [],
  reportsPerMonth: 0,
  monitoring: false,
  alerts: false,
  detailedAnalysis: false,
  advancedAnalytics: false,
  supportTier: 'standard',
  reportingTracker: false,
  marketplaceAccessLevel: 0,
};

/** Plan as rendered on pricing cards and in the billing panel. */
export interface PlanSummary {
  id: string;
  code: PlanCode;
  name: string;
  tagline: string;
  description: string;
  monthlyPriceCents: number;
  currency: string;
  features: string[];
  entitlements: Entitlements;
  /** Enterprise is sales-assisted — no self-serve checkout (spec §9.2). */
  isContactSales: boolean;
  displayOrder: number;
  isActive: boolean;
  stripePriceId: string | null;
}

/** The session-scoped view of the caller, assembled once per request. */
export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
  mfaEnabled: boolean;
  firstName: string | null;
}

export interface BusinessSummary {
  id: string;
  legalName: string;
  dbaName: string | null;
  verificationStatus: VerificationStatus;
  /** Masked for display. The full value is decrypt-on-read and audited. */
  einMasked: string;
  city: string;
  state: string;
}

export interface SubscriptionSummary {
  status: SubscriptionStatus | null;
  planCode: PlanCode | null;
  planName: string | null;
  monthlyPriceCents: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
}

/**
 * A subscription is "entitling" only in these states. `past_due` deliberately
 * keeps access during the grace window; Stripe's dunning drives the outcome
 * (spec §10.7).
 */
export const ENTITLING_STATUSES: SubscriptionStatus[] = ['active', 'trialing', 'past_due'];

export interface OnboardingStep {
  key: 'verify_email' | 'business_info' | 'choose_plan' | 'connect_bureau' | 'complete_profile';
  title: string;
  description: string;
  /** Always DERIVED from real state, never a stored toggle (TASK-07 caveat). */
  complete: boolean;
  href: string;
}
