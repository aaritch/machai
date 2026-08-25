import { getAvailabilityLine, getReportingClaim } from '@machai/config';
import { PageBackdrop } from '@/components/brand/backdrop';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { getOptionalSession } from '@/server/auth/session';

/**
 * Public route group.
 *
 * Server-rendered so marketing content is in the HTML for crawlers (TASK-03
 * "guard against client-only rendering of key content").
 *
 * Rendered per request, for the whole group. The footer below carries the
 * bureau reporting claim, which is gated on furnisher approval (spec §12.4).
 * Prerendering freezes that claim into the build, and the direction that
 * matters is turning a bureau OFF: a stale page would keep asserting coverage
 * after the flag was cleared.
 *
 * This was not hypothetical. /about and /pricing were static while / and
 * /learn were dynamic, so the same footer told visitors the bureaus were "on
 * our roadmap" on one page and "we report to" them on another.
 *
 * Declared on the layout rather than per page so a new marketing page inherits
 * it instead of having to remember.
 */
export const dynamic = 'force-dynamic';
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await getOptionalSession();
  const claim = getReportingClaim();

  return (
    <div className="flex min-h-screen flex-col">
      {/* One backdrop for the whole group — every marketing page inherits it. */}
      <PageBackdrop />
      <SiteHeader signedIn={Boolean(session)} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter
        availabilityLine={getAvailabilityLine()}
        roadmapLine={claim.roadmapLine}
        reportingClaim={claim.claimLine}
      />
    </div>
  );
}
