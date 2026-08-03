import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { checklistStatusEnum, productTypeEnum } from './enums';
import { users } from './identity';

const base = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/** The credit-building checklist (spec §4.10). Seeded content. */
export const checklistItems = pgTable(
  'checklist_items',
  {
    ...base,
    key: text('key').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('general'),
    points: integer('points').notNull().default(10),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [uniqueIndex('checklist_items_key_key').on(t.key)],
);

export const userChecklistProgress = pgTable(
  'user_checklist_progress',
  {
    ...base,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    checklistItemId: uuid('checklist_item_id')
      .notNull()
      .references(() => checklistItems.id, { onDelete: 'cascade' }),
    status: checklistStatusEnum('status').notNull().default('todo'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('user_checklist_unique').on(t.userId, t.checklistItemId)],
);

/**
 * Achievements (spec §4.11). Criteria are data-driven so a new badge does not
 * need a redeploy.
 */
export const achievements = pgTable(
  'achievements',
  {
    ...base,
    key: text('key').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    icon: text('icon').notNull().default('star'),
    criteria: jsonb('criteria').$type<AchievementCriteria>().notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [uniqueIndex('achievements_key_key').on(t.key)],
);

/**
 * Evaluated against derived state, never against a stored counter, so a badge
 * cannot survive the condition that earned it going away mid-evaluation.
 */
export type AchievementCriteria =
  | { type: 'email_verified' }
  | { type: 'business_added' }
  | { type: 'kyb_verified' }
  | { type: 'subscription_active' }
  | { type: 'first_report_pulled' }
  | { type: 'reports_pulled'; count: number }
  | { type: 'checklist_items_completed'; count: number }
  | { type: 'tradelines_tracked'; count: number }
  | { type: 'all_tradelines_current'; minimumTradelines: number }
  | { type: 'months_active'; count: number };

export const userAchievements = pgTable(
  'user_achievements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: uuid('achievement_id')
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // The uniqueness guard IS the idempotency mechanism: a re-evaluation inserts
  // with on-conflict-do-nothing and cannot double-award (TASK-07 edge case).
  (t) => [uniqueIndex('user_achievements_unique').on(t.userId, t.achievementId)],
);

/** Marketplace catalog (spec §4.14), gated by plan access level. */
export const marketplaceItems = pgTable(
  'marketplace_items',
  {
    ...base,
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    type: productTypeEnum('type').notNull(),
    description: text('description').notNull().default(''),
    priceCents: integer('price_cents'),
    /** Minimum plan access level required. 0 = free. */
    accessLevel: integer('access_level').notNull().default(0),
    contentRef: text('content_ref'),
    isActive: boolean('is_active').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (t) => [
    uniqueIndex('marketplace_items_slug_key').on(t.slug),
    index('marketplace_items_access_idx').on(t.accessLevel),
  ],
);

/** Help-center content (spec §4.13). Editable by non-engineers via admin. */
export const helpArticles = pgTable(
  'help_articles',
  {
    ...base,
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    excerpt: text('excerpt').notNull().default(''),
    bodyMarkdown: text('body_markdown').notNull(),
    category: text('category').notNull(),
    isPublished: boolean('is_published').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (t) => [
    uniqueIndex('help_articles_slug_key').on(t.slug),
    index('help_articles_category_idx').on(t.category),
  ],
);

export const faqs = pgTable(
  'faqs',
  {
    ...base,
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    category: text('category').notNull().default('general'),
    displayOrder: integer('display_order').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(true),
  },
  (t) => [index('faqs_category_idx').on(t.category)],
);

export const feedback = pgTable('feedback', {
  ...base,
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  rating: integer('rating').notNull(),
  message: text('message').notNull(),
});
