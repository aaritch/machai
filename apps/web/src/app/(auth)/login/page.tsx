import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Alert, Card, CardBody } from '@machai/ui';
import { LoginForm } from '@/components/forms/login-form';
import { getOptionalSession } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Log in', robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const session = await getOptionalSession();
  if (session) redirect('/dashboard');

  const { next, reset } = await searchParams;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Welcome back
      </h1>

      {reset === 'done' ? (
        <div className="mt-6">
          <Alert tone="success">
            Your password has been changed. Sign in with your new password.
          </Alert>
        </div>
      ) : null}

      <Card className="mt-6">
        <CardBody className="p-7">
          <LoginForm next={next} />
        </CardBody>
      </Card>
    </div>
  );
}
