import { loadEnvFile } from '@machai/config';
import { closeDb } from '../client';
import { seed } from '../seed/index';

// Run under tsx, not Next, so the root .env has to be loaded explicitly.
loadEnvFile();

/** `pnpm db:seed` — idempotent, safe to re-run on any environment. */
async function main() {
  const results = await seed();
  for (const r of results) {
    process.stdout.write(`  seeded ${r.table}: ${r.rows} rows\n`);
  }
  process.stdout.write('Seed complete.\n');
  await closeDb();
}

main().catch(async (error) => {
  // Connection failures from postgres-js carry an empty `message` and put the
  // useful part in `code` (ECONNREFUSED, CONNECT_TIMEOUT). Reporting only the
  // message produced a bare "Seed failed:" with no cause.
  process.stderr.write(`Seed failed: ${describeError(error)}\n`);
  await closeDb();
  process.exit(1);
});

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error as { code?: string }).code;
  const parts = [error.message, code && `code ${code}`, error.name !== 'Error' && error.name]
    .filter(Boolean)
    .join(' · ');
  return parts.length > 0 ? parts : 'no detail reported — is the database reachable?';
}
