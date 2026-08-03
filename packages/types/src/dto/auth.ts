import { z } from 'zod';
import { emailSchema, passwordSchema } from '../validation/primitives';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  /** Present only when the account has TOTP enrolled. */
  totpCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code')
    .optional()
    .or(z.literal('')),
});
export type LoginInput = z.input<typeof loginSchema>;

export const requestPasswordResetSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const mfaEnrollSchema = z.object({
  secret: z.string().min(16),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

/**
 * Deliberately identical text for "no such account" and "wrong password".
 * Distinguishing them hands an attacker an account-enumeration oracle
 * (TASK-02 security scenario).
 */
export const GENERIC_AUTH_ERROR = 'That email and password combination is not recognized.';

/**
 * Signup and password-reset responses are always phrased so they read the same
 * whether or not the address is registered.
 */
export const GENERIC_RESET_ACK =
  'If an account exists for that address, a reset link is on its way.';
