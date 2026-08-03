import type { Metadata } from 'next';
import { brand } from '@machai/config/public';
import { Alert } from '@machai/ui';
import { Markdown } from '@/components/markdown';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  robots: { index: true, follow: false },
};

/** Placeholder Privacy Policy pending legal review (TASK-01). */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        Last updated: not yet published
      </p>

      <div className="mt-6">
        <Alert tone="warning" title="Draft — pending legal review">
          This is placeholder content describing our intended practices. It must be replaced with a
          counsel-reviewed policy before launch.
        </Alert>
      </div>

      <div className="mt-8">
        <Markdown source={PRIVACY_DRAFT.replaceAll('{{BRAND}}', brand.name)} />
      </div>
    </div>
  );
}

const PRIVACY_DRAFT = `## What we collect

**Account information.** Your name, email address, and password (stored only as a cryptographic
hash — we cannot read it).

**Business information.** Your business's legal name, trading name, address, phone number, entity
type, and Employer Identification Number.

**Representative information.** The name, title, contact details, and ownership percentage of the
person authorised to act for the business.

**Billing information.** Handled by our payment processor. Card numbers never reach our servers; we
store only the card brand and last four digits, for display.

**Credit data.** Reports and scores retrieved from commercial bureaus at your request, retained so
you can see history over time.

**Usage and security data.** Log data, IP address, and device information, used for security,
abuse prevention, and diagnostics.

## What we deliberately do not collect

We do not ask for a Social Security number. The service is built around your business identity.

## How your EIN is protected

Your EIN is encrypted before it is stored, using a key unique to that record which is itself
protected by a key management service. It is excluded from application logs, analytics, and error
reports. Interfaces show only the last four digits. Every access to the full value is recorded in
an audit trail.

## How we use your information

To operate your account, retrieve and display your credit file at your request, process payments,
send transactional messages, provide support, prevent fraud and abuse, and meet legal obligations.

We send marketing messages only if you opt in, and you can withdraw that at any time from your
settings. We do not sell your personal information.

## Who we share it with

**Credit bureaus**, when you request a report, limited to what is needed to identify your business.
**Our payment processor**, for billing. **Infrastructure providers** who host and operate the
service under contract. **Law enforcement or regulators**, where legally required.

## Retention

Account and business records are kept while your account is open. Credit reports and audit records
are retained for the periods our legal obligations require, which may extend past account closure.
Closing your account removes your data on a defined schedule, except records we are required to
keep.

## Your rights

You can access, correct, export, or delete your information, and object to certain processing,
subject to legal retention requirements. Requests can be made from your settings or through our
contact page, and are answered within the period the applicable law requires.

## Cookies

We use cookies that are strictly necessary to keep you signed in and to protect the service. We do
not use advertising cookies.

## Contact

Privacy questions can be sent through our contact page.`;
