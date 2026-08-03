import type { Metadata } from 'next';
import { eq, getDb, users } from '@machai/db';
import { Badge, Card, CardBody, CardHeader } from '@machai/ui';
import { MarketingConsentForm, ResendVerificationButton, SignOutButtons } from '@/components/dashboard/settings-forms';
import { getAccountContext } from '@/server/context';

export const metadata: Metadata = { title: 'Settings' };

/** Settings (spec §7.6). */
export default async function SettingsPage() {
  const context = await getAccountContext();
  if (!context) return null;

  const [user] = await getDb()
    .select({
      marketingOptInAt: users.marketingOptInAt,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.id, context.user.id))
    .limit(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Settings
        </h1>
      </div>

      <Card>
        <CardHeader title="Account" />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {context.user.email}
              </p>
              <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                Member since {user?.createdAt.toLocaleDateString() ?? '—'}
              </p>
            </div>
            {context.user.emailVerifiedAt ? (
              <Badge tone="success">Email confirmed</Badge>
            ) : (
              <ResendVerificationButton />
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Security"
          description="Changing your password signs you out of every other session."
        />
        <CardBody className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Last sign-in: {user?.lastLoginAt?.toLocaleString() ?? 'this session'}
          </p>
          {context.user.role !== 'member' ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              Staff accounts must have two-factor authentication enrolled before the admin area is
              accessible.{' '}
              {context.user.mfaEnabled ? 'Yours is enrolled.' : 'Yours is not yet enrolled.'}
            </p>
          ) : null}
          <SignOutButtons />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Email preferences" />
        <CardBody>
          <MarketingConsentForm optedIn={Boolean(user?.marketingOptInAt)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Your data"
          description="You can request an export or the closure of your account at any time."
        />
        <CardBody className="space-y-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          <p>
            Closing your account removes your data on a defined schedule. Some records — audit
            entries and anything we are legally required to retain — are kept per our retention
            policy.
          </p>
          <p>
            To export your data or close your account, open a ticket from{' '}
            <a href="/dashboard/tickets" className="font-medium underline">
              Support tickets
            </a>{' '}
            and we will action it within the period the applicable law requires.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
