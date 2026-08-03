# TASK-07 — Engagement: checklist, achievements, support & marketplace

**Phase:** 1–3 · **Owner:** Frontend + Backend · **Depends on:** TASK-02 · **Consulted:** Product

## Objective

Build the retention and support surfaces: the onboarding checklist and achievements, the support-ticket system (agent + member views), and the marketplace/products area. These make the dashboard feel alive and give users a reason to return between monthly reports.

## Scope

**In:** onboarding checklist ("X of 5") + credit checklist, achievements engine, support tickets (member + staff views) fed by the public contact form, marketplace + one-off products listing, feedback form.
**Out:** the credit-data features that some checklist steps reference (TASK-05), billing for product purchases (TASK-04 provides the purchase mechanism), report furnishing (TASK-06).

## Implementation details

**Onboarding checklist.** The "Get started · X of Y complete" widget tracks steps: verify email, add business info, choose a plan, connect a bureau, complete profile. Each step's completion is derived from real state (e.g., email verified, subscription active) rather than a manual toggle, so it can't drift.

**Credit checklist.** A longer, seeded list of credit-building actions with categories and points. Members mark steps done; completion emits domain events.

**Achievements engine.** Consumes events (checklist completion, on-time behavior, first report pulled, etc.) and awards milestones ("2 of 12 earned," "Perfect Payments"). Criteria are data-driven (`achievements.criteria`) so new badges don't require redeploys. Awarding is idempotent — a badge is earned once.

**Support tickets.** Member view: list (status, subject, last update) + thread where member and staff exchange messages. Staff view (in admin): queue with category, priority, assignment, and status transitions (open → pending → resolved → closed). Public contact-form submissions (TASK-03) become tickets and are matched to a user by email when possible. Notifications on replies.

**Marketplace & products.** Catalog of courses, vendor lists, and resources with plan-gated access levels; one-off products (e.g., AI business plan) purchasable via the TASK-04 purchase mechanism, with "My Purchases" history. Gate access by entitlement/access level.

**Feedback.** A lightweight form writing to an internal feedback store or a ticket category.

## Data touched

`checklist_items`, `user_checklist_progress`, `achievements`, `user_achievements`, `support_tickets`, `ticket_messages`, `marketplace_items`, `products`, `purchases` (read), `audit_log`.

## Test scenarios

**Happy path**
- Given a user who verifies email and subscribes, when the dashboard loads, then the matching onboarding steps show complete automatically.
- Given a completed checklist step whose criteria satisfy a badge, when evaluated, then the achievement is awarded once.
- Given a member reply on a ticket, when submitted, then staff are notified and the thread updates.
- Given a plan-gated course, when an entitled user opens it, then access is granted; an unentitled user sees an upsell.

**Edge**
- Given a checklist step whose underlying state is later reversed (e.g., subscription canceled), when re-evaluated, then the derived step reflects current reality.
- Given the same achievement criteria met twice, when evaluated, then it is not awarded twice (idempotent).
- Given a public contact submission from an email that later registers, when the user signs up, then the prior ticket is associated to them.

**Failure**
- Given the achievements evaluator errors on one event, when it runs, then other users'/events' processing is unaffected (isolated failure).
- Given a ticket notification email failure, when it occurs, then the ticket state still persists and the email retries.

**Security**
- Given a member requesting another member's ticket by id, when the guard runs, then it is denied and audited.
- Given a staff-only status transition, when attempted by a member, then it is rejected.
- Given ticket message content, when rendered in the staff view, then it is output-encoded (no stored XSS).
- Given a plan-gated marketplace item, when an unentitled user requests it directly, then access is blocked server-side (not just hidden in the UI).

## Caveats

- **Derive onboarding state, don't store toggles.** If steps are manually flagged, they drift from reality (e.g., "plan chosen" stays green after cancellation). Compute from source state.
- **Idempotent awarding.** Without a uniqueness guard, retries or duplicate events double-award badges and erode trust.
- **Ticket identity matching** across the public form and registered accounts is fiddly — match on verified email and handle the "no account yet" case.
- **Marketplace gating must be server-side.** Hiding a locked item in the UI is not access control; enforce entitlement on the content endpoint.
- **Gamification shouldn't imply outcomes.** "Perfect Payments" badges are fine; avoid implying badges cause score/funding results.

## Definition of done

Onboarding + credit checklists derive from real state; achievements award idempotently from data-driven criteria; members and staff can exchange ticket messages with correct permissions; public contact submissions become matchable tickets; marketplace/products are entitlement-gated server-side; all four test buckets pass.
