import type { Entitlements, PlanCode, PlanSummary } from '@machai/types';

/**
 * Plan catalog — decision D1.
 *
 * STATE.md §7 left final names, prices, and feature splits open; this mirrors
 * the tier structure from the spec (§9.1) so the product is buildable, and
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
    // `code` is the stable internal identifier — the DB unique key, the URL
    // param, and the STRIPE_PRICE_* env suffix. Display names change with
    // marketing; codes deliberately do not.
    code: 'starter',
    name: 'Foundation',
    tagline: 'A $2,500 trade account, reported every month.',
    description: 'Your payment activity, reported where it counts.',
    monthlyPriceCents: 2500,
    currency: 'usd',
    features: [
      'A $2,500 net-30 trade account in your business name',
      'Your payment activity reported to Creditsafe every month',
      'Business identity verified before your first submission',
      'Credit-building tips and resources',
      'Email support',
    ],
    entitlements: {
      bureausReportedTo: ['creditsafe'],
      // Reading a customer's file is not part of any plan.
      bureausAllowed: [],
      reportsPerMonth: 0,
      monitoring: false,
      alerts: false,
      detailedAnalysis: false,
      advancedAnalytics: false,
      supportTier: 'standard',
      marketplaceAccessLevel: 1,
    },
    isContactSales: false,
    displayOrder: 1,
    isActive: true,
    stripePriceEnvKey: 'STRIPE_PRICE_STARTER',
  },
  professional: {
    code: 'professional',
    name: 'Growth',
    tagline: 'A $4,000 trade account, reported to all three bureaus.',
    description: 'Reported to every bureau we are approved to furnish.',
    monthlyPriceCents: 4500,
    currency: 'usd',
    features: [
      'A $4,000 net-30 trade account in your business name',
      'Your payment activity reported to all three bureaus — Creditsafe, Equifax Business, and Dun & Bradstreet',
      'Business identity verified before your first submission',
      'Credit-building tips and resources',
      'Priority phone and chat support',
    ],
    entitlements: {
      bureausReportedTo: ['creditsafe', 'equifax_business', 'dnb'],
      bureausAllowed: [],
      reportsPerMonth: 0,
      monitoring: false,
      alerts: false,
      detailedAnalysis: false,
      advancedAnalytics: false,
      supportTier: 'priority',
      marketplaceAccessLevel: 2,
    },
    isContactSales: false,
    displayOrder: 2,
    isActive: true,
    stripePriceEnvKey: 'STRIPE_PRICE_PROFESSIONAL',
  },
  enterprise: {
    code: 'enterprise',
    name: 'Premier',
    tagline: 'Reported to all four bureaus, with a named contact.',
    description: 'Full coverage, full visibility, and a named contact.',
    monthlyPriceCents: 9900,
    currency: 'usd',
    features: [
      'Your payment activity reported to all four bureaus — Creditsafe, Equifax Business, Dun & Bradstreet, and Experian Business',
      'Advanced reporting analytics',
      'Dedicated account manager',
      'Credit-building tips and resources',
    ],
    entitlements: {
      bureausReportedTo: ['creditsafe', 'equifax_business', 'dnb', 'experian_business'],
      bureausAllowed: [],
      reportsPerMonth: 0,
      monitoring: false,
      alerts: false,
      detailedAnalysis: false,
      advancedAnalytics: true,
      supportTier: 'dedicated',
      marketplaceAccessLevel: 3,
    },
    /**
     * Self-serve, like the other two. This tier was sales-assisted per spec
     * §9.2; making the CTA "Get started" means it now goes through Checkout,
     * so it needs STRIPE_PRICE_ENTERPRISE set like any other plan.
     */
    isContactSales: false,
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
    label: 'Bureaus we report to',
    value: (e) => (e.bureausReportedTo.length === 0 ? '—' : String(e.bureausReportedTo.length)),
  },
  { label: 'Monthly reporting cycle', value: (e) => (e.bureausReportedTo.length > 0 ? 'Included' : '—') },
  { label: 'Advanced reporting analytics', value: (e) => (e.advancedAnalytics ? 'Included' : '—') },
  {
    label: 'Support',
    value: (e) =>
      ({ standard: 'Email', priority: 'Priority phone & chat', dedicated: 'Dedicated manager' })[
        e.supportTier
      ],
  },
];
