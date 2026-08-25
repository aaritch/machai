import Link from 'next/link';
import type { Metadata } from 'next';
import { getBureauCapabilities, getReportingClaim } from '@machai/config';
import { brand, disclosures } from '@machai/config/public';
import { formatPrice } from '@machai/config';
import { Card, CardBody, LinkButton } from '@machai/ui';
import { getActivePlans } from '@/server/plans';

// Overrides the root description for this page specifically, so it has to say
// the same thing — it still advertised report pulls and monitoring.
export const metadata: Metadata = {
  description:
    'Build business credit in your business name, not against your personal score. We report your payment activity to the commercial bureaus every month.',
};

/**
 * Home page (spec §5.2).
 *
 * Rendered per request via the route group's layout, which carries
 * `force-dynamic` because the bureau claim on this page and in the footer is
 * gated on furnisher approval. Content is still fully server-rendered, so the
 * TASK-03 SEO requirement is unaffected.
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
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl dark:text-neutral-50">
              Build credit in your business name, not against your personal score.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
              We report your payment activity to the commercial bureaus every month, so your
              company builds a credit history of its own. Built around your EIN.
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
              {disclosures.freeToStart}
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
              title: 'Create your account',
              body: 'Add your business name, address, entity type, and EIN. No card required to start.',
            },
            {
              n: 2,
              title: 'Choose your coverage',
              body: 'Pick which of the commercial bureaus we report your payment activity to.',
            },
            {
              n: 3,
              title: 'We report, every month',
              body: 'Your activity goes out on a monthly cycle, and your file builds from there. Each bureau decides how it scores what it receives.',
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
            {/* claimLine is null until a bureau approves us as a furnisher, so the
                fallback must not assert reporting of any kind. */}
            {claim.claimLine ??
              'We name a bureau here only once it has approved us as a data furnisher.'}
          </p>

          {/* Flex-wrap rather than a 3-column grid: with four bureaus the grid
              left a lone card orphaned on the second row. Centring the wrap
              keeps the trailing row balanced whatever the bureau count. */}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {bureaus.map((bureau) => (
              <Card
                key={bureau.bureau}
                // Widths track the gap so three sit per row on large screens
                // and two on small, matching the previous grid.
                className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]"
              >
                <CardBody className="p-5">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-50">
                    {bureau.label}
                  </p>
                  {/* No status badge: the sentence below already says whether we
                      report to this bureau, and a badge repeating it added a
                      second thing to keep in step with the flag.

                      Still branches on reportingLive, not pullLive — this makes a
                      furnishing claim, so it follows furnisher approval rather
                      than our ability to read the bureau's data. */}
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {bureau.reportingLive
                      ? `We report your account activity to ${bureau.label}. Scored on a ${bureau.scoreScale} scale.`
                      : 'Not yet available. We will add it once approval is in place.'}
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
                  q: 'What exactly do you report?',
                  a: 'Your payment activity on the accounts you hold — submitted monthly, as it actually happened. We report the record; we do not create accounts on your behalf.',
                },
                {
                  q: 'How long before it shows up on my file?',
                  a: 'Submissions go out on a monthly cycle. Each bureau decides when and how a submission appears, and a brand-new file often takes a few cycles before it is scoreable.',
                },
                {
                  q: 'What if something you reported is wrong?',
                  a: 'Tell us and we investigate it and correct the record. You can also dispute it directly with the bureau — that right is yours regardless of anything we do.',
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
