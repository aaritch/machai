import { afterEach, describe, expect, it } from 'vitest';
import { ConfigError, buildConfigForTest, resetConfigCache } from './server';
import { getAvailabilityLine, getBureauCapabilities, getReportingClaim } from './bureaus';

const BASE_ENV = {
  APP_ENV: 'test',
  SESSION_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  BUREAU_MODE: 'mock',
};

afterEach(() => {
  resetConfigCache();
  process.env.REPORTING_LIVE_CREDITSAFE = 'false';
  process.env.REPORTING_LIVE_EQUIFAX_BUSINESS = 'false';
  process.env.REPORTING_LIVE_DNB = 'false';
});

describe('config validation', () => {
  it('boots a development environment with almost nothing set', () => {
    expect(() => buildConfigForTest({ APP_ENV: 'development' })).not.toThrow();
  });

  it('refuses to boot production without the keys that hold the boundary (failure)', () => {
    // TASK-01: "Given a required env var is missing, when an app boots, then it
    // fails fast with a clear message."
    expect(() => buildConfigForTest({ APP_ENV: 'production' })).toThrow(ConfigError);
    expect(() => buildConfigForTest({ APP_ENV: 'production' })).toThrow(/DATABASE_URL/);
  });

  it('refuses a live Stripe key outside production (security)', () => {
    // TASK-01 caveat: "A production key leaking into staging is a serious
    // incident."
    expect(() =>
      buildConfigForTest({ ...BASE_ENV, APP_ENV: 'staging', STRIPE_SECRET_KEY: 'sk_live_abc' }),
    ).toThrow(/LIVE key/);
  });

  it('refuses a test Stripe key in production (failure)', () => {
    expect(() =>
      buildConfigForTest({
        APP_ENV: 'production',
        DATABASE_URL: 'postgres://x',
        SESSION_SECRET: 'x'.repeat(32),
        STRIPE_SECRET_KEY: 'sk_test_abc',
        STRIPE_WEBHOOK_SECRET: 'whsec_abc',
        ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
      }),
    ).toThrow(/TEST key/);
  });

  it('refuses live bureau mode outside production (security)', () => {
    // Non-production must never make a billable provider call.
    expect(() =>
      buildConfigForTest({ ...BASE_ENV, APP_ENV: 'staging', BUREAU_MODE: 'live' }),
    ).toThrow(/BUREAU_MODE=live/);
  });

  it('requires an encryption key in production when not using KMS', () => {
    expect(() =>
      buildConfigForTest({
        APP_ENV: 'production',
        DATABASE_URL: 'postgres://x',
        SESSION_SECRET: 'x'.repeat(32),
        STRIPE_SECRET_KEY: 'sk_live_abc',
        STRIPE_WEBHOOK_SECRET: 'whsec_abc',
        ENCRYPTION_PROVIDER: 'local',
      }),
    ).toThrow(/ENCRYPTION_KEY/);
  });
});

/**
 * spec §12.4 and TASK-03: no "reports to X" claim may render ahead of that
 * bureau's approved furnisher agreement. These are the tests that hold the
 * line.
 */
describe('reporting claim gating', () => {
  it('renders NO reporting claim when every flag is off (compliance)', () => {
    const claim = getReportingClaim();
    expect(claim.claimLine).toBeNull();
    expect(claim.live).toHaveLength(0);
    // Everything unapproved is described as roadmap, never as active.
    expect(claim.roadmapLine).toContain('roadmap');
  });

  it('describes an unapproved bureau as roadmap, not as reporting', () => {
    const claim = getReportingClaim();
    expect(claim.roadmap.map((b) => b.bureau)).toContain('creditsafe');
    expect(claim.roadmapLine).toContain('data furnisher');
  });

  it('renders a claim only for a bureau whose flag is on', () => {
    process.env.REPORTING_LIVE_CREDITSAFE = 'true';
    resetConfigCache();

    const claim = getReportingClaim();
    expect(claim.claimLine).toContain('Creditsafe');
    expect(claim.live.map((b) => b.bureau)).toEqual(['creditsafe']);
    // The others stay roadmap.
    expect(claim.roadmap.map((b) => b.bureau)).toContain('equifax_business');
    expect(claim.claimLine).not.toContain('Equifax');
  });

  it('separates pull availability from furnishing approval', () => {
    // Two independent capabilities. Being able to READ a bureau's data says
    // nothing about being approved to WRITE to it.
    const capabilities = getBureauCapabilities();
    expect(capabilities.every((c) => c.pullLive)).toBe(true); // mock mode
    expect(capabilities.every((c) => !c.reportingLive)).toBe(true);
  });

  it('names no bureau in the coverage line until one is approved (compliance)', () => {
    // The footer line sits beside the reporting claim, so it is gated on
    // furnisher approval too — not on our ability to read a bureau's data.
    const line = getAvailabilityLine();
    expect(line).toBe('Bureau coverage is being onboarded.');
    expect(line).not.toContain('Creditsafe');
    expect(line).not.toContain('Equifax');
  });

  it('names only the approved bureaus once approval lands', () => {
    process.env.REPORTING_LIVE_CREDITSAFE = 'true';
    resetConfigCache();

    const line = getAvailabilityLine();
    expect(line).toContain('Creditsafe');
    // The unapproved ones stay out of it, even though mock mode makes every
    // bureau readable.
    expect(line).not.toContain('Equifax');
    expect(line).not.toContain('Dun & Bradstreet');
  });
});
