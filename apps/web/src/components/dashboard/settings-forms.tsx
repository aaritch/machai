'use client';

import { useActionState } from 'react';
import { Button, Checkbox } from '@machai/ui';
import { IDLE_STATE } from '@/lib/form';
import { logout, logoutEverywhere, resendVerification } from '@/server/actions/auth';
import { updateMarketingConsentAction } from '@/server/actions/dashboard';
import { FormBanner, SubmitButton } from '@/components/forms/form-parts';

export function ResendVerificationButton() {
  const [state, action] = useActionState(resendVerification, IDLE_STATE);

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={action}>
        <SubmitButton size="sm" variant="secondary">
          Resend confirmation
        </SubmitButton>
      </form>
      <div className="max-w-sm">
        <FormBanner state={state} />
      </div>
    </div>
  );
}

export function MarketingConsentForm({ optedIn }: { optedIn: boolean }) {
  return (
    <form action={updateMarketingConsentAction} className="space-y-4">
      <Checkbox
        id="marketingOptIn"
        name="marketingOptIn"
        defaultChecked={optedIn}
        label="Send me product announcements. Transactional messages — verification, receipts, and alerts — are sent regardless."
      />
      <Button type="submit" size="sm" variant="secondary">
        Save preference
      </Button>
    </form>
  );
}

export function SignOutButtons() {
  return (
    <div className="flex flex-wrap gap-3">
      <form action={logout}>
        <Button type="submit" size="sm" variant="secondary">
          Sign out
        </Button>
      </form>
      <form action={logoutEverywhere}>
        <Button type="submit" size="sm" variant="secondary">
          Sign out everywhere
        </Button>
      </form>
    </div>
  );
}
