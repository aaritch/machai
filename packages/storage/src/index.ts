import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getConfig } from '@machai/config';
import { logger } from '@machai/observability';

/**
 * Private object storage for report PDFs and uploads.
 *
 * The invariant (STATE.md §8): private files are reachable ONLY via signed,
 * expiring URLs. There is deliberately no `getPublicUrl` in this module and the
 * bucket must be created with public access blocked — a signed-URL policy in
 * code means nothing if the bucket itself is world-readable.
 *
 * Note that what gets stored in the database is a storage KEY, never a URL. A
 * persisted signed URL would either expire (breaking the record) or, worse, be
 * long-lived and become a permanent public link.
 */

export interface StorageObject {
  key: string;
  contentType: string;
  body: Uint8Array | Buffer | string;
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const config = getConfig();
  if (!config.STORAGE_ACCESS_KEY_ID || !config.STORAGE_SECRET_ACCESS_KEY) {
    throw new Error('Object storage is not configured. See STORAGE_* in .env.example.');
  }
  client = new S3Client({
    region: config.STORAGE_REGION,
    // R2 and other S3-compatible stores need an explicit endpoint and path
    // style; plain AWS S3 ignores both.
    endpoint: config.STORAGE_ENDPOINT || undefined,
    forcePathStyle: Boolean(config.STORAGE_ENDPOINT),
    credentials: {
      accessKeyId: config.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: config.STORAGE_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

export function isStorageConfigured(): boolean {
  const config = getConfig();
  return Boolean(config.STORAGE_BUCKET && config.STORAGE_ACCESS_KEY_ID);
}

export async function putObject(object: StorageObject): Promise<string> {
  const config = getConfig();
  await getClient().send(
    new PutObjectCommand({
      Bucket: config.STORAGE_BUCKET,
      Key: object.key,
      Body: object.body,
      ContentType: object.contentType,
      // Belt and braces alongside the bucket policy.
      ACL: 'private',
      ServerSideEncryption: 'AES256',
    }),
  );
  logger.info('stored object', { key: object.key, contentType: object.contentType });
  return object.key;
}

/**
 * Mints a short-lived download URL.
 *
 * Callers MUST have already checked ownership — this function has no idea who
 * is asking. The TTL is short by default (15 minutes) because a signed URL is a
 * bearer token: anyone holding it can read the object until it expires.
 */
export async function getSignedDownloadUrl(key: string, ttlSeconds?: number): Promise<string> {
  const config = getConfig();
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: config.STORAGE_BUCKET, Key: key }),
    { expiresIn: ttlSeconds ?? config.STORAGE_SIGNED_URL_TTL_SECONDS },
  );
}

/** Namespaced so a report PDF can never collide with another business's. */
export function reportPdfKey(businessId: string, reportId: string): string {
  return `reports/${businessId}/${reportId}.pdf`;
}

export function resetStorageForTest(): void {
  client = null;
}
