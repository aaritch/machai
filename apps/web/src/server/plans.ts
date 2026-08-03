import 'server-only';
import { cache } from 'react';
import { PLAN_LIST, getConfig } from '@machai/config';
import { asc, eq, plans, tryGetDb } from '@machai/db';
import { logger } from '@machai/observability';
import type { PlanCode, PlanSummary } from '@machai/types';

/**
 * Plan reads.
 *
 * Plans come from the `plans` table so marketing never depends on a live Stripe
 * call and prices can change without a deploy (spec §4.4, TASK-03).
 *
 * When the database is not yet provisioned, this falls back to the seed catalog
 * — the same data the seed script writes. That keeps the pricing page correct
 * on a first deploy, before anyone has run migrations, rather than showing an
 * error page to a prospect. Documented in docs/adr/0004-degraded-mode.md.
 */

export const getActivePlans = cache(async (): Promise<PlanSummary[]> => {
  const db = tryGetDb();
  if (!db) return catalogFallback();

  try {
    const rows = await db
      .select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(asc(plans.displayOrder));

    // An empty table means migrations ran but the seed did not. Falling back is
    // better than rendering a pricing page with no plans on it.
    if (rows.length === 0) return catalogFallback();

    return rows.map((row) => ({
      id: row.id,
      code: row.code as PlanCode,
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      monthlyPriceCents: row.monthlyPriceCents,
      currency: row.currency,
      features: row.features,
      entitlements: row.entitlements,
      isContactSales: row.isContactSales,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
      stripePriceId: row.stripePriceId,
    }));
  } catch (error) {
    logger.error('failed to read plans; falling back to catalog', { error });
    return catalogFallback();
  }
});

export async function getPlanByCode(code: PlanCode): Promise<PlanSummary | null> {
  const all = await getActivePlans();
  return all.find((p) => p.code === code) ?? null;
}

export async function getPlanById(id: string): Promise<PlanSummary | null> {
  const all = await getActivePlans();
  return all.find((p) => p.id === id) ?? null;
}

function catalogFallback(): PlanSummary[] {
  const config = getConfig();
  return PLAN_LIST.filter((p) => p.isActive).map((plan) => ({
    id: `catalog:${plan.code}`,
    code: plan.code,
    name: plan.name,
    tagline: plan.tagline,
    description: plan.description,
    monthlyPriceCents: plan.monthlyPriceCents,
    currency: plan.currency,
    features: [...plan.features],
    entitlements: plan.entitlements,
    isContactSales: plan.isContactSales,
    displayOrder: plan.displayOrder,
    isActive: plan.isActive,
    stripePriceId:
      (config[plan.stripePriceEnvKey as keyof typeof config] as string | undefined) ?? null,
  }));
}

/** True when a plan row came from the fallback rather than the database. */
export function isCatalogPlan(plan: PlanSummary): boolean {
  return plan.id.startsWith('catalog:');
}
