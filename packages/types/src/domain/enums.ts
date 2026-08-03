/** Enumerations shared by the database schema, the API surface, and the UI. */

export const USER_ROLES = ['member', 'staff', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'suspended', 'closed'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ENTITY_TYPES = [
  'sole_prop',
  'llc',
  's_corp',
  'c_corp',
  'partnership',
  'nonprofit',
  'other',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  sole_prop: 'Sole Proprietorship',
  llc: 'LLC',
  s_corp: 'S Corporation',
  c_corp: 'C Corporation',
  partnership: 'Partnership',
  nonprofit: 'Nonprofit',
  other: 'Other',
};

export const VERIFICATION_STATUSES = ['unverified', 'pending', 'verified', 'rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Mirrors Stripe's subscription status vocabulary exactly (spec §4.5). */
export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const INVOICE_STATUSES = ['draft', 'open', 'paid', 'void', 'uncollectible'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const BUREAUS = ['creditsafe', 'equifax_business', 'dnb'] as const;
export type Bureau = (typeof BUREAUS)[number];

export const BUREAU_LABELS: Record<Bureau, string> = {
  creditsafe: 'Creditsafe',
  equifax_business: 'Equifax Business',
  dnb: 'Dun & Bradstreet',
};

/**
 * Score scales differ per bureau and must never be conflated — a 78 means
 * something very different on a 0–100 scale than on a 0–650 one (spec §7.2).
 */
export const BUREAU_SCORE_SCALES: Record<Bureau, { min: number; max: number; label: string }> = {
  creditsafe: { min: 0, max: 100, label: '0–100' },
  equifax_business: { min: 0, max: 650, label: '0–650' },
  dnb: { min: 0, max: 100, label: '0–100' },
};

export const REPORT_STATUSES = ['pending', 'available', 'failed', 'no_file'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const TRADELINE_ACCOUNT_TYPES = [
  'net30',
  'revolving',
  'installment',
  'vendor',
  'other',
] as const;
export type TradelineAccountType = (typeof TRADELINE_ACCOUNT_TYPES)[number];

export const TRADELINE_PAYMENT_STATUSES = [
  'current',
  'late_30',
  'late_60',
  'late_90',
  'collections',
] as const;
export type TradelinePaymentStatus = (typeof TRADELINE_PAYMENT_STATUSES)[number];

/**
 * `platform_reported` exists in the schema only so Direction B (TASK-06) has a
 * home once furnisher approval lands. Nothing in this codebase writes it —
 * see packages/bureau-clients/src/furnishing.
 */
export const TRADELINE_SOURCES = ['user_added', 'platform_reported', 'bureau_observed'] as const;
export type TradelineSource = (typeof TRADELINE_SOURCES)[number];

export const TICKET_CATEGORIES = [
  'billing',
  'reporting',
  'onboarding',
  'account_access',
  'other',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  billing: 'Billing',
  reporting: 'Credit reporting',
  onboarding: 'Onboarding',
  account_access: 'Account access',
  other: 'Something else',
};

export const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const PLAN_CODES = ['starter', 'professional', 'enterprise'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const SUPPORT_TIERS = ['standard', 'priority', 'dedicated'] as const;
export type SupportTier = (typeof SUPPORT_TIERS)[number];

export const DISPUTE_STATUSES = ['submitted', 'investigating', 'resolved', 'rejected'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const PRODUCT_TYPES = ['course', 'vendor', 'resource', 'product'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'PR', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;
export type UsState = (typeof US_STATES)[number];
