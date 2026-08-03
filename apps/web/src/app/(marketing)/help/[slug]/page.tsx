import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardBody, LinkButton } from '@machai/ui';
import { Markdown } from '@/components/markdown';
import { getHelpArticle, getHelpArticles } from '@/server/help';

/** Pre-renders the known articles; new ones are rendered on demand. */
export async function generateStaticParams() {
  const articles = await getHelpArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getHelpArticle(slug);
  if (!article) return { title: 'Article not found' };
  return { title: article.title, description: article.excerpt };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getHelpArticle(slug);
  if (!article) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link
        href="/help"
        className="text-sm font-medium text-accent-700 hover:underline dark:text-accent-300"
      >
        ← Help center
      </Link>

      <article className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {article.title}
        </h1>
        <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-300">{article.excerpt}</p>
        <div className="mt-8">
          <Markdown source={article.bodyMarkdown} />
        </div>
      </article>

      <Card className="mt-14">
        <CardBody className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-semibold text-neutral-900 dark:text-neutral-50">
              Did this answer your question?
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              If not, open a ticket and a person will help.
            </p>
          </div>
          <LinkButton href="/contact" variant="secondary">
            Contact support
          </LinkButton>
        </CardBody>
      </Card>
    </div>
  );
}
