import { defineConfig } from 'drizzle-kit';

/**
 * Migrations run against the DIRECT (unpooled) endpoint. Schema changes over a
 * transaction pooler fail in confusing ways — the pooler does not hold the
 * session state DDL needs.
 */
export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
