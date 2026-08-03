import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getConfig } from '@machai/config';
import { getKeyProvider } from './key-provider';

/**
 * Field-level encryption for EIN and any other highly-sensitive field
 * (spec §13.2, STATE.md §8).
 *
 * Envelope encryption: a fresh 256-bit data key per record encrypts the value;
 * the data key itself is wrapped by the master key (a local key in development,
 * KMS in staging/production). Compromising one record's data key does not
 * expose any other record, and rotating the master key re-wraps data keys
 * without touching ciphertext.
 *
 * Values are written and read ONLY through this module. Anything else is a bug.
 */

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, the GCM standard
const AUTH_TAG_LENGTH = 16;

export class EncryptionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EncryptionError';
  }
}

/**
 * Encrypts a plaintext field value.
 *
 * Output format: `v1.<wrappedDataKey>.<iv>.<authTag>.<ciphertext>`, all base64url.
 * Self-describing so a future version can change algorithm without a migration
 * that must decrypt everything first.
 */
export async function encryptField(plaintext: string): Promise<string> {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new EncryptionError('Refusing to encrypt an empty value');
  }

  const provider = getKeyProvider();
  const { dataKey, wrappedDataKey } = await provider.generateDataKey();

  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, dataKey, iv, { authTagLength: AUTH_TAG_LENGTH });
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      VERSION,
      wrappedDataKey,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  } finally {
    // Zero the plaintext data key as soon as it is no longer needed. Not a
    // guarantee in a GC'd runtime, but it shortens the window.
    dataKey.fill(0);
  }
}

/** Decrypts a value produced by {@link encryptField}. */
export async function decryptField(encoded: string): Promise<string> {
  const parts = encoded.split('.');
  if (parts.length !== 5) {
    throw new EncryptionError('Malformed ciphertext: unexpected segment count');
  }
  const [version, wrappedDataKey, ivB64, authTagB64, ciphertextB64] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (version !== VERSION) {
    throw new EncryptionError(`Unsupported ciphertext version: ${version}`);
  }

  const provider = getKeyProvider();
  const dataKey = await provider.unwrapDataKey(wrappedDataKey);

  try {
    const decipher = createDecipheriv(ALGORITHM, dataKey, Buffer.from(ivB64, 'base64url'), {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (cause) {
    // GCM authentication failure means the ciphertext was altered or the wrong
    // key was used. Never fall back to returning something — fail closed.
    throw new EncryptionError('Decryption failed: ciphertext failed authentication', { cause });
  } finally {
    dataKey.fill(0);
  }
}

/**
 * Deterministic HMAC fingerprint, for equality checks without decryption.
 *
 * Used to spot the same EIN registered twice. It is a keyed hash, not
 * encryption: it cannot be reversed, but identical inputs produce identical
 * output — which is the whole point, and also why it must never be exposed
 * outside the database.
 */
export function fingerprintField(normalizedValue: string): string {
  const config = getConfig();
  const key = config.SESSION_SECRET ?? config.ENCRYPTION_KEY;
  if (!key) {
    throw new EncryptionError(
      'Cannot compute a fingerprint without SESSION_SECRET or ENCRYPTION_KEY set',
    );
  }
  return createHmac('sha256', key).update(normalizedValue).digest('base64url');
}

/** Constant-time comparison, for tokens and fingerprints. */
export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export { getKeyProvider, resetKeyProvider } from './key-provider';
