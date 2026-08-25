import type { Metadata } from 'next';
import { COMPARISON_ROWS, formatPrice, getAvailabilityLine } from '@machai/config';
import { PRORATION_NOTE, disclosures } from '@machai/config';
import { Badge, Card, CardBody, LinkButton } from '@machai/ui';
import { getActivePlans } from '@/server/plans';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Straightforward monthly plans for building your business credit file. Foundation, Growth, and Premier.',
};

/**
 * Pricing page (spec §5.3, TASK-03).
 *
 * Plans render from the `plans` table, and the comparison table derives every
 * cell from the same `entitlements` object the gating layer reads. A row here
 * cannot promise something the backend will refuse.
 */
export default async function PricingPage() {
  const plans = await getActivePlans();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Pick the coverage you need
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
          Every plan includes the dashboard, the credit checklist, and the tradeline tracker. What
          changes is how many bureaus you can pull from, and how often.
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const featured = plan.code === 'professional';
          return (
            <Card
              key={plan.code}
              className={featured ? 'ring-2 ring-accent-600 dark:ring-accent-500' : undefined}
            >
              <CardBody className="flex h-full flex-col p-7">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                    {plan.name}
                  </h2>
                  {featured ? <Badge tone="accent">Most popular</Badge> : null}
                </div>
                <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                  {plan.tagline}
                </p>

                <p className="mt-6 text-4xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {formatPrice(plan.monthlyPriceCents, plan.currency)}
                  <span className="text-base font-normal text-neutral-500">/month</span>
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
                      <svg
                        viewBox="0 0 20 20"
                        className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        aria-hidden="true"
                      >
                        <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Enterprise is sales-assisted — no self-serve checkout (spec §9.2). */}
                <LinkButton
                  href={plan.isContactSales ? '/contact?topic=enterprise' : `/signup?plan=${plan.code}`}
                  variant={featured ? 'primary' : 'secondary'}
                  fullWidth
                  size="lg"
                  className="mt-7"
                >
                  {plan.isContactSales ? 'Contact sales' : 'Subscribe'}
                </LinkButton>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {PRORATION_NOTE}
      </p>

      {/* Comparison table */}
      <section className="mt-20">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Compare plans
        </h2>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">Feature comparison across all plans</caption>
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th scope="col" className="py-3 pr-4 text-left font-medium text-neutral-500">
                  Feature
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.code}
                    scope="col"
                    className="px-4 py-3 text-left font-semibold text-neutral-900 dark:text-neutral-50"
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-neutral-200 dark:border-neutral-800">
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-normal text-neutral-700 dark:text-neutral-300"
                  >
                    {row.label}
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.code}
                      className="px-4 py-3 tabular-nums text-neutral-900 dark:text-neutral-100"
                    >
                      {row.value(plan.entitlements)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-12 space-y-2 rounded-xl border border-neutral-200 bg-white p-6 text-sm leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <p>{getAvailabilityLine()}</p>
        <p>{disclosures.pullDisclosure}</p>
        <p>{disclosures.noGuarantee}</p>
      </div>
    </div>
  );
}
