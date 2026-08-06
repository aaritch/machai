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
 */
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
