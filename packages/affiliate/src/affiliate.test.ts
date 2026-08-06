import { describe, expect, it } from 'vitest';
import {
  AFFILIATE_PROGRAM,
  QUALIFYING_EVENT_COPY,
  formatCommission,
  isValidReferralCode,
} from '@machai/config/affiliate';
import { generateReferralCode, normalizeReferralCode } from './code';

/**
 * Program-rule tests.
 *
 * The service functions themselves write to the database, so they belong in an
 * integration suite. What is covered here is the part that decides whether
 * money moves at all — and the constants that decide it are exactly the kind of
 * thing a well-meaning edit can quietly change.
 */

describe('program economics', () => {
  it('pays the requested $10 commission', () => {
    expect(AFFILIATE_PROGRAM.commissionCents).toBe(1000);
    expect(formatCommission()).toBe('$10');
  });

  it('earns only on conversion to a paid plan, never on a free signup', () => {
    // This is the guard on the whole program. Signup is free and collects an
    // EIN, so paying on signup would fund fabricated registrations.
    expect(AFFILIATE_PROGRAM.qualifyingEvent).toBe('subscription_active');
    expect(QUALIFYING_EVENT_COPY[AFFILIATE_PROGRAM.qualifyingEvent]).toBe('they start a paid plan');
  });

  it('holds commissions long enough to cover a refund or dispute', () => {
    // A hold shorter than the dispute window means paying out money that can
    // still be taken back.
    expect(AFFILIATE_PROGRAM.holdDays).toBeGreaterThanOrEqual(30);
  });

  it('bounds the attribution window', () => {
    // Unbounded attribution lets an affiliate claim a signup they had nothing
    // to do with months later.
    expect(AFFILIATE_PROGRAM.attributionWindowDays).toBeGreaterThan(0);
    expect(AFFILIATE_PROGRAM.attributionWindowDays).toBeLessThanOrEqual(90);
  });

  it('requires approval and sets a review threshold', () => {
    expect(AFFILIATE_PROGRAM.requiresApproval).toBe(true);
    expect(AFFILIATE_PROGRAM.dailyReferralReviewThreshold).toBeGreaterThan(0);
  });

  it('sets a minimum payout so balances are not paid in pennies', () => {
    expect(AFFILIATE_PROGRAM.minimumPayoutCents).toBeGreaterThanOrEqual(
      AFFILIATE_PROGRAM.commissionCents,
    );
  });
});

describe('referral codes', () => {
  it('generates valid codes', () => {
    for (let i = 0; i < 200; i++) {
      expect(isValidReferralCode(generateReferralCode())).toBe(true);
    }
  });

  it('generates codes without visually ambiguous characters', () => {
    // A code someone dictates or writes down has to survive it: no O/0, I/1/L.
    const codes = Array.from({ length: 200 }, () => generateReferralCode()).join('');
    for (const banned of ['O', '0', 'I', '1', 'L']) {
      expect(codes).not.toContain(banned);
    }
  });

  it('produces distinct codes', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateReferralCode()));
    // Collisions are handled by a retry against a unique index, but a generator
    // that clusters would make them routine.
    expect(codes.size).toBeGreaterThan(495);
  });

  it('normalizes user input from URLs and hand-typing', () => {
    expect(normalizeReferralCode(' abcd2345 ')).toBe('ABCD2345');
    expect(normalizeReferralCode('ABCD-2345')).toBe('ABCD2345');
  });

  it('rejects malformed codes', () => {
    expect(isValidReferralCode('')).toBe(false);
    expect(isValidReferralCode('ABC')).toBe(false);
    expect(isValidReferralCode('ABCD23456')).toBe(false);
    // Ambiguous characters are not in the alphabet, so they are invalid.
    expect(isValidReferralCode('ABCD012I')).toBe(false);
    expect(isValidReferralCode('abcd2345')).toBe(false);
  });
});

describe('middleware code pattern agrees with the config alphabet', () => {
  it('accepts every generated code and rejects ambiguous characters', () => {
    // The edge middleware cannot import node crypto, so it carries its own
    // regex. If the two drift, referral links silently stop being captured.
    const middlewarePattern = /^[A-HJ-NP-Z2-9]{8}$/;
    for (let i = 0; i < 200; i++) {
      expect(middlewarePattern.test(generateReferralCode())).toBe(true);
    }
    expect(middlewarePattern.test('ABCD0123')).toBe(false);
    expect(middlewarePattern.test('ABCDIJKL')).toBe(false);
  });
});
