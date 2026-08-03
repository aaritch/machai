'use client';

import { useActionState } from 'react';
import { Field, Select, Textarea } from '@machai/ui';
import { IDLE_STATE } from '@/lib/form';
import { submitFeedbackAction } from '@/server/actions/dashboard';
import { FormBanner, SubmitButton, fieldError } from '@/components/forms/form-parts';

const RATING_LABELS = ['Very poor', 'Poor', 'Fine', 'Good', 'Excellent'];

export function FeedbackForm() {
  const [state, action] = useActionState(submitFeedbackAction, IDLE_STATE);

  if (state.status === 'success') return <FormBanner state={state} />;

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormBanner state={state} />

      <Field label="How is it going so far?" htmlFor="rating" required>
        <Select id="rating" name="rating" defaultValue="4">
          {RATING_LABELS.map((label, index) => (
            <option key={label} value={index + 1}>
              {index + 1} — {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="What would you change?" htmlFor="message" required error={fieldError(state, 'message')}>
        <Textarea id="message" name="message" required invalid={Boolean(fieldError(state, 'message'))} />
      </Field>

      <SubmitButton>Send feedback</SubmitButton>
    </form>
  );
}
