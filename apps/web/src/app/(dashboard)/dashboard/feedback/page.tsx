import type { Metadata } from 'next';
import { Card, CardBody, CardHeader } from '@machai/ui';
import { FeedbackForm } from '@/components/dashboard/feedback-form';

export const metadata: Metadata = { title: 'Feedback' };

export default function FeedbackPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Feedback
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Tell us what is working and what is not. This goes to the product team, not to support —
          for anything that needs a reply, open a ticket instead.
        </p>
      </div>

      <Card>
        <CardHeader title="Share your thoughts" />
        <CardBody>
          <FeedbackForm />
        </CardBody>
      </Card>
    </div>
  );
}
