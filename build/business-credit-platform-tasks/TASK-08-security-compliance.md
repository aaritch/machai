# TASK-08 — Security, compliance & observability (cross-cutting)

**Phase:** all · **Owner (accountable):** Security + Legal/Compliance · **Owner (build):** Backend + DevOps · **Depends on:** TASK-01

## Objective

Make the platform safe to hold EINs, business financials, and credit files. This task is not a phase you finish — it's a set of controls and checks that every other task must satisfy. It exists as its own file so the controls are owned, tested, and audited rather than assumed.

## Scope

**In:** data classification + encryption, secrets handling, PCI posture, access control + audit, application-security baseline, backups/retention/deletion, FCRA/consumer-protection guardrails, privacy compliance, observability with PII scrubbing, incident runbooks.
**Out:** the features themselves — this task defines and verifies the controls those features must meet.

## Implementation details

**Data classification.** Label fields: highly sensitive (EIN, any SSN/last4, full credit reports, financials), sensitive (business/representative PII, billing metadata), operational (everything else). Controls scale with the label.

**Encryption.** TLS 1.2+ in transit with HSTS. Field-level encryption for EIN/SSN via a KMS-managed key (envelope encryption), plus at-rest encryption on the database and object store. These fields never appear in plaintext columns, logs, analytics, or error traces. Report PDFs are served only via signed URLs.

**Secrets.** All keys in a secrets manager / Vercel encrypted env vars; never in the repo or client bundle. Rotate on schedule and on staff offboarding. Secret scanning in CI.

**PCI.** By using Stripe-hosted card surfaces and never transmitting raw card data, stay in PCI-DSS SAQ A. Document this and guard against regressions (no proxying/logging of card fields).

**Access control + audit.** Least-privilege roles (member/staff/admin), MFA required for staff/admin, and an append-only `audit_log` covering auth events, EIN/report views, plan changes, admin actions, data exports, and every bureau interaction. Logs reference sensitive values by id, never by value.

**App-sec baseline (OWASP Top 10).** Parameterized queries, output encoding, CSRF protection on state-changing requests, strict CORS, security headers (CSP, HSTS, X-Frame-Options), authoritative server-side validation, rate limiting on auth and public forms, bot/spam protection on contact + signup, and dependency scanning in CI.

**Backups, retention, deletion.** Automated encrypted backups with periodically tested restores. Documented retention windows for credit data and furnishing records (per legal). An account-closure path that purges user data on the defined schedule, including from backups.

**Legal/regulatory guardrails (build them into the product).** FCRA permissible-purpose for pulls and accuracy/dispute duties for furnished data; a documented dispute-resolution workflow; KYB/anti-fraud; no guaranteed-outcome marketing; truthful `reporting_live`-gated claims; Privacy Policy + Terms consented at signup; data-subject request handling; marketing-consent tracking; cookie/consent management (CCPA/CPRA and state equivalents).

**Observability.** Structured logging with a PII-scrubbing filter, error tracking with sensitive-data redaction, tracing, uptime monitoring, and alerting on security-relevant events (auth anomalies, webhook signature failures, dead-lettered jobs).

**Incident readiness.** Runbooks for incident response, webhook replay, reporting-run failure recovery, and key rotation. A defined severity scale and escalation path.

## Data touched

Cross-cutting: `audit_log` (all sensitive actions), encryption of `businesses.ein` and any SSN fields, retention across all user data.

## Test scenarios

**Happy path**
- Given any sensitive action (login, EIN view, report pull, plan change, admin action), when it occurs, then an audit entry is written referencing ids, not values.
- Given an EIN at rest, when inspected, then it is ciphertext; when read by an authorized path, then it decrypts correctly.
- Given a report PDF, when accessed, then only a signed URL works and it expires.

**Edge**
- Given an account-closure request, when processed, then user data is purged on schedule, including from backups, while legally required records (e.g., furnishing/audit) are retained per policy.
- Given a data-subject access/deletion request, when received, then it is fulfilled within the required window.

**Failure**
- Given a backup, when a restore drill runs, then data is recoverable and integrity-checked (a backup never tested is not a backup).
- Given a dependency with a known CVE, when CI scans, then the build flags/fails per policy.

**Security**
- Given a log/error payload containing an EIN or report field, when emitted, then the scrubber redacts it (asserted by test).
- Given a webhook with an invalid signature, when received, then it is rejected and the failure is alerted.
- Given a member attempting a staff/admin action, when the guard runs, then it is denied and audited.
- Given common injection/XSS/CSRF probes, when run against endpoints, then they are blocked by the baseline controls.
- Given a leaked secret in a commit, when CI scans, then it fails.

## Caveats

- **Security is a constraint on every task, not a later phase.** Retrofitting encryption and audit after features ship is expensive and error-prone. Enforce the controls in each task's Definition of Done.
- **Collecting SSNs contradicts the product and adds liability.** Default to EIN-only; if ever forced, isolate, encrypt, and get legal review.
- **FCRA duties are real and ongoing** for both pulling (permissible purpose) and furnishing (accuracy + disputes). These are legal accountabilities engineering implements.
- **"Business credit building" marketing draws FTC attention** when it implies guaranteed results. Keep claims substantiated and `reporting_live`-gated.
- **Untested backups fail when you need them.** Schedule restore drills.
- **PII in logs is the most common leak.** The scrubber must be verified by tests, not assumed.
- **Deletion vs retention tension.** Some records must be retained (furnishing/audit) even after account closure — reconcile deletion requests with legal retention obligations explicitly.

## Definition of done

Encryption, secrets handling, and PCI posture verified; audit log covers all sensitive actions with id-only references; OWASP baseline and rate limiting in place; PII scrubbing proven by tests; backups restore-tested; retention/deletion paths documented and legally reconciled; FCRA/privacy guardrails wired into product flows; incident runbooks exist; security checks are part of every other task's DoD.
