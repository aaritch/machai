import type { Bureau } from '../domain/enums';

/**
 * Job payload shapes shared by producer (web) and consumer (worker).
 *
 * Queue contract (project plan C.3): producers enqueue a typed job; the worker
 * consumes exactly-once via an idempotency store, with retry, backoff, and a
 * dead-letter path. Every handler must be safe to run twice.
 */

export const QUEUE_NAMES = {
  stripeEvents: 'stripe-events',
  reportPull: 'report-pull',
  monitoring: 'monitoring',
  emails: 'emails',
  kyb: 'kyb',
  /** Registered but intentionally unimplemented until TASK-06 clears legal. */
  reportingRun: 'reporting-run',
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface StripeEventJob {
  /** Stripe's event id — also the idempotency key. Stripe retries deliveries. */
  eventId: string;
  eventType: string;
}

export interface ReportPullJob {
  businessId: string;
  bureau: Bureau;
  requestedByUserId: string;
  /**
   * `${businessId}:${bureau}:${YYYY-MM-DD}` — makes the pull idempotent per
   * business/bureau/day so a double-click cannot bill the data provider twice
   * (TASK-05 edge case).
   */
  idempotencyKey: string;
}

export interface MonitoringJob {
  businessId: string;
  bureau: Bureau;
  reason: 'scheduled_refresh';
}

export interface EmailJob {
  template: EmailTemplateKey;
  to: string;
  /**
   * Template variables only. Never an EIN, a report payload, or anything from
   * the highly-sensitive class (spec §13.1).
   */
  data: Record<string, string | number | boolean | null>;
}

export const EMAIL_TEMPLATES = {
  verifyEmail: 'verify-email',
  passwordReset: 'password-reset',
  contactAutoresponder: 'contact-autoresponder',
  ticketReply: 'ticket-reply',
  reportReady: 'report-ready',
  reportFailed: 'report-failed',
  scoreAlert: 'score-alert',
  paymentFailed: 'payment-failed',
  subscriptionActivated: 'subscription-activated',
  enterpriseLead: 'enterprise-lead',
} as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATES)[keyof typeof EMAIL_TEMPLATES];

export interface KybJob {
  businessId: string;
  attempt: number;
}

/** Maps each queue to its payload so producers and consumers cannot drift. */
export interface JobPayloadMap {
  [QUEUE_NAMES.stripeEvents]: StripeEventJob;
  [QUEUE_NAMES.reportPull]: ReportPullJob;
  [QUEUE_NAMES.monitoring]: MonitoringJob;
  [QUEUE_NAMES.emails]: EmailJob;
  [QUEUE_NAMES.kyb]: KybJob;
  [QUEUE_NAMES.reportingRun]: never;
}

export interface EnqueueOptions {
  /** Deduplication key. A second enqueue with the same id is dropped. */
  jobId?: string;
  delayMs?: number;
  attempts?: number;
}

/** Builds the per-day idempotency key for a report pull. */
export function reportPullIdempotencyKey(
  businessId: string,
  bureau: Bureau,
  date: Date = new Date(),
): string {
  const day = date.toISOString().slice(0, 10);
  return `${businessId}:${bureau}:${day}`;
}
