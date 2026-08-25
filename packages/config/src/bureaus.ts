import { BUREAUS, BUREAU_LABELS, BUREAU_SCORE_SCALES, type Bureau } from '@machai/types';
import { getConfig } from './server';

/**
 * Bureau capability flags — the technical enforcement of spec §12.4.
 *
 * Two flags per bureau, and conflating them is the mistake the spec warns about:
 *
 *   pullLive       Direction A. We can READ this bureau's data. Requires a
 *                  signed data/reseller agreement with permissible-use terms.
 *   reportingLive  Direction B. We are an APPROVED DATA FURNISHER and may write
 *                  tradelines to this bureau. Requires per-bureau application,
 *                  credentialing, and a signed furnishing agreement — weeks to
 *                  months, and accountable to Legal/Compliance, not engineering.
 *
 * Every "reports to X" statement anywhere in the product MUST be gated on
 * `reportingLive`. There is deliberately no way to hardcode such a claim in a
 * page: the copy helpers below are the only sanctioned source.
 */

export interface BureauCapability {
  bureau: Bureau;
  label: string;
  scoreScale: string;
  /** Direction A — reading reports. */
  pullLive: boolean;
  /** Direction B — furnishing. Defaults false and stays false until approved. */
  reportingLive: boolean;
}

export function getBureauCapabilities(): BureauCapability[] {
  const c = getConfig();
  const reportingFlags: Record<Bureau, boolean> = {
    creditsafe: c.REPORTING_LIVE_CREDITSAFE,
    equifax_business: c.REPORTING_LIVE_EQUIFAX_BUSINESS,
    dnb: c.REPORTING_LIVE_DNB,
    experian_business: c.REPORTING_LIVE_EXPERIAN_BUSINESS,
  };
  const pullConfigured: Record<Bureau, boolean> = {
    creditsafe: Boolean(c.CREDITSAFE_API_KEY),
    equifax_business: Boolean(c.EQUIFAX_BUSINESS_API_KEY),
    dnb: Boolean(c.DNB_API_KEY),
    experian_business: Boolean(c.EXPERIAN_BUSINESS_API_KEY),
  };

  return BUREAUS.map((bureau) => ({
    bureau,
    label: BUREAU_LABELS[bureau],
    scoreScale: BUREAU_SCORE_SCALES[bureau].label,
    // In mock mode every bureau is "pullable" — against fixtures, never a real
    // provider. This is what lets TASK-05 be built while the pull data
    // agreement is still unsigned (STATE.md §6).
    pullLive: c.BUREAU_MODE === 'mock' ? true : pullConfigured[bureau],
    reportingLive: reportingFlags[bureau],
  }));
}

export function getPullableBureaus(): Bureau[] {
  return getBureauCapabilities()
    .filter((b) => b.pullLive)
    .map((b) => b.bureau);
}

/**
 * The ONLY sanctioned way to render a reporting claim.
 *
 * Returns bureaus split into what we may truthfully say we report to, and what
 * may only be described as roadmap. If `live` is empty the caller must not
 * render any "reports to" language at all — `claimLine` returns null to make
 * that the path of least resistance.
 */
export function getReportingClaim(): {
  live: BureauCapability[];
  roadmap: BureauCapability[];
  claimLine: string | null;
  roadmapLine: string | null;
} {
  const caps = getBureauCapabilities();
  const live = caps.filter((b) => b.reportingLive);
  const roadmap = caps.filter((b) => !b.reportingLive);

  return {
    live,
    roadmap,
    claimLine: live.length > 0 ? `Reports your activity to ${joinLabels(live)}.` : null,
    roadmapLine:
      roadmap.length > 0
        ? `${joinLabels(roadmap)} ${roadmap.length === 1 ? 'is' : 'are'} on our roadmap — we add a bureau only once it approves us as a data furnisher.`
        : null,
  };
}

/**
 * The bureau coverage line shown in the footer.
 *
 * Derived from furnisher approval, not from our ability to read a bureau's
 * data — the two are independent, and this line sits next to the reporting
 * claim, so branching it on the wrong flag would let the footer imply coverage
 * that has not been approved.
 */
export function getAvailabilityLine(): string {
  const live = getBureauCapabilities().filter((b) => b.reportingLive);
  if (live.length === 0) return 'Bureau coverage is being onboarded.';
  return `Bureaus we report to: ${joinLabels(live)}`;
}

function joinLabels(caps: BureauCapability[]): string {
  const labels = caps.map((c) => c.label);
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}
