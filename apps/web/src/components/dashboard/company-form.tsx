'use client';

import { useActionState } from 'react';
import { ENTITY_TYPES, ENTITY_TYPE_LABELS, US_STATES } from '@machai/types';
import { Field, Input, Select } from '@machai/ui';
import { IDLE_STATE } from '@/lib/form';
import { updateCompanyAction } from '@/server/actions/dashboard';
import { FormBanner, SubmitButton, fieldError } from '@/components/forms/form-parts';

export interface CompanyDefaults {
  legalName: string;
  dbaName: string;
  streetAddress: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  entityType: string;
  website: string;
}

export function CompanyForm({ defaults }: { defaults: CompanyDefaults }) {
  const [state, action] = useActionState(updateCompanyAction, IDLE_STATE);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormBanner state={state} />

      <Field label="Business name" htmlFor="legalName" required error={fieldError(state, 'legalName')}>
        <Input id="legalName" name="legalName" defaultValue={defaults.legalName} required />
      </Field>

      <Field label="D.B.A / trade name" htmlFor="dbaName" hint="Optional">
        <Input id="dbaName" name="dbaName" defaultValue={defaults.dbaName} />
      </Field>

      <Field label="Street address" htmlFor="streetAddress" required error={fieldError(state, 'streetAddress')}>
        <Input id="streetAddress" name="streetAddress" defaultValue={defaults.streetAddress} required />
      </Field>

      <Field label="Address line 2" htmlFor="addressLine2" hint="Optional">
        <Input id="addressLine2" name="addressLine2" defaultValue={defaults.addressLine2} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="City" htmlFor="city" required error={fieldError(state, 'city')}>
          <Input id="city" name="city" defaultValue={defaults.city} required />
        </Field>
        <Field label="State" htmlFor="state" required error={fieldError(state, 'state')}>
          <Select id="state" name="state" defaultValue={defaults.state} required>
            {US_STATES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ZIP" htmlFor="zip" required error={fieldError(state, 'zip')}>
          <Input id="zip" name="zip" defaultValue={defaults.zip} inputMode="numeric" required />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone" required hint="10 digits" error={fieldError(state, 'phone')}>
          <Input id="phone" name="phone" defaultValue={defaults.phone} inputMode="numeric" required />
        </Field>
        <Field label="Business entity type" htmlFor="entityType" required>
          <Select id="entityType" name="entityType" defaultValue={defaults.entityType} required>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {ENTITY_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Website" htmlFor="website" hint="Optional — helps bureaus corroborate your file">
        <Input id="website" name="website" defaultValue={defaults.website} placeholder="https://" />
      </Field>

      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}
