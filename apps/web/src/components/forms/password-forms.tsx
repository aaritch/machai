'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { PASSWORD_MIN_LENGTH, PASSWORD_STRENGTH_LABELS, passwordStrength } from '@machai/types';
import { Field, Input, cn } from '@machai/ui';
import { IDLE_STATE } from '@/lib/form';
import { requestPasswordReset, resetPassword } from '@/server/actions/auth';
import { FormBanner, SubmitButton, fieldError } from '@/components/forms/form-parts';

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, IDLE_STATE);

  // The acknowledgement is identical whether or not the address is registered,
  // so replacing the form on success reveals nothing.
  if (state.status === 'success') {
    return (
      <div className="space-y-4">
        <FormBanner state={state} />
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-accent-700 hover:underline dark:text-accent-300"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormBanner state={state} />
      <Field label="Email" htmlFor="email" required error={fieldError(state, 'email')}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          invalid={Boolean(fieldError(state, 'email'))}
        />
      </Field>
      <SubmitButton size="lg" fullWidth>
        Send reset link
      </SubmitButton>
      <Link
        href="/login"
        className="block text-center text-sm font-medium text-accent-700 hover:underline dark:text-accent-300"
      >
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, IDLE_STATE);
  const [password, setPassword] = useState('');
  const strength = passwordStrength(password);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormBanner state={state} />
      <input type="hidden" name="token" value={token} />

      <Field
        label="New password"
        htmlFor="password"
        required
        hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
        error={fieldError(state, 'password')}
      >
        <Input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          autoFocus
          invalid={Boolean(fieldError(state, 'password'))}
        />
      </Field>

      {password ? (
        <div>
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full',
                  i < strength
                    ? strength <= 1
                      ? 'bg-red-500'
                      : strength === 2
                        ? 'bg-amber-500'
                        : 'bg-accent-600'
                    : 'bg-neutral-200 dark:bg-neutral-800',
                )}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400" aria-live="polite">
            Password strength: {PASSWORD_STRENGTH_LABELS[strength]}
          </p>
        </div>
      ) : null}

      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        required
        error={fieldError(state, 'confirmPassword')}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(fieldError(state, 'confirmPassword'))}
        />
      </Field>

      <SubmitButton size="lg" fullWidth>
        Set new password
      </SubmitButton>

      <p className="text-center text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Changing your password signs you out everywhere else.
      </p>
    </form>
  );
}
