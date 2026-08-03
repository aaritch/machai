import { describe, expect, it } from 'vitest';
import {
  einSchema,
  formatEin,
  formatPhone,
  maskEin,
  passwordSchema,
  passwordStrength,
  phoneSchema,
  stateSchema,
  zipSchema,
} from './primitives';
import { representativeStepSchema } from '../dto/onboarding';

/** TASK-02 test scenarios: field validation across all four buckets. */

describe('EIN validation', () => {
  it('accepts nine digits (happy path)', () => {
    expect(einSchema.parse('123456789')).toBe('123456789');
  });

  it('normalizes dashes and spaces to nine digits (edge)', () => {
    // TASK-02: "Given an EIN entered as 12-3456789 with dashes/spaces, when
    // submitted, then it is normalized to 9 digits and accepted."
    expect(einSchema.parse('12-3456789')).toBe('123456789');
    expect(einSchema.parse(' 12 345 6789 ')).toBe('123456789');
    expect(einSchema.parse('12–3456789'.replace('–', '-'))).toBe('123456789');
  });

  it('rejects the wrong number of digits (failure)', () => {
    expect(() => einSchema.parse('12345678')).toThrow();
    expect(() => einSchema.parse('1234567890')).toThrow();
    expect(() => einSchema.parse('')).toThrow();
  });

  it('rejects a repeated-digit EIN (failure)', () => {
    expect(() => einSchema.parse('111111111')).toThrow();
  });

  it('never reveals more than the last four when masked (security)', () => {
    const masked = maskEin('123456789');
    expect(masked).toContain('6789');
    expect(masked).not.toContain('12345');
    // The first five digits must not survive anywhere in the masked form.
    expect(masked).not.toMatch(/1234/);
  });

  it('formats for display without changing the stored value', () => {
    expect(formatEin('123456789')).toBe('12-3456789');
  });
});

describe('phone validation', () => {
  it('accepts ten digits and strips formatting', () => {
    expect(phoneSchema.parse('(555) 010-1234')).toBe('5550101234');
  });

  it('rejects anything that is not ten digits', () => {
    expect(() => phoneSchema.parse('555010123')).toThrow();
    expect(() => phoneSchema.parse('15550101234')).toThrow();
  });

  it('formats for display', () => {
    expect(formatPhone('5550101234')).toBe('(555) 010-1234');
  });
});

describe('ZIP and state validation', () => {
  it('accepts 5 and 9 digit ZIPs', () => {
    expect(zipSchema.parse('12345')).toBe('12345');
    expect(zipSchema.parse('12345-6789')).toBe('123456789');
  });

  it('rejects other lengths', () => {
    expect(() => zipSchema.parse('1234')).toThrow();
    expect(() => zipSchema.parse('1234567')).toThrow();
  });

  it('uppercases and validates state codes', () => {
    expect(stateSchema.parse('ca')).toBe('CA');
    expect(() => stateSchema.parse('XX')).toThrow();
  });
});

describe('password policy', () => {
  it('accepts a long mixed-case password with a digit', () => {
    expect(passwordSchema.parse('CorrectHorse7Battery')).toBe('CorrectHorse7Battery');
  });

  it('rejects short passwords regardless of complexity', () => {
    expect(() => passwordSchema.parse('Aa1!')).toThrow();
  });

  it('scores strength monotonically', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abcdefghijkl')).toBeLessThan(passwordStrength('Abcdefghijkl1'));
    expect(passwordStrength('Abcdefghijklmnop1!')).toBe(4);
  });
});

describe('representative attestation', () => {
  const base = {
    firstName: 'Dana',
    lastName: 'Reyes',
    title: 'Owner',
    email: 'dana@example.com',
    phone: '',
    ownershipPercentage: '51',
    attestedAuthority: true,
  };

  it('accepts an attestation backed by sufficient ownership (happy path)', () => {
    expect(() => representativeStepSchema.parse(base)).not.toThrow();
  });

  it('rejects an attestation that the ownership contradicts (edge)', () => {
    // TASK-02: "Given ownership percentage below the attested threshold, when
    // submitting step 2, then the attestation cannot be truthfully checked and
    // the UI surfaces the mismatch."
    expect(() => representativeStepSchema.parse({ ...base, ownershipPercentage: '10' })).toThrow();
  });

  it('rejects an unchecked attestation (failure)', () => {
    expect(() => representativeStepSchema.parse({ ...base, attestedAuthority: false })).toThrow();
  });
});
