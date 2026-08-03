import type { Entitlements, PlanCode, PlanSummary } from '@machai/types';

/**
 * Plan catalog — decision D1.
 *
 * STATE.md §7 left final names, prices, and feature splits open; this mirrors
 * the $19/$49/$99 model from the spec (§9.1) so the product is buildable, and
 * is the single place to change them when the real numbers land.
 *
 * This catalog is the SEED for the `plans` table. At runtime the pricing page
 * and all gating read the table, not this file (spec §4.4) — so marketing never
 * depends on a live Stripe call, and prices can change without a deploy.
 * The catalog remains the fallback when the database is not yet provisioned.
 */

export interface PlanCatalogEntry
  extends Omit<PlanSummary, 'id' | 'stripePriceId' | 'entitlements'> {
  entitlements: Entitlements;
  /** Which env var carries this plan's Stripe Price id. */
  stripePriceEnvKey: string;
}

export const PLAN_CATALOG: Record<PlanCode, PlanCatalogEntry> = {
  starter: {
    code: 'starter',
    name: 'Starter',
    tagline: 'Unlock your live credit file.',
    description: 'See your report, your score, and what to fix.',
    monthlyPriceCents: 1900,
    currency: 'usd',
    features: [
      'Live business credit report from Creditsafe or Equifax Business (your choice)',
      'Your real business credit score, updated monthly',
      'Score monitoring and alerts when something changes',
      'Credit-building tips and resources',
      'Standard email support',
    ],
    entitlements: {
      bureausAllowed: ['creditsafe'],
      reportsPerMonth: 2,
      monitoring: true,
      alerts: true,
      detailedAnalysis: false,
      advancedAnalytics: false,
      supportTier: 'standard',
      reportingTracker: false,
      marketplaceAccessLevel: 1,
    },
    isContactSales: false,
    displayOrder: 1,
    isActive: true,
    stripePriceEnvKey: 'STRIPE_PRICE_STARTER',
  },
  professional: {
    code: 'professional',
    name: 'Professional',
    tagline: 'Ideal for growing businesses seeking funding.',
    description: 'Both bureaus, deeper analysis, and faster support.',
    monthlyPriceCents: 4900,
    currency: 'usd',
    features: [
      'Live reports from both bureaus (Creditsafe and Equifax Business)',
      'Detailed credit analysis reports',
      'Monthly credit-score monitoring',
      'Tradeline tracker and credit checklist',
      'Priority phone and chat support',
    ],
    entitlements: {
      bureausAllowed: ['creditsafe', 'equifax_business'],
      reportsPerMonth: 6,
      monitoring: true,
      alerts: true,
      detailedAnalysis: true,
      advancedAnalytics: false,
      supportTier: 'priority',
      reportingTracker: false,
      marketplaceAccessLevel: 2,
    },
    isContactSales: false,
    displayOrder: 2,
    isActive: true,
    stripePriceEnvKey: 'STRIPE_PRICE_PROFESSIONAL',
  },
  enterprise: {
    code: 'enterprise',
    name: 'Enterprise',
    tagline: 'Comprehensive solution for established businesses.',
    description: 'Every bureau we add, advanced analytics, and a named contact.',
    monthlyPriceCents: 9900,
    currency: 'usd',
    features: [
      'Coverage of Creditsafe and Equifax Business, plus each new bureau we add',
      'Monthly reporting tracker',
      'Advanced analytics dashboard',
      'Dedicated account manager',
      'Monthly credit-score monitoring',
      'Credit-building tips and resources',
    ],
    entitlements: {
      bureausAllowed: ['creditsafe', 'equifax_business', 'dnb'],
      reportsPerMonth: 20,
      monitoring: true,
      alerts: true,
      detailedAnalysis: true,
      advancedAnalytics: true,
      supportTier: 'dedicated',
      reportingTracker: true,
      marketplaceAccessLevel: 3,
    },
    /** Sales-assisted: no self-serve Checkout (spec §9.2, §10.5). */
    isContactSales: true,
    displayOrder: 3,
    isActive: true,
    stripePriceEnvKey: 'STRIPE_PRICE_ENTERPRISE',
  },
};

export const PLAN_LIST: PlanCatalogEntry[] = Object.values(PLAN_CATALOG).sort(
  (a, b) => a.displayOrder - b.displayOrder,
);

export function formatPrice(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Verbatim from the reference billing panel (spec §7.5). */
export const PRORATION_NOTE =
  'Upgrades apply immediately with prorated charges. Downgrades take effect next cycle.';

/**
 * Feature-comparison matrix for the pricing table. Derived from entitlements so
 * the table can never claim something the gating layer will not honor.
 */
export const COMPARISON_ROWS: Array<{
  label: string;
  value: (e: Entitlements) => string;
}> = [
  {
    label: 'Bureaus available',
    value: (e) => (e.bureausAllowed.length === 1 ? 'Choose 1' : String(e.bureausAllowed.length)),
  },
  { label: 'Live report pulls per month', value: (e) => String(e.reportsPerMonth) },
  { label: 'Score monitoring', value: (e) => (e.monitoring ? 'Included' : '—') },
  { label: 'Change alerts', value: (e) => (e.alerts ? 'Included' : '—') },
  { label: 'Detailed credit analysis', value: (e) => (e.detailedAnalysis ? 'Included' : '—') },
  { label: 'Advanced analytics', value: (e) => (e.advancedAnalytics ? 'Included' : '—') },
  { label: 'Monthly reporting tracker', value: (e) => (e.reportingTracker ? 'Included' : '—') },
  {
    label: 'Support',
    value: (e) =>
      ({ standard: 'Email', priority: 'Priority phone & chat', dedicated: 'Dedicated manager' })[
        e.supportTier
      ],
  },
];
