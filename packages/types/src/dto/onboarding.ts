import { z } from 'zod';
import {
  einSchema,
  emailSchema,
  entityTypeSchema,
  MIN_ATTESTED_OWNERSHIP,
  optionalPhoneSchema,
  optionalTextSchema,
  ownershipPercentageSchema,
  passwordSchema,
  phoneSchema,
  shortTextSchema,
  stateSchema,
  zipSchema,
} from '../validation/primitives';

/**
 * The three-step wizard: Business → Representative → Account (spec §6).
 *
 * Each step validates independently so progress can be saved and resumed, and
 * the final submit re-validates all three server-side before the transaction.
 */

export const businessStepSchema = z.object({
  legalName: shortTextSchema('Business name', 120).refine(
    (v) => v.length >= 2,
    'Business name must be at least 2 characters',
  ),
  dbaName: optionalTextSchema(120),
  streetAddress: shortTextSchema('Street address', 200),
  addressLine2: optionalTextSchema(200),
  city: shortTextSchema('City', 100),
  state: stateSchema,
  zip: zipSchema,
  ein: einSchema,
  entityType: entityTypeSchema,
  phone: phoneSchema,
});
export type BusinessStepInput = z.input<typeof businessStepSchema>;
export type BusinessStepData = z.output<typeof businessStepSchema>;

export const representativeStepSchema = z
  .object({
    firstName: shortTextSchema('First name', 80),
    lastName: shortTextSchema('Last name', 80),
    title: shortTextSchema('Title', 80),
    email: emailSchema,
    phone: optionalPhoneSchema,
    ownershipPercentage: ownershipPercentageSchema,
    /** "I confirm the registered representative has at least 25% ownership." */
    attestedAuthority: z.boolean(),
  })
  .refine((data) => data.attestedAuthority, {
    message: 'You must confirm the representative has authority to act for the business',
    path: ['attestedAuthority'],
  })
  /**
   * The attestation and the number have to agree. If someone enters 10% they
   * cannot truthfully check a ≥25% box — surface the mismatch instead of
   * silently accepting a false attestation (TASK-02 edge case).
   */
  .refine((data) => !data.attestedAuthority || data.ownershipPercentage >= MIN_ATTESTED_OWNERSHIP, {
    message: `Ownership is below ${MIN_ATTESTED_OWNERSHIP}%, so this attestation cannot be made. Enter the owner's details instead.`,
    path: ['attestedAuthority'],
  });
export type RepresentativeStepInput = z.input<typeof representativeStepSchema>;
export type RepresentativeStepData = z.output<typeof representativeStepSchema>;

export const accountStepSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptedTerms: z.boolean(),
    marketingOptIn: z.boolean().default(false),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.acceptedTerms, {
    message: 'You must accept the Terms of Service and Privacy Policy',
    path: ['acceptedTerms'],
  });
export type AccountStepInput = z.input<typeof accountStepSchema>;
export type AccountStepData = z.output<typeof accountStepSchema>;

/** Full wizard submit — the server re-validates every step, not just the last. */
export const signupSchema = z.object({
  business: businessStepSchema,
  representative: representativeStepSchema,
  account: accountStepSchema,
});
export type SignupInput = z.input<typeof signupSchema>;

export const WIZARD_STEPS = [
  { key: 'business', label: 'Business', number: 1 },
  { key: 'representative', label: 'Representative', number: 2 },
  { key: 'account', label: 'Account', number: 3 },
] as const;
export type WizardStepKey = (typeof WIZARD_STEPS)[number]['key'];

/** Post-signup profile edits. EIN and legal name changes re-trigger KYB. */
export const businessProfileUpdateSchema = businessStepSchema.partial().extend({
  website: optionalTextSchema(200),
});
export type BusinessProfileUpdate = z.input<typeof businessProfileUpdateSchema>;

/** Fields whose change invalidates a prior KYB decision (TASK-02 caveat). */
export const KYB_SENSITIVE_FIELDS = ['legalName', 'ein', 'entityType'] as const;
