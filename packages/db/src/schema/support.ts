import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  ticketAuthorTypeEnum,
  ticketCategoryEnum,
  ticketPriorityEnum,
  ticketStatusEnum,
} from './enums';
import { users } from './identity';

const base = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Support tickets (spec §4.12).
 *
 * `userId` is nullable because the public contact form creates real tickets
 * from people who have no account. `contactEmail` is what later links such a
 * ticket to an account, once that address is verified (TASK-07).
 */
export const supportTickets = pgTable(
  'support_tickets',
  {
    ...base,
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    contactEmail: text('contact_email').notNull(),
    contactName: text('contact_name').notNull(),
    contactPhone: text('contact_phone'),
    subject: text('subject').notNull(),
    category: ticketCategoryEnum('category').notNull().default('other'),
    status: ticketStatusEnum('status').notNull().default('open'),
    priority: ticketPriorityEnum('priority').notNull().default('normal'),
    assignedStaffId: uuid('assigned_staff_id').references(() => users.id, { onDelete: 'set null' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    /** 'contact_form' | 'dashboard' — where the ticket originated. */
    source: text('source').notNull().default('dashboard'),
  },
  (t) => [
    index('support_tickets_user_idx').on(t.userId),
    index('support_tickets_email_idx').on(t.contactEmail),
    index('support_tickets_status_idx').on(t.status),
  ],
);

export const ticketMessages = pgTable(
  'ticket_messages',
  {
    ...base,
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),
    authorType: ticketAuthorTypeEnum('author_type').notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    /**
     * Stored raw and ESCAPED AT RENDER, never sanitized on the way in. Escaping
     * on output is what actually prevents stored XSS in the staff view
     * (TASK-03/07 security scenario); input sanitizing is bypassable and lossy.
     */
    body: text('body').notNull(),
    attachments: jsonb('attachments').$type<Array<{ key: string; filename: string }>>()
      .notNull()
      .default([]),
  },
  (t) => [index('ticket_messages_ticket_idx').on(t.ticketId)],
);

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  user: one(users, { fields: [supportTickets.userId], references: [users.id] }),
  messages: many(ticketMessages),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [ticketMessages.ticketId],
    references: [supportTickets.id],
  }),
}));
