import Link from 'next/link';
import type { Metadata } from 'next';
import {
  businesses,
  count,
  desc,
  eq,
  getDb,
  supportTickets,
  users,
} from '@machai/db';
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, StatTile } from '@machai/ui';
import { requireStaffWithMfa } from '@/server/auth/guards';
import { requireSession } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

export const dynamic = 'force-dynamic';

/**
 * Staff area (spec §8.3).
 *
 * Gated by role AND by MFA enrolment. The check runs on every render rather
 * than only at login, so promoting an account to staff does not grant admin
 * access to a session established before the requirement applied.
 */
export default async function AdminPage() {
  const session = await requireSession('/admin');
  await requireStaffWithMfa(session);

  const db = getDb();
  const [userCount] = await db.select({ value: count() }).from(users);
  const [businessCount] = await db.select({ value: count() }).from(businesses);
  const [openTickets] = await db
    .select({ value: count() })
    .from(supportTickets)
    .where(eq(supportTickets.status, 'open'));

  const kybQueue = await db
    .select({
      id: businesses.id,
      legalName: businesses.legalName,
      status: businesses.verificationStatus,
      notes: businesses.verificationNotes,
      createdAt: businesses.createdAt,
    })
    .from(businesses)
    .where(eq(businesses.verificationStatus, 'pending'))
    .orderBy(desc(businesses.createdAt))
    .limit(25);

  const recentTickets = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      status: supportTickets.status,
      contactEmail: supportTickets.contactEmail,
      lastMessageAt: supportTickets.lastMessageAt,
    })
    .from(supportTickets)
    .orderBy(desc(supportTickets.lastMessageAt))
    .limit(15);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Admin
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Every action taken here is written to the audit log against your account.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Members" value={userCount?.value ?? 0} />
        <StatTile label="Businesses" value={businessCount?.value ?? 0} />
        <StatTile label="Open tickets" value={openTickets?.value ?? 0} tone="accent" />
      </div>

      <Alert tone="info" title="Bureau furnishing is not enabled">
        Direction B (reporting tradelines to bureaus) is blocked pending legal review and per-bureau
        furnisher approval. There is no reporting pipeline in this build, and no reporting claim
        renders anywhere until the per-bureau flags are turned on.
      </Alert>

      <Card>
        <CardHeader
          title="KYB review queue"
          description="Businesses awaiting a verification decision"
        />
        {kybQueue.length === 0 ? (
          <EmptyState title="Nothing waiting" description="No businesses are pending review." />
        ) : (
          <CardBody className="space-y-3">
            {kybQueue.map((business) => (
              <div
                key={business.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                    {business.legalName}
                  </p>
                  <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                    {business.notes ?? 'Queued for review'} · submitted{' '}
                    {business.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <Badge tone="warning">{business.status}</Badge>
              </div>
            ))}
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader title="Recent tickets" />
        {recentTickets.length === 0 ? (
          <EmptyState title="No tickets" />
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {recentTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/dashboard/tickets/${ticket.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {ticket.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {ticket.contactEmail} · {ticket.lastMessageAt.toLocaleDateString()}
                    </p>
                  </div>
                  <Badge tone={ticket.status === 'open' ? 'accent' : 'neutral'}>
                    {ticket.status}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
