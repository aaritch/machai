'use client';

import { useActionState } from 'react';
import { IDLE_STATE } from '@/lib/form';
import { startProductCheckout } from '@/server/actions/billing';
import { FormBanner, SubmitButton } from '@/components/forms/form-parts';

export function BuyProductButton({
  productId,
  disabled,
}: {
  productId: string;
  disabled: boolean;
}) {
  const [state, action] = useActionState(startProductCheckout, IDLE_STATE);

  return (
    <div className="space-y-2">
      <FormBanner state={state} />
      <form action={action}>
        <input type="hidden" name="productId" value={productId} />
        <SubmitButton size="sm" disabled={disabled}>
          Buy
        </SubmitButton>
      </form>
      {disabled ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Confirm your email address first.
        </p>
      ) : null}
    </div>
  );
}
