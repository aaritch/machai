'use server';

import { isDatabaseConfigured } from '@machai/db';
import { logger } from '@machai/observability';
import {
  contactFormSchema,
  enterpriseLeadSchema,
  ERROR_CODES,
  TICKET_CATEGORY_LABELS,
} from '@machai/types';
import { enqueue } from '@machai/queue';
import { EMAIL_TEMPLATES, QUEUE_NAMES } from '@machai/types';
import { enterpriseLeads, getDb } from '@machai/db';
import { errorState, parseForm, successState, toFormState, type FormState } from '@/lib/form';
import { getOptionalSession, getRequestContext } from '@/server/auth/session';
import { RATE_LIMITS, enforceRateLimit } from '@/server/rate-limit';
import { assertNotSpam } from '@/server/spam';
import { createTicket } from '@/server/tickets';

/**
 * Public contact form (spec §5.4).
 *
 * Order of operations matters: spam checks and rate limiting run BEFORE any
 * write, so junk never reaches the ticket queue, and the ticket is created
 * before the autoresponder is queued so a submission is never silently lost.
 */
export async function submitContactForm(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const input = parseForm(contactFormSchema, formData);
    const context = await getRequestContext();

    await assertNotSpam({
      honeypot: input.website,
      renderedAt: input.renderedAt,
      captchaToken: input.captchaToken,
      ip: context.ip,
    });

    // Limited by IP rather than by email: an email is trivially varied per
    // submission, an IP much less so.
    await enforceRateLimit(RATE_LIMITS.contact, context.ip ?? input.email);

    if (!isDatabaseConfigured()) {
      logger.error('contact submission received with no database configured');
      return errorState(
        'Our contact form is temporarily unavailable. Please email us directly and we will pick it up.',
        ERROR_CODES.PROVIDER_UNAVAILABLE,
      );
    }

    const session = await getOptionalSession();
    const { ref } = await createTicket({
      contactName: `${input.firstName} ${input.lastName}`.trim(),
      contactEmail: input.email,
      contactPhone: input.phone || null,
      subject: `${TICKET_CATEGORY_LABELS[input.category]} enquiry from ${input.firstName} ${input.lastName}`,
      category: input.category,
      message: input.message,
      userId: session?.id ?? null,
      source: 'contact_form',
    });

    return successState(
      `Thanks — your message is now ticket #${ref}. We reply to most enquiries within 24 hours.`,
    );
  } catch (error) {
    return toFormState(error);
  }
}

/**
 * Enterprise "Contact Sales" lead (spec §10.5).
 *
 * Deliberately does not create a subscription or grant any entitlement. Staff
 * provision Enterprise manually after qualifying the lead — there is no
 * self-serve path to those entitlements.
 */
export async function submitEnterpriseLead(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const input = parseForm(enterpriseLeadSchema, formData);
    const context = await getRequestContext();

    await assertNotSpam({
      honeypot: input.website,
      renderedAt: input.renderedAt,
      ip: context.ip,
    });
    await enforceRateLimit(RATE_LIMITS.contact, context.ip ?? input.email);

    if (!isDatabaseConfigured()) {
      return errorState(
        'Our enquiry form is temporarily unavailable. Please email us directly.',
        ERROR_CODES.PROVIDER_UNAVAILABLE,
      );
    }

    const [lead] = await getDb()
      .insert(enterpriseLeads)
      .values({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone || null,
        companyName: input.companyName,
        message: input.message || null,
      })
      .returning({ id: enterpriseLeads.id });

    if (lead) {
      await enqueue(QUEUE_NAMES.emails, `enterprise-lead:${lead.id}`, {
        template: EMAIL_TEMPLATES.enterpriseLead,
        to: 'sales@machai.example',
        data: {
          companyName: input.companyName,
          contactName: `${input.firstName} ${input.lastName}`,
          email: input.email,
          phone: input.phone || null,
        },
      });
    }

    return successState('Thanks — someone from our team will be in touch shortly.');
  } catch (error) {
    return toFormState(error);
  }
}
