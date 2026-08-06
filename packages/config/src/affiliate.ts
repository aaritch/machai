/**
 * Affiliate program configuration (spec §1.3, Phase 5).
 *
 * The commission is earned when a referred business starts a PAID PLAN — not
 * when it signs up. That single choice is what makes the program safe: signup
 * is free and collects an EIN, so paying per signup would have funded exactly
 * the fabrication vector spec §6.4 warns about. Paying on conversion means the
 * commission always comes out of revenue that actually arrived.
 *
 * Everything here is data rather than code, so the program can be retuned
 * without a deploy.
 */

/** What has to happen before a referral earns anything. */
export type QualifyingEvent =
  /** The referred user completed the signup wizard. No revenue — unsafe. */
  | 'signup'
  /** They also confirmed their email address. Still no revenue. */
  | 'email_verified'
  /** Their business passed KYB verification. Still no revenue. */
  | 'kyb_verified'
  /** Their subscription went active. Paid out of revenue. */
  | 'subscription_active';

export interface AffiliateProgramConfig {
  /** Commission per qualified referral, in cents. */
  commissionCents: number;
  currency: string;
  qualifyingEvent: QualifyingEvent;
  /**
   * Days a qualified referral is held before it becomes payable.
   *
   * This is a chargeback and refund window, not red tape. A subscription that
   * activates and is then refunded or disputed must not have already paid a
   * commission — the hold is what makes the reversal possible.
   */
  holdDays: number;
  /** Days a referral cookie survives, i.e. the attribution window. */
  attributionWindowDays: number;
  /** Referrals one affiliate may register in a day before they are flagged. */
  dailyReferralReviewThreshold: number;
  /** Affiliate balance required before a payout is issued, in cents. */
  minimumPayoutCents: number;
  /** New affiliates need staff approval before their link earns. */
  requiresApproval: boolean;
}

export const AFFILIATE_PROGRAM: AffiliateProgramConfig = {
  /** $10 per converted referral. */
  commissionCents: 1000,
  currency: 'usd',

  /** Paid on conversion to a paid plan. See the note at the top of this file. */
  qualifyingEvent: 'subscription_active',

  /**
   * 30 days. Comfortably covers Stripe's card dispute window opening and the
   * first renewal, so a subscription that activates and immediately churns has
   * been reversed before the commission is payable.
   */
  holdDays: 30,

  /**
   * 30 days. Long enough that someone can read a recommendation, think about
   * it, and come back; short enough that an affiliate cannot claim a signup
   * they had nothing to do with months later.
   */
  attributionWindowDays: 30,

  dailyReferralReviewThreshold: 10,
  minimumPayoutCents: 5000,
  requiresApproval: true,
};

export function formatCommission(config = AFFILIATE_PROGRAM): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: config.currency.toUpperCase(),
    minimumFractionDigits: config.commissionCents % 100 === 0 ? 0 : 2,
  }).format(config.commissionCents / 100);
}

/** Plain-English description of the qualifying event, for the terms page. */
export const QUALIFYING_EVENT_COPY: Record<QualifyingEvent, string> = {
  signup: 'they complete signup',
  email_verified: 'they complete signup and confirm their email address',
  kyb_verified: 'their business passes verification',
  subscription_active: 'they start a paid plan',
};

/** The referral cookie. Read server-side at signup; never trusted from a form. */
export const REFERRAL_COOKIE = 'machai_ref';

/**
 * Referral codes are short and unambiguous when read aloud or written down:
 * no O/0, no I/1/L. A code someone dictates over the phone has to survive it.
 */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 8;

export function isValidReferralCode(code: string): boolean {
  if (code.length !== REFERRAL_CODE_LENGTH) return false;
  return [...code].every((char) => REFERRAL_CODE_ALPHABET.includes(char));
}
