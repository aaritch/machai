'use client';

import { useActionState } from 'react';
import { CONTACT_MESSAGE_MAX, TICKET_CATEGORIES, TICKET_CATEGORY_LABELS } from '@machai/types';
import { Field, Input, Select, Textarea } from '@machai/ui';
import { IDLE_STATE } from '@/lib/form';
import { submitContactForm } from '@/server/actions/contact';
import { FormBanner, SpamFields, SubmitButton, fieldError } from '@/components/forms/form-parts';

/** "Send us a message" (spec §5.4). Submission creates a real support ticket. */
export function ContactForm({ defaultCategory }: { defaultCategory?: string }) {
  const [state, action] = useActionState(submitContactForm, IDLE_STATE);

  // A successful submission replaces the form: leaving it filled invites a
  // duplicate submit, and the confirmation carries the ticket reference.
  if (state.status === 'success') {
    return <FormBanner state={state} />;
  }

  return (
    <form action={action} className="relative space-y-5" noValidate>
      <FormBanner state={state} />
      <SpamFields />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" required error={fieldError(state, 'firstName')}>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            required
            invalid={Boolean(fieldError(state, 'firstName'))}
          />
        </Field>
        <Field label="Last name" htmlFor="lastName" required error={fieldError(state, 'lastName')}>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            required
            invalid={Boolean(fieldError(state, 'lastName'))}
          />
        </Field>
      </div>

      <Field label="Email" htmlFor="email" required error={fieldError(state, 'email')}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          invalid={Boolean(fieldError(state, 'email'))}
        />
      </Field>

      <Field label="Phone" htmlFor="phone" hint="Optional" error={fieldError(state, 'phone')}>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="numeric" />
      </Field>

      <Field label="What is this about?" htmlFor="category" error={fieldError(state, 'category')}>
        <Select id="category" name="category" defaultValue={defaultCategory ?? 'other'}>
          {TICKET_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {TICKET_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Message"
        htmlFor="message"
        required
        hint={`Up to ${CONTACT_MESSAGE_MAX.toLocaleString()} characters`}
        error={fieldError(state, 'message')}
      >
        <Textarea
          id="message"
          name="message"
          required
          maxLength={CONTACT_MESSAGE_MAX}
          invalid={Boolean(fieldError(state, 'message'))}
        />
      </Field>

      <SubmitButton size="lg">Send message</SubmitButton>
    </form>
  );
}
