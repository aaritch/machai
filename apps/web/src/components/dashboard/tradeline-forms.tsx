'use client';

import { useActionState } from 'react';
import {
  BUREAUS,
  BUREAU_LABELS,
  TRADELINE_ACCOUNT_TYPES,
  TRADELINE_PAYMENT_STATUSES,
} from '@machai/types';
import { Button, Checkbox, Field, Input, Select } from '@machai/ui';
import { IDLE_STATE } from '@/lib/form';
import { addTradelineAction, deleteTradelineAction } from '@/server/actions/dashboard';
import { FormBanner, SubmitButton, fieldError } from '@/components/forms/form-parts';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  net30: 'Net-30 vendor account',
  revolving: 'Revolving (credit card / line)',
  installment: 'Installment (loan / lease)',
  vendor: 'Vendor account',
  other: 'Other',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  current: 'Current',
  late_30: '30 days late',
  late_60: '60 days late',
  late_90: '90+ days late',
  collections: 'In collections',
};

export function AddTradelineForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(addTradelineAction, IDLE_STATE);

  if (disabled) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Add your business details first, then you can track accounts here.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormBanner state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Creditor name"
          htmlFor="creditorName"
          required
          error={fieldError(state, 'creditorName')}
        >
          <Input
            id="creditorName"
            name="creditorName"
            required
            invalid={Boolean(fieldError(state, 'creditorName'))}
          />
        </Field>
        <Field label="Account type" htmlFor="accountType" required>
          <Select id="accountType" name="accountType" defaultValue="net30">
            {TRADELINE_ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ACCOUNT_TYPE_LABELS[type] ?? type}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Date opened" htmlFor="dateOpened" hint="Optional" error={fieldError(state, 'dateOpened')}>
          <Input id="dateOpened" name="dateOpened" type="date" />
        </Field>
        <Field label="Credit limit" htmlFor="creditLimitCents" hint="Optional, in dollars">
          <Input id="creditLimitCents" name="creditLimitCents" inputMode="decimal" placeholder="5000" />
        </Field>
        <Field label="Current balance" htmlFor="currentBalanceCents" hint="Optional, in dollars">
          <Input id="currentBalanceCents" name="currentBalanceCents" inputMode="decimal" placeholder="1200" />
        </Field>
      </div>

      <Field label="Payment status" htmlFor="paymentStatus" required>
        <Select id="paymentStatus" name="paymentStatus" defaultValue="current">
          {TRADELINE_PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PAYMENT_STATUS_LABELS[status] ?? status}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset>
        <legend className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Reporting to
        </legend>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Tick the bureaus you know this account reports to. Leave blank if you are not sure.
        </p>
        <div className="mt-3 space-y-2">
          {BUREAUS.map((bureau) => (
            <Checkbox
              key={bureau}
              id={`reportedTo-${bureau}`}
              name="reportedTo"
              value={bureau}
              label={BUREAU_LABELS[bureau]}
            />
          ))}
        </div>
      </fieldset>

      <SubmitButton>Add tradeline</SubmitButton>
    </form>
  );
}

export function DeleteTradelineButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={deleteTradelineAction}>
      <input type="hidden" name="tradelineId" value={id} />
      <Button type="submit" variant="ghost" size="sm">
        <span className="sr-only">Remove {name}</span>
        <span aria-hidden="true">Remove</span>
      </Button>
    </form>
  );
}
