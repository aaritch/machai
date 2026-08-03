import { NextResponse } from 'next/server';
import { getConfig } from '@machai/config';
import { isDatabaseConfigured } from '@machai/db';
import { queueTransportName } from '@machai/queue';

/**
 * Health endpoint for uptime monitoring (TASK-01).
 *
 * Reports which subsystems are configured but deliberately exposes no
 * credentials, hostnames, or version detail — an unauthenticated endpoint is
 * a reconnaissance surface.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const config = getConfig();
  return NextResponse.json({
    status: 'ok',
    environment: config.APP_ENV,
    subsystems: {
      database: isDatabaseConfigured(),
      queue: queueTransportName(),
      billing: config.hasStripe,
      storage: config.hasStorage,
      bureauMode: config.BUREAU_MODE,
    },
  });
}
