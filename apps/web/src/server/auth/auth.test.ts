import { describe, expect, it } from 'vitest';
import { buildOtpAuthUri, generateMfaSecret, totpCodeAt, verifyTotp } from './mfa';
import { hashPassword, hashTokenValue, issueToken, lockoutDurationMs, verifyPassword } from './password';

/** TASK-02 security scenarios for the auth primitives. */

describe('password hashing', () => {
  it('round-trips a correct password (happy path)', async () => {
    const hash = await hashPassword('CorrectHorse7Battery');
    expect(await verifyPassword('CorrectHorse7Battery', hash)).toBe(true);
  });

  it('rejects a wrong password (failure)', async () => {
    const hash = await hashPassword('CorrectHorse7Battery');
    expect(await verifyPassword('correcthorse7battery', hash)).toBe(false);
  });

  it('never stores the plaintext (security)', async () => {
    const hash = await hashPassword('CorrectHorse7Battery');
    expect(hash).not.toContain('CorrectHorse7Battery');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('salts, so equal passwords hash differently (security)', async () => {
    const a = await hashPassword('CorrectHorse7Battery');
    const b = await hashPassword('CorrectHorse7Battery');
    expect(a).not.toBe(b);
  });

  it('returns false rather than throwing on a malformed hash', async () => {
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
  });
});

describe('lockout escalation', () => {
  it('does not lock out on a few typos', () => {
    expect(lockoutDurationMs(1)).toBe(0);
    expect(lockoutDurationMs(4)).toBe(0);
  });

  it('escalates as attempts continue (security)', () => {
    expect(lockoutDurationMs(5)).toBeGreaterThan(0);
    expect(lockoutDurationMs(9)).toBeGreaterThan(lockoutDurationMs(6));
    expect(lockoutDurationMs(20)).toBeGreaterThan(lockoutDurationMs(9));
  });

  it('stays bounded, so an attacker cannot lock someone out permanently', () => {
    // A permanent lock would be a denial-of-service against any account whose
    // address an attacker knows.
    expect(lockoutDurationMs(1000)).toBeLessThanOrEqual(30 * 60_000);
  });
});

describe('single-use tokens', () => {
  it('stores only a hash, never the token (security)', () => {
    const { token, tokenHash } = issueToken(60);
    expect(tokenHash).not.toBe(token);
    expect(tokenHash).not.toContain(token);
    expect(hashTokenValue(token)).toBe(tokenHash);
  });

  it('expires in the future and is unique per issue', () => {
    const a = issueToken(60);
    const b = issueToken(60);
    expect(a.token).not.toBe(b.token);
    expect(a.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('TOTP', () => {
  it('accepts a code generated for the current window (happy path)', () => {
    const secret = generateMfaSecret();
    const now = Date.now();
    expect(verifyTotp(secret, totpCodeAt(secret, now), now)).toBe(true);
  });

  it('tolerates one step of clock drift (edge)', () => {
    const secret = generateMfaSecret();
    const now = Date.now();
    const code = totpCodeAt(secret, now);
    expect(verifyTotp(secret, code, now + 30_000)).toBe(true);
    expect(verifyTotp(secret, code, now - 30_000)).toBe(true);
  });

  it('rejects a code from far outside the window (security)', () => {
    const secret = generateMfaSecret();
    const now = Date.now();
    const code = totpCodeAt(secret, now);
    expect(verifyTotp(secret, code, now + 10 * 60_000)).toBe(false);
  });

  it('rejects a code generated for a different secret (security)', () => {
    const now = Date.now();
    const code = totpCodeAt(generateMfaSecret(), now);
    expect(verifyTotp(generateMfaSecret(), code, now)).toBe(false);
  });

  it('rejects malformed codes (failure)', () => {
    const secret = generateMfaSecret();
    expect(verifyTotp(secret, '12345')).toBe(false);
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
  });

  it('builds a scannable enrolment URI', () => {
    const secret = generateMfaSecret();
    const uri = buildOtpAuthUri(secret, 'dana@example.com');
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('digits=6');
  });
});
