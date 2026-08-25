import Link from 'next/link';
import type { Metadata } from 'next';
import { Alert, Card, CardBody, LinkButton } from '@machai/ui';
import { consumeVerificationToken } from '@/server/actions/auth';

export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false, follow: false },
};

/**
 * Consumes the verification token (spec §6.5).
 *
 * Dynamic, never cached: a cached response would either leak a verification
 * outcome to the next visitor or silently skip the consumption entirely.
 */
export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await consumeVerificationToken(token) : { ok: false as const, reason: 'invalid' as const };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardBody className="p-8 text-center">
          {result.ok ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                Email confirmed
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                Thanks — your address is verified. You can now choose a plan and start reporting.
              </p>
              <LinkButton href="/dashboard" size="lg" fullWidth className="mt-6">
                Go to your dashboard
              </LinkButton>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                That link did not work
              </h1>
              <div className="mt-5 text-left">
                <Alert tone="warning">
                  {result.reason === 'expired'
                    ? 'This confirmation link has expired. Links are valid for 24 hours.'
                    : result.reason === 'already_used'
                      ? 'This link has already been used. If you have confirmed your address, just sign in.'
                      : 'This confirmation link is not valid. It may have been altered in transit.'}
                </Alert>
              </div>
              <p className="mt-5 text-sm text-neutral-600 dark:text-neutral-400">
                Sign in and use the “Resend confirmation” button on your dashboard to get a fresh
                link.
              </p>
              <LinkButton href="/login" size="lg" fullWidth className="mt-6">
                Sign in
              </LinkButton>
              <Link
                href="/contact"
                className="mt-4 inline-block text-sm font-medium text-accent-700 hover:underline dark:text-accent-300"
              >
                Contact support
              </Link>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
