import 'server-only';
import { cache } from 'react';
import { and, asc, eq, faqs, helpArticles, tryGetDb } from '@machai/db';
import { FAQS as SEED_FAQS, HELP_ARTICLES as SEED_ARTICLES } from '@machai/db/seed-data';
import { logger } from '@machai/observability';

/**
 * Help-center content (spec §5.5).
 *
 * Content lives in the database so non-engineers can edit it through the admin
 * surface. As with plans, an unprovisioned database falls back to the seed
 * content rather than rendering an empty knowledge base.
 */

export interface HelpArticle {
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  category: string;
}

export interface Faq {
  question: string;
  answer: string;
  category: string;
}

export const HELP_CATEGORIES = [
  { key: 'getting-started', label: 'Getting started', blurb: 'Set up your account and your file.' },
  { key: 'billing', label: 'Billing', blurb: 'Plans, invoices, and payment methods.' },
  { key: 'credit-reporting', label: 'Credit reporting', blurb: 'Scores, reports, and bureaus.' },
  { key: 'account-access', label: 'Account access', blurb: 'Sign-in, security, and your data.' },
  { key: 'disputes', label: 'Disputes', blurb: 'Correcting inaccurate information.' },
] as const;

export const getHelpArticles = cache(async (): Promise<HelpArticle[]> => {
  const db = tryGetDb();
  if (!db) return seedArticles();
  try {
    const rows = await db
      .select()
      .from(helpArticles)
      .where(eq(helpArticles.isPublished, true))
      .orderBy(asc(helpArticles.displayOrder));
    return rows.length > 0 ? rows.map(toArticle) : seedArticles();
  } catch (error) {
    logger.error('failed to read help articles', { error });
    return seedArticles();
  }
});

export const getFaqs = cache(async (): Promise<Faq[]> => {
  const db = tryGetDb();
  if (!db) return seedFaqs();
  try {
    const rows = await db
      .select()
      .from(faqs)
      .where(eq(faqs.isPublished, true))
      .orderBy(asc(faqs.displayOrder));
    return rows.length > 0
      ? rows.map((r) => ({ question: r.question, answer: r.answer, category: r.category }))
      : seedFaqs();
  } catch (error) {
    logger.error('failed to read faqs', { error });
    return seedFaqs();
  }
});

export async function getHelpArticle(slug: string): Promise<HelpArticle | null> {
  const db = tryGetDb();
  if (db) {
    try {
      const [row] = await db
        .select()
        .from(helpArticles)
        .where(and(eq(helpArticles.slug, slug), eq(helpArticles.isPublished, true)))
        .limit(1);
      if (row) return toArticle(row);
    } catch (error) {
      logger.error('failed to read help article', { slug, error });
    }
  }
  return seedArticles().find((a) => a.slug === slug) ?? null;
}

export interface SearchResults {
  articles: HelpArticle[];
  faqs: Faq[];
  total: number;
}

/**
 * Search across articles and FAQs.
 *
 * Deliberately a simple scored substring match rather than Postgres full-text.
 * At this content volume the ranking difference is nil, and it works
 * identically against the seed fallback — so search never breaks just because
 * the database is not yet provisioned. Revisit if the knowledge base grows past
 * a few hundred articles.
 */
export async function searchHelp(query: string): Promise<SearchResults> {
  const [articles, faqList] = await Promise.all([getHelpArticles(), getFaqs()]);
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (terms.length === 0) return { articles: [], faqs: [], total: 0 };

  const scoredArticles = articles
    .map((article) => ({
      article,
      score: score(terms, [article.title, article.title, article.excerpt, article.bodyMarkdown]),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.article);

  const scoredFaqs = faqList
    .map((faq) => ({ faq, score: score(terms, [faq.question, faq.question, faq.answer]) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.faq);

  return {
    articles: scoredArticles,
    faqs: scoredFaqs,
    total: scoredArticles.length + scoredFaqs.length,
  };
}

/** Fields are passed twice where they should weigh double (e.g. titles). */
function score(terms: string[], fields: string[]): number {
  const haystacks = fields.map((f) => f.toLowerCase());
  let total = 0;
  for (const term of terms) {
    for (const hay of haystacks) {
      if (hay.includes(term)) total += 1;
    }
  }
  return total;
}

function toArticle(row: typeof helpArticles.$inferSelect): HelpArticle {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyMarkdown: row.bodyMarkdown,
    category: row.category,
  };
}

function seedArticles(): HelpArticle[] {
  return SEED_ARTICLES.map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    bodyMarkdown: a.bodyMarkdown,
    category: a.category,
  }));
}

function seedFaqs(): Faq[] {
  return SEED_FAQS.map((f) => ({ question: f.question, answer: f.answer, category: f.category }));
}
