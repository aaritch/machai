import type { AchievementCriteria } from '../schema/engagement';

/**
 * Seed content.
 *
 * Everything here is editable through the admin surface after seeding — the
 * seed only guarantees a usable starting state, so a fresh environment has a
 * working pricing page, help center, and checklist.
 */

export const CHECKLIST_ITEMS = [
  {
    key: 'ein_obtained',
    title: 'Get your EIN from the IRS',
    description:
      'Your Employer Identification Number is the foundation of a business credit file. It is free and issued the same day online.',
    category: 'foundation',
    points: 10,
    displayOrder: 1,
  },
  {
    key: 'entity_registered',
    title: 'Register your business entity',
    description:
      'An LLC or corporation separates you from the business legally — bureaus build a file against the entity, not against you.',
    category: 'foundation',
    points: 10,
    displayOrder: 2,
  },
  {
    key: 'business_bank_account',
    title: 'Open a dedicated business bank account',
    description:
      'Separate finances are what make business credit possible. Commingled accounts undermine every later step.',
    category: 'foundation',
    points: 10,
    displayOrder: 3,
  },
  {
    key: 'duns_number',
    title: 'Request a D-U-N-S number',
    description:
      'Dun & Bradstreet issues D-U-N-S numbers free of charge. Many suppliers and lenders look for one before extending terms.',
    category: 'foundation',
    points: 15,
    displayOrder: 4,
  },
  {
    key: 'business_phone_listed',
    title: 'List a business phone and address',
    description:
      'Bureaus corroborate your file against public listings. A consistent, listed phone and address reduce mismatches.',
    category: 'foundation',
    points: 5,
    displayOrder: 5,
  },
  {
    key: 'net30_vendor_1',
    title: 'Open your first Net-30 vendor account',
    description:
      'Net-30 trade accounts are the most common first tradeline. Pay early and the account reports positively.',
    category: 'tradelines',
    points: 20,
    displayOrder: 6,
  },
  {
    key: 'net30_vendor_3',
    title: 'Build to three reporting vendor accounts',
    description:
      'A single tradeline is thin. Three reporting accounts give the bureaus enough history to score you.',
    category: 'tradelines',
    points: 25,
    displayOrder: 7,
  },
  {
    key: 'business_credit_card',
    title: 'Open a business credit card in the business name',
    description:
      'Look for issuers that report to commercial bureaus rather than to your personal file.',
    category: 'tradelines',
    points: 20,
    displayOrder: 8,
  },
  {
    key: 'pay_early',
    title: 'Pay every account before its due date',
    description:
      'Commercial scores weight payment timing heavily. Paying early scores better than paying on time.',
    category: 'habits',
    points: 15,
    displayOrder: 9,
  },
  {
    key: 'monitor_monthly',
    title: 'Review your report every month',
    description:
      'Errors on a business file are common and will not fix themselves. Catching one early is the cheapest fix available.',
    category: 'habits',
    points: 10,
    displayOrder: 10,
  },
  {
    key: 'utilization_low',
    title: 'Keep revolving balances well under the limit',
    description:
      'High utilization reads as strain. Keeping balances low is one of the few levers with a fast effect.',
    category: 'habits',
    points: 10,
    displayOrder: 11,
  },
  {
    key: 'dispute_errors',
    title: 'Dispute anything inaccurate on your file',
    description:
      'You have the right to have inaccurate information investigated. Start a dispute from the report screen.',
    category: 'habits',
    points: 10,
    displayOrder: 12,
  },
] as const;

export const ACHIEVEMENTS: Array<{
  key: string;
  title: string;
  description: string;
  icon: string;
  criteria: AchievementCriteria;
  displayOrder: number;
}> = [
  {
    key: 'account_verified',
    title: 'Verified',
    description: 'You confirmed your email address.',
    icon: 'check-circle',
    criteria: { type: 'email_verified' },
    displayOrder: 1,
  },
  {
    key: 'business_on_file',
    title: 'On the Record',
    description: 'You added your business profile.',
    icon: 'building',
    criteria: { type: 'business_added' },
    displayOrder: 2,
  },
  {
    key: 'identity_confirmed',
    title: 'Identity Confirmed',
    description: 'Your business passed verification.',
    icon: 'shield-check',
    criteria: { type: 'kyb_verified' },
    displayOrder: 3,
  },
  {
    key: 'subscriber',
    title: 'Plan Active',
    description: 'You activated a plan and unlocked live bureau data.',
    icon: 'sparkles',
    criteria: { type: 'subscription_active' },
    displayOrder: 4,
  },
  {
    key: 'first_pull',
    title: 'First Look',
    description: 'You pulled your first live credit report.',
    icon: 'file-search',
    criteria: { type: 'first_report_pulled' },
    displayOrder: 5,
  },
  {
    key: 'regular_reviewer',
    title: 'Regular Reviewer',
    description: 'You have pulled six reports.',
    icon: 'calendar-check',
    criteria: { type: 'reports_pulled', count: 6 },
    displayOrder: 6,
  },
  {
    key: 'checklist_starter',
    title: 'Getting Organized',
    description: 'You completed three checklist steps.',
    icon: 'list-checks',
    criteria: { type: 'checklist_items_completed', count: 3 },
    displayOrder: 7,
  },
  {
    key: 'checklist_halfway',
    title: 'Halfway There',
    description: 'You completed six checklist steps.',
    icon: 'list-checks',
    criteria: { type: 'checklist_items_completed', count: 6 },
    displayOrder: 8,
  },
  {
    key: 'foundation_complete',
    title: 'Foundation Laid',
    description: 'You completed ten checklist steps.',
    icon: 'landmark',
    criteria: { type: 'checklist_items_completed', count: 10 },
    displayOrder: 9,
  },
  {
    key: 'tradeline_tracker',
    title: 'Tracking Trade',
    description: 'You are tracking three tradelines.',
    icon: 'receipt',
    criteria: { type: 'tradelines_tracked', count: 3 },
    displayOrder: 10,
  },
  {
    key: 'perfect_payments',
    title: 'Perfect Payments',
    description: 'Every tradeline you track is current.',
    icon: 'trophy',
    criteria: { type: 'all_tradelines_current', minimumTradelines: 3 },
    displayOrder: 11,
  },
  {
    key: 'six_months',
    title: 'Six Months In',
    description: 'You have been building for six months.',
    icon: 'flame',
    criteria: { type: 'months_active', count: 6 },
    displayOrder: 12,
  },
];

export const FAQS = [
  {
    question: 'Do I need to give you my Social Security number?',
    answer:
      'No. We build your file against your business identity — your EIN — and we do not collect a Social Security number at signup. That is the whole point of the product.',
    category: 'getting-started',
    displayOrder: 1,
  },
  {
    question: 'What is business credit, and how is it different from personal credit?',
    answer:
      'Business credit is a file held against your business entity rather than against you as an individual. Commercial bureaus score it on different scales and weight supplier payment history heavily. A strong business file lets a company borrow and buy on terms without leaning on the owner’s personal score.',
    category: 'getting-started',
    displayOrder: 2,
  },
  {
    question: 'How long does it take to build a business credit file?',
    answer:
      'It depends on your activity, not on us. A file typically appears once a few suppliers or lenders report activity against your business — often a few months after your first reporting trade account. We cannot promise a timeline or a score.',
    category: 'getting-started',
    displayOrder: 3,
  },
  {
    question: 'Which bureaus can I pull a report from?',
    answer:
      'Your plan determines your bureau coverage. Foundation includes one bureau of your choice; Growth and Premier include more. The bureaus currently available are listed on the pricing page and in your dashboard.',
    category: 'credit-reporting',
    displayOrder: 4,
  },
  {
    question: 'Do you report my payments to the bureaus?',
    answer:
      'Only where we have been approved as a data furnisher by that specific bureau. Furnisher approval is a separate application and credentialing process for each bureau, and we do not claim reporting we have not been approved for. Any bureau not yet approved is shown as roadmap.',
    category: 'credit-reporting',
    displayOrder: 5,
  },
  {
    question: 'Why does my report say “no file”?',
    answer:
      'It means that bureau has no record of your business yet — which is normal for a newer company. It is not an error. The credit checklist in your dashboard walks through the steps that cause a file to be established.',
    category: 'credit-reporting',
    displayOrder: 6,
  },
  {
    question: 'Can you guarantee my score will go up?',
    answer:
      'No, and you should be sceptical of anyone who does. Scores are set by each bureau from your business’s actual activity. We give you the data, the tracking, and the checklist; the payment behaviour is yours.',
    category: 'credit-reporting',
    displayOrder: 7,
  },
  {
    question: 'How do I change or cancel my plan?',
    answer:
      'From Subscriptions & Billing in your dashboard. Upgrades apply immediately with a prorated charge; downgrades take effect at the start of your next billing cycle. Cancelling stops the renewal and you keep access until the period ends.',
    category: 'billing',
    displayOrder: 8,
  },
  {
    question: 'What happens if a payment fails?',
    answer:
      'We retry automatically over several days and email you. Your access continues during that grace window. If every retry fails the subscription cancels and the account returns to the free tier — your data stays put.',
    category: 'billing',
    displayOrder: 9,
  },
  {
    question: 'Something on my report is wrong. What can I do?',
    answer:
      'Open a dispute from the report or tradeline in question. We record the dispute, track the investigation, and log the outcome. You also have the right to dispute directly with the bureau.',
    category: 'disputes',
    displayOrder: 10,
  },
  {
    question: 'I cannot get into my account.',
    answer:
      'Use the password reset link on the login page. If the email never arrives, check spam, then contact support and we will help you recover access.',
    category: 'account-access',
    displayOrder: 11,
  },
  {
    question: 'How do you protect my EIN?',
    answer:
      'Your EIN is encrypted at rest with a per-record key, is never written to logs or error traces, and is only ever displayed to you. Every access is recorded in an audit trail.',
    category: 'account-access',
    displayOrder: 12,
  },
];

export const HELP_ARTICLES = [
  {
    slug: 'getting-started',
    title: 'Getting started with your business credit file',
    excerpt: 'What to do in your first week, in order.',
    category: 'getting-started',
    displayOrder: 1,
    bodyMarkdown: `## Your first week

Business credit is built in a specific order, and skipping steps is the usual reason a file never forms.

### 1. Establish the entity

Register the business and get your EIN from the IRS. Both are free or close to it. A sole proprietorship without an EIN has no separate identity for a bureau to build a file against.

### 2. Separate the money

Open a business bank account and stop paying business expenses from personal accounts. Commingled finances undermine every later step and are the first thing an underwriter looks for.

### 3. Make yourself findable

List a business phone number and address. Bureaus corroborate your file against public records; a business they cannot find is a business they cannot score.

### 4. Get a D-U-N-S number

Dun & Bradstreet issues these free. Many suppliers check for one before offering terms.

### 5. Open your first trade account

A Net-30 supplier account is the usual first tradeline. Pay it early — commercial scoring weights payment timing heavily, and early beats on-time.

Work the credit checklist in your dashboard; it tracks all of this and awards progress as you go.`,
  },
  {
    slug: 'how-scores-work',
    title: 'How commercial credit scores work',
    excerpt: 'Different bureaus, different scales, different inputs.',
    category: 'credit-reporting',
    displayOrder: 2,
    bodyMarkdown: `## Different bureaus, different scales

There is no single "business credit score". Each commercial bureau maintains its own file and its own scale, and a number from one tells you very little about another.

| Bureau | Typical scale | Weighted toward |
|---|---|---|
| Creditsafe | 0–100 | Payment behaviour, company age, financial strength |
| Equifax Business | 0–650 | Payment history, credit utilisation, public records |
| Dun & Bradstreet | 0–100 (PAYDEX) | Supplier payment timing |

Because the scales differ, we always show the scale next to the number and chart each bureau as its own line. Comparing a 78 on one scale to a 78 on another is meaningless.

## What moves the number

- **Payment timing.** The dominant input. Paying before the due date scores better than paying on it.
- **Number of reporting tradelines.** A file with one account is thin and scores conservatively.
- **Utilisation.** High balances against limits read as strain.
- **Public records.** Liens, judgments, and filings weigh heavily and persist.
- **Company age and size.** Not something you can act on, but it is in the model.

## What does not move it

Checking your own report does not affect your score. Neither does paying a subscription to any service, including this one.`,
  },
  {
    slug: 'no-file-explained',
    title: 'Your report says “no file” — what that means',
    excerpt: 'A missing file is a normal starting point, not an error.',
    category: 'credit-reporting',
    displayOrder: 3,
    bodyMarkdown: `## "No file" is a starting point

When a pull returns *no file*, the bureau has no record of your business. For a company that has not yet bought on terms from a reporting supplier, that is the expected result — not a failure, and not something to dispute.

## How a file gets created

A file is created when someone who extends you credit reports the account. That is usually:

- a supplier offering Net-30 terms who reports to a commercial bureau,
- a business credit card issuer that reports commercially rather than personally,
- a lender or equipment financer.

Not every supplier reports. Before opening an account, ask which bureaus they report to — it is a normal question, and the answer determines whether the account does anything for your file.

## What to do next

Work through the foundation section of your credit checklist, then open one or two reporting trade accounts. Re-pull in 30–60 days. Files typically appear after the first reporting account cycles.`,
  },
  {
    slug: 'billing-and-plans',
    title: 'Billing, plans, and changing your subscription',
    excerpt: 'Proration, downgrades, failed payments, and invoices.',
    category: 'billing',
    displayOrder: 4,
    bodyMarkdown: `## Changing plans

**Upgrades apply immediately** and you are charged a prorated amount for the remainder of the current period.

**Downgrades take effect at the next billing cycle.** You keep the higher plan's features until the period you already paid for ends.

Both are handled from Subscriptions & Billing in your dashboard.

## Payment methods

Card details are entered on Stripe's own pages and never touch our servers. We store only the brand and last four digits, for display.

## When a payment fails

Stripe retries a failed payment several times over a few days and emails you each time. Your access continues during that window and a banner appears prompting you to update the card. If every retry fails, the subscription cancels and the account returns to the free tier. Nothing is deleted.

## Invoices

Every invoice is listed under Billing History with a PDF. Stripe-hosted invoices are the system of record for your accounting.`,
  },
  {
    slug: 'disputing-an-error',
    title: 'Disputing something inaccurate on your file',
    excerpt: 'How to file, what happens next, and what to expect.',
    category: 'disputes',
    displayOrder: 5,
    bodyMarkdown: `## Filing a dispute

Errors on commercial files are common — mismatched addresses, accounts belonging to a similarly named company, balances that were paid but never updated.

Open the report or tradeline in your dashboard and choose **Dispute**. Describe specifically what is wrong and what the correct information is. Vague disputes get rejected; specific ones get investigated.

## What happens next

1. We record the dispute and open an investigation with a target date.
2. We contact the source of the disputed information.
3. The outcome is recorded against the dispute and you are notified.

## Your direct rights

You can also dispute directly with the bureau that holds the file, and you retain that right regardless of anything we do. For information we furnish ourselves, we are obliged to investigate and to correct anything found inaccurate.`,
  },
  {
    slug: 'protecting-your-data',
    title: 'How we protect your business data',
    excerpt: 'Encryption, access control, and what we deliberately do not collect.',
    category: 'account-access',
    displayOrder: 6,
    bodyMarkdown: `## What we do not collect

We do not ask for a Social Security number. The product is built around your EIN, and data we never collect cannot be exposed.

## How your EIN is stored

Your EIN is encrypted with a key unique to that record, which is itself wrapped by a master key held in a key management service. It is never written to application logs, analytics, or error traces. Lists and support screens show only the last four digits.

## Access and audit

Access to your data is limited to your own account. Staff access is role-restricted and requires multi-factor authentication. Sensitive actions — viewing an EIN, pulling a report, changing a plan — are written to an append-only audit trail that records who did what, and when, by reference rather than by value.

## Files

Report PDFs are stored privately and reachable only through short-lived signed links. There is no public URL for your report.`,
  },
];

export const MARKETPLACE_ITEMS = [
  {
    slug: 'net30-vendor-list',
    title: 'Starter Net-30 vendor list',
    type: 'vendor' as const,
    description:
      'Suppliers that commonly extend Net-30 terms to newer businesses and report to commercial bureaus.',
    accessLevel: 1,
    displayOrder: 1,
  },
  {
    slug: 'business-credit-course',
    title: 'Business credit fundamentals (course)',
    type: 'course' as const,
    description: 'Six short lessons covering entity setup, trade credit, and reading your file.',
    accessLevel: 1,
    displayOrder: 2,
  },
  {
    slug: 'lender-readiness-checklist',
    title: 'Lender readiness checklist',
    type: 'resource' as const,
    description: 'What underwriters look for before approving a business line of credit.',
    accessLevel: 2,
    displayOrder: 3,
  },
  {
    slug: 'advanced-tradeline-strategy',
    title: 'Advanced tradeline strategy',
    type: 'course' as const,
    description: 'Sequencing trade accounts and managing utilisation across a growing file.',
    accessLevel: 2,
    displayOrder: 4,
  },
  {
    slug: 'analytics-playbook',
    title: 'Portfolio analytics playbook',
    type: 'resource' as const,
    description: 'Reading trend data across multiple entities and reporting periods.',
    accessLevel: 3,
    displayOrder: 5,
  },
];

export const PRODUCTS = [
  {
    slug: 'ai-business-plan',
    title: 'AI-assisted business plan',
    description:
      'A lender-ready business plan drafted from your profile and financials, delivered as an editable document.',
    priceCents: 14900,
    displayOrder: 1,
  },
  {
    slug: 'credit-file-review',
    title: 'One-on-one credit file review',
    description:
      'A 45-minute session with a specialist walking through your file and the specific next actions for it.',
    priceCents: 19900,
    displayOrder: 2,
  },
];
