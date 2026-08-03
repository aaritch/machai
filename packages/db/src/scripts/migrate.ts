import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '@machai/config';
import postgres from 'postgres';

/**
 * Migration runner.
 *
 * TASK-01 requires migrations to be a GATED, reviewed step — never
 * auto-applied on deploy. Two guards enforce that here:
 *
 *  1. Statements that drop or truncate refuse to run unless
 *     `--allow-destructive` is passed explicitly. An auto-applied destructive
 *     migration can drop data before anyone notices.
 *  2. It connects to the DIRECT endpoint, not the pooler — DDL over a
 *     transaction pooler fails in confusing ways.
 */

const DESTRUCTIVE_PATTERN =
  /\b(drop\s+(table|column|schema|database|type)|truncate|alter\s+table\s+\S+\s+drop\s+column)\b/i;

async function main() {
  const args = process.argv.slice(2);
  const allowDestructive = args.includes('--allow-destructive');
  const dryRun = args.includes('--dry-run');

  const config = getConfig();
  const url = config.DATABASE_URL_UNPOOLED ?? config.DATABASE_URL;
  if (!url) {
    process.stderr.write('DATABASE_URL is not set. Nothing to migrate against.\n');
    process.exit(1);
  }

  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');
  let files: string[];
  try {
    files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch {
    process.stderr.write(
      `No migrations directory at ${migrationsDir}. Run \`pnpm db:generate\` first.\n`,
    );
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const applied = new Set(
      (await sql<{ filename: string }[]>`SELECT filename FROM schema_migrations`).map(
        (r) => r.filename,
      ),
    );

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      process.stdout.write('No pending migrations.\n');
      return;
    }

    for (const file of pending) {
      const body = readFileSync(join(migrationsDir, file), 'utf8');
      const destructive = DESTRUCTIVE_PATTERN.test(body);

      if (destructive && !allowDestructive) {
        process.stderr.write(
          `\nBLOCKED: ${file} contains a destructive statement (drop/truncate).\n` +
            `This migration will not run automatically. Review it, then re-run with\n` +
            `  pnpm db:migrate -- --allow-destructive\n` +
            `after taking a backup. See docs/runbooks/migrations.md.\n`,
        );
        process.exit(2);
      }

      if (dryRun) {
        process.stdout.write(`  would apply ${file}${destructive ? ' (DESTRUCTIVE)' : ''}\n`);
        continue;
      }

      process.stdout.write(`  applying ${file}${destructive ? ' (DESTRUCTIVE)' : ''}\n`);
      // Each migration runs in its own transaction: a failure rolls back that
      // file rather than leaving the schema half-migrated.
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`INSERT INTO schema_migrations (filename) VALUES (${file})`;
      });
    }

    process.stdout.write(`${dryRun ? 'Dry run' : 'Migration'} complete.\n`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  process.stderr.write(
    `Migration failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
