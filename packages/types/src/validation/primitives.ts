import { z } from 'zod';
import { ENTITY_TYPES, US_STATES } from '../domain/enums';

/**
 * Field primitives shared by client and server.
 *
 * Client-side validation is UX only. The server re-runs every one of these
 * (global convention, TASK-00) — that is why they live in a shared package
 * rather than in a form component.
 */

/** Strips every non-digit. `12-3456789`, `12 3456789`, `123456789` → `123456789`. */
export function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * EIN: exactly 9 digits once normalized (spec §6.1, "9 digits only").
 * Stored normalized and encrypted at rest — never in a plaintext column.
 */
export const einSchema = z
  .string()
  .trim()
  .min(1, 'Tax ID (EIN) is required')
  .transform(normalizeDigits)
  .refine((v) => v.length === 9, 'EIN must be exactly 9 digits')
  .refine((v) => !/^(\d)\1{8}$/.test(v), 'That EIN does not look valid');

/** Display form for a normalized EIN: `123456789` → `12-3456789`. */
export function formatEin(normalized: string): string {
  const digits = normalizeDigits(normalized);
  if (digits.length !== 9) return normalized;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

/** Only ever show the last four. Full EIN display is an audited action. */
export function maskEin(normalized: string): string {
  const digits = normalizeDigits(normalized);
  if (digits.length !== 9) return '••-•••••••';
  return `••-•••${digits.slice(5)}`;
}

/** US phone: exactly 10 digits once normalized (spec §6.1, "10 digits only"). */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone is required')
  .transform(normalizeDigits)
  .refine((v) => v.length === 10, 'Phone must be exactly 10 digits');

export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform(normalizeDigits)
  .refine((v) => v.length === 0 || v.length === 10, 'Phone must be exactly 10 digits')
  .optional()
  .or(z.literal(''));

export function formatPhone(normalized: string): string {
  const d = normalizeDigits(normalized);
  if (d.length !== 10) return normalized;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** ZIP: 5 or 9 digits (ZIP+4 accepted with or without the hyphen). */
export const zipSchema = z
  .string()
  .trim()
  .min(1, 'ZIP is required')
  .transform(normalizeDigits)
  .refine((v) => v.length === 5 || v.length === 9, 'ZIP must be 5 or 9 digits');

export const stateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(US_STATES, { errorMap: () => ({ message: 'Select a valid state' }) }));

export const entityTypeSchema = z.enum(ENTITY_TYPES, {
  errorMap: () => ({ message: 'Select a business entity type' }),
});

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .email('Enter a valid email address');

/**
 * Password policy. Length carries most of the strength here; the character
 * classes exist to stop the trivially weak cases without pushing users toward
 * `Password1!` patterns.
 */
export const PASSWORD_MIN_LENGTH = 12;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200, 'Password is too long')
  .refine((v) => /[a-z]/.test(v), 'Include a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Include an uppercase letter')
  .refine((v) => /\d/.test(v), 'Include a number');

/** 0–4, for the signup strength meter. Advisory only — never a gate. */
export function passwordStrength(value: string): 0 | 1 | 2 | 3 | 4 {
  if (!value) return 0;
  let score = 0;
  if (value.length >= PASSWORD_MIN_LENGTH) score++;
  if (value.length >= 16) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

export const PASSWORD_STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/** Ownership percentage, 0–100 with two decimals. */
export const ownershipPercentageSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'string' ? Number.parseFloat(v) : v))
  .refine((v) => Number.isFinite(v), 'Enter a valid percentage')
  .refine((v) => v >= 0 && v <= 100, 'Ownership must be between 0 and 100');

/** The attestation threshold shown at signup (spec §6.2, pic6). */
export const MIN_ATTESTED_OWNERSHIP = 25;

export const shortTextSchema = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const optionalTextSchema = (max = 120) => z.string().trim().max(max).optional().or(z.literal(''));
