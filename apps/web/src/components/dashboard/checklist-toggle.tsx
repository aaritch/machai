import { Badge, cn } from '@machai/ui';
import { toggleChecklistItemAction } from '@/server/actions/dashboard';

/**
 * A checklist row.
 *
 * A plain form with a submit button rather than a checkbox with an onChange
 * handler: it works without JavaScript, and the mutation goes through a Server
 * Action, which carries Next's origin check.
 */
export function ChecklistItemToggle({
  id,
  title,
  description,
  points,
  complete,
}: {
  id: string;
  title: string;
  description: string;
  points: number;
  complete: boolean;
}) {
  return (
    <form action={toggleChecklistItemAction} className="flex items-start gap-3 px-5 py-4">
      <input type="hidden" name="itemId" value={id} />
      <input type="hidden" name="complete" value={complete ? 'false' : 'true'} />

      <button
        type="submit"
        aria-pressed={complete}
        className={cn(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-xs font-bold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
          complete
            ? 'border-accent-600 bg-accent-600 text-white'
            : 'border-neutral-300 hover:border-accent-500 dark:border-neutral-600',
        )}
      >
        <span className="sr-only">
          {complete ? `Mark "${title}" as not done` : `Mark "${title}" as done`}
        </span>
        <span aria-hidden="true">{complete ? '✓' : ''}</span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              'text-sm font-medium',
              complete
                ? 'text-neutral-500 line-through dark:text-neutral-500'
                : 'text-neutral-900 dark:text-neutral-100',
            )}
          >
            {title}
          </p>
          <Badge tone={complete ? 'success' : 'neutral'}>{points} pts</Badge>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {description}
        </p>
      </div>
    </form>
  );
}
