import Link from 'next/link';
import type { Metadata } from 'next';
import { getBureauCapabilities, getReportingClaim } from '@machai/config';
import { brand, disclosures } from '@machai/config/public';
import { formatPrice } from '@machai/config';
import { Badge, Card, CardBody, LinkButton } from '@machai/ui';
import { getActivePlans } from '@/server/plans';

export const metadata: Metadata = {
  description:
    'Build business credit on your EIN, not your personal score. Live bureau reports, monthly monitoring, and a checklist that tells you exactly what to do next.',
};

/**
 * Home page (spec §5.2).
 *
 * Statically rendered where possible — this is the top of the acquisition
 * funnel and its content must be in the HTML, not assembled client-side
 * (TASK-03 caveat on SEO regressions).
 */
export default async function HomePage() {
  const plans = await getActivePlans();
  const bureaus = getBureauCapabilities();
  const claim = getReportingClaim();

  return (
    <>
      {/* Hero */}
      {/* No ground colour: PageBackdrop is fixed behind the page, so a section
          that paints an opaque background would cover it. Border only. */}
      <section className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-3xl">
            <Badge tone="accent">EIN only — no SSN required</Badge>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl dark:text-neutral-50">
              Your business should stand on its own credit, not your personal score.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
              See your live business credit file, watch it change month over month, and work a
              checklist that tells you what actually moves the number. Built around your EIN.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/signup" size="lg">
                Create your free account
              </LinkButton>
              <LinkButton href="/pricing" size="lg" variant="secondary">
                See plans
              </LinkButton>
            </div>
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
              {disclosures.einOnly}
            </p>
          </div>
        </div>
      </section>

      {/* Three steps */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Build business credit in 3 easy steps
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              n: 1,
              title: 'Create your EIN-only account',
              body: 'Add your business name, address, entity type, and EIN. No Social Security number, no card.',
            },
            {
              n: 2,
              title: 'Choose a plan and connect a bureau',
              body: 'Pick the coverage you need and pull your live file to see where you actually stand today.',
            },
            {
              n: 3,
              title: 'Monitor and build, month over month',
              body: 'Track your score, log your tradelines, work the checklist, and get alerted when something changes.',
            },
          ].map((step) => (
            <Card key={step.n}>
              <CardBody className="p-6">
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-accent-50 text-base font-semibold text-accent-800 dark:bg-accent-900/40 dark:text-accent-200"
                >
                  {step.n}
                </span>
                <h3 className="mt-4 text-base font-semibold text-neutral-900 dark:text-neutral-50">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {step.body}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* Bureau strip — every claim here is config-gated (spec §12.4) */}
      <section className="border-y border-neutral-200 py-16 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            The bureaus we work with
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {claim.claimLine ??
              'We pull and monitor your file at the commercial bureaus below. We do not claim to report your activity to a bureau until that bureau has approved us as a data furnisher.'}
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {bureaus.map((bureau) => (
              <Card key={bureau.bureau}>
                <CardBody className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-50">
                      {bureau.label}
                    </p>
                    {bureau.reportingLive ? (
                      <Badge tone="success">Reporting live</Badge>
                    ) : bureau.pullLive ? (
                      <Badge tone="accent">Reports available</Badge>
                    ) : (
                      <Badge tone="neutral">Roadmap</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {bureau.pullLive
                      ? `Pull and monitor your file. Scored on a ${bureau.scoreScale} scale.`
                      : 'Not yet available. We will add it once coverage is in place.'}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>

          {claim.roadmapLine ? (
            <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              {claim.roadmapLine}
            </p>
          ) : null}
        </div>
      </section>

      {/* Feature highlights */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Everything you need to build a file
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: 'Live credit reports',
              body: 'Pull your current file on demand and download it as a PDF. Your allowance is set by your plan.',
            },
            {
              title: 'Score monitoring',
              body: 'We re-check on a schedule and email you when your score moves, so you are not the last to know.',
            },
            {
              title: 'Credit progress',
              body: 'Every observation charted per bureau, on that bureau’s own scale, so trends are actually readable.',
            },
            {
              title: 'Tradeline tracker',
              body: 'Log the accounts you hold and see which are reporting. Nudges flag the ones that are not.',
            },
            {
              title: 'Credit checklist',
              body: 'Twelve concrete steps, in order, from getting a D-U-N-S number to keeping utilisation down.',
            },
            {
              title: 'Dispute tracking',
              body: 'File a dispute against a report or tradeline and follow the investigation to its outcome.',
            },
          ].map((feature) => (
            <div key={feature.title}>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Plan teaser */}
      <section className="border-t border-neutral-200 py-20 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Plans
            </h2>
            <Link
              href="/pricing"
              className="text-sm font-semibold text-accent-700 hover:underline dark:text-accent-300"
            >
              See full pricing →
            </Link>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.code}>
                <CardBody className="p-6">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-50">{plan.name}</p>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    {plan.tagline}
                  </p>
                  <p className="mt-4 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                    {formatPrice(plan.monthlyPriceCents, plan.currency)}
                    <span className="text-base font-normal text-neutral-500">/mo</span>
                  </p>
                  <LinkButton
                    href={plan.isContactSales ? '/contact?topic=enterprise' : '/signup'}
                    variant={plan.code === 'professional' ? 'primary' : 'secondary'}
                    fullWidth
                    className="mt-5"
                  >
                    {plan.isContactSales ? 'Contact sales' : 'Get started'}
                  </LinkButton>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ teaser + final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Common questions
            </h2>
            <dl className="mt-6 space-y-6">
              {[
                {
                  q: 'Do I need to give you my SSN?',
                  a: 'No. We build your file against your EIN and do not collect a Social Security number at signup.',
                },
                {
                  q: 'Can you guarantee my score will go up?',
                  a: 'No, and you should be sceptical of anyone who does. Scores are set by each bureau from your business’s actual activity.',
                },
                {
                  q: 'What if the bureau has no file for me?',
                  a: 'That is normal for a newer business, and it is not an error. The checklist walks through what causes a file to be created.',
                },
              ].map((item) => (
                <div key={item.q}>
                  <dt className="font-medium text-neutral-900 dark:text-neutral-100">{item.q}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              href="/help"
              className="mt-6 inline-block text-sm font-semibold text-accent-700 hover:underline dark:text-accent-300"
            >
              Visit the help center →
            </Link>
          </div>

          <Card className="self-start">
            <CardBody className="p-8">
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                Start with a free account
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                Add your business, work the checklist, and see the dashboard before you pay for
                anything. {brand.name} asks for a card only when you choose a plan.
              </p>
              <LinkButton href="/signup" size="lg" fullWidth className="mt-6">
                Create your free account
              </LinkButton>
              <p className="mt-4 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {disclosures.noGuarantee}
              </p>
            </CardBody>
          </Card>
        </div>
      </section>
    </>
  );
}
