'use server';

import { revalidatePath } from 'next/cache';
import { applyForAffiliate, setAffiliateStatus } from '@machai/affiliate';
import { AFFILIATE_PROGRAM } from '@machai/config/affiliate';
import { isDatabaseConfigured } from '@machai/db';
import { ERROR_CODES, emailSchema } from '@machai/types';
import { z } from 'zod';
import { errorState, successState, toFormState, type FormState } from '@/lib/form';
import { requireStaffWithMfa } from '@/server/auth/guards';
import { requireSessionOrThrow, requireVerifiedSession } from '@/server/auth/session';

const applySchema = z.object({
  payoutEmail: emailSchema,
  applicationNote: z.string().trim().max(2000).optional().or(z.literal('')),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the program terms' }),
  }),
});

/**
 * Join the affiliate program.
 *
 * Requires a verified email: we are agreeing to send this person money, and an
 * unverified address is not an identity.
 */
export async function applyForAffiliateAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireVerifiedSession();
    if (!isDatabaseConfigured()) {
      return errorState('The affiliate program is temporarily unavailable.', ERROR_CODES.PROVIDER_UNAVAILABLE);
    }

    const input = applySchema.parse({
      payoutEmail: formData.get('payoutEmail') ?? '',
      applicationNote: formData.get('applicationNote') ?? '',
      acceptedTerms: formData.get('acceptedTerms') === 'on',
    });

    const affiliate = await applyForAffiliate({
      userId: session.id,
      payoutEmail: input.payoutEmail,
      applicationNote: input.applicationNote || null,
    });

    revalidatePath('/dashboard/affiliate');
    return successState(
      affiliate.status === 'active'
        ? 'You are in — your referral link is ready below.'
        : 'Application received. We review these by hand, usually within a business day.',
    );
  } catch (error) {
    return toFormState(error);
  }
}

/** Staff decision on an application. Role- and MFA-gated, and audited. */
export async function decideAffiliateApplicationAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await requireStaffWithMfa(session);

  const affiliateId = String(formData.get('affiliateId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  if (!affiliateId || !['active', 'rejected', 'suspended'].includes(decision)) return;

  await setAffiliateStatus({
    affiliateId,
    status: decision as 'active' | 'rejected' | 'suspended',
    staffUserId: session.id,
    reason: String(formData.get('reason') ?? '') || null,
  });

  revalidatePath('/admin');
}

export { AFFILIATE_PROGRAM };
