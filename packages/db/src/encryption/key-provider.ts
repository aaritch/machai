import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getConfig } from '@machai/config';

/**
 * Master-key abstraction behind envelope encryption.
 *
 * The application never sees the master key. It asks for a data key, gets back
 * the plaintext data key plus its wrapped form, and stores only the wrapped
 * form. Swapping local → KMS is a config change, not a code change.
 */
export interface KeyProvider {
  readonly name: 'local' | 'kms';
  /** A fresh 256-bit data key plus its wrapped (encrypted) representation. */
  generateDataKey(): Promise<{ dataKey: Buffer; wrappedDataKey: string }>;
  unwrapDataKey(wrapped: string): Promise<Buffer>;
}

const DATA_KEY_LENGTH = 32;
const WRAP_IV_LENGTH = 12;
const WRAP_ALGORITHM = 'aes-256-gcm';

/**
 * Development / self-hosted provider: the master key comes from ENCRYPTION_KEY.
 *
 * Adequate when the key is held in a secrets manager and injected at runtime.
 * KMS is preferred in production because the master key never enters process
 * memory there.
 */
class LocalKeyProvider implements KeyProvider {
  readonly name = 'local' as const;
  private readonly masterKey: Buffer;

  constructor(base64Key: string) {
    const key = Buffer.from(base64Key, 'base64');
    if (key.length !== DATA_KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_KEY must decode to exactly ${DATA_KEY_LENGTH} bytes (got ${key.length}). ` +
          `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
      );
    }
    this.masterKey = key;
  }

  async generateDataKey(): Promise<{ dataKey: Buffer; wrappedDataKey: string }> {
    const dataKey = randomBytes(DATA_KEY_LENGTH);
    const iv = randomBytes(WRAP_IV_LENGTH);
    const cipher = createCipheriv(WRAP_ALGORITHM, this.masterKey, iv);
    const wrapped = Buffer.concat([cipher.update(dataKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    const wrappedDataKey = Buffer.concat([iv, tag, wrapped]).toString('base64url');
    return { dataKey, wrappedDataKey };
  }

  async unwrapDataKey(wrapped: string): Promise<Buffer> {
    const buf = Buffer.from(wrapped, 'base64url');
    const iv = buf.subarray(0, WRAP_IV_LENGTH);
    const tag = buf.subarray(WRAP_IV_LENGTH, WRAP_IV_LENGTH + 16);
    const payload = buf.subarray(WRAP_IV_LENGTH + 16);
    const decipher = createDecipheriv(WRAP_ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(payload), decipher.final()]);
  }
}

/**
 * AWS KMS provider — the master key never leaves KMS.
 *
 * `GenerateDataKey` returns the plaintext data key and its KMS-encrypted blob
 * in one call; `Decrypt` unwraps it. Every unwrap is an API call, so decrypting
 * a page of records is chatty by design — that cost is why EIN display is a
 * deliberate, audited action rather than something rendered in every list.
 */
class KmsKeyProvider implements KeyProvider {
  readonly name = 'kms' as const;

  constructor(private readonly keyId: string) {}

  private async client() {
    const { KMSClient } = await import('@aws-sdk/client-kms');
    return new KMSClient({ region: getConfig().STORAGE_REGION });
  }

  async generateDataKey(): Promise<{ dataKey: Buffer; wrappedDataKey: string }> {
    const { GenerateDataKeyCommand } = await import('@aws-sdk/client-kms');
    const client = await this.client();
    const result = await client.send(
      new GenerateDataKeyCommand({ KeyId: this.keyId, KeySpec: 'AES_256' }),
    );
    if (!result.Plaintext || !result.CiphertextBlob) {
      throw new Error('KMS GenerateDataKey returned an incomplete response');
    }
    return {
      dataKey: Buffer.from(result.Plaintext),
      wrappedDataKey: Buffer.from(result.CiphertextBlob).toString('base64url'),
    };
  }

  async unwrapDataKey(wrapped: string): Promise<Buffer> {
    const { DecryptCommand } = await import('@aws-sdk/client-kms');
    const client = await this.client();
    const result = await client.send(
      new DecryptCommand({
        CiphertextBlob: Buffer.from(wrapped, 'base64url'),
        KeyId: this.keyId,
      }),
    );
    if (!result.Plaintext) throw new Error('KMS Decrypt returned no plaintext');
    return Buffer.from(result.Plaintext);
  }
}

let cached: KeyProvider | null = null;

export function getKeyProvider(): KeyProvider {
  if (cached) return cached;
  const config = getConfig();

  if (config.ENCRYPTION_PROVIDER === 'kms') {
    if (!config.KMS_KEY_ID) {
      throw new Error('ENCRYPTION_PROVIDER=kms requires KMS_KEY_ID');
    }
    cached = new KmsKeyProvider(config.KMS_KEY_ID);
    return cached;
  }

  if (!config.ENCRYPTION_KEY) {
    throw new Error(
      'ENCRYPTION_KEY is not set. EIN fields cannot be written without it — see .env.example.',
    );
  }
  cached = new LocalKeyProvider(config.ENCRYPTION_KEY);
  return cached;
}

/** Test-only. */
export function resetKeyProvider(): void {
  cached = null;
}

export function setKeyProviderForTest(provider: KeyProvider): void {
  cached = provider;
}
