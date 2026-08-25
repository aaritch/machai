import type { Metadata } from 'next';
import { brand, disclosures } from '@machai/config/public';
import { Card, CardBody, LinkButton } from '@machai/ui';

export const metadata: Metadata = {
  title: 'About',
  description: `Why ${brand.name} exists, what we do, and what we deliberately do not do.`,
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        About {brand.name}
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
        Most small businesses borrow against their owner’s personal credit because nobody ever
        showed them the alternative. We think that is backwards, and fixable.
      </p>

      <section id="story" className="mt-12 space-y-4 text-neutral-700 dark:text-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Our story</h2>
        <p className="leading-relaxed">
          A business credit file is not hard to build. It is just undocumented. The steps are
          specific and ordered — get an EIN, separate the finances, get listed, open trade accounts
          that actually report — and almost nobody explains which of them matter or in what
          sequence.
        </p>
        <p className="leading-relaxed">
          So owners guess, or they pay someone who promises a number. We built the opposite: show
          people their real file, chart what it does over time, and give them a checklist with the
          actual steps on it.
        </p>
      </section>

      <section className="mt-12 space-y-4 text-neutral-700 dark:text-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          What we will not do
        </h2>
        <p className="leading-relaxed">
          This industry has a credibility problem, and most of it comes from three practices. We do
          none of them:
        </p>
        <ul className="list-disc space-y-2.5 pl-5">
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              We do not promise a score.
            </strong>{' '}
            Your file reflects your business’s actual payment behaviour. Anyone guaranteeing a
            number is either guessing or selling something worse.
          </li>
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              We do not sell tradelines.
            </strong>{' '}
            Manufacturing a credit line for a fee is the practice the bureaus specifically reject
            furnishers for. A tradeline that exists because you paid a subscription is not credit
            history.
          </li>
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              We do not claim reporting we have not earned.
            </strong>{' '}
            Reporting your activity to a bureau requires that bureau to approve us as a data
            furnisher — an application and credentialing process that takes months. We name a bureau
            only once that is done. Everything else is described as roadmap.
          </li>
        </ul>
      </section>

      <section className="mt-12 space-y-4 text-neutral-700 dark:text-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          How we handle your data
        </h2>
        <p className="leading-relaxed">
          We ask for your EIN and not your Social Security number. Your EIN is encrypted with a key
          unique to your record, never written to logs, and shown only to you. Every access to it is
          recorded. Report PDFs are private and reachable only through short-lived links.
        </p>
      </section>

      <Card className="mt-14">
        <CardBody className="p-7">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
            Start with a free account
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {disclosures.freeToStart}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <LinkButton href="/signup">Create your account</LinkButton>
            <LinkButton href="/contact" variant="secondary">
              Talk to us
            </LinkButton>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
