'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, type ButtonProps } from '@machai/ui';
import type { FormState } from '@/lib/form';

/**
 * Shared form parts.
 *
 * The honeypot and render-timestamp pair here are what the server's spam check
 * reads. Putting them in one component means a new public form cannot
 * accidentally ship without them.
 */

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? 'Working…' : children}
    </Button>
  );
}

/**
 * Honeypot + timing fields.
 *
 * The honeypot is hidden from sight AND from assistive technology: `aria-hidden`
 * plus `tabIndex={-1}` keep screen-reader users from ever encountering a field
 * that would fail their submission. `display: none` alone is skipped by some
 * bots, hence the off-screen positioning instead.
 */
export function SpamFields() {
  const [renderedAt, setRenderedAt] = useState('');

  // Set on the client after mount so a cached HTML response cannot ship a stale
  // timestamp that instantly fails the minimum-fill-time check.
  useEffect(() => {
    setRenderedAt(String(Date.now()));
  }, []);

  return (
    <>
      <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      <input type="hidden" name="renderedAt" value={renderedAt} />
    </>
  );
}

/** Renders the action's result banner and moves focus to it for announcement. */
export function FormBanner({ state }: { state: FormState }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status !== 'idle') ref.current?.focus();
  }, [state]);

  if (state.status === 'idle' || !state.message) return null;

  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      <Alert tone={state.status === 'success' ? 'success' : 'danger'}>{state.message}</Alert>
    </div>
  );
}

/** First error for a field, if the action returned one. */
export function fieldError(state: FormState, name: string): string | undefined {
  return state.fieldErrors?.[name]?.[0];
}
