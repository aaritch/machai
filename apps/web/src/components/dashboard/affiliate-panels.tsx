'use client';

import { useActionState, useState } from 'react';
import { Button, Checkbox, Field, Input, Textarea } from '@machai/ui';
import { IDLE_STATE } from '@/lib/form';
import { applyForAffiliateAction } from '@/server/actions/affiliate';
import { FormBanner, SubmitButton, fieldError } from '@/components/forms/form-parts';

export function AffiliateApplyForm({ emailVerified }: { emailVerified: boolean }) {
  const [state, action] = useActionState(applyForAffiliateAction, IDLE_STATE);

  if (!emailVerified) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Confirm your email address before joining. We are agreeing to send you money, so we need an
        address you have proven you can read.
      </p>
    );
  }

  if (state.status === 'success') return <FormBanner state={state} />;

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormBanner state={state} />

      <Field
        label="Payout email"
        htmlFor="payoutEmail"
        required
        hint="Where we send your payments. We do not collect bank or card details here."
        error={fieldError(state, 'payoutEmail')}
      >
        <Input
          id="payoutEmail"
          name="payoutEmail"
          type="email"
          required
          invalid={Boolean(fieldError(state, 'payoutEmail'))}
        />
      </Field>

      <Field
        label="How do you plan to share your link?"
        htmlFor="applicationNote"
        hint="Optional, but it speeds up review."
        error={fieldError(state, 'applicationNote')}
      >
        <Textarea id="applicationNote" name="applicationNote" maxLength={2000} />
      </Field>

      <Checkbox
        id="acceptedTerms"
        name="acceptedTerms"
        error={fieldError(state, 'acceptedTerms')}
        label="I understand commissions are earned only when a referred business starts a paid plan, are held before payment, and are reversed if the subscription is refunded or ends within the hold. Self-referrals do not qualify."
      />

      <SubmitButton>Join the program</SubmitButton>
    </form>
  );
}

/**
 * The shareable link with a copy button.
 *
 * Uses the async clipboard API with a visible fallback: the input is
 * `readOnly` rather than disabled, so it stays selectable and a user can copy
 * by hand if the clipboard permission is refused.
 */
export function ReferralLink({ code, baseUrl }: { code: string; baseUrl: string }) {
  const link = `${baseUrl}/?ref=${code}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked. The field is selectable, so there is a manual path.
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label htmlFor="referral-link" className="sr-only">
          Your referral link
        </label>
        <Input id="referral-link" readOnly value={link} className="flex-1 font-mono text-xs" />
        <Button type="button" variant="secondary" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {/* Announced politely so the confirmation is not sighted-only. */}
      <p className="text-xs text-neutral-500 dark:text-neutral-400" aria-live="polite">
        {copied ? 'Link copied to your clipboard.' : `Your code is ${code}.`}
      </p>
      <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        The code works on any page — <span className="font-mono">/pricing?ref={code}</span> sends
        people straight to the plans.
      </p>
    </div>
  );
}
