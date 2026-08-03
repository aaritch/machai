import { z } from 'zod';
import { TICKET_CATEGORIES } from '../domain/enums';
import {
  emailSchema,
  optionalPhoneSchema,
  shortTextSchema,
} from '../validation/primitives';

/** Documented limits — the contact page states them, and the server enforces them. */
export const CONTACT_MESSAGE_MIN = 10;
export const CONTACT_MESSAGE_MAX = 5000;

/**
 * Public contact form (spec §5.4). Submission creates a real support ticket;
 * it is never a fire-and-forget mailto.
 */
export const contactFormSchema = z.object({
  firstName: shortTextSchema('First name', 80),
  lastName: shortTextSchema('Last name', 80),
  email: emailSchema,
  phone: optionalPhoneSchema,
  category: z.enum(TICKET_CATEGORIES).default('other'),
  message: z
    .string()
    .trim()
    .min(CONTACT_MESSAGE_MIN, 'Tell us a little more so we can help')
    .max(CONTACT_MESSAGE_MAX, `Please keep your message under ${CONTACT_MESSAGE_MAX} characters`),
  /**
   * Honeypot. Real users never see this field, so any value means a bot.
   * Named to look tempting to naive form-fillers.
   */
  website: z.string().max(0, 'Rejected').optional().or(z.literal('')),
  /** Client render timestamp; sub-second submissions are automated. */
  renderedAt: z.coerce.number().optional(),
  captchaToken: z.string().optional(),
});
export type ContactFormInput = z.input<typeof contactFormSchema>;

/** A human cannot read the form and type a message this fast. */
export const MIN_FORM_FILL_MS = 2500;

export const newTicketSchema = z.object({
  subject: shortTextSchema('Subject', 160),
  category: z.enum(TICKET_CATEGORIES),
  message: z
    .string()
    .trim()
    .min(CONTACT_MESSAGE_MIN, 'Add a few more details')
    .max(CONTACT_MESSAGE_MAX),
});
export type NewTicketInput = z.input<typeof newTicketSchema>;

export const ticketReplySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1, 'Write a reply').max(CONTACT_MESSAGE_MAX),
});

export const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  message: z.string().trim().min(1, 'Tell us what you think').max(CONTACT_MESSAGE_MAX),
});

/** Enterprise "Contact Sales" lead (spec §10.5). No self-serve checkout. */
export const enterpriseLeadSchema = z.object({
  firstName: shortTextSchema('First name', 80),
  lastName: shortTextSchema('Last name', 80),
  email: emailSchema,
  phone: optionalPhoneSchema,
  companyName: shortTextSchema('Company name', 120),
  message: z.string().trim().max(CONTACT_MESSAGE_MAX).optional().or(z.literal('')),
  website: z.string().max(0).optional().or(z.literal('')),
  renderedAt: z.coerce.number().optional(),
});
export type EnterpriseLeadInput = z.input<typeof enterpriseLeadSchema>;
