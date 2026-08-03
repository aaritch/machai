import { randomBytes } from 'node:crypto';

/**
 * Test environment.
 *
 * Deliberately does NOT set DATABASE_URL, STRIPE_SECRET_KEY, or any bureau
 * credential: the suites here are pure-logic tests of validation, encryption,
 * entitlements, normalization, and the compliance gates. Anything needing a
 * live service belongs in an integration suite with its own fixtures.
 *
 * The encryption key is generated per run, which also proves the encryption
 * helpers do not depend on a fixed key.
 */
process.env.NODE_ENV = 'test';
process.env.APP_ENV = 'test';
process.env.ENCRYPTION_PROVIDER = 'local';
process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.SESSION_SECRET = randomBytes(32).toString('base64');
process.env.BUREAU_MODE = 'mock';
process.env.LOG_LEVEL = 'error';

// Reporting flags default OFF, matching production reality: no bureau has
// approved us as a data furnisher. Tests that need them on set them explicitly.
process.env.REPORTING_LIVE_CREDITSAFE = 'false';
process.env.REPORTING_LIVE_EQUIFAX_BUSINESS = 'false';
process.env.REPORTING_LIVE_DNB = 'false';
