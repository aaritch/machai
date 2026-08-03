import type { Metadata } from 'next';
import { Alert, LinkButton } from '@machai/ui';
import { ScoreProgress } from '@/components/dashboard/score-chart';
import { getAccountContext } from '@/server/context';
import { getScoreHistory } from '@/server/reports';

export const metadata: Metadata = { title: 'Credit progress' };

/** Credit Progress (spec §7.3). */
export default async function ProgressPage() {
  const context = await getAccountContext();
  if (!context) return null;

  const history = context.businessId ? await getScoreHistory(context.businessId) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Credit progress
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          One panel per bureau. Each is charted on its own scale — the numbers are not comparable
          across bureaus.
        </p>
      </div>

      {!context.entitlements.monitoring ? (
        <Alert
          tone="info"
          title="Monitoring is part of a paid plan"
          action={
            <LinkButton href="/dashboard/billing" size="sm" variant="secondary">
              See plans
            </LinkButton>
          }
        >
          With a plan we re-check your score on a schedule and chart every observation here.
        </Alert>
      ) : null}

      <ScoreProgress
        points={history.map((point) => ({
          bureau: point.bureau,
          score: point.score,
          recordedOn: point.recordedOn,
        }))}
      />
    </div>
  );
}
