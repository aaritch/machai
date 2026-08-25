import type { Metadata } from 'next';
import { disclosures } from '@machai/config/public';
import { Alert, Badge, Card, CardBody, CardHeader, LinkButton, StatTile } from '@machai/ui';
import { PullReportPanel } from '@/components/dashboard/pull-report';
import { getAccountContext } from '@/server/context';
import { allowanceSummary, getBureauCards } from '@/server/reports';

export const metadata: Metadata = { title: 'Business credit score' };

/** Business Credit Score (spec §7.2, pic3). */
export default async function ScorePage() {
  const context = await getAccountContext();
  if (!context) return null;

  const cards = await getBureauCards(context.businessId, context.entitlements);
  const allowance = allowanceSummary(context.entitlements, context.pullsUsedThisMonth);
  const entitled = context.entitlements.reportsPerMonth > 0;
  const kybVerified = context.business?.verificationStatus === 'verified';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Business credit score
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Pull your live file from the bureaus your plan covers.
        </p>
      </div>

      {!entitled ? (
        <Alert
          tone="info"
          title="Live reports need a plan"
          action={
            <LinkButton href="/dashboard/billing" size="sm" variant="secondary">
              See plans
            </LinkButton>
          }
        >
          Your free account includes the dashboard, checklist, and tradeline tracker. Pulling a live
          report requires an active plan.
        </Alert>
      ) : null}

      {entitled && !kybVerified ? (
        <Alert tone="warning" title="Business verification is not complete">
          We verify each business before requesting its file. This is usually quick — you will be
          able to pull a report as soon as it clears.
        </Alert>
      ) : null}

      {entitled ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Pulls used" value={allowance.used} hint={`This month (${allowance.period})`} />
          <StatTile label="Remaining" value={allowance.remaining} tone="accent" />
          <StatTile label="Monthly allowance" value={allowance.total} />
        </div>
      ) : null}

      <div className="space-y-4">
        {cards.map((card) => (
          <Card key={card.bureau}>
            <CardHeader
              title={card.label}
              description={`Scored ${card.scoreScale}`}
              action={
                card.allowed ? (
                  <Badge tone="accent">Included</Badge>
                ) : (
                  <Badge tone="neutral">Not on your plan</Badge>
                )
              }
            />
            <CardBody className="space-y-4">
              {card.latest?.status === 'available' ? (
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <p className="text-4xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                      {card.latest.score ?? '—'}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      {card.latest.scoreBand ?? 'Scored'} · {card.scoreScale}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Last pulled{' '}
                    {card.latest.pulledAt?.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              ) : card.latest?.status === 'no_file' ? (
                // "No file" is a first-class state, not an error (TASK-05).
                <Alert tone="info" title="This bureau has no file for your business yet">
                  That is normal for a newer company and nothing to dispute. A file is created once a
                  supplier or lender that reports to this bureau opens an account for you — the{' '}
                  <a href="/dashboard/checklist" className="font-medium underline">
                    credit checklist
                  </a>{' '}
                  walks through the steps.
                </Alert>
              ) : card.latest?.status === 'pending' ? (
                <Alert tone="info">
                  A pull is in progress. This usually takes under a minute — refresh the page
                  shortly.
                </Alert>
              ) : card.latest?.status === 'failed' ? (
                <Alert tone="warning" title="That pull did not complete">
                  {card.latest.failureMessage ?? 'The bureau did not respond.'} Your allowance was
                  not used — you can try again.
                </Alert>
              ) : (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  No report pulled from this bureau yet.
                </p>
              )}

              <PullReportPanel
                bureau={card.bureau}
                label={card.label}
                disabled={!card.allowed || !entitled || !kybVerified || allowance.remaining <= 0}
                reason={
                  !entitled
                    ? 'Requires an active plan'
                    : !card.allowed
                      ? 'Not included on your plan'
                      : !kybVerified
                        ? 'Business verification pending'
                        : allowance.remaining <= 0
                          ? 'Monthly allowance used'
                          : null
                }
              />
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        {disclosures.reportingDisclosure} {disclosures.noGuarantee}
      </p>
    </div>
  );
}
