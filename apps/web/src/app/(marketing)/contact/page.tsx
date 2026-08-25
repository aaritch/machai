import type { Metadata } from 'next';
import { brand } from '@machai/config/public';
import { Card, CardBody } from '@machai/ui';
import { ContactForm } from '@/components/marketing/contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Get in touch with ${brand.name}. Billing, reporting, onboarding, and account access questions.`,
};

/** Contact page (spec §5.4 / pic2). Two columns: info, then the message form. */
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  const isEnterprise = topic === 'enterprise';

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Contact {brand.name} — we’re here to help
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
            {isEnterprise
              ? 'Tell us about your business and what you need covered, and we will put together a Premier plan that fits.'
              : 'Every message becomes a tracked ticket, so nothing gets lost in an inbox. Tell us what you need and we will pick it up.'}
          </p>

          <dl className="mt-10 space-y-6">
            <InfoBlock label="Email" value={brand.supportEmail} />
            <InfoBlock label="Response time" value={brand.responseTime} />
            <InfoBlock label="Hours" value={brand.hours} />
            <InfoBlock label="Support scope" value={brand.supportScope} />
          </dl>

          <Card className="mt-10">
            <CardBody className="p-6">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
                What happens after you send this
              </h2>
              <ol className="mt-4 space-y-3">
                {[
                  'Your message becomes a support ticket with its own reference number.',
                  'You get an automatic acknowledgement with that reference straight away.',
                  'A person reads it and replies — usually within one business day.',
                  'If you have an account, the whole thread shows up under Support Tickets.',
                ].map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm text-neutral-700 dark:text-neutral-300">
                    <span
                      aria-hidden="true"
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-50 text-xs font-semibold text-accent-800 dark:bg-accent-900/40 dark:text-accent-200"
                    >
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <Card className="self-start">
          <CardBody className="p-7">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
              Send us a message
            </h2>
            <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
              Fields marked with an asterisk are required.
            </p>
            <div className="mt-6">
              <ContactForm defaultCategory={isEnterprise ? 'billing' : undefined} />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
        {value}
      </dd>
    </div>
  );
}
