'use client';

import { useActionState } from 'react';
import type { Bureau } from '@machai/types';
import { IDLE_STATE } from '@/lib/form';
import { pullReportAction } from '@/server/actions/dashboard';
import { FormBanner, SubmitButton } from '@/components/forms/form-parts';

/**
 * "Pull your live credit report".
 *
 * The disabled state carries a reason — a greyed-out button with no
 * explanation is the most common way a gated feature reads as broken.
 * The server re-checks every one of these conditions regardless.
 */
export function PullReportPanel({
  bureau,
  label,
  disabled,
  reason,
}: {
  bureau: Bureau;
  label: string;
  disabled: boolean;
  reason: string | null;
}) {
  const [state, action] = useActionState(pullReportAction, IDLE_STATE);

  return (
    <div className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <FormBanner state={state} />
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="bureau" value={bureau} />
        <SubmitButton disabled={disabled} size="sm">
          Pull live report
        </SubmitButton>
        {disabled && reason ? (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{reason}</span>
        ) : (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Uses one pull from your monthly allowance for {label}.
          </span>
        )}
      </form>
    </div>
  );
}
