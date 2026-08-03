# Runbook — Database migrations

Migrations are a **gated, reviewed step**. They are not applied by any deploy
pipeline. TASK-01 is explicit: "An auto-applied destructive migration on deploy
can drop data before anyone notices."

## Generating

```bash
# Edit packages/db/src/schema/*.ts, then:
pnpm db:generate
```

`drizzle-kit` writes a plain SQL file to `packages/db/migrations/`. **Read it.**
This is the point at which a rename that Drizzle interpreted as a drop-plus-add
is still cheap to catch.

## Applying

```bash
# Always dry-run first.
pnpm db:migrate -- --dry-run

# Then apply.
pnpm db:migrate
```

The runner:

- connects to `DATABASE_URL_UNPOOLED` (DDL over a transaction pooler fails in
  confusing ways),
- tracks applied files in `schema_migrations`,
- runs each file in its own transaction, so a failure rolls back that file
  rather than leaving the schema half-migrated,
- **refuses** any file containing `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or
  similar, exiting with code 2.

## Applying a destructive migration

This is deliberately awkward. Do it in this order:

1. Confirm a backup exists and note its timestamp.
2. Confirm no running deploy is mid-rollout.
3. Have a second person read the SQL.
4. Run it:

   ```bash
   pnpm db:migrate -- --allow-destructive
   ```

5. Record what was run, by whom, and when, in the changelog of `STATE.md`.

## Expand / contract for anything that would drop data

Never rename or drop in one step against a live database:

1. **Expand** — add the new column, deploy code that writes both.
2. **Backfill** — migrate the data, verify counts.
3. **Migrate reads** — deploy code that reads the new column.
4. **Contract** — drop the old column, in a separate reviewed migration, once
   the previous deploy has been stable long enough to roll back without it.

## If a migration fails halfway

Each file is transactional, so a failed file has rolled back. `schema_migrations`
will not contain it. Fix the SQL and re-run; already-applied files are skipped.

If the process died between the DDL committing and the `schema_migrations`
insert, the file will re-run. Make migrations idempotent where you can
(`IF NOT EXISTS`), or remove the offending statements before re-running.
