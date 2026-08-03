import { z } from 'zod';
import {
  BUREAUS,
  TRADELINE_ACCOUNT_TYPES,
  TRADELINE_PAYMENT_STATUSES,
} from '../domain/enums';
import { shortTextSchema } from '../validation/primitives';

const centsSchema = z
  .union([z.string(), z.number()])
  .transform((v) => {
    if (typeof v === 'number') return Math.round(v * 100);
    const cleaned = v.replace(/[^0-9.]/g, '');
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  })
  .nullable();

/**
 * User-tracked tradelines (spec §7.3). `source` is fixed to `user_added` by the
 * server — a client cannot claim a line was platform-reported or
 * bureau-observed.
 */
export const tradelineSchema = z.object({
  creditorName: shortTextSchema('Creditor name', 120),
  accountType: z.enum(TRADELINE_ACCOUNT_TYPES),
  dateOpened: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  creditLimitCents: centsSchema.optional(),
  currentBalanceCents: centsSchema.optional(),
  highBalanceCents: centsSchema.optional(),
  paymentStatus: z.enum(TRADELINE_PAYMENT_STATUSES).default('current'),
  reportedTo: z.array(z.enum(BUREAUS)).default([]),
});
export type TradelineInput = z.input<typeof tradelineSchema>;

export const pullReportSchema = z.object({
  bureau: z.enum(BUREAUS),
});

/**
 * FCRA-aligned dispute intake (spec §14.1). A dispute always targets a concrete
 * report or tradeline so the investigation has a subject.
 */
export const disputeSchema = z
  .object({
    creditReportId: z.string().uuid().optional(),
    tradelineId: z.string().uuid().optional(),
    reason: shortTextSchema('Reason', 200),
    details: z.string().trim().min(20, 'Describe the inaccuracy in more detail').max(5000),
  })
  .refine((d) => Boolean(d.creditReportId ?? d.tradelineId), {
    message: 'Select the report or tradeline you are disputing',
    path: ['tradelineId'],
  });
export type DisputeInput = z.input<typeof disputeSchema>;
