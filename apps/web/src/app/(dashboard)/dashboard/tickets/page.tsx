import Link from 'next/link';
import type { Metadata } from 'next';
import { TICKET_CATEGORY_LABELS } from '@machai/types';
import { Badge, Card, CardBody, CardHeader, EmptyState } from '@machai/ui';
import { NewTicketForm } from '@/components/dashboard/ticket-forms';
import { getAccountContext } from '@/server/context';
import { listTicketsForUser } from '@/server/tickets';

export const metadata: Metadata = { title: 'Support tickets' };

/** Member ticket list (spec §7.4). */
export default async function TicketsPage() {
  const context = await getAccountContext();
  if (!context) return null;

  const tickets = await listTicketsForUser(context.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Support tickets
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Every message you send becomes a tracked ticket, including anything sent through the
          public contact form using this address.
        </p>
      </div>

      <Card>
        <CardHeader title="Your tickets" description={`${tickets.length} total`} />
        {tickets.length === 0 ? (
          <EmptyState
            title="No tickets yet"
            description="Open one below and a person will get back to you, usually within a business day."
          />
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/dashboard/tickets/${ticket.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                      {ticket.subject}
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                      #{ticket.id.slice(0, 8).toUpperCase()} ·{' '}
                      {TICKET_CATEGORY_LABELS[ticket.category]} · updated{' '}
                      {ticket.lastMessageAt.toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    tone={
                      ticket.status === 'open'
                        ? 'accent'
                        : ticket.status === 'pending'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {ticket.status}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Open a ticket" />
        <CardBody>
          <NewTicketForm />
        </CardBody>
      </Card>
    </div>
  );
}
