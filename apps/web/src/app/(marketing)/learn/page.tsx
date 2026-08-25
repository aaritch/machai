import type { Metadata } from 'next';
import { getBureauCapabilities } from '@machai/config';
import { disclosures } from '@machai/config/public';
import { Card, CardBody, LinkButton } from '@machai/ui';

export const metadata: Metadata = {
  title: 'What is business credit?',
  description:
    'How business credit works, how it differs from personal credit, which bureaus matter, and why an EIN-based file is worth building.',
};

/**
 * Educational pillar page (spec §5.6).
 *
 * An SEO asset, so the substance is server-rendered rather than assembled on
 * the client, and it is deliberately long-form.
 *
 * Dynamic for the same reason as the home page: it renders per-bureau
 * reporting claims, and those must reflect the current flags rather than
 * whatever was true at build time.
 */
export const dynamic = 'force-dynamic';
export default function LearnPage() {
  const bureaus = getBureauCapabilities();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        What is business credit?
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
        Business credit is a record of how reliably your company pays the people who extend it
        credit. It is kept against your business, not against you — and it is built, tracked, and
        scored entirely separately from your personal file.
      </p>

      <section className="mt-12 space-y-4 text-neutral-700 dark:text-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          How it differs from personal credit
        </h2>
        <p className="leading-relaxed">
          Personal credit is governed by consumer-protection law, keyed to your Social Security
          number, and largely standardised. Business credit is none of those things. The files are
          keyed to your business identity, the scales differ per bureau, and — unlike consumer
          reports — many commercial files are available for anyone to purchase. A supplier deciding
          whether to offer you terms can simply look you up.
        </p>
        <p className="leading-relaxed">
          The practical consequence: your business file is a sales asset as much as a borrowing one.
          It is what a prospective supplier sees before deciding whether to trust you with 30 days.
        </p>
      </section>

      <section className="mt-12 space-y-4 text-neutral-700 dark:text-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          The commercial bureaus
        </h2>
        <p className="leading-relaxed">
          Several bureaus maintain commercial files, and they do not share data. A strong file at one
          says nothing about the others, which is why coverage across more than one matters.
        </p>
        <div className="mt-5 space-y-3">
          {bureaus.map((bureau) => (
            <Card key={bureau.bureau}>
              <CardBody className="p-5">
                <p className="font-semibold text-neutral-900 dark:text-neutral-50">{bureau.label}</p>
                {/* Gated on furnisher approval, like every other reporting claim. */}
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Scored on a {bureau.scoreScale} scale.{' '}
                  {bureau.reportingLive
                    ? 'We report your account activity here.'
                    : 'Not yet part of our coverage.'}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12 space-y-4 text-neutral-700 dark:text-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Why EIN-based credit matters
        </h2>
        <p className="leading-relaxed">
          Borrowing on a personal guarantee ties the company’s obligations to the owner’s household.
          A business default becomes a personal default; a business expansion consumes personal
          borrowing capacity. Building the company’s own file separates the two.
        </p>
        <p className="leading-relaxed">
          It also outlives you in the business. A company with its own credit history is worth more
          when sold, because the buyer inherits the file rather than starting over.
        </p>
      </section>

      <section className="mt-12 space-y-4 text-neutral-700 dark:text-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          What actually builds a file
        </h2>
        <ol className="list-decimal space-y-2.5 pl-5">
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              A real, registered entity with an EIN.
            </strong>{' '}
            Without a separate legal identity there is nothing to build a file against.
          </li>
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              Separated finances.
            </strong>{' '}
            A dedicated business bank account. Commingled money undermines everything after it.
          </li>
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              Trade accounts that report.
            </strong>{' '}
            Not every supplier reports to a bureau. Ask before you open the account — an account that
            does not report does nothing for your file.
          </li>
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              Early payment, consistently.
            </strong>{' '}
            Commercial scoring weights timing heavily, and paying before the due date scores better
            than paying on it.
          </li>
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">Time.</strong>{' '}
            Files thicken as accounts accumulate history. There is no way to shortcut this, and
            attempts to buy the appearance of history are exactly what bureaus screen for.
          </li>
        </ol>
      </section>

      <p className="mt-10 rounded-xl border border-neutral-200 bg-white p-5 text-sm leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {disclosures.noGuarantee}
      </p>

      <Card className="mt-10">
        <CardBody className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-semibold text-neutral-900 dark:text-neutral-50">
              See where your file stands today
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Create a free account and work the checklist. {disclosures.freeToStart}
            </p>
          </div>
          <LinkButton href="/signup">Get started</LinkButton>
        </CardBody>
      </Card>
    </div>
  );
}
