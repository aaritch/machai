import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

/**
 * Password hashing and single-use tokens.
 *
 * bcrypt at cost 12 (decision D5: in-house auth). Argon2id would be the
 * stronger choice, but every Node binding for it is native, and native modules
 * are a recurring source of build failures across Vercel's build image, the
 * worker's Alpine container, and Windows development machines. bcryptjs is pure
 * JavaScript, runs identically everywhere, and at cost 12 is comfortably within
 * OWASP guidance. Recorded in docs/adr/0002-authentication.md.
 */

const BCRYPT_COST = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    return false;
  }
}

/**
 * Burns the same amount of time as a real verification.
 *
 * Called when the email does not exist. Without it, "no such user" returns in
 * microseconds while "wrong password" takes ~250ms, and that timing difference
 * is a usable account-enumeration oracle regardless of how carefully the error
 * messages are worded (TASK-02 security scenario).
 */
let decoyHash: Promise<string> | null = null;

export async function burnPasswordTime(): Promise<void> {
  // Generated once per process rather than hardcoded: a literal would have to
  // be a byte-perfect valid bcrypt string, and an invalid one fails instantly —
  // which would reintroduce exactly the timing gap this closes.
  decoyHash ??= bcrypt.hash('timing-equalizer', BCRYPT_COST);
  await bcrypt.compare('not-the-password', await decoyHash);
}

export interface IssuedToken {
  /** Sent to the user. Never stored. */
  token: string;
  /** Stored. Never leaves the database. */
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Issues a single-use, expiring, hashed token for email verification and
 * password reset (spec §8.1).
 */
export function issueToken(ttlMinutes: number): IssuedToken {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashTokenValue(token),
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
  };
}

export function hashTokenValue(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const EMAIL_VERIFICATION_TTL_MINUTES = 24 * 60;
export const PASSWORD_RESET_TTL_MINUTES = 60;

/**
 * Progressive lockout (spec §8.1).
 *
 * Escalating rather than fixed: a handful of typos costs nothing, while a
 * sustained attack against one account backs off fast. Locking permanently
 * would hand an attacker a denial-of-service against any account whose address
 * they know.
 */
export function lockoutDurationMs(failedCount: number): number {
  if (failedCount < 5) return 0;
  if (failedCount < 8) return 60_000;
  if (failedCount < 12) return 5 * 60_000;
  return 30 * 60_000;
}
