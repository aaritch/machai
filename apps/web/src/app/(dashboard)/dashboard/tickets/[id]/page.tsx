import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TICKET_CATEGORY_LABELS } from '@machai/types';
import { Badge, Card, CardBody, CardHeader, cn } from '@machai/ui';
import { TicketReplyForm } from '@/components/dashboard/ticket-forms';
import { getAccountContext } from '@/server/context';
import { getTicketThread } from '@/server/tickets';

export const metadata: Metadata = { title: 'Ticket', robots: { index: false, follow: false } };

/**
 * Ticket thread (spec §7.4).
 *
 * Message bodies are rendered as TEXT nodes, never as HTML. React escapes them,
 * which is what actually prevents stored XSS in this view — the bodies are
 * stored raw on purpose (TASK-07 security scenario).
 */
export default async function TicketThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getAccountContext();
  if (!context) return null;

  const isStaff = context.user.role === 'staff' || context.user.role === 'admin';
  const thread = await getTicketThread(id, context.user.id, isStaff);

  // getTicketThread returns null for both "does not exist" and "not yours", so
  // a probe cannot tell the two apart.
  if (!thread) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/tickets"
        className="text-sm font-medium text-accent-700 hover:underline dark:text-accent-300"
      >
        ← All tickets
      </Link>

      <Card>
        <CardHeader
          title={thread.ticket.subject}
          description={`#${thread.ticket.id.slice(0, 8).toUpperCase()} · ${TICKET_CATEGORY_LABELS[thread.ticket.category]}`}
          action={
            <Badge
              tone={
                thread.ticket.status === 'open'
                  ? 'accent'
                  : thread.ticket.status === 'pending'
                    ? 'warning'
                    : 'neutral'
              }
            >
              {thread.ticket.status}
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          {thread.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'rounded-lg border px-4 py-3',
                message.authorType === 'staff'
                  ? 'border-accent-200 bg-accent-50 dark:border-accent-900 dark:bg-accent-900/30'
                  : 'border-neutral-200 dark:border-neutral-800',
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {message.authorName}
                  {message.authorType === 'staff' ? ' · Support' : ''}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {message.createdAt.toLocaleString()}
                </p>
              </div>
              {/* whitespace-pre-wrap preserves the author's line breaks without
                  interpreting anything in the body as markup. */}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                {message.body}
              </p>
            </div>
          ))}
        </CardBody>
      </Card>

      {thread.ticket.status !== 'closed' ? (
        <Card>
          <CardHeader title="Reply" />
          <CardBody>
            <TicketReplyForm ticketId={thread.ticket.id} />
          </CardBody>
        </Card>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          This ticket is closed. Open a new one if you need more help.
        </p>
      )}
    </div>
  );
}
