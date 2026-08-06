import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Loads the repository-root `.env` into `process.env`.
 *
 * Next.js does this for `apps/web` automatically. Nothing else does — the
 * migration and seed scripts run under `tsx`, and so does the worker, so
 * without this they see an empty environment and report "DATABASE_URL is not
 * set" while a perfectly good `.env` sits at the root.
 *
 * Uses Node's built-in `process.loadEnvFile` (20.6+) rather than a dotenv
 * dependency. Callers invoke it explicitly at their entrypoint rather than it
 * happening as an import side effect, so it is obvious where the environment
 * comes from.
 *
 * Values already present in `process.env` win: a variable set by the shell, a
 * container, or a platform's secret store must not be overwritten by a
 * developer's local file.
 */
export function loadEnvFile(startDir: string = process.cwd()): string | null {
  const envPath = findUp('.env', startDir);
  if (!envPath) return null;

  // Snapshot what was already set so the file cannot clobber it.
  const preexisting = new Map(Object.entries(process.env));

  try {
    process.loadEnvFile(envPath);
  } catch {
    // A malformed or unreadable file should not take down a migration; the
    // config validator will report whatever is actually missing.
    return null;
  }

  for (const [key, value] of preexisting) {
    if (value !== undefined) process.env[key] = value;
  }

  return envPath;
}

/** Walks up from `startDir` looking for `filename`, stopping at the root. */
function findUp(filename: string, startDir: string): string | null {
  let current = resolve(startDir);
  for (;;) {
    const candidate = join(current, filename);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
