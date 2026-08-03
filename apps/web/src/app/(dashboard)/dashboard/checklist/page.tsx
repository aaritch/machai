import type { Metadata } from 'next';
import { Card, CardBody, CardHeader, StatTile } from '@machai/ui';
import { ChecklistItemToggle } from '@/components/dashboard/checklist-toggle';
import { getChecklist } from '@/server/checklist';
import { getAccountContext } from '@/server/context';

export const metadata: Metadata = { title: 'Credit checklist' };

const CATEGORY_LABELS: Record<string, string> = {
  foundation: 'Foundation',
  tradelines: 'Tradelines',
  habits: 'Habits',
  general: 'General',
};

/** Credit checklist (spec §7.3). Free for everyone — it is the useful part. */
export default async function ChecklistPage() {
  const context = await getAccountContext();
  if (!context) return null;

  const items = await getChecklist(context.user.id);
  const completed = items.filter((i) => i.complete);
  const points = completed.reduce((sum, i) => sum + i.points, 0);
  const totalPoints = items.reduce((sum, i) => sum + i.points, 0);

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Credit checklist
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          The steps that actually build a file, roughly in the order they matter.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Steps done" value={`${completed.length} of ${items.length}`} tone="accent" />
        <StatTile label="Points" value={`${points} / ${totalPoints}`} />
        <StatTile
          label="Progress"
          value={`${items.length === 0 ? 0 : Math.round((completed.length / items.length) * 100)}%`}
        />
      </div>

      {Object.entries(grouped).map(([category, categoryItems]) => (
        <Card key={category}>
          <CardHeader title={CATEGORY_LABELS[category] ?? category} />
          <CardBody className="divide-y divide-neutral-200 p-0 dark:divide-neutral-800">
            {categoryItems.map((item) => (
              <ChecklistItemToggle
                key={item.id}
                id={item.id}
                title={item.title}
                description={item.description}
                points={item.points}
                complete={item.complete}
              />
            ))}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
