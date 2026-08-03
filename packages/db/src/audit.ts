import { logger, redact, type AuditEntryInput } from '@machai/observability';
import { getDb, isDatabaseConfigured } from './client';
import { auditLog } from './schema/audit';

/**
 * Writes an audit entry (spec §13.5).
 *
 * Two properties this function must hold:
 *
 *  1. It never throws into the caller. An audit write failing must not take
 *     down the action being audited — but it must be loudly logged, because a
 *     silently missing audit trail is a compliance problem.
 *  2. Metadata is re-scrubbed on the way in. Call sites are supposed to pass
 *     ids only; this is the backstop for when one does not.
 */
export async function writeAudit(entry: AuditEntryInput): Promise<void> {
  if (!isDatabaseConfigured()) {
    logger.warn('audit entry dropped: database not configured', { action: entry.action });
    return;
  }
  try {
    const metadata = entry.metadata
      ? (redact(entry.metadata) as Record<string, string | number | boolean | null>)
      : null;

    await getDb().insert(auditLog).values({
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      metadata,
    });
  } catch (error) {
    logger.error('failed to write audit entry', {
      action: entry.action,
      entityType: entry.entityType,
      error,
    });
  }
}
