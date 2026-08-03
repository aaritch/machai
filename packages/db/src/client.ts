import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getConfig } from '@machai/config';
import * as schema from './schema/index';

/**
 * The shared database client used by both apps.
 *
 * Connection strategy matters here (TASK-01 caveat: "serverless connection
 * storms"). Vercel functions open many short-lived connections, so the web app
 * must use the POOLED endpoint with a tiny per-instance pool. `prepare: false`
 * is required for transaction-mode poolers like PgBouncer and the Neon pooler,
 * which do not keep prepared statements across a transaction boundary.
 */

export type Database = PostgresJsDatabase<typeof schema>;

let cachedDb: Database | null = null;
let cachedSql: postgres.Sql | null = null;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      'DATABASE_URL is not set. Provision Postgres and set it in the environment ' +
        '(see .env.example). Marketing pages render without it; anything that reads or ' +
        'writes user data does not.',
    );
    this.name = 'DatabaseNotConfiguredError';
  }
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getConfig().DATABASE_URL);
}

export function getDb(): Database {
  if (cachedDb) return cachedDb;
  const config = getConfig();
  if (!config.DATABASE_URL) throw new DatabaseNotConfiguredError();

  cachedSql = postgres(config.DATABASE_URL, {
    // One connection per serverless instance. The pooler multiplexes; a large
    // per-instance pool just moves the exhaustion problem around.
    max: config.isProduction ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
  });

  cachedDb = drizzle(cachedSql, { schema, logger: false });
  return cachedDb;
}

/**
 * Returns the client, or null when the database is unconfigured.
 *
 * Lets marketing pages degrade to seed content on a fresh deploy instead of
 * erroring — see the pricing page, which falls back to the plan catalog.
 */
export function tryGetDb(): Database | null {
  return isDatabaseConfigured() ? getDb() : null;
}

/** Closes the pool. For scripts and tests; serverless never calls this. */
export async function closeDb(): Promise<void> {
  await cachedSql?.end({ timeout: 5 });
  cachedSql = null;
  cachedDb = null;
}

export { schema };
