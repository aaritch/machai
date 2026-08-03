# TASK-02 — Authentication & onboarding wizard

**Phase:** 1 · **Owner:** Backend lead + Frontend · **Depends on:** TASK-01 · **Blocks:** TASK-04, TASK-05, TASK-07

## Objective

Let a business owner create an account and complete the three-step onboarding — **Business → Representative → Account** — with secure auth, email verification, and business-identity (KYB) verification. When done, a verified user with a business profile exists and can reach the dashboard shell.

## Scope

**In:** signup/login/logout, email verification, password reset, MFA (required for staff), the resumable 3-step wizard with full server-side validation, representative capture + attestations, KYB verification hook, session management.
**Out:** billing (TASK-04), report pulling (TASK-05), dashboard feature screens (their own tasks). This task delivers accounts + the wizard + the empty authenticated shell.

## Implementation details

**Auth foundation.** Prefer a managed provider (Auth.js/Clerk/Supabase Auth) unless there's a strong reason to build in-house. Requirements regardless: password hashing with argon2/bcrypt, secure httpOnly SameSite session cookies (or short-lived JWT + refresh), absolute + idle session timeouts, and a "log out everywhere" control. Rate-limit and lock out login, reset, and verification endpoints.

**Signup wizard — Step 1 (Business).** Collect legal name, DBA (optional), street address, address line 2 (optional), city, state, ZIP, EIN, entity type, phone. Validation: EIN exactly 9 digits (format `NN-NNNNNNN`, normalize on store, encrypt at rest); phone 10 digits; ZIP 5 or 9; state a valid 2-letter code; entity type from the fixed enum; required fields enforced. Persist progress so the user can leave and resume.

**Step 2 (Representative).** First/last name, title, email, phone, ownership percentage, and the ≥25% ownership attestation. This data attaches to the representative record, distinct from the login user.

**Step 3 (Account).** Email, password, confirm password (show/hide + strength meter). Required consent: Terms + Privacy. Optional: marketing announcements (records a consent flag). On submit: create user (unverified), business, representative in one transaction; send verification email; sign in; land on dashboard with an unverified banner + onboarding checklist.

**Email verification.** Single-use, expiring, hashed token. Unverified users may browse the shell but cannot subscribe, pull reports, or connect a bureau. Resend is rate-limited.

**KYB verification.** After signup, verify the business via a KYB provider (Middesk/Baselayer/etc.) or a manual staff review queue for v1. Set `businesses.verification_status`. Gate any future bureau interaction on `verified`.

**Authorization scaffolding.** Establish the server-side guard used everywhere: confirm the caller owns the resource and (later) has the entitlement, then audit. Roles: member, staff, admin. MFA required for staff/admin.

## Data touched

`users`, `businesses`, `representatives`, `email_verifications`, `password_resets`, `sessions`, `audit_log`, `user_checklist_progress` (seed the onboarding checklist).

## Test scenarios

**Happy path**
- Given valid inputs across all three steps, when the user submits, then user+business+representative are created, a verification email is sent, and the dashboard shell loads with an "unverified" banner.
- Given a verification link, when clicked, then the email is marked verified and gated actions unlock.
- Given a returning user mid-wizard, when they resume, then previously entered steps are preserved.

**Edge**
- Given an EIN entered as `12-3456789` with dashes/spaces, when submitted, then it is normalized to 9 digits and accepted.
- Given ownership percentage below the attested threshold, when submitting step 2, then the attestation cannot be truthfully checked and the UI surfaces the mismatch.
- Given a business whose KYB comes back `pending`, when the user reaches the dashboard, then bureau actions remain locked with an explanatory state.

**Failure**
- Given a duplicate email at signup, when submitting, then a clear, non-enumerating error is returned (don't reveal whether the email exists in a way that aids account enumeration).
- Given a KYB provider outage, when verification is requested, then the business is queued and retried, not hard-failed.
- Given an expired verification token, when used, then it is rejected and a resend is offered.

**Security**
- Given brute-force login attempts, when the threshold is crossed, then lockout + rate limiting engage.
- Given a user requesting another user's business by id, when the guard runs, then it returns not-authorized and audits the attempt.
- Given an EIN in the database, when inspected at rest, then it is encrypted (not plaintext) and never appears in logs.
- Given a staff login without MFA, when attempted, then access is denied until MFA is completed.

## Caveats

- **Honor "EIN only — no SSN."** Do not collect full SSNs. If a downstream integration ever forces it, isolate and encrypt it separately and revisit with legal — it contradicts the brand promise and adds liability.
- **KYB is not optional polish.** Anyone can type any EIN. Without verification you risk users building credit for businesses they don't control — a fraud/compliance problem. Budget for it.
- **Account enumeration.** Signup, login, and reset error messages must not reveal whether an email/EIN already exists.
- **Editing key fields post-signup** (legal name, EIN) must re-trigger KYB — otherwise verification drifts from reality.
- **Managed-auth lock-in.** If choosing Clerk/Supabase Auth, confirm data-export and migration paths before committing; auth is painful to swap later.
- **Session fixation / CSRF.** Rotate session on privilege change; protect all state-changing routes.

## Definition of done

A user can complete the wizard, verify email, and reach the shell; EIN is encrypted; KYB status is set and gates bureau actions; ownership + role guards are enforced and audited; all four test buckets pass; MFA is required for staff.
