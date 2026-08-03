import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, CardBody, EmptyState, LinkButton } from '@machai/ui';
import { HELP_CATEGORIES, getFaqs, getHelpArticles, searchHelp } from '@/server/help';

export const metadata: Metadata = {
  title: 'Help center',
  description:
    'Guides and answers on getting started, billing, credit reporting, account access, and disputes.',
};

/**
 * Help center (spec §5.5).
 *
 * Search is a plain GET form so results are server-rendered, linkable, and
 * indexable — and it works with JavaScript disabled.
 */
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const query = q?.trim() ?? '';

  const [allArticles, allFaqs] = await Promise.all([getHelpArticles(), getFaqs()]);
  const results = query ? await searchHelp(query) : null;

  const articles = results
    ? results.articles
    : category
      ? allArticles.filter((a) => a.category === category)
      : allArticles;
  const faqList = results
    ? results.faqs
    : category
      ? allFaqs.filter((f) => f.category === category)
      : allFaqs;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          How can we help?
        </h1>
        <form method="get" role="search" className="mx-auto mt-8 flex max-w-xl gap-2">
          <label htmlFor="q" className="sr-only">
            Search the help center
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search articles and FAQs"
            className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-accent-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-800"
          >
            Search
          </button>
        </form>
      </div>

      {query ? (
        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
          {results?.total === 0
            ? `No results for “${query}”.`
            : `${results?.total} result${results?.total === 1 ? '' : 's'} for “${query}”.`}
        </p>
      ) : (
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HELP_CATEGORIES.map((cat) => (
            <Link key={cat.key} href={`/help?category=${cat.key}`} className="group">
              <Card className="h-full transition-colors group-hover:border-accent-400">
                <CardBody className="p-5">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-50">{cat.label}</p>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{cat.blurb}</p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {results?.total === 0 ? (
        <Card className="mt-10">
          <EmptyState
            title="Nothing matched that search"
            description="Try a different word, browse the categories above, or send us a message — a person will pick it up."
            action={<LinkButton href="/contact">Contact support</LinkButton>}
          />
        </Card>
      ) : null}

      {articles.length > 0 ? (
        <section className="mt-14">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {query ? 'Matching articles' : 'Articles'}
          </h2>
          <div className="mt-4 space-y-3">
            {articles.map((article) => (
              <Link key={article.slug} href={`/help/${article.slug}`} className="block">
                <Card className="transition-colors hover:border-accent-400">
                  <CardBody className="p-5">
                    <p className="font-medium text-neutral-900 dark:text-neutral-50">
                      {article.title}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      {article.excerpt}
                    </p>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {faqList.length > 0 ? (
        <section className="mt-14">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {query ? 'Matching questions' : 'Frequently asked questions'}
          </h2>
          <dl className="mt-4 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            {faqList.map((faq) => (
              <div key={faq.question} className="px-5 py-4">
                <dt className="font-medium text-neutral-900 dark:text-neutral-100">
                  {faq.question}
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <Card className="mt-14">
        <CardBody className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-semibold text-neutral-900 dark:text-neutral-50">Still need help?</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Send us a message and we will open a ticket for you.
            </p>
          </div>
          <LinkButton href="/contact">Contact support</LinkButton>
        </CardBody>
      </Card>
    </div>
  );
}
