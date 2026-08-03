import { pgEnum } from 'drizzle-orm/pg-core';
import {
  BUREAUS,
  DISPUTE_STATUSES,
  ENTITY_TYPES,
  INVOICE_STATUSES,
  PRODUCT_TYPES,
  REPORT_STATUSES,
  SUBSCRIPTION_STATUSES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TRADELINE_ACCOUNT_TYPES,
  TRADELINE_PAYMENT_STATUSES,
  TRADELINE_SOURCES,
  USER_ROLES,
  USER_STATUSES,
  VERIFICATION_STATUSES,
} from '@machai/types';

/**
 * Postgres enums generated from the shared vocabulary in @machai/types.
 *
 * Deriving them here rather than re-typing the values means the database, the
 * API, and the UI can never disagree about what a valid value is.
 */

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const userStatusEnum = pgEnum('user_status', USER_STATUSES);
export const entityTypeEnum = pgEnum('entity_type', ENTITY_TYPES);
export const verificationStatusEnum = pgEnum('verification_status', VERIFICATION_STATUSES);
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);
export const invoiceStatusEnum = pgEnum('invoice_status', INVOICE_STATUSES);
export const bureauEnum = pgEnum('bureau', BUREAUS);
export const reportStatusEnum = pgEnum('report_status', REPORT_STATUSES);
export const tradelineAccountTypeEnum = pgEnum('tradeline_account_type', TRADELINE_ACCOUNT_TYPES);
export const tradelinePaymentStatusEnum = pgEnum(
  'tradeline_payment_status',
  TRADELINE_PAYMENT_STATUSES,
);
export const tradelineSourceEnum = pgEnum('tradeline_source', TRADELINE_SOURCES);
export const ticketCategoryEnum = pgEnum('ticket_category', TICKET_CATEGORIES);
export const ticketStatusEnum = pgEnum('ticket_status', TICKET_STATUSES);
export const ticketPriorityEnum = pgEnum('ticket_priority', TICKET_PRIORITIES);
export const disputeStatusEnum = pgEnum('dispute_status', DISPUTE_STATUSES);
export const productTypeEnum = pgEnum('product_type', PRODUCT_TYPES);
export const checklistStatusEnum = pgEnum('checklist_status', ['todo', 'done']);
export const ticketAuthorTypeEnum = pgEnum('ticket_author_type', ['member', 'staff']);
