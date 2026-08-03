import { sql } from 'drizzle-orm';
import { PLAN_LIST, getConfig } from '@machai/config';
import { getDb } from '../client';
import {
  achievements,
  checklistItems,
  faqs,
  helpArticles,
  marketplaceItems,
  plans,
  products,
} from '../schema/index';
import {
  ACHIEVEMENTS,
  CHECKLIST_ITEMS,
  FAQS,
  HELP_ARTICLES,
  MARKETPLACE_ITEMS,
  PRODUCTS,
} from './data';

/**
 * Idempotent seed.
 *
 * Every insert is an upsert keyed on the natural key, so running this against
 * an existing environment refreshes content without duplicating rows or
 * clobbering ids that other tables reference.
 */
export async function seed(): Promise<{ table: string; rows: number }[]> {
  const db = getDb();
  const config = getConfig();
  const results: { table: string; rows: number }[] = [];

  // Plans mirror the catalog (decision D1). Stripe Price ids come from the
  // environment so the same seed works across dev/staging/prod with different
  // Stripe accounts.
  const planRows = PLAN_LIST.map((plan) => ({
    code: plan.code,
    name: plan.name,
    tagline: plan.tagline,
    description: plan.description,
    monthlyPriceCents: plan.monthlyPriceCents,
    currency: plan.currency,
    stripePriceId:
      (config[plan.stripePriceEnvKey as keyof typeof config] as string | undefined) ?? null,
    features: [...plan.features],
    entitlements: plan.entitlements,
    isContactSales: plan.isContactSales,
    displayOrder: plan.displayOrder,
    isActive: plan.isActive,
  }));

  await db
    .insert(plans)
    .values(planRows)
    .onConflictDoUpdate({
      target: plans.code,
      set: {
        name: sqlExcluded('name'),
        tagline: sqlExcluded('tagline'),
        description: sqlExcluded('description'),
        monthlyPriceCents: sqlExcluded('monthly_price_cents'),
        features: sqlExcluded('features'),
        entitlements: sqlExcluded('entitlements'),
        isContactSales: sqlExcluded('is_contact_sales'),
        displayOrder: sqlExcluded('display_order'),
        isActive: sqlExcluded('is_active'),
        updatedAt: new Date(),
      },
    });
  results.push({ table: 'plans', rows: planRows.length });

  await db
    .insert(checklistItems)
    .values(CHECKLIST_ITEMS.map((i) => ({ ...i })))
    .onConflictDoUpdate({
      target: checklistItems.key,
      set: {
        title: sqlExcluded('title'),
        description: sqlExcluded('description'),
        category: sqlExcluded('category'),
        points: sqlExcluded('points'),
        displayOrder: sqlExcluded('display_order'),
        updatedAt: new Date(),
      },
    });
  results.push({ table: 'checklist_items', rows: CHECKLIST_ITEMS.length });

  await db
    .insert(achievements)
    .values(ACHIEVEMENTS)
    .onConflictDoUpdate({
      target: achievements.key,
      set: {
        title: sqlExcluded('title'),
        description: sqlExcluded('description'),
        icon: sqlExcluded('icon'),
        criteria: sqlExcluded('criteria'),
        displayOrder: sqlExcluded('display_order'),
        updatedAt: new Date(),
      },
    });
  results.push({ table: 'achievements', rows: ACHIEVEMENTS.length });

  // FAQs have no natural unique key, so replace wholesale. They are pure
  // content with nothing referencing them.
  await db.delete(faqs);
  await db.insert(faqs).values(FAQS.map((f) => ({ ...f })));
  results.push({ table: 'faqs', rows: FAQS.length });

  await db
    .insert(helpArticles)
    .values(HELP_ARTICLES.map((a) => ({ ...a })))
    .onConflictDoUpdate({
      target: helpArticles.slug,
      set: {
        title: sqlExcluded('title'),
        excerpt: sqlExcluded('excerpt'),
        bodyMarkdown: sqlExcluded('body_markdown'),
        category: sqlExcluded('category'),
        displayOrder: sqlExcluded('display_order'),
        updatedAt: new Date(),
      },
    });
  results.push({ table: 'help_articles', rows: HELP_ARTICLES.length });

  await db
    .insert(marketplaceItems)
    .values(MARKETPLACE_ITEMS.map((m) => ({ ...m })))
    .onConflictDoUpdate({
      target: marketplaceItems.slug,
      set: {
        title: sqlExcluded('title'),
        description: sqlExcluded('description'),
        accessLevel: sqlExcluded('access_level'),
        displayOrder: sqlExcluded('display_order'),
        updatedAt: new Date(),
      },
    });
  results.push({ table: 'marketplace_items', rows: MARKETPLACE_ITEMS.length });

  await db
    .insert(products)
    .values(PRODUCTS.map((p) => ({ ...p })))
    .onConflictDoUpdate({
      target: products.slug,
      set: {
        title: sqlExcluded('title'),
        description: sqlExcluded('description'),
        priceCents: sqlExcluded('price_cents'),
        displayOrder: sqlExcluded('display_order'),
        updatedAt: new Date(),
      },
    });
  results.push({ table: 'products', rows: PRODUCTS.length });

  return results;
}

/**
 * `excluded.<column>` — the row Postgres would have inserted, had there been no
 * conflict. Column names here are literals from this file, never input-derived.
 */
function sqlExcluded(column: string) {
  return sql.raw(`excluded."${column}"`);
}
