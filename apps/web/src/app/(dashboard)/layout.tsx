import { redirect } from 'next/navigation';
import { Alert, LinkButton } from '@machai/ui';
import { Sidebar } from '@/components/dashboard/sidebar';
import { getAccountContext } from '@/server/context';
import { requireSession } from '@/server/auth/session';

/**
 * Authenticated shell.
 *
 * Everything below is dynamic: it depends on session state, and caching any of
 * it would risk serving one account's data to another.
 */
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireSession('/dashboard');
  const context = await getAccountContext();

  // Session resolved but context did not — the database is unreachable. Send
  // them somewhere honest rather than rendering a shell full of blanks.
  if (!context) redirect('/login');

  const planLabel = context.subscription.planName
    ? `${context.subscription.planName} plan`
    : 'Free plan · no card on file';

  return (
    <div className="min-h-screen bg-neutral-50 lg:flex dark:bg-neutral-950">
      <Sidebar
        userEmail={context.user.email}
        businessName={context.business?.legalName ?? null}
        planLabel={planLabel}
        hasEntitlements={context.entitlements.reportsPerMonth > 0}
        isStaff={context.user.role === 'staff' || context.user.role === 'admin'}
      />

      <div className="min-w-0 flex-1">
        <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
          {/* Two banners that must appear on every page, not just where they
              are convenient — an unverified account and a failing payment both
              change what the user can do. */}
          {!context.user.emailVerifiedAt ? (
            <div className="mb-6">
              <Alert
                tone="warning"
                title="Confirm your email address"
                action={
                  <LinkButton href="/dashboard/settings" size="sm" variant="secondary">
                    Resend
                  </LinkButton>
                }
              >
                Until you confirm it, you cannot subscribe or start reporting.
              </Alert>
            </div>
          ) : null}

          {context.inGracePeriod ? (
            <div className="mb-6">
              <Alert
                tone="danger"
                title="Your last payment did not go through"
                action={
                  <LinkButton href="/dashboard/billing" size="sm" variant="secondary">
                    Update card
                  </LinkButton>
                }
              >
                We are retrying automatically and your access continues for now. Updating your card
                avoids any interruption.
              </Alert>
            </div>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}
