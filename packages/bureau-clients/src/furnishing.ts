import type { Bureau, TradelineSource } from '@machai/types';

/**
 * Direction B — furnishing tradelines TO bureaus.  DELIBERATELY NOT IMPLEMENTED.
 *
 * TASK-06 is BLOCKED (STATE.md §6): no legal review, no data-furnisher approval
 * from any bureau, and no confirmed arm's-length tradeline source. That task is
 * accountable to Legal/Compliance, not to engineering, and its own file opens
 * with "Do not start the build until legal review and at least one bureau's
 * data-furnisher approval are in hand."
 *
 * So this file contains the interface and the eligibility guard, and nothing
 * that can transmit. `buildSubmissionFile` throws unconditionally.
 *
 * Why the guard exists before the pipeline does: the two bureau disqualifiers
 * (spec §12.2) are structural, not procedural —
 *
 *   1. "Furnishers that report tradelines on themselves are NOT accepted."
 *   2. "Furnishers that report 'pay for tradelines' are NOT accepted."
 *
 * A subscription that buys a flattering tradeline is exactly what gets a
 * furnisher rejected, and can attract FCRA/FTC scrutiny. Encoding the guard now
 * means the rule is in the codebase before there is any pressure to ship
 * around it.
 */

export class FurnishingNotApprovedError extends Error {
  constructor(bureau: Bureau) {
    super(
      `Furnishing to ${bureau} is not implemented and must not be. ` +
        `TASK-06 requires legal sign-off and an approved per-bureau data-furnisher ` +
        `agreement before any submission pipeline exists. See docs/adr/0005-direction-b-deferred.md.`,
    );
    this.name = 'FurnishingNotApprovedError';
  }
}

export interface FurnishableRecord {
  tradelineId: string;
  businessId: string;
  source: TradelineSource;
  /** True only for a genuine credit obligation extended by an unrelated party. */
  armsLength: boolean;
  /** True if this record originates from the subscription the business pays us. */
  derivedFromSubscription: boolean;
  creditorName: string;
}

export interface EligibilityDecision {
  eligible: boolean;
  reason?: string;
}

/**
 * The structural filter. Returns a reason rather than a boolean so the manifest
 * of excluded records can explain each exclusion (TASK-06 edge case).
 *
 * Note that it rejects on the *shape of the relationship*, not on data quality.
 * A perfectly formatted record describing a subscription-derived tradeline is
 * still ineligible, and no amount of cleanup makes it eligible.
 */
export function checkFurnishingEligibility(record: FurnishableRecord): EligibilityDecision {
  if (record.derivedFromSubscription) {
    return {
      eligible: false,
      reason:
        'Record derives from the subscription this business pays us. Furnishing it would be ' +
        'reporting a tradeline on ourselves — a bureau disqualifier (spec §12.2).',
    };
  }
  if (!record.armsLength) {
    return {
      eligible: false,
      reason:
        'Record is not an arm’s-length credit obligation. Only genuine extended-and-repaid ' +
        'credit may be furnished (spec §12.2).',
    };
  }
  if (record.source === 'platform_reported') {
    return {
      eligible: false,
      reason:
        'Record is marked platform_reported, meaning we generated it rather than observed a ' +
        'real obligation. Nothing in this codebase may furnish such a record.',
    };
  }
  return { eligible: true };
}

/**
 * The FurnishingBuilder contract, documented for whoever implements TASK-06.
 *
 * Promise: given eligible records for a period, produce a validated submission
 * file in the target bureau's required layout, plus a manifest of included and
 * excluded records with reasons.
 *
 * Format note that will bite an implementer who assumes otherwise: Equifax
 * accepts its standard COMMERCIAL layout from non-financial contributors and
 * does NOT accept Metro 2 from them. Creditsafe and D&B each run their own
 * program with their own format. There is no shared file format — build one
 * builder per bureau.
 */
export interface FurnishingBuilder {
  readonly bureau: Bureau;
  buildSubmissionFile(records: FurnishableRecord[], period: string): Promise<never>;
}

export function createFurnishingBuilder(bureau: Bureau): FurnishingBuilder {
  return {
    bureau,
    async buildSubmissionFile(): Promise<never> {
      throw new FurnishingNotApprovedError(bureau);
    },
  };
}
