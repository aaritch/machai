'use server';

import { revalidatePath } from 'next/cache';
import {
  and,
  businesses,
  disputes,
  eq,
  feedback,
  getDb,
  isNull,
  tradelines,
  users,
  writeAudit,
} from '@machai/db';
import { AUDIT_ACTIONS } from '@machai/observability';
import {
  ERROR_CODES,
  KYB_SENSITIVE_FIELDS,
  businessProfileUpdateSchema,
  disputeSchema,
  feedbackSchema,
  newTicketSchema,
  ticketReplySchema,
  tradelineSchema,
} from '@machai/types';
import { errorState, parseForm, successState, toFormState, type FormState } from '@/lib/form';
import { requireBusinessOwnership } from '@/server/auth/guards';
import { requireSessionOrThrow, requireVerifiedSession } from '@/server/auth/session';
import { setChecklistItemStatus } from '@/server/checklist';
import { getAccountContext } from '@/server/context';
import { invalidateVerification } from '@/server/kyb';
import { RATE_LIMITS, enforceRateLimit } from '@/server/rate-limit';
import { addTicketMessage, createTicket, getTicketThread } from '@/server/tickets';

/**
 * Dashboard actions.
 *
 * Every one of these re-resolves the session and re-checks ownership. None of
 * them trusts an id that arrived in the form body without confirming the caller
 * owns the thing it points at.
 */

// --- Disputes ---------------------------------------------------------------

export async function fileDisputeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const session = await requireVerifiedSession();
    const context = await getAccountContext();
    if (!context?.businessId) return errorState('No business on file.', ERROR_CODES.NOT_FOUND);

    const input = parseForm(disputeSchema, formData);
    const business = await requireBusinessOwnership(session, context.businessId);

    await getDb().insert(disputes).values({
      businessId: business.id,
      filedByUserId: session.id,
      creditReportId: input.creditReportId ?? null,
      tradelineId: input.tradelineId ?? null,
      reason: input.reason,
      details: input.details,
      status: 'submitted',
      // FCRA investigations run to a deadline; recording it at intake makes the
      // clock explicit rather than implied (spec §14.1).
      dueBy: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    });

    await writeAudit({
      actorId: session.id,
      action: AUDIT_ACTIONS.DISPUTE_FILED,
      entityType: 'business',
      entityId: business.id,
      metadata: { hasReport: Boolean(input.creditReportId), hasTradeline: Boolean(input.tradelineId) },
    });

    revalidatePath('/dashboard/tradelines');
    return successState('Dispute recorded. We will confirm the outcome once the investigation closes.');
  } catch (error) {
    return toFormState(error);
  }
}

// --- Tradelines -------------------------------------------------------------

export async function addTradelineAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const session = await requireSessionOrThrow();
    const context = await getAccountContext();
    if (!context?.businessId) return errorState('No business on file.', ERROR_CODES.NOT_FOUND);

    // `reportedTo` is a checkbox group, so it can carry several values under
    // one name. FormData.entries() would keep only the last — getAll is the
    // only correct read here.
    const input = tradelineSchema.parse({
      creditorName: formData.get('creditorName') ?? '',
      accountType: formData.get('accountType') ?? 'net30',
      dateOpened: formData.get('dateOpened') ?? '',
      creditLimitCents: formData.get('creditLimitCents') ?? '',
      currentBalanceCents: formData.get('currentBalanceCents') ?? '',
      highBalanceCents: formData.get('highBalanceCents') ?? '',
      paymentStatus: formData.get('paymentStatus') ?? 'current',
      reportedTo: formData.getAll('reportedTo').filter((v): v is string => typeof v === 'string'),
    });
    const business = await requireBusinessOwnership(session, context.businessId);

    await getDb().insert(tradelines).values({
      businessId: business.id,
      creditorName: input.creditorName,
      accountType: input.accountType,
      dateOpened: input.dateOpened || null,
      creditLimitCents: input.creditLimitCents ?? null,
      currentBalanceCents: input.currentBalanceCents ?? null,
      highBalanceCents: input.highBalanceCents ?? null,
      paymentStatus: input.paymentStatus,
      reportedTo: input.reportedTo,
      // Forced server-side. A client cannot claim a line was platform-reported
      // or bureau-observed — those sources mean something specific.
      source: 'user_added',
    });

    revalidatePath('/dashboard/tradelines');
    return successState('Tradeline added.');
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteTradelineAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  const context = await getAccountContext();
  if (!context?.businessId) return;

  const tradelineId = String(formData.get('tradelineId') ?? '');
  const business = await requireBusinessOwnership(session, context.businessId);

  // Scoped by business id as well as tradeline id: without it, a guessed id
  // from another account would delete someone else's row.
  await getDb()
    .update(tradelines)
    .set({ deletedAt: new Date() })
    .where(and(eq(tradelines.id, tradelineId), eq(tradelines.businessId, business.id)));

  revalidatePath('/dashboard/tradelines');
}

// --- Checklist --------------------------------------------------------------

export async function toggleChecklistItemAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  const itemId = String(formData.get('itemId') ?? '');
  const complete = formData.get('complete') === 'true';
  if (!itemId) return;

  await setChecklistItemStatus(session.id, itemId, complete);
  revalidatePath('/dashboard/checklist');
  revalidatePath('/dashboard');
}

// --- Support ----------------------------------------------------------------

export async function createTicketAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const session = await requireSessionOrThrow();
    const input = parseForm(newTicketSchema, formData);
    await enforceRateLimit(RATE_LIMITS.ticketReply, session.id);

    const { ref } = await createTicket({
      contactName: session.firstName ?? session.email,
      contactEmail: session.email,
      subject: input.subject,
      category: input.category,
      message: input.message,
      userId: session.id,
      source: 'dashboard',
    });

    revalidatePath('/dashboard/tickets');
    return successState(`Ticket #${ref} opened. We will reply by email and in this thread.`);
  } catch (error) {
    return toFormState(error);
  }
}

export async function replyToTicketAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const session = await requireSessionOrThrow();
    const input = parseForm(ticketReplySchema, formData);
    await enforceRateLimit(RATE_LIMITS.ticketReply, session.id);

    const isStaff = session.role === 'staff' || session.role === 'admin';
    const thread = await getTicketThread(input.ticketId, session.id, isStaff);
    if (!thread) return errorState('That ticket could not be found.', ERROR_CODES.NOT_FOUND);

    await addTicketMessage({
      ticketId: input.ticketId,
      // Derived from the session role, never from the form — otherwise a member
      // could post a message that renders as staff (TASK-07 security scenario).
      authorType: isStaff ? 'staff' : 'member',
      authorId: session.id,
      authorName: session.firstName ?? session.email,
      body: input.body,
    });

    revalidatePath(`/dashboard/tickets/${input.ticketId}`);
    return successState('Reply sent.');
  } catch (error) {
    return toFormState(error);
  }
}

export async function submitFeedbackAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const session = await requireSessionOrThrow();
    const input = parseForm(feedbackSchema, formData);
    await getDb().insert(feedback).values({
      userId: session.id,
      rating: input.rating,
      message: input.message,
    });
    return successState('Thanks — we read every piece of feedback.');
  } catch (error) {
    return toFormState(error);
  }
}

// --- Company profile --------------------------------------------------------

export async function updateCompanyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const session = await requireSessionOrThrow();
    const context = await getAccountContext();
    if (!context?.businessId) return errorState('No business on file.', ERROR_CODES.NOT_FOUND);

    const input = businessProfileUpdateSchema.parse({
      legalName: formData.get('legalName') ?? undefined,
      dbaName: formData.get('dbaName') ?? undefined,
      streetAddress: formData.get('streetAddress') ?? undefined,
      addressLine2: formData.get('addressLine2') ?? undefined,
      city: formData.get('city') ?? undefined,
      state: formData.get('state') ?? undefined,
      zip: formData.get('zip') ?? undefined,
      phone: formData.get('phone') ?? undefined,
      entityType: formData.get('entityType') ?? undefined,
      website: formData.get('website') ?? undefined,
    });

    const business = await requireBusinessOwnership(session, context.businessId);

    // Changing a KYB-relevant field invalidates the prior decision. Without
    // this, a business verified under one legal name could quietly change it
    // and keep the verified badge (TASK-02 caveat).
    const kybAffected = KYB_SENSITIVE_FIELDS.some((field) => {
      const next = input[field as keyof typeof input];
      return next !== undefined && next !== '' && next !== business[field as keyof typeof business];
    });

    await getDb()
      .update(businesses)
      .set({
        legalName: input.legalName ?? business.legalName,
        dbaName: input.dbaName || null,
        streetAddress: input.streetAddress ?? business.streetAddress,
        addressLine2: input.addressLine2 || null,
        city: input.city ?? business.city,
        state: input.state ?? business.state,
        zip: input.zip ?? business.zip,
        phone: input.phone ?? business.phone,
        entityType: input.entityType ?? business.entityType,
        website: input.website || null,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, business.id));

    await writeAudit({
      actorId: session.id,
      action: AUDIT_ACTIONS.BUSINESS_UPDATED,
      entityType: 'business',
      entityId: business.id,
      metadata: { kybAffected },
    });

    if (kybAffected) {
      await invalidateVerification(business.id, 'Key business details changed');
    }

    revalidatePath('/dashboard/company');
    return successState(
      kybAffected
        ? 'Saved. Because key details changed, your business needs to be verified again.'
        : 'Saved.',
    );
  } catch (error) {
    return toFormState(error);
  }
}

// --- Settings ---------------------------------------------------------------

export async function updateMarketingConsentAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  const optIn = formData.get('marketingOptIn') === 'on';

  await getDb()
    .update(users)
    .set({ marketingOptInAt: optIn ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(users.id, session.id), isNull(users.deletedAt)));

  revalidatePath('/dashboard/settings');
}
