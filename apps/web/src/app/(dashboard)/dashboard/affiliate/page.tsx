import type { Metadata } from 'next';
import {
  getAffiliateForUser,
  getAffiliateSummary,
  listReferrals,
} from '@machai/affiliate';
import { AFFILIATE_PROGRAM, QUALIFYING_EVENT_COPY, formatCommission } from '@machai/config/affiliate';
import { appUrl } from '@machai/config/public';
import { formatPrice } from '@machai/config';
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, StatTile } from '@machai/ui';
import { AffiliateApplyForm, ReferralLink } from '@/components/dashboard/affiliate-panels';
import { getAccountContext } from '@/server/context';

export const metadata: Metadata = { title: 'Affiliate program' };

const STATUS_COPY: Record<string, { label: string; tone: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }> = {
  pending: { label: 'Signed up', tone: 'neutral' },
  qualified: { label: 'Converted — in hold', tone: 'warning' },
  payable: { label: 'Ready to pay', tone: 'accent' },
  paid: { label: 'Paid', tone: 'success' },
  reversed: { label: 'Reversed', tone: 'danger' },
};

/**
 * Affiliate dashboard (spec §1.3, Phase 5).
 *
 * The status column is the honest part: a referral sits at "Signed up" earning
 * nothing until it converts to a paid plan. Showing that plainly is better than
 * a headline number that later shrinks.
 */
export default async function AffiliatePage() {
  const context = await getAccountContext();
  if (!context) return null;

  const affiliate = await getAffiliateForUser(context.user.id);
  const summary = affiliate ? await getAffiliateSummary(affiliate.id) : null;
  const referrals = affiliate ? await listReferrals(affiliate.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Affiliate program
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Earn {formatCommission()} for every business you refer that starts a paid plan.
        </p>
      </div>

      {!affiliate ? (
        <>
          <Card>
            <CardHeader
              title="How it works"
              description={`You earn ${formatCommission()} when ${QUALIFYING_EVENT_COPY[AFFILIATE_PROGRAM.qualifyingEvent]}.`}
            />
            <CardBody>
              <ol className="space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
                {[
                  'Join the program and get your own referral link.',
                  'Share it. Anyone who arrives through it is attributed to you for ' +
                    `${AFFILIATE_PROGRAM.attributionWindowDays} days.`,
                  `When they start a paid plan, you earn ${formatCommission()}.`,
                  `Commissions are held for ${AFFILIATE_PROGRAM.holdDays} days to cover refunds and disputes, ` +
                    `then paid once your balance reaches ${formatPrice(AFFILIATE_PROGRAM.minimumPayoutCents)}.`,
                ].map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-50 text-xs font-semibold text-accent-800 dark:bg-accent-900/40 dark:text-accent-200"
                    >
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>

              <Alert tone="info" className="mt-5">
                A free signup earns nothing. The commission is paid on conversion to a paid plan, so
                it always comes out of revenue that actually arrived.
              </Alert>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Join the program" />
            <CardBody>
              <AffiliateApplyForm emailVerified={Boolean(context.user.emailVerifiedAt)} />
            </CardBody>
          </Card>
        </>
      ) : (
        <>
          {affiliate.status === 'pending' ? (
            <Alert tone="warning" title="Your application is under review">
              We review applications by hand, usually within a business day. Your link will start
              earning as soon as it is approved.
            </Alert>
          ) : affiliate.status === 'suspended' ? (
            <Alert tone="danger" title="Your affiliate account is suspended">
              Referrals through your link are not being attributed. Contact support if you think this
              is wrong.
            </Alert>
          ) : affiliate.status === 'rejected' ? (
            <Alert tone="danger" title="Your application was not approved">
              Contact support if you would like to discuss it.
            </Alert>
          ) : null}

          {summary ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Ready to pay"
                value={formatPrice(summary.payableCents)}
                hint={`${summary.payable} referral${summary.payable === 1 ? '' : 's'}`}
                tone="accent"
              />
              <StatTile
                label="In hold"
                value={formatPrice(summary.heldCents)}
                hint={`${summary.qualified} converted, clearing in ${AFFILIATE_PROGRAM.holdDays} days`}
              />
              <StatTile label="Paid to date" value={formatPrice(summary.paidCents)} hint={`${summary.paid} settled`} />
              <StatTile
                label="Signed up"
                value={summary.pending}
                hint="Not yet on a paid plan — earns nothing"
              />
            </div>
          ) : null}

          {affiliate.status === 'active' ? (
            <Card>
              <CardHeader
                title="Your referral link"
                description={`Attribution lasts ${AFFILIATE_PROGRAM.attributionWindowDays} days from the first visit.`}
              />
              <CardBody>
                <ReferralLink code={affiliate.code} baseUrl={appUrl} />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Your referrals"
              description={`${referrals.length} total`}
            />
            {referrals.length === 0 ? (
              <EmptyState
                title="No referrals yet"
                description="Share your link — anyone who signs up through it appears here, and you earn when they start a paid plan."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[38rem] text-sm">
                  <caption className="sr-only">Your referrals and their status</caption>
                  <thead>
                    <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                      <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Signed up</th>
                      <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Status</th>
                      <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Commission</th>
                      <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Clears</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((referral) => {
                      const status = STATUS_COPY[referral.status] ?? {
                        label: referral.status,
                        tone: 'neutral' as const,
                      };
                      return (
                        <tr key={referral.id} className="border-b border-neutral-200 last:border-0 dark:border-neutral-800">
                          {/* Only the date — never the referred person's identity.
                              An affiliate has no business seeing who signed up. */}
                          <td className="px-5 py-3 text-neutral-800 dark:text-neutral-200">
                            {referral.signedUpAt.toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            {referral.flaggedForReview ? (
                              <span className="ml-2 text-xs text-neutral-500">under review</span>
                            ) : null}
                          </td>
                          <td className="px-5 py-3 tabular-nums text-neutral-800 dark:text-neutral-200">
                            {referral.commissionCents > 0 ? formatPrice(referral.commissionCents) : '—'}
                          </td>
                          <td className="px-5 py-3 text-neutral-600 dark:text-neutral-400">
                            {referral.status === 'reversed'
                              ? (referral.reversalReason ?? 'Reversed')
                              : referral.status === 'paid'
                                ? (referral.paidAt?.toLocaleDateString() ?? '—')
                                : (referral.payableAt?.toLocaleDateString() ?? '—')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            Commissions are earned only on conversion to a paid plan and are reversed if the
            subscription is refunded, disputed, or ends within the {AFFILIATE_PROGRAM.holdDays}-day
            hold. Self-referrals do not qualify. We may withhold payment on referrals that appear
            fabricated.
          </p>
        </>
      )}
    </div>
  );
}
