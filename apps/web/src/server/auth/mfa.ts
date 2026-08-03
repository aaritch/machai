import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { brand } from '@machai/config/public';

/**
 * TOTP (RFC 6238) for staff and admin accounts (spec §8.1).
 *
 * Implemented directly rather than pulled from a library: the algorithm is
 * ~40 lines of well-specified arithmetic, and a dependency in the auth path is
 * a dependency that can be compromised in a supply-chain attack. There is
 * nothing here to get creatively wrong.
 */

const DIGITS = 6;
const PERIOD_SECONDS = 30;
/**
 * Accept the adjacent windows either side of now. Clock drift between a phone
 * and a server is routine; one step is the usual tolerance, and widening it
 * further meaningfully increases the guessing surface.
 */
const DRIFT_WINDOWS = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateMfaSecret(): string {
  return toBase32(randomBytes(20));
}

/** The `otpauth://` URI an authenticator app scans. */
export function buildOtpAuthUri(secret: string, accountEmail: string): string {
  const issuer = encodeURIComponent(brand.name);
  const account = encodeURIComponent(accountEmail);
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD_SECONDS}`;
}

/**
 * Verifies a submitted code against the secret.
 *
 * Comparison is constant-time. A naive `===` on the code string leaks, through
 * timing, how many leading digits were correct — which reduces a six-digit
 * brute force to six sequential single-digit searches.
 */
export function verifyTotp(secret: string, code: string, atMs: number = Date.now()): boolean {
  const normalized = code.replace(/\D/g, '');
  if (normalized.length !== DIGITS) return false;

  const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  const key = fromBase32(secret);

  for (let offset = -DRIFT_WINDOWS; offset <= DRIFT_WINDOWS; offset++) {
    const expected = generateTotp(key, counter + offset);
    if (constantTimeEquals(expected, normalized)) return true;
  }
  return false;
}

/**
 * Produces the code valid for a given moment.
 *
 * Exported so tests can assert against a real code without reimplementing the
 * algorithm — a test that reimplements the thing it tests only proves it agrees
 * with itself. Not used in the request path.
 */
export function totpCodeAt(secret: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  return generateTotp(fromBase32(secret), counter);
}

function generateTotp(key: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', key).update(buffer).digest();
  // Dynamic truncation: the low nibble of the final byte selects the offset.
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const binary =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);

  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function toBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function fromBase32(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
