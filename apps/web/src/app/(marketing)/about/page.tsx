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
        The typical small business borrows on the strength of its owner’s personal credit, for the
        simple reason that no one ever pointed out there was another way. We think that has it the
        wrong way round — and that it can be put right.
      </p>

      <section id="story" className="mt-12 space-y-4 text-neutral-700 dark:text-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Our story</h2>
        <p className="leading-relaxed">
          Building a business credit file is not difficult. It is simply unexplained. There is a
          definite sequence to it — register the entity and get an EIN, separate the money, become
          findable, then open trade accounts that genuinely report — and hardly anyone sets out
          which steps count, or the order they belong in.
        </p>
        <p className="leading-relaxed">
          So owners work it out by guesswork, or hand money to someone promising a number. We took
          the other route: extend real trade credit, report how it is paid every month, and hand
          over a checklist naming each remaining step.
        </p>
      </section>

      <section className="mt-12 space-y-4 text-neutral-700 dark:text-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          What we will not do
        </h2>
        <p className="leading-relaxed">
          This sector has an honesty problem, and three habits account for most of it. We keep clear
          of all three:
        </p>
        <ul className="list-disc space-y-2.5 pl-5">
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              We never promise a score.
            </strong>{' '}
            What appears on your file is a record of how your business actually pays. Anybody
            warranting a particular number is either speculating or selling you something worse.
          </li>
          <li className="leading-relaxed">
            {/* Reworked rather than reworded: the old bullet said "We do not sell
                tradelines", which now reads as a flat contradiction of the plans,
                each of which includes a trade account. The distinction that
                matters is real extended credit versus a fabricated line. */}
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              We never invent credit history.
            </strong>{' '}
            The trade account on your plan is genuine credit you draw on and repay — not a line
            conjured up to flatter your file. Bureaus refuse furnishers who report fabricated
            accounts, and they are right to. Payment behaviour that never happened is not history.
          </li>
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              We never claim reporting we have not earned.
            </strong>{' '}
            Sending your activity to a bureau means that bureau approving us as a data furnisher
            first — an application and vetting process measured in months. A bureau is named here
            only after that has happened. Anything short of it we describe as roadmap.
          </li>
        </ul>
      </section>

      <section className="mt-12 space-y-4 text-neutral-700 dark:text-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          How we handle your data
        </h2>
        {/* The old closing sentence promised private report PDFs. Those were part
            of the report-pulling feature and no longer exist, so it is gone
            rather than reworded. */}
        <p className="leading-relaxed">
          What we ask for is your EIN, not your Social Security number. That EIN is encrypted under
          a key belonging to your record alone, kept out of every log, and displayed to nobody but
          you. Each time it is read, that is written down.
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
