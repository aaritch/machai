# TASK-05 — Credit report pulling & dashboard (Direction A)

**Phase:** 3 · **Owner:** Backend lead + Frontend · **Depends on:** TASK-02, TASK-04 · **Consulted:** Legal, Security · **Note:** requires a signed bureau/aggregator **pull** data agreement

## Objective

Let entitled members pull their live business credit report and score from a bureau, view scores and history, track tradelines, and work a credit checklist — the launchable, legitimate core of the product. This is the "read from bureaus" direction only; furnishing is TASK-06.

## Scope

**In:** the `BureauClient` abstraction + per-bureau pull implementations, the report-pull job, normalization + PDF rendering, Business Credit Score screen, Credit Progress chart, Tradeline Tracker, Credit Checklist, monitoring/alerts, dispute intake, per-plan pull metering.
**Out:** furnishing/reporting to bureaus (TASK-06), billing (TASK-04), engagement gamification internals (TASK-07 owns achievements; this task emits the events).

## Implementation details

**BureauClient abstraction.** Define one interface every bureau satisfies: given a verified business, return a `NormalizedReport` (score, band, scale, tradelines, public records, risk factors) or a typed failure (`no_file`, `provider_error`, `rate_limited`). Implement `creditsafe`, `equifax_business`, and (later) `dnb` behind it. The app never branches on which bureau — it depends only on the normalized shape. Keep the raw payload for audit and re-parsing.

**Pull flow.** User with entitlement requests a pull → backend checks (verified email, KYB verified, bureau allowed by plan, monthly allowance remaining) → enqueue a job → worker calls the bureau → normalize → persist `credit_reports` (raw + normalized) → append `score_history` → render a PDF to private storage → notify the user. The pull is idempotent per (business, bureau, day) to avoid duplicate charges from the data provider.

**Score screen.** Per-bureau cards with score, band label, correct scale (Creditsafe 0–100, Equifax Business 0–650), last-pulled timestamp, and a "Pull / refresh report" action (metered). A "Pull your live credit report" action produces a downloadable PDF and an on-screen breakdown. Handle the "no file" empty state (bureau has no record yet) with guidance.

**Credit Progress.** Line chart from `score_history`, per bureau, with milestone annotations. See the dataviz guidance for accessible, consistent chart styling.

**Tradeline Tracker.** Users add accounts they hold (Net-30 vendors, cards, loans) and see per-bureau reporting status; nudges flag accounts not reporting. Source is `user_added` here (platform-reported lines come from TASK-06).

**Credit Checklist.** Seeded, actionable steps (get a D-U-N-S number, open vendor accounts, separate finances). Completion tracking emits events that TASK-07's achievements engine consumes.

**Monitoring & alerts.** A scheduled worker job refreshes scores on a cadence per plan, detects changes, and sends alert emails/notifications. Respect plan entitlements (monitoring on/off).

**Disputes.** Intake + tracking flow tied to a report or tradeline, aligned to FCRA expectations (record the dispute, investigation status, and outcome).

**Metering.** Enforce per-plan pull allowances and rate limits so a user can't drain your data-provider budget.

## Data touched

`credit_reports`, `score_history`, `tradelines`, `checklist_items` + `user_checklist_progress`, dispute records, `audit_log`. Reads `subscriptions`/entitlements.

## Test scenarios

**Happy path**
- Given an entitled, verified business, when a pull is requested, then a job runs, a normalized report + PDF are stored, score history is appended, and the user is notified.
- Given multiple pulls over time, when the progress screen loads, then the chart shows the score trend per bureau.
- Given a Starter user (one bureau) vs Professional (both), when they view scores, then only entitled bureaus are available.

**Edge**
- Given a business the bureau has no record of, when a pull runs, then a `no_file` state is shown with guidance (not an error).
- Given two pull requests for the same business/bureau on the same day, when processed, then only one provider call is made (idempotent).
- Given a bureau that changes its score scale or payload, when normalization runs, then unknown fields are preserved in raw and the normalized mapping fails safely (flagged, not silently wrong).

**Failure**
- Given a bureau API outage, when a pull runs, then it retries with backoff and, if still failing, marks the report `failed` and surfaces a retry option — the user's allowance is not consumed for a failed pull.
- Given a rendering error on the PDF, when it occurs, then the normalized data is still saved and the PDF is regenerated on retry.
- Given monitoring detecting a large score drop, when it fires, then an alert is sent once (not repeatedly for the same change).

**Security**
- Given a user requesting another business's report by id, when the guard runs, then it is denied and audited.
- Given a free (unentitled) user, when they attempt a pull, then it is blocked with an upsell.
- Given report payloads, when stored/logged, then sensitive fields are encrypted/redacted and PDFs are only reachable via signed URLs.
- Given the monthly allowance, when exceeded, then further pulls are blocked until reset.

## Caveats

- **This direction is legitimate and buildable now** — but it still requires a commercial data agreement (direct bureau or aggregator) with permissible-use rules and per-pull/subscription costs. Procurement time is real; start early.
- **Metering protects your margin.** Live pulls cost money per call; without allowances and idempotency, abuse or bugs can run up the bill.
- **"No file" is common, not an error.** New businesses often have no bureau record. Design the empty state as a first-class experience with next steps.
- **Permissible purpose.** Pulling credit data has FCRA implications; ensure you have a lawful basis and the user's business relationship supports it. Consult legal.
- **Normalization drift.** Bureaus change formats; never discard the raw payload, and fail loudly (flag) rather than silently mapping wrong values.
- **Don't imply guarantees.** Showing a score and tips is fine; promising increases is not.

## Definition of done

Entitled users can pull reports from allowed bureaus; normalized data + PDF + score history persist; progress chart, tradeline tracker, checklist, monitoring/alerts, and dispute intake work; metering and idempotency prevent overbilling; ownership/entitlement guards and encryption are enforced; all four test buckets pass; legal has confirmed permissible-purpose posture.
