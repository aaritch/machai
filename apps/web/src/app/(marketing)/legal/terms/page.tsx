import type { Metadata } from 'next';
import { brand } from '@machai/config/public';
import { Alert } from '@machai/ui';
import { Markdown } from '@/components/markdown';

export const metadata: Metadata = {
  title: 'Terms of Service',
  robots: { index: true, follow: false },
};

/**
 * Placeholder Terms pending legal review (TASK-01: "Publish Terms of Service
 * and Privacy Policy pages (placeholder content pending legal)").
 *
 * The banner is deliberate and must stay until counsel signs off. Shipping
 * unreviewed legal text without marking it as such is worse than shipping
 * nothing, because it reads as binding.
 */
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        Last updated: not yet published
      </p>

      <div className="mt-6">
        <Alert tone="warning" title="Draft — pending legal review">
          This is placeholder content and is not the operative agreement. It must be replaced with
          counsel-reviewed terms before launch.
        </Alert>
      </div>

      <div className="mt-8">
        <Markdown source={TERMS_DRAFT.replaceAll('{{BRAND}}', brand.name)} />
      </div>
    </div>
  );
}

const TERMS_DRAFT = `## 1. What this service is

{{BRAND}} provides tools to view, monitor, and track a business credit file, along with
educational content and record-keeping features. We are not a lender, not a credit repair
organization, and not a credit bureau.

## 2. What this service is not

We do not guarantee any credit score, credit limit, or funding outcome. We do not offer to remove
accurate information from any credit file. We do not sell tradelines, and we do not create credit
accounts on your behalf.

## 3. Eligibility and accuracy of information

You must be authorised to act for the business you register, and you must hold at least the
ownership stake you attest to. The information you provide about your business must be accurate.
We may verify your business identity and may suspend access where verification fails.

## 4. Plans, billing, and cancellation

Paid plans bill monthly in advance through our payment processor. Upgrades take effect immediately
with a prorated charge; downgrades take effect at the start of the next billing period.
Cancellation stops future renewals and access continues to the end of the period already paid for.
Fees already charged are not refundable except where required by law.

## 5. Reporting to the bureaus

We submit your payment activity to the commercial bureaus your plan covers, on a monthly cycle,
and only for a business you are authorised to act for. Each bureau decides independently what it
accepts, how it presents it, and how it scores it. We do not control those decisions and cannot
promise a score, a rating, or a funding outcome.

You are responsible for the accuracy of the information you give us. If something we have reported
is inaccurate, tell us and we will investigate and correct the record. You may also raise a dispute
directly with the bureau, and that right is unaffected by anything in these terms.

## 6. Acceptable use

You may not attempt to access another customer's data, probe or circumvent our access controls,
scrape the service, or use it to build a credit file for a business you do not control.

## 7. Your data

Our handling of your information is described in the Privacy Policy. You may export your data and
close your account at any time; some records are retained where law requires.

## 8. Availability and liability

The service is provided as-is. We do not warrant uninterrupted availability, nor the accuracy or
completeness of data supplied by third-party bureaus. Our aggregate liability is limited to the
fees you paid in the twelve months preceding the claim, except where such limitation is not
permitted by law.

## 9. Changes

We may update these terms. Material changes will be notified in advance by email or in the
application.

## 10. Contact

Questions about these terms can be sent through our contact page.`;
