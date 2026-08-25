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
    /**
     * Which bureaus we currently claim to report to.
     *
     * Worth exposing: these flags decide a public regulatory claim, they are
     * booleans rather than secrets, and when they are misconfigured the only
     * other symptom is marketing copy quietly reverting to "roadmap" — which
     * is exactly the failure that is easy to miss and expensive to ship.
     */
    reportingLive: {
      creditsafe: config.REPORTING_LIVE_CREDITSAFE,
      equifaxBusiness: config.REPORTING_LIVE_EQUIFAX_BUSINESS,
      dnb: config.REPORTING_LIVE_DNB,
    },
  });
}
