import type { Metadata } from 'next';
import { AFFILIATE_PROGRAM, formatCommission } from '@machai/config/affiliate';
import { formatPrice } from '@machai/config';
import { brand } from '@machai/config/public';
import { Card, CardBody, LinkButton } from '@machai/ui';

export const metadata: Metadata = {
  title: 'Affiliate program',
  description: `Earn ${formatCommission()} for every business you refer to ${brand.name} that starts a paid plan.`,
};

/**
 * Public affiliate program page (spec §1.3).
 *
 * The terms are stated plainly, including the parts that are unfavourable to the
 * affiliate — what does not earn, and when a commission is reversed. An
 * affiliate who discovers the hold window after the fact becomes a support
 * ticket and a bad review.
 */
export default function AffiliatesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Earn {formatCommission()} per referral
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
        If you work with small businesses — as a bookkeeper, an accountant, a consultant, or a
        supplier — you already know who needs their own credit file. Refer them, and you earn{' '}
        {formatCommission()} when they start a paid plan.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { n: 1, title: 'Join', body: 'Create a free account and apply. We review applications by hand.' },
          { n: 2, title: 'Share your link', body: `Anyone arriving through it is attributed to you for ${AFFILIATE_PROGRAM.attributionWindowDays} days.` },
          { n: 3, title: 'Get paid', body: `${formatCommission()} per referral that starts a paid plan.` },
        ].map((step) => (
          <Card key={step.n}>
            <CardBody className="p-5">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 place-items-center rounded-lg bg-accent-50 text-sm font-semibold text-accent-800 dark:bg-accent-900/40 dark:text-accent-200"
              >
                {step.n}
              </span>
              <h2 className="mt-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">
                {step.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {step.body}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <section className="mt-14 space-y-4 text-neutral-700 dark:text-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          The terms, in full
        </h2>
        <ul className="list-disc space-y-3 pl-5">
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              A free signup earns nothing.
            </strong>{' '}
            The commission is earned when a referred business starts a paid plan, which means it is
            always paid out of revenue that actually arrived.
          </li>
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              Commissions are held for {AFFILIATE_PROGRAM.holdDays} days.
            </strong>{' '}
            If the subscription is refunded, disputed, or ends inside that window, the commission is
            reversed. This is not a delay tactic — it is the window in which a card dispute can
            still arrive.
          </li>
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              Payouts start at {formatPrice(AFFILIATE_PROGRAM.minimumPayoutCents)}.
            </strong>{' '}
            Balances below that roll forward.
          </li>
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              Self-referrals do not qualify.
            </strong>{' '}
            Referring your own account, or an account on your own email address, earns nothing.
          </li>
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              One attribution per business.
            </strong>{' '}
            The first link someone arrives through is the one that counts.
          </li>
          <li className="leading-relaxed">
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              We review unusual patterns.
            </strong>{' '}
            Referrals that appear fabricated are held pending review, and we may decline to pay
            them.
          </li>
        </ul>
      </section>

      <section className="mt-12 space-y-4 text-neutral-700 dark:text-neutral-300">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          What we ask of you
        </h2>
        <p className="leading-relaxed">
          Describe the product accurately. Do not promise a score increase, a funding approval, or a
          timeline — we do not, and neither should anyone sharing our link. Do not claim we report to
          a bureau that is not listed as live on our pricing page.
        </p>
        <p className="leading-relaxed">
          Referrals obtained through spam, misleading claims, or paid search on our brand name will
          not be paid.
        </p>
      </section>

      <Card className="mt-14">
        <CardBody className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-semibold text-neutral-900 dark:text-neutral-50">Ready to start?</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Apply from the Affiliate program page in your dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/dashboard/affiliate">Apply now</LinkButton>
            <LinkButton href="/signup" variant="secondary">
              Create an account
            </LinkButton>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
