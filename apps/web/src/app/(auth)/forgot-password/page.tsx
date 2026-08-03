import type { Metadata } from 'next';
import { Card, CardBody } from '@machai/ui';
import { ForgotPasswordForm } from '@/components/forms/password-forms';

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Reset your password
      </h1>
      <p className="mt-3 text-center text-sm text-neutral-600 dark:text-neutral-400">
        Enter your email and we will send you a link to set a new one.
      </p>
      <Card className="mt-6">
        <CardBody className="p-7">
          <ForgotPasswordForm />
        </CardBody>
      </Card>
    </div>
  );
}
