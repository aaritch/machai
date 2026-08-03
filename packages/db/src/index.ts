export * from './client';
export * from './audit';
export * from './encryption/index';
export * from './schema/index';
export type { AchievementCriteria } from './schema/engagement';

// Re-export the query helpers apps reach for constantly, so a feature module
// imports from one place rather than from drizzle-orm directly.
export {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  isNotNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
