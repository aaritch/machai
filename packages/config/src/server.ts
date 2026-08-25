import { z } from 'zod';

/**
 * Server-only runtime configuration.
 *
 * TASK-01 requires this to FAIL FAST when a required key is missing, rather
 * than surfacing a confusing runtime error later. "Required" is
 * environment-dependent: local dev must boot with almost nothing set, while
 * production refuses to start without the keys that hold the security
 * boundary.
 */

const booleanish = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),

  DATABASE_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  REDIS_URL: z.string().optional(),

  ENCRYPTION_PROVIDER: z.enum(['local', 'kms']).default('local'),
  ENCRYPTION_KEY: z.string().optional(),
  KMS_KEY_ID: z.string().optional(),

  SESSION_SECRET: z.string().optional(),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(60),
  SESSION_ABSOLUTE_TIMEOUT_HOURS: z.coerce.number().int().positive().default(720),

  STRIPE_SECRET_KEY: z.string().optional(),
  // Read here only so the prefix can be validated at boot. The browser gets it
  // from the NEXT_PUBLIC_ inlining, not from this module.
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PROFESSIONAL: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE: z.string().optional(),

  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  EMAIL_FROM: z.string().default('Machai <no-reply@example.com>'),
  RESEND_API_KEY: z.string().optional(),

  BUREAU_MODE: z.enum(['mock', 'live']).default('mock'),
  CREDITSAFE_API_URL: z.string().optional(),
  CREDITSAFE_API_KEY: z.string().optional(),
  EQUIFAX_BUSINESS_API_URL: z.string().optional(),
  EQUIFAX_BUSINESS_API_KEY: z.string().optional(),
  DNB_API_URL: z.string().optional(),
  DNB_API_KEY: z.string().optional(),
  EXPERIAN_BUSINESS_API_URL: z.string().optional(),
  EXPERIAN_BUSINESS_API_KEY: z.string().optional(),

  REPORTING_LIVE_CREDITSAFE: booleanish,
  REPORTING_LIVE_EQUIFAX_BUSINESS: booleanish,
  REPORTING_LIVE_DNB: booleanish,
  REPORTING_LIVE_EXPERIAN_BUSINESS: booleanish,

  KYB_PROVIDER: z.enum(['manual', 'middesk']).default('manual'),
  KYB_API_KEY: z.string().optional(),

  TURNSTILE_SECRET_KEY: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  WORKER_PORT: z.coerce.number().int().positive().default(3001),
  WORKER_INTERNAL_TOKEN: z.string().optional(),
});

export type RawServerConfig = z.infer<typeof rawSchema>;

/**
 * Keys without which production must not boot. Missing any of these means the
 * security boundary is not actually in place: no session secret means forgeable
 * sessions, no encryption key means plaintext EINs.
 */
const PRODUCTION_REQUIRED = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function build(env: NodeJS.ProcessEnv = process.env) {
  const parsed = rawSchema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new ConfigError(`Invalid environment configuration:\n${detail}`);
  }
  const c = parsed.data;
  const isProduction = c.APP_ENV === 'production';

  /**
   * Reject a key whose prefix Stripe does not issue.
   *
   * The environment checks below only compare `sk_test_` against `sk_live_`,
   * so anything else — a typo, a key from another service, a truncated paste —
   * passed straight through. `hasStripe` then went true, the pricing page
   * rendered Subscribe buttons, and the first sign of trouble was a customer
   * reaching Checkout and getting an auth error. Fail at boot instead.
   */
  if (c.STRIPE_SECRET_KEY && !/^(sk|rk)_(test|live)_/.test(c.STRIPE_SECRET_KEY)) {
    throw new ConfigError(
      `STRIPE_SECRET_KEY does not look like a Stripe secret key. Expected it to start with ` +
        `sk_test_, sk_live_, rk_test_ or rk_live_, got "${c.STRIPE_SECRET_KEY.slice(0, 4)}…". ` +
        `Publishable keys (pk_) belong in NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, and the webhook ` +
        `signing secret (whsec_) in STRIPE_WEBHOOK_SECRET.`,
    );
  }
  if (
    c.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    !/^pk_(test|live)_/.test(c.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  ) {
    throw new ConfigError(
      `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY should start with pk_test_ or pk_live_. A secret key ` +
        `here would be published to the browser.`,
    );
  }
  if (c.STRIPE_WEBHOOK_SECRET && !c.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
    throw new ConfigError(
      `STRIPE_WEBHOOK_SECRET should start with whsec_. It is the endpoint's signing secret, ` +
        `not an API key — see docs/runbooks/stripe-setup.md.`,
    );
  }

  if (isProduction) {
    const missing = PRODUCTION_REQUIRED.filter((key) => !c[key]);
    if (missing.length > 0) {
      throw new ConfigError(
        `Missing required production environment variables: ${missing.join(', ')}. ` +
          `See .env.example. Refusing to boot rather than run without them.`,
      );
    }
    if (c.ENCRYPTION_PROVIDER === 'local' && !c.ENCRYPTION_KEY) {
      throw new ConfigError(
        'ENCRYPTION_KEY is required when ENCRYPTION_PROVIDER=local. EIN fields cannot be ' +
          'written without it. Prefer ENCRYPTION_PROVIDER=kms in production.',
      );
    }
    // A live key in a non-production environment charges real cards; the
    // inverse — a test key in production — silently fails to collect money.
    if (c.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      throw new ConfigError('APP_ENV=production is configured with a Stripe TEST key.');
    }
  } else if (c.STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
    throw new ConfigError(
      `A Stripe LIVE key is set in APP_ENV=${c.APP_ENV}. This would charge real cards. ` +
        `Use test-mode keys outside production (TASK-01 caveat).`,
    );
  }

  if (c.BUREAU_MODE === 'live' && !isProduction) {
    throw new ConfigError(
      `BUREAU_MODE=live outside production. Non-production environments must use the mock ` +
        `bureau client so no billable provider calls are made (spec §3.3).`,
    );
  }

  return {
    ...c,
    isProduction,
    isDevelopment: c.APP_ENV === 'development',
    /** Feature availability, derived rather than re-checked at every call site. */
    hasDatabase: Boolean(c.DATABASE_URL),
    hasRedis: Boolean(c.REDIS_URL),
    hasStripe: Boolean(c.STRIPE_SECRET_KEY),
    hasStorage: Boolean(c.STORAGE_BUCKET && c.STORAGE_ACCESS_KEY_ID),
    hasCaptcha: Boolean(c.TURNSTILE_SECRET_KEY),
  };
}

export type ServerConfig = ReturnType<typeof build>;

let cached: ServerConfig | null = null;

/**
 * Loads and caches config. Throws a ConfigError with an actionable message on
 * the first call if the environment is unusable.
 */
export function getConfig(): ServerConfig {
  // Checked via globalThis rather than a bare `window` so this module needs no
  // DOM lib — it is server-only and should not pull browser types in.
  if (typeof (globalThis as { window?: unknown }).window !== 'undefined') {
    throw new ConfigError('@machai/config/server was imported into a browser bundle.');
  }
  cached ??= build();
  return cached;
}

/** Test-only: rebuild from an explicit env. */
export function buildConfigForTest(env: NodeJS.ProcessEnv): ServerConfig {
  return build(env);
}

export function resetConfigCache(): void {
  cached = null;
}
