import 'server-only';
import {
  achievements,
  and,
  asc,
  checklistItems,
  count,
  creditReports,
  eq,
  getDb,
  inArray,
  isDatabaseConfigured,
  isNull,
  tradelines,
  userAchievements,
  userChecklistProgress,
  type AchievementCriteria,
} from '@machai/db';
import { logger } from '@machai/observability';

/**
 * Credit checklist and achievements (spec §4.10, §4.11; TASK-07).
 *
 * The design rule: awarding is idempotent and criteria are evaluated against
 * DERIVED state. A badge is a view over facts, not a counter someone increments
 * — so a re-run cannot double-award, and a badge cannot survive the condition
 * that earned it disappearing.
 */

export async function seedUserChecklist(userId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const items = await getDb().select({ id: checklistItems.id }).from(checklistItems);
    if (items.length === 0) return;
    await getDb()
      .insert(userChecklistProgress)
      .values(items.map((item) => ({ userId, checklistItemId: item.id, status: 'todo' as const })))
      .onConflictDoNothing();
  } catch (error) {
    // A missing checklist is cosmetic; it must not fail a signup.
    logger.warn('failed to seed checklist for user', { userId, error });
  }
}

export interface ChecklistEntry {
  id: string;
  key: string;
  title: string;
  description: string;
  category: string;
  points: number;
  complete: boolean;
}

export async function getChecklist(userId: string): Promise<ChecklistEntry[]> {
  if (!isDatabaseConfigured()) return [];

  const rows = await getDb()
    .select({
      id: checklistItems.id,
      key: checklistItems.key,
      title: checklistItems.title,
      description: checklistItems.description,
      category: checklistItems.category,
      points: checklistItems.points,
      status: userChecklistProgress.status,
    })
    .from(checklistItems)
    .leftJoin(
      userChecklistProgress,
      and(
        eq(userChecklistProgress.checklistItemId, checklistItems.id),
        eq(userChecklistProgress.userId, userId),
      ),
    )
    .where(eq(checklistItems.isActive, true))
    .orderBy(asc(checklistItems.displayOrder));

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    category: row.category,
    points: row.points,
    complete: row.status === 'done',
  }));
}

export async function setChecklistItemStatus(
  userId: string,
  checklistItemId: string,
  complete: boolean,
): Promise<void> {
  await getDb()
    .insert(userChecklistProgress)
    .values({
      userId,
      checklistItemId,
      status: complete ? 'done' : 'todo',
      completedAt: complete ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [userChecklistProgress.userId, userChecklistProgress.checklistItemId],
      set: {
        status: complete ? 'done' : 'todo',
        completedAt: complete ? new Date() : null,
        updatedAt: new Date(),
      },
    });
}

// --- Achievements -----------------------------------------------------------

export interface AchievementView {
  key: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: Date | null;
}

/** Facts the criteria evaluate against, gathered once per evaluation. */
export interface AchievementFacts {
  emailVerified: boolean;
  hasBusiness: boolean;
  kybVerified: boolean;
  subscriptionActive: boolean;
  reportsPulled: number;
  checklistCompleted: number;
  tradelinesTracked: number;
  tradelinesAllCurrent: boolean;
  monthsActive: number;
}

export function meetsCriteria(criteria: AchievementCriteria, facts: AchievementFacts): boolean {
  switch (criteria.type) {
    case 'email_verified':
      return facts.emailVerified;
    case 'business_added':
      return facts.hasBusiness;
    case 'kyb_verified':
      return facts.kybVerified;
    case 'subscription_active':
      return facts.subscriptionActive;
    case 'first_report_pulled':
      return facts.reportsPulled >= 1;
    case 'reports_pulled':
      return facts.reportsPulled >= criteria.count;
    case 'checklist_items_completed':
      return facts.checklistCompleted >= criteria.count;
    case 'tradelines_tracked':
      return facts.tradelinesTracked >= criteria.count;
    case 'all_tradelines_current':
      // Guarded on a minimum: "all current" with zero tradelines is vacuously
      // true, and awarding a payment badge to someone with no accounts would be
      // meaningless (TASK-07: gamification should not imply outcomes).
      return (
        facts.tradelinesTracked >= criteria.minimumTradelines && facts.tradelinesAllCurrent
      );
    case 'months_active':
      return facts.monthsActive >= criteria.count;
    default:
      return false;
  }
}

/**
 * Evaluates every achievement and awards any newly met.
 *
 * The unique index on (user, achievement) plus `onConflictDoNothing` IS the
 * idempotency guarantee — no read-then-write race, and a duplicate event
 * cannot double-award (TASK-07 edge case).
 *
 * Failures are swallowed per user: an error evaluating one person's badges must
 * not break the page they were loading.
 */
export async function evaluateAchievements(
  userId: string,
  facts: AchievementFacts,
): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const db = getDb();
    const all = await db.select().from(achievements).where(eq(achievements.isActive, true));
    const earnedKeys = new Set(
      (
        await db
          .select({ achievementId: userAchievements.achievementId })
          .from(userAchievements)
          .where(eq(userAchievements.userId, userId))
      ).map((r) => r.achievementId),
    );

    const toAward = all.filter((a) => !earnedKeys.has(a.id) && meetsCriteria(a.criteria, facts));
    if (toAward.length === 0) return [];

    await db
      .insert(userAchievements)
      .values(toAward.map((a) => ({ userId, achievementId: a.id })))
      .onConflictDoNothing();

    return toAward.map((a) => a.key);
  } catch (error) {
    logger.warn('achievement evaluation failed', { userId, error });
    return [];
  }
}

export async function getAchievements(userId: string): Promise<AchievementView[]> {
  if (!isDatabaseConfigured()) return [];

  const rows = await getDb()
    .select({
      key: achievements.key,
      title: achievements.title,
      description: achievements.description,
      icon: achievements.icon,
      earnedAt: userAchievements.earnedAt,
    })
    .from(achievements)
    .leftJoin(
      userAchievements,
      and(
        eq(userAchievements.achievementId, achievements.id),
        eq(userAchievements.userId, userId),
      ),
    )
    .where(eq(achievements.isActive, true))
    .orderBy(asc(achievements.displayOrder));

  return rows.map((row) => ({
    key: row.key,
    title: row.title,
    description: row.description,
    icon: row.icon,
    earned: Boolean(row.earnedAt),
    earnedAt: row.earnedAt,
  }));
}

/** Gathers the facts for one user, for evaluation. */
export async function collectAchievementFacts(input: {
  userId: string;
  businessId: string | null;
  emailVerified: boolean;
  kybVerified: boolean;
  subscriptionActive: boolean;
  accountCreatedAt: Date;
}): Promise<AchievementFacts> {
  const db = getDb();

  const [reports] = input.businessId
    ? await db
        .select({ value: count() })
        .from(creditReports)
        .where(
          and(
            eq(creditReports.businessId, input.businessId),
            inArray(creditReports.status, ['available', 'no_file']),
          ),
        )
    : [{ value: 0 }];

  const [checklistDone] = await db
    .select({ value: count() })
    .from(userChecklistProgress)
    .where(
      and(eq(userChecklistProgress.userId, input.userId), eq(userChecklistProgress.status, 'done')),
    );

  const lines = input.businessId
    ? await db
        .select({ paymentStatus: tradelines.paymentStatus })
        .from(tradelines)
        .where(and(eq(tradelines.businessId, input.businessId), isNull(tradelines.deletedAt)))
    : [];

  const monthsActive = Math.floor(
    (Date.now() - input.accountCreatedAt.getTime()) / (30 * 24 * 3600 * 1000),
  );

  return {
    emailVerified: input.emailVerified,
    hasBusiness: Boolean(input.businessId),
    kybVerified: input.kybVerified,
    subscriptionActive: input.subscriptionActive,
    reportsPulled: reports?.value ?? 0,
    checklistCompleted: checklistDone?.value ?? 0,
    tradelinesTracked: lines.length,
    tradelinesAllCurrent: lines.length > 0 && lines.every((l) => l.paymentStatus === 'current'),
    monthsActive,
  };
}
