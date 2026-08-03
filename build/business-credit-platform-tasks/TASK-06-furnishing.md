# TASK-06 — Bureau furnishing pipeline (Direction B)

**Phase:** 4 · **Owner (accountable):** Legal/Compliance · **Owner (build):** Backend lead · **Depends on:** TASK-05 + **per-bureau furnisher approval** · **Risk:** legal

> ⚠️ **Do not start the build until legal review and at least one bureau's data-furnisher approval are in hand.** This task is where the product's biggest legal and contractual risk lives. Read the caveats first.

## Objective

Once approved as a data furnisher, submit **real, arm's-length** business tradeline/payment data to each bureau on a monthly cycle, ingest their acknowledgments, and surface reporting status to users (the Enterprise "monthly reporting tracker"). This is the "write to bureaus" direction.

## Scope

**In:** per-bureau submission-file builders, the monthly reporting pipeline (assemble → validate → transmit → ingest acknowledgments), reconciliation, the reporting tracker UI, and config-gated reporting claims.
**Out:** pulling reports (TASK-05). Also out of scope for engineering to decide: *whether* the furnished data is legitimate — that is a legal/business determination this task depends on.

## Implementation details

**Legitimacy precondition.** The only data furnished is genuine credit obligations — real Net-30/trade-credit accounts where credit is actually extended and repaid — sourced from a lawful, arm's-length product or vendor partnerships. The pipeline must be incapable of furnishing synthetic "pay-for-tradeline" records or self-reported tradelines (both are disqualified by the bureaus).

**FurnishingBuilder interface.** Per bureau: given eligible tradeline records for a period, produce a validated submission file in that bureau's required layout, plus a manifest of included/excluded records with reasons. Note the format constraint: Equifax accepts its **standard commercial layout** for non-financial contributors (Metro 2 is not accepted from non-financial commercial contributors); Creditsafe and D&B have their own programs/formats. Build one builder per bureau; do not assume a shared format.

**Monthly pipeline.** A scheduled worker job: select eligible, verified records → validate each against the bureau spec (reject nonconforming) → generate the per-bureau file → transmit over the bureau's secure electronic channel → ingest the acknowledgment/error report → update `tradelines.reported_to` and a reporting-run record. Everything is auditable and retained.

**Reconciliation & tracker.** Match accepted/rejected records back to accounts; expose an Enterprise "monthly reporting tracker" showing what was submitted, accepted, or errored, with reasons. Errors feed a correction workflow for the next cycle.

**Claims gating.** A per-bureau `reporting_live` flag (set only after that bureau's approval) drives every "reports to X" statement in marketing and the dashboard's "Connect a bureau" options. No claim renders ahead of approval.

**Disputes & accuracy duties.** As a furnisher you inherit FCRA accuracy and dispute-investigation duties. Wire furnished data into the dispute flow from TASK-05 so disputes about furnished lines are investigated and corrected within required timelines.

## Data touched

`tradelines` (source `platform_reported`, `reported_to`), reporting-run records, acknowledgment/error logs, `audit_log`. Retained per legal's schedule.

## Test scenarios

**Happy path**
- Given eligible, verified, arm's-length tradelines, when the monthly run executes for an approved bureau, then a conforming file is produced, transmitted, and the acknowledgment marks records accepted.
- Given an acknowledgment, when ingested, then `reported_to` and the tracker reflect accepted/rejected status with reasons.

**Edge**
- Given a record missing a required field, when validated, then it is excluded with a reason and does not block the rest of the file.
- Given a bureau not yet approved (`reporting_live=false`), when the pipeline runs, then no file is produced for it and no claim renders.
- Given a correction after a prior rejection, when the next run executes, then the corrected record is resubmitted.

**Failure**
- Given the bureau's secure channel is unavailable, when transmitting, then the run retries and, if still failing, alerts and preserves the prepared file for re-send (no partial/ambiguous submission).
- Given an acknowledgment file that fails to parse, when ingested, then the run is flagged for manual review rather than silently marking success.
- Given a dispute on a furnished line, when filed, then an investigation is opened and the outcome recorded within required timelines.

**Security / compliance**
- Given any attempt to furnish a self-reported or subscription-derived tradeline, when the pipeline runs, then it is rejected by design (cannot be furnished).
- Given furnished submissions, when stored, then they are retained, access-controlled, and audited.
- Given a `reporting_live` flag off, when marketing renders, then no "reports to that bureau" claim appears anywhere.

## Caveats

- **Becoming a furnisher is a gated, per-bureau contractual process** — application, credentialing/vetting, a signed membership/furnishing agreement, a member/contributor number, and prescribed electronic monthly submission. It takes weeks to months per bureau. There is no self-service furnishing API.
- **Two disqualifiers threaten the naive business model:** bureaus reject furnishers that "report tradelines on themselves" and those that "report pay-for-tradelines." A subscription that buys a flattering tradeline is exactly what gets rejected — and can expose you to FCRA/FTC scrutiny. The legitimate model furnishes real obligations only.
- **Legal is accountable, engineering implements.** Do not let build momentum outrun legal sign-off. The `reporting_live` gate is the technical enforcement of that boundary.
- **Furnisher accuracy duties are ongoing.** Once you furnish, you owe accuracy and timely dispute investigation under the FCRA — this is operational load, not a one-time build.
- **Volume/quality thresholds.** Some bureaus expect a meaningful record volume and maintain data-quality standards; low-quality submissions risk your furnisher status.
- **Marketing must stay behind reality.** Only claim bureaus that are live; phrase the rest as roadmap.

## Definition of done

Legal sign-off and ≥1 bureau approval obtained; per-bureau builders produce conforming files; the monthly pipeline transmits and reconciles acknowledgments; synthetic/self-reported furnishing is impossible by design; disputes on furnished lines are handled; every reporting claim is `reporting_live`-gated; submissions are retained and audited; all test buckets pass.
