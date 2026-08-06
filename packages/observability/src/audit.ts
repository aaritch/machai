/**
 * Audit action vocabulary.
 *
 * The invariant (STATE.md §8): every sensitive action writes an `audit_log`
 * entry that references ids, never sensitive values. Keeping the action names
 * in a closed set means the log stays queryable and a reviewer can enumerate
 * exactly what is covered.
 *
 * Writing entries is @machai/db's job; naming them is this package's.
 */

export const AUDIT_ACTIONS = {
  // Authentication
  LOGIN_SUCCEEDED: 'auth.login.succeeded',
  LOGIN_FAILED: 'auth.login.failed',
  LOGIN_LOCKED_OUT: 'auth.login.locked_out',
  LOGOUT: 'auth.logout',
  LOGOUT_ALL_SESSIONS: 'auth.logout_all',
  SIGNUP_COMPLETED: 'auth.signup.completed',
  EMAIL_VERIFIED: 'auth.email.verified',
  EMAIL_VERIFICATION_RESENT: 'auth.email.verification_resent',
  PASSWORD_RESET_REQUESTED: 'auth.password.reset_requested',
  PASSWORD_RESET_COMPLETED: 'auth.password.reset_completed',
  PASSWORD_CHANGED: 'auth.password.changed',
  MFA_ENROLLED: 'auth.mfa.enrolled',
  MFA_CHALLENGE_FAILED: 'auth.mfa.challenge_failed',

  // Sensitive reads — required by spec §13.5
  EIN_VIEWED: 'business.ein.viewed',
  REPORT_VIEWED: 'report.viewed',
  REPORT_PDF_URL_ISSUED: 'report.pdf_url.issued',
  DATA_EXPORTED: 'account.data.exported',

  // Business
  BUSINESS_CREATED: 'business.created',
  BUSINESS_UPDATED: 'business.updated',
  KYB_REQUESTED: 'business.kyb.requested',
  KYB_DECIDED: 'business.kyb.decided',

  // Billing
  CHECKOUT_SESSION_CREATED: 'billing.checkout.created',
  PORTAL_SESSION_CREATED: 'billing.portal.created',
  SUBSCRIPTION_MIRRORED: 'billing.subscription.mirrored',
  INVOICE_MIRRORED: 'billing.invoice.mirrored',
  WEBHOOK_RECEIVED: 'billing.webhook.received',
  WEBHOOK_SIGNATURE_REJECTED: 'billing.webhook.signature_rejected',
  ENTERPRISE_LEAD_SUBMITTED: 'billing.enterprise_lead.submitted',

  // Bureau interaction — every one is audited (spec §13.5)
  REPORT_PULL_REQUESTED: 'bureau.pull.requested',
  REPORT_PULL_COMPLETED: 'bureau.pull.completed',
  REPORT_PULL_FAILED: 'bureau.pull.failed',
  REPORT_PULL_BLOCKED: 'bureau.pull.blocked',
  DISPUTE_FILED: 'bureau.dispute.filed',

  // Authorization failures — the attempt itself is the signal
  OWNERSHIP_CHECK_FAILED: 'authz.ownership.failed',
  ENTITLEMENT_CHECK_FAILED: 'authz.entitlement.failed',
  ROLE_CHECK_FAILED: 'authz.role.failed',

  // Affiliate program — every money-affecting transition is recorded
  AFFILIATE_APPLIED: 'affiliate.applied',
  AFFILIATE_APPROVED: 'affiliate.approved',
  AFFILIATE_SUSPENDED: 'affiliate.suspended',
  REFERRAL_RECORDED: 'affiliate.referral.recorded',
  REFERRAL_REJECTED: 'affiliate.referral.rejected',
  REFERRAL_FLAGGED: 'affiliate.referral.flagged',
  REFERRAL_QUALIFIED: 'affiliate.referral.qualified',
  REFERRAL_BECAME_PAYABLE: 'affiliate.referral.payable',
  REFERRAL_REVERSED: 'affiliate.referral.reversed',
  AFFILIATE_PAYOUT_ISSUED: 'affiliate.payout.issued',

  // Admin
  ADMIN_USER_VIEWED: 'admin.user.viewed',
  ADMIN_USER_UPDATED: 'admin.user.updated',
  ADMIN_KYB_DECIDED: 'admin.kyb.decided',
  ADMIN_TICKET_UPDATED: 'admin.ticket.updated',
  ADMIN_PLAN_UPDATED: 'admin.plan.updated',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEntryInput {
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /**
   * Ids, counts, status codes, and enum values only.
   *
   * Never an EIN, a password, a token, or a report payload — the whole point of
   * the audit log is that it can be read freely during an investigation.
   */
  metadata?: Record<string, string | number | boolean | null>;
}
