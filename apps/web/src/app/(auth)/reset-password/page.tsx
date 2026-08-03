import Link from 'next/link';
import type { Metadata } from 'next';
import { Alert, Card, CardBody } from '@machai/ui';
import { ResetPasswordForm } from '@/components/forms/password-forms';

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Set a new password
      </h1>
      <Card className="mt-6">
        <CardBody className="p-7">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-4">
              <Alert tone="warning">
                This page needs a reset link. Request one and follow the link in the email.
              </Alert>
              <Link
                href="/forgot-password"
                className="inline-block text-sm font-medium text-accent-700 hover:underline dark:text-accent-300"
              >
                Request a reset link
              </Link>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
