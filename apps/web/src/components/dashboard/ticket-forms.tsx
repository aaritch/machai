'use client';

import { useActionState } from 'react';
import { CONTACT_MESSAGE_MAX, TICKET_CATEGORIES, TICKET_CATEGORY_LABELS } from '@machai/types';
import { Field, Input, Select, Textarea } from '@machai/ui';
import { IDLE_STATE } from '@/lib/form';
import { createTicketAction, replyToTicketAction } from '@/server/actions/dashboard';
import { FormBanner, SubmitButton, fieldError } from '@/components/forms/form-parts';

export function NewTicketForm() {
  const [state, action] = useActionState(createTicketAction, IDLE_STATE);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormBanner state={state} />

      <Field label="Subject" htmlFor="subject" required error={fieldError(state, 'subject')}>
        <Input id="subject" name="subject" required invalid={Boolean(fieldError(state, 'subject'))} />
      </Field>

      <Field label="Category" htmlFor="category" required>
        <Select id="category" name="category" defaultValue="other">
          {TICKET_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {TICKET_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Message" htmlFor="message" required error={fieldError(state, 'message')}>
        <Textarea
          id="message"
          name="message"
          required
          maxLength={CONTACT_MESSAGE_MAX}
          invalid={Boolean(fieldError(state, 'message'))}
        />
      </Field>

      <SubmitButton>Open ticket</SubmitButton>
    </form>
  );
}

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action] = useActionState(replyToTicketAction, IDLE_STATE);

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormBanner state={state} />
      <input type="hidden" name="ticketId" value={ticketId} />
      <Field label="Your reply" htmlFor="body" required error={fieldError(state, 'body')}>
        <Textarea id="body" name="body" required maxLength={CONTACT_MESSAGE_MAX} />
      </Field>
      <SubmitButton>Send reply</SubmitButton>
    </form>
  );
}
