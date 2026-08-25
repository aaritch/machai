import Link from 'next/link';
import type { Metadata } from 'next';
import { getBureauCapabilities, getReportingClaim } from '@machai/config';
import { Badge, Card, CardBody, CardHeader, LinkButton, StatTile, cn } from '@machai/ui';
import { getAccountContext } from '@/server/context';
import { collectAchievementFacts, evaluateAchievements, getAchievements } from '@/server/checklist';

export const metadata: Metadata = { title: 'Home' };

/** Dashboard home (spec §7.1, pic7). */
export default async function DashboardHomePage() {
  const context = await getAccountContext();
  if (!context) return null;

  // Achievements are evaluated on load against derived facts, so a badge cannot
  // lag the state that earned it.
  const facts = await collectAchievementFacts({
    userId: context.user.id,
    businessId: context.businessId,
    emailVerified: Boolean(context.user.emailVerifiedAt),
    kybVerified: context.business?.verificationStatus === 'verified',
    subscriptionActive: context.entitlements.bureausReportedTo.length > 0,
    accountCreatedAt: new Date(),
  });
  await evaluateAchievements(context.user.id, facts);

  const achievements = await getAchievements(context.user.id);
  const earned = achievements.filter((a) => a.earned).length;
  const claim = getReportingClaim();

  // Bureaus this account is actually reported to: covered by the plan AND
  // approved as a furnisher. Either alone is not enough to say so.
  const reporting = getBureauCapabilities().filter(
    (b) => b.reportingLive && context.entitlements.bureausReportedTo.includes(b.bureau),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {greeting()}
          {context.user.firstName ? `, ${context.user.firstName}` : ''}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <span>
            {context.subscription.planName
              ? `You are on the ${context.subscription.planName} plan.`
              : 'You are on the Free plan — no card on file.'}
          </span>
          {context.business ? (
            <Badge
              tone={
                context.business.verificationStatus === 'verified'
                  ? 'success'
                  : context.business.verificationStatus === 'rejected'
                    ? 'danger'
                    : 'warning'
              }
            >
              {context.business.verificationStatus === 'verified'
                ? 'Business verified'
                : context.business.verificationStatus === 'rejected'
                  ? 'Verification failed'
                  : 'Verification pending'}
            </Badge>
          ) : null}
        </p>
      </div>

      {/* Reporting status — the primary conversion action for free users. */}
      {reporting.length === 0 ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="max-w-xl">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                Your activity is not being reported yet
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                Choose a plan and we start including your payment activity in the monthly
                submission to the bureaus it covers.
              </p>
              {claim.roadmapLine ? (
                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                  {claim.roadmapLine}
                </p>
              ) : null}
            </div>
            <LinkButton href="/dashboard/billing">Choose a plan</LinkButton>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reporting.map((bureau) => (
            <StatTile
              key={bureau.bureau}
              label={bureau.label}
              value="Reporting"
              hint="Included in the monthly submission"
              tone="accent"
            />
          ))}
        </div>
      )}

      {/* Onboarding — every step derived from real state. */}
      <Card>
        <CardHeader
          title="Get started"
          description={`${context.onboarding.completed} of ${context.onboarding.total} complete`}
        />
        <CardBody>
          <ol className="space-y-3">
            {context.onboarding.steps.map((step) => (
              <li key={step.key} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-semibold',
                    step.complete
                      ? 'bg-accent-600 text-white'
                      : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
                  )}
                >
                  {step.complete ? '✓' : ''}
                </span>
                <div className="min-w-0">
                  <Link
                    href={step.href}
                    className={cn(
                      'text-sm font-medium hover:underline',
                      step.complete
                        ? 'text-neutral-500 line-through dark:text-neutral-500'
                        : 'text-neutral-900 dark:text-neutral-100',
                    )}
                  >
                    {step.title}
                  </Link>
                  {!step.complete ? (
                    <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
                      {step.description}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader
          title="Achievements"
          description={`${earned} of ${achievements.length} milestones earned`}
        />
        <CardBody>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((achievement) => (
              <li
                key={achievement.key}
                className={cn(
                  'rounded-lg border px-4 py-3',
                  achievement.earned
                    ? 'border-accent-200 bg-accent-50 dark:border-accent-900 dark:bg-accent-900/30'
                    : 'border-neutral-200 dark:border-neutral-800',
                )}
              >
                <p
                  className={cn(
                    'text-sm font-semibold',
                    achievement.earned
                      ? 'text-accent-900 dark:text-accent-100'
                      : 'text-neutral-500 dark:text-neutral-400',
                  )}
                >
                  {achievement.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {achievement.description}
                </p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
