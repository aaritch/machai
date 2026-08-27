import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { getConfig } from '@machai/config';
import {
  decryptField,
  encryptField,
  eq,
  getDb,
  isDatabaseConfigured,
  onboardingDrafts,
} from '@machai/db';
import { logger } from '@machai/observability';
import type { BusinessStepInput, RepresentativeStepInput } from '@machai/types';

/**
 * Resumable wizard state (spec §6: "progress saved after each step so a user
 * can leave and return").
 *
 * Two things this must get right:
 *
 *  1. The EIN inside a draft is encrypted before the row is written. A
 *     half-finished signup must not create a plaintext EIN anywhere, and an
 *     abandoned draft is exactly the kind of row nobody thinks to audit.
 *  2. The Account step is NEVER persisted. It holds the password, and a draft
 *     table is not a place for credentials, hashed or otherwise.
 */

const DRAFT_COOKIE = 'machai_draft';
const DRAFT_TTL_DAYS = 14;

export interface OnboardingDraft {
  business: BusinessStepInput | null;
  representative: RepresentativeStepInput | null;
}

const EMPTY_DRAFT: OnboardingDraft = { business: null, representative: null };

async function getDraftKey(create: boolean): Promise<string | null> {
  const store = await cookies();
  const existing = store.get(DRAFT_COOKIE)?.value;
  if (existing) return existing;
  if (!create) return null;

  const key = randomBytes(24).toString('base64url');
  store.set(DRAFT_COOKIE, key, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getConfig().APP_ENV !== 'development',
    path: '/',
    maxAge: DRAFT_TTL_DAYS * 24 * 3600,
  });
  return key;
}

export async function loadDraft(): Promise<OnboardingDraft> {
  if (!isDatabaseConfigured()) return EMPTY_DRAFT;
  const key = await getDraftKey(false);
  if (!key) return EMPTY_DRAFT;

  try {
    const [row] = await getDb()
      .select()
      .from(onboardingDrafts)
      .where(eq(onboardingDrafts.draftKey, key))
      .limit(1);

    if (!row || row.expiresAt < new Date()) return EMPTY_DRAFT;

    const business = row.businessStep
      ? ((await decryptBusinessStep(row.businessStep)) as BusinessStepInput)
      : null;
    const representative = row.representativeStep
      ? (JSON.parse(row.representativeStep) as RepresentativeStepInput)
      : null;

    return { business, representative };
  } catch (error) {
    // A corrupt or undecryptable draft should never block signup — start fresh.
    logger.warn('failed to load onboarding draft', { error });
    return EMPTY_DRAFT;
  }
}

/**
 * Returns false when the step could not be persisted.
 *
 * The caller must not advance the wizard on a false: the next step re-reads the
 * draft to decide which step to show, so an unsaved step sends the user
 * straight back to this one with an empty form and no explanation.
 */
export async function saveBusinessStep(step: BusinessStepInput): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const key = await getDraftKey(true);
  if (!key) return false;

  const { ein, ...rest } = step;
  const payload = JSON.stringify({ ...rest, einEncrypted: await encryptField(String(ein)) });

  await upsertDraft(key, { businessStep: payload });
  return true;
}

/** Returns false when the step could not be persisted. See above. */
export async function saveRepresentativeStep(step: RepresentativeStepInput): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const key = await getDraftKey(true);
  if (!key) return false;
  await upsertDraft(key, { representativeStep: JSON.stringify(step) });
  return true;
}

async function upsertDraft(
  key: string,
  values: { businessStep?: string; representativeStep?: string },
): Promise<void> {
  const expiresAt = new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 3600 * 1000);
  await getDb()
    .insert(onboardingDrafts)
    .values({ draftKey: key, expiresAt, ...values })
    .onConflictDoUpdate({
      target: onboardingDrafts.draftKey,
      set: { ...values, expiresAt, updatedAt: new Date() },
    });
}

async function decryptBusinessStep(serialized: string): Promise<Record<string, unknown>> {
  const parsed = JSON.parse(serialized) as Record<string, unknown> & { einEncrypted?: string };
  const { einEncrypted, ...rest } = parsed;
  if (!einEncrypted) return rest;
  return { ...rest, ein: await decryptField(einEncrypted) };
}

/** Called after a successful signup so the draft cannot be replayed. */
export async function clearDraft(): Promise<void> {
  const store = await cookies();
  const key = store.get(DRAFT_COOKIE)?.value;
  store.delete(DRAFT_COOKIE);
  if (!key || !isDatabaseConfigured()) return;
  await getDb().delete(onboardingDrafts).where(eq(onboardingDrafts.draftKey, key));
}
