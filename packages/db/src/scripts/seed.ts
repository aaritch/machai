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
  process.stderr.write(`Seed failed: ${error instanceof Error ? error.message : String(error)}\n`);
  await closeDb();
  process.exit(1);
});
