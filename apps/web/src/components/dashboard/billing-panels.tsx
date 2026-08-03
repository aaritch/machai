'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Badge, Button, LinkButton } from '@machai/ui';
import { IDLE_STATE } from '@/lib/form';
import { openBillingPortal, refreshBillingState, startCheckout } from '@/server/actions/billing';
import { FormBanner, SubmitButton } from '@/components/forms/form-parts';

/** Refresh + portal controls (spec §7.5). */
export function BillingActions({ hasCustomer }: { hasCustomer: boolean }) {
  const [state, refresh] = useActionState(refreshBillingState, IDLE_STATE);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <form action={refresh}>
          <SubmitButton variant="secondary" size="sm">
            Refresh
          </SubmitButton>
        </form>
        {hasCustomer ? (
          <form action={openBillingPortal}>
            <Button type="submit" size="sm" variant="secondary">
              Manage in portal
            </Button>
          </form>
        ) : null}
      </div>
      <div className="w-full max-w-md">
        <FormBanner state={state} />
      </div>
    </div>
  );
}

export interface PlanOptionView {
  code: string;
  name: string;
  tagline: string;
  priceLabel: string;
  isContactSales: boolean;
  isCurrent: boolean;
}

export function PlanOptions({
  plans,
  emailVerified,
}: {
  plans: PlanOptionView[];
  emailVerified: boolean;
}) {
  const [state, checkout] = useActionState(startCheckout, IDLE_STATE);

  return (
    <div className="space-y-4">
      <FormBanner state={state} />

      {!emailVerified ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Confirm your email address before subscribing.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.code}
            className="flex flex-col rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-neutral-900 dark:text-neutral-50">{plan.name}</p>
              {plan.isCurrent ? <Badge tone="accent">Current</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{plan.tagline}</p>
            <p className="mt-3 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
              {plan.priceLabel}
            </p>

            <div className="mt-4">
              {plan.isContactSales ? (
                <LinkButton href="/contact?topic=enterprise" variant="secondary" fullWidth size="sm">
                  Contact sales
                </LinkButton>
              ) : plan.isCurrent ? (
                <Button variant="secondary" fullWidth size="sm" disabled>
                  Your plan
                </Button>
              ) : (
                <form action={checkout}>
                  <input type="hidden" name="planCode" value={plan.code} />
                  <SubmitButton fullWidth size="sm" disabled={!emailVerified}>
                    Subscribe
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Card details are entered on Stripe’s own pages and never reach our servers. See our{' '}
        <Link href="/legal/terms" className="underline">
          terms
        </Link>{' '}
        for billing details.
      </p>
    </div>
  );
}
