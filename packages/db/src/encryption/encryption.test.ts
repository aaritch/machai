import { describe, expect, it } from 'vitest';
import { EncryptionError, decryptField, encryptField, fingerprintField, safeEquals } from './index';

/**
 * TASK-08 / TASK-02 security scenario:
 *
 *   "Given an EIN in the database, when inspected at rest, then it is encrypted
 *    (not plaintext) and never appears in logs."
 *
 * The at-rest half is what these tests prove.
 */

const EIN = '123456789';

describe('field encryption', () => {
  it('round-trips a value (happy path)', async () => {
    const ciphertext = await encryptField(EIN);
    expect(await decryptField(ciphertext)).toBe(EIN);
  });

  it('never leaves the plaintext recoverable from the ciphertext (security)', async () => {
    const ciphertext = await encryptField(EIN);
    expect(ciphertext).not.toContain(EIN);
    // Nor in any common encoding someone might spot by eye.
    expect(ciphertext).not.toContain(Buffer.from(EIN).toString('base64'));
    expect(ciphertext).not.toContain(Buffer.from(EIN).toString('hex'));
  });

  it('produces different ciphertext for the same input every time (security)', async () => {
    // Envelope encryption generates a fresh data key and IV per call, so equal
    // plaintexts must not produce equal ciphertexts — otherwise the column
    // leaks which businesses share an EIN.
    const a = await encryptField(EIN);
    const b = await encryptField(EIN);
    expect(a).not.toBe(b);
    expect(await decryptField(a)).toBe(await decryptField(b));
  });

  it('is self-describing and versioned', async () => {
    const ciphertext = await encryptField(EIN);
    expect(ciphertext.startsWith('v1.')).toBe(true);
    expect(ciphertext.split('.')).toHaveLength(5);
  });

  it('fails closed when the ciphertext is tampered with (security)', async () => {
    // GCM authenticates the ciphertext. A modified payload must throw, never
    // return partial or wrong plaintext.
    const ciphertext = await encryptField(EIN);
    const parts = ciphertext.split('.');
    const tampered = [...parts.slice(0, 4), `${parts[4]}AA`].join('.');
    await expect(decryptField(tampered)).rejects.toThrow(EncryptionError);
  });

  it('rejects malformed ciphertext rather than guessing', async () => {
    await expect(decryptField('not-ciphertext')).rejects.toThrow(EncryptionError);
    await expect(decryptField('v9.a.b.c.d')).rejects.toThrow(EncryptionError);
  });

  it('refuses to encrypt an empty value', async () => {
    await expect(encryptField('')).rejects.toThrow(EncryptionError);
  });
});

describe('fingerprints', () => {
  it('is deterministic, so duplicates can be detected without decrypting', () => {
    expect(fingerprintField(EIN)).toBe(fingerprintField(EIN));
  });

  it('differs for different inputs', () => {
    expect(fingerprintField(EIN)).not.toBe(fingerprintField('987654321'));
  });

  it('is not reversible to the plaintext', () => {
    const fingerprint = fingerprintField(EIN);
    expect(fingerprint).not.toContain(EIN);
    expect(Buffer.from(fingerprint, 'base64url').toString('utf8')).not.toContain(EIN);
  });
});

describe('constant-time comparison', () => {
  it('matches equal strings and rejects unequal ones', () => {
    expect(safeEquals('abc', 'abc')).toBe(true);
    expect(safeEquals('abc', 'abd')).toBe(false);
    expect(safeEquals('abc', 'abcd')).toBe(false);
  });
});
