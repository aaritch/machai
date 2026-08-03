import 'server-only';
import {
  and,
  desc,
  eq,
  getDb,
  isDatabaseConfigured,
  supportTickets,
  ticketMessages,
  users,
} from '@machai/db';
import { EMAIL_TEMPLATES, QUEUE_NAMES, type TicketCategory } from '@machai/types';
import { enqueue } from '@machai/queue';
import { logger } from '@machai/observability';

/**
 * Support ticket service (spec §4.12, §7.4).
 *
 * The load-bearing guarantee: a contact submission is never lost. The ticket is
 * written first and the autoresponder is queued second, so an email-provider
 * outage costs the acknowledgement, not the enquiry (TASK-03 failure scenario).
 */

export interface CreateTicketInput {
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  subject: string;
  category: TicketCategory;
  message: string;
  userId?: string | null;
  source: 'contact_form' | 'dashboard';
}

export async function createTicket(input: CreateTicketInput): Promise<{ id: string; ref: string }> {
  const db = getDb();

  // A public submission from an address that already has an account is linked
  // to it immediately; otherwise it is matched later, on verification
  // (TASK-07 edge case).
  let userId = input.userId ?? null;
  if (!userId) {
    userId = await findVerifiedUserIdByEmail(input.contactEmail);
  }

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      userId,
      contactEmail: input.contactEmail,
      contactName: input.contactName,
      contactPhone: input.contactPhone ?? null,
      subject: input.subject,
      category: input.category,
      source: input.source,
      status: 'open',
    })
    .returning({ id: supportTickets.id });

  if (!ticket) throw new Error('Ticket insert returned no row');

  await db.insert(ticketMessages).values({
    ticketId: ticket.id,
    authorType: 'member',
    authorId: userId,
    authorName: input.contactName,
    body: input.message,
  });

  const ref = ticket.id.slice(0, 8).toUpperCase();

  // Queued, not sent inline: the submitter should not wait on an SMTP round
  // trip, and a failure here must not roll back the ticket.
  await enqueue(QUEUE_NAMES.emails, `ticket-ack:${ticket.id}`, {
    template: EMAIL_TEMPLATES.contactAutoresponder,
    to: input.contactEmail,
    data: { ticketRef: ref },
  });

  logger.info('support ticket created', { ticketId: ticket.id, category: input.category });
  return { id: ticket.id, ref };
}

/**
 * Only VERIFIED addresses are matched.
 *
 * Matching on an unverified address would let someone claim another person's
 * tickets by registering their email and never confirming it.
 */
async function findVerifiedUserIdByEmail(email: string): Promise<string | null> {
  const [user] = await getDb()
    .select({ id: users.id, verifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return user?.verifiedAt ? user.id : null;
}

/**
 * Links prior public submissions to a user once they verify their address
 * (TASK-07 edge case).
 */
export async function claimTicketsForVerifiedUser(userId: string, email: string): Promise<number> {
  const claimed = await getDb()
    .update(supportTickets)
    .set({ userId })
    .where(and(eq(supportTickets.contactEmail, email.toLowerCase()), eq(supportTickets.userId, null as never)))
    .returning({ id: supportTickets.id });
  return claimed.length;
}

export async function listTicketsForUser(userId: string) {
  if (!isDatabaseConfigured()) return [];
  return getDb()
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      category: supportTickets.category,
      status: supportTickets.status,
      lastMessageAt: supportTickets.lastMessageAt,
      createdAt: supportTickets.createdAt,
    })
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.lastMessageAt));
}

/**
 * Loads a ticket thread, enforcing ownership.
 *
 * Returns null rather than throwing on a foreign id so the caller renders a
 * plain not-found — the same response a nonexistent id gets (TASK-07 security
 * scenario).
 */
export async function getTicketThread(ticketId: string, userId: string, isStaff: boolean) {
  const [ticket] = await getDb()
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  if (!ticket) return null;
  if (!isStaff && ticket.userId !== userId) return null;

  const messages = await getDb()
    .select()
    .from(ticketMessages)
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(ticketMessages.createdAt);

  return { ticket, messages };
}

export async function addTicketMessage(input: {
  ticketId: string;
  authorType: 'member' | 'staff';
  authorId: string;
  authorName: string;
  body: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(ticketMessages).values(input);
  await db
    .update(supportTickets)
    .set({
      lastMessageAt: new Date(),
      // A member reply reopens a resolved ticket; a staff reply moves it to
      // pending while awaiting the member.
      status: input.authorType === 'member' ? 'open' : 'pending',
      updatedAt: new Date(),
    })
    .where(eq(supportTickets.id, input.ticketId));
}
