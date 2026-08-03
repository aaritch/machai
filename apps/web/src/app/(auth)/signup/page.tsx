import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { WIZARD_STEPS, type WizardStepKey } from '@machai/types';
import { disclosures } from '@machai/config/public';
import { Card, CardBody, cn } from '@machai/ui';
import { AccountStep, BusinessStep, RepresentativeStep } from '@/components/forms/wizard-steps';
import { getOptionalSession } from '@/server/auth/session';
import { loadDraft } from '@/server/onboarding';

export const metadata: Metadata = {
  title: 'Create your account',
  robots: { index: false, follow: false },
};

/**
 * Signup wizard (spec §6 / pic1, pic6).
 *
 * The step lives in the URL rather than in component state, so Back works, the
 * page can be reloaded mid-flow, and a resumed session lands where it left off.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await getOptionalSession();
  if (session) redirect('/dashboard');

  const { step } = await searchParams;
  const draft = await loadDraft();

  // Guard against deep-linking past an incomplete step: without the earlier
  // data the final submit would fail anyway, so send them back to fill it in.
  let current: WizardStepKey = 'business';
  if (step === 'representative' && draft.business) current = 'representative';
  else if (step === 'account' && draft.business && draft.representative) current = 'account';

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Create your account
      </h1>
      <p className="mt-3 text-center text-sm text-neutral-600 dark:text-neutral-400">
        {disclosures.einOnly}
      </p>

      <ol className="mt-8 flex items-center justify-center gap-2" aria-label="Signup progress">
        {WIZARD_STEPS.map((wizardStep, index) => {
          const currentIndex = WIZARD_STEPS.findIndex((s) => s.key === current);
          const done = index < currentIndex;
          const active = wizardStep.key === current;
          return (
            <li key={wizardStep.key} className="flex items-center gap-2">
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium',
                  active
                    ? 'bg-accent-700 text-white'
                    : done
                      ? 'bg-accent-50 text-accent-800 dark:bg-accent-900/40 dark:text-accent-200'
                      : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
                )}
              >
                <span aria-hidden="true">{done ? '✓' : wizardStep.number}</span>
                {wizardStep.label}
              </span>
              {index < WIZARD_STEPS.length - 1 ? (
                <span aria-hidden="true" className="h-px w-4 bg-neutral-300 dark:bg-neutral-700" />
              ) : null}
            </li>
          );
        })}
      </ol>

      <Card className="mt-8">
        <CardBody className="p-7">
          {current === 'business' ? <BusinessStep defaults={draft.business} /> : null}
          {current === 'representative' ? (
            <RepresentativeStep defaults={draft.representative} />
          ) : null}
          {current === 'account' ? (
            <AccountStep defaultEmail={draft.representative?.email ?? ''} />
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
