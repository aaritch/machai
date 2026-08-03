'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import {
  ENTITY_TYPES,
  ENTITY_TYPE_LABELS,
  MIN_ATTESTED_OWNERSHIP,
  PASSWORD_MIN_LENGTH,
  PASSWORD_STRENGTH_LABELS,
  US_STATES,
  passwordStrength,
  type BusinessStepInput,
  type RepresentativeStepInput,
} from '@machai/types';
import { Checkbox, Field, Input, Select, cn } from '@machai/ui';
import { IDLE_STATE, type FormState } from '@/lib/form';
import {
  completeSignup,
  saveBusinessStepAction,
  saveRepresentativeStepAction,
} from '@/server/actions/auth';
import { FormBanner, SpamFields, SubmitButton, fieldError } from '@/components/forms/form-parts';

/**
 * The three-step wizard: Business → Representative → Account (spec §6).
 *
 * Steps 1 and 2 persist to a server-side draft on submit, so the flow is
 * resumable — a user can close the tab and come back. Step 3 holds the password
 * and is never persisted before the final submit.
 */

/** Navigates when an action returns a redirect target. */
function useActionRedirect(state: FormState) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === 'success' && state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state, router]);
}

export function BusinessStep({ defaults }: { defaults: BusinessStepInput | null }) {
  const [state, action] = useActionState(saveBusinessStepAction, IDLE_STATE);
  useActionRedirect(state);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormBanner state={state} />

      <Field
        label="Business name"
        htmlFor="legalName"
        required
        error={fieldError(state, 'legalName')}
      >
        <Input
          id="legalName"
          name="legalName"
          defaultValue={defaults?.legalName ?? ''}
          autoComplete="organization"
          required
          invalid={Boolean(fieldError(state, 'legalName'))}
        />
      </Field>

      <Field
        label="D.B.A / trade name"
        htmlFor="dbaName"
        hint="Optional — only if you trade under a different name"
        error={fieldError(state, 'dbaName')}
      >
        <Input id="dbaName" name="dbaName" defaultValue={defaults?.dbaName ?? ''} />
      </Field>

      <Field
        label="Street address"
        htmlFor="streetAddress"
        required
        error={fieldError(state, 'streetAddress')}
      >
        <Input
          id="streetAddress"
          name="streetAddress"
          defaultValue={defaults?.streetAddress ?? ''}
          autoComplete="street-address"
          required
          invalid={Boolean(fieldError(state, 'streetAddress'))}
        />
      </Field>

      <Field label="Address line 2" htmlFor="addressLine2" hint="Optional">
        <Input id="addressLine2" name="addressLine2" defaultValue={defaults?.addressLine2 ?? ''} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="City" htmlFor="city" required error={fieldError(state, 'city')}>
          <Input
            id="city"
            name="city"
            defaultValue={defaults?.city ?? ''}
            autoComplete="address-level2"
            required
            invalid={Boolean(fieldError(state, 'city'))}
          />
        </Field>
        <Field label="State" htmlFor="state" required error={fieldError(state, 'state')}>
          <Select
            id="state"
            name="state"
            defaultValue={defaults?.state ?? ''}
            required
            invalid={Boolean(fieldError(state, 'state'))}
          >
            <option value="">Select…</option>
            {US_STATES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ZIP" htmlFor="zip" required error={fieldError(state, 'zip')}>
          <Input
            id="zip"
            name="zip"
            defaultValue={defaults?.zip ?? ''}
            inputMode="numeric"
            autoComplete="postal-code"
            required
            invalid={Boolean(fieldError(state, 'zip'))}
          />
        </Field>
      </div>

      <Field
        label="Tax ID (EIN)"
        htmlFor="ein"
        required
        hint="9 digits only. We encrypt this and never show it in full again."
        error={fieldError(state, 'ein')}
      >
        <Input
          id="ein"
          name="ein"
          inputMode="numeric"
          placeholder="12-3456789"
          defaultValue={defaults?.ein ?? ''}
          required
          invalid={Boolean(fieldError(state, 'ein'))}
        />
      </Field>

      <Field
        label="Business entity type"
        htmlFor="entityType"
        required
        error={fieldError(state, 'entityType')}
      >
        <Select
          id="entityType"
          name="entityType"
          defaultValue={defaults?.entityType ?? ''}
          required
          invalid={Boolean(fieldError(state, 'entityType'))}
        >
          <option value="">Select…</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {ENTITY_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Phone"
        htmlFor="phone"
        required
        hint="10 digits only"
        error={fieldError(state, 'phone')}
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          defaultValue={defaults?.phone ?? ''}
          autoComplete="tel"
          required
          invalid={Boolean(fieldError(state, 'phone'))}
        />
      </Field>

      <SubmitButton size="lg" fullWidth>
        Continue
      </SubmitButton>
    </form>
  );
}

export function RepresentativeStep({ defaults }: { defaults: RepresentativeStepInput | null }) {
  const [state, action] = useActionState(saveRepresentativeStepAction, IDLE_STATE);
  useActionRedirect(state);

  const [ownership, setOwnership] = useState(String(defaults?.ownershipPercentage ?? ''));
  const ownershipNumber = Number.parseFloat(ownership);
  // Mirrors the server rule so the mismatch is visible before submitting, not
  // after. The server re-checks it regardless.
  const belowThreshold =
    Number.isFinite(ownershipNumber) && ownershipNumber < MIN_ATTESTED_OWNERSHIP;

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormBanner state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" required error={fieldError(state, 'firstName')}>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={defaults?.firstName ?? ''}
            autoComplete="given-name"
            required
            invalid={Boolean(fieldError(state, 'firstName'))}
          />
        </Field>
        <Field label="Last name" htmlFor="lastName" required error={fieldError(state, 'lastName')}>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={defaults?.lastName ?? ''}
            autoComplete="family-name"
            required
            invalid={Boolean(fieldError(state, 'lastName'))}
          />
        </Field>
      </div>

      <Field label="Title" htmlFor="title" required error={fieldError(state, 'title')}>
        <Input
          id="title"
          name="title"
          placeholder="Owner, Managing Member, CEO…"
          defaultValue={defaults?.title ?? ''}
          required
          invalid={Boolean(fieldError(state, 'title'))}
        />
      </Field>

      <Field label="Email" htmlFor="repEmail" required error={fieldError(state, 'email')}>
        <Input
          id="repEmail"
          name="email"
          type="email"
          defaultValue={defaults?.email ?? ''}
          autoComplete="email"
          required
          invalid={Boolean(fieldError(state, 'email'))}
        />
      </Field>

      <Field label="Phone" htmlFor="repPhone" hint="Optional" error={fieldError(state, 'phone')}>
        <Input id="repPhone" name="phone" type="tel" inputMode="numeric" defaultValue={defaults?.phone ?? ''} />
      </Field>

      <Field
        label="Ownership percentage"
        htmlFor="ownershipPercentage"
        required
        hint="Percentage of the business this person owns"
        error={fieldError(state, 'ownershipPercentage')}
      >
        <Input
          id="ownershipPercentage"
          name="ownershipPercentage"
          inputMode="decimal"
          value={ownership}
          onChange={(e) => setOwnership(e.target.value)}
          required
          invalid={Boolean(fieldError(state, 'ownershipPercentage'))}
        />
      </Field>

      <Checkbox
        id="attestedAuthority"
        name="attestedAuthority"
        defaultChecked={defaults?.attestedAuthority ?? false}
        error={fieldError(state, 'attestedAuthority')}
        label={`I confirm the registered representative has at least ${MIN_ATTESTED_OWNERSHIP}% ownership and is authorised to act for this business.`}
      />

      {belowThreshold ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          The ownership you entered is below {MIN_ATTESTED_OWNERSHIP}%, so this attestation cannot
          be made truthfully. Enter the details of someone who meets the threshold.
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href="/signup?step=business"
          className="inline-flex h-12 items-center justify-center rounded-lg px-6 text-base font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 dark:text-neutral-300 dark:ring-neutral-700"
        >
          Back
        </Link>
        <SubmitButton size="lg" className="flex-1">
          Continue
        </SubmitButton>
      </div>
    </form>
  );
}

export function AccountStep({ defaultEmail }: { defaultEmail: string }) {
  const [state, action] = useActionState(completeSignup, IDLE_STATE);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const strength = passwordStrength(password);

  return (
    <form action={action} className="relative space-y-5" noValidate>
      <FormBanner state={state} />
      <SpamFields />

      <Field label="Email" htmlFor="accountEmail" required error={fieldError(state, 'email')}>
        <Input
          id="accountEmail"
          name="email"
          type="email"
          defaultValue={defaultEmail}
          autoComplete="email"
          required
          invalid={Boolean(fieldError(state, 'email'))}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        hint={`At least ${PASSWORD_MIN_LENGTH} characters, with upper and lower case and a number`}
        error={fieldError(state, 'password')}
      >
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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
          {/* Announced politely so screen-reader users get the same feedback. */}
          <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400" aria-live="polite">
            Password strength: {PASSWORD_STRENGTH_LABELS[strength]}
          </p>
        </div>
      ) : null}

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        required
        error={fieldError(state, 'confirmPassword')}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          invalid={Boolean(fieldError(state, 'confirmPassword'))}
        />
      </Field>

      <div className="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <Checkbox
          id="acceptedTerms"
          name="acceptedTerms"
          error={fieldError(state, 'acceptedTerms')}
          label={
            <>
              I agree to the{' '}
              <Link href="/legal/terms" className="font-medium text-accent-700 underline dark:text-accent-300">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/legal/privacy" className="font-medium text-accent-700 underline dark:text-accent-300">
                Privacy Policy
              </Link>
              .
            </>
          }
        />
        <Checkbox
          id="marketingOptIn"
          name="marketingOptIn"
          label="Send me product announcements. (Optional — you can change this any time.)"
        />
      </div>

      <div className="flex gap-3">
        <Link
          href="/signup?step=representative"
          className="inline-flex h-12 items-center justify-center rounded-lg px-6 text-base font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 dark:text-neutral-300 dark:ring-neutral-700"
        >
          Back
        </Link>
        <SubmitButton size="lg" className="flex-1">
          Create account
        </SubmitButton>
      </div>

      <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
        Free to start — no card required.
      </p>
    </form>
  );
}
