'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Field, Input } from '@machai/ui';
import { IDLE_STATE } from '@/lib/form';
import { login } from '@/server/actions/auth';
import { FormBanner, SubmitButton, fieldError } from '@/components/forms/form-parts';

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, IDLE_STATE);
  const [showPassword, setShowPassword] = useState(false);

  // The TOTP field only appears once the server asks for it — surfacing it
  // up front would tell an attacker which accounts have MFA enrolled.
  const needsTotp = Boolean(state.fieldErrors?.totpCode);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormBanner state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

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

      <Field label="Password" htmlFor="password" required error={fieldError(state, 'password')}>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="pr-16"
            invalid={Boolean(fieldError(state, 'password'))}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </Field>

      {needsTotp ? (
        <Field
          label="Authentication code"
          htmlFor="totpCode"
          required
          hint="6-digit code from your authenticator app"
          error={fieldError(state, 'totpCode')}
        >
          <Input
            id="totpCode"
            name="totpCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            invalid={Boolean(fieldError(state, 'totpCode'))}
          />
        </Field>
      ) : null}

      <SubmitButton size="lg" fullWidth>
        Log in
      </SubmitButton>

      <div className="flex justify-between text-sm">
        <Link
          href="/forgot-password"
          className="font-medium text-accent-700 hover:underline dark:text-accent-300"
        >
          Forgot password?
        </Link>
        <Link
          href="/signup"
          className="font-medium text-accent-700 hover:underline dark:text-accent-300"
        >
          Create an account
        </Link>
      </div>
    </form>
  );
}
