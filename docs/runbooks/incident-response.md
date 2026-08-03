# Runbook — Incident response

## Severity

| Sev | Meaning | Examples | Response |
|---|---|---|---|
| **1** | Sensitive data exposed, or money moving wrongly | EIN or report data in logs; a leaked key; wrong charges | Page immediately. Security + Legal in the loop from minute one. |
| **2** | Core flow broken for many users | Signup down; checkout failing; every report pull failing | Page during hours; escalate to Sev 1 if data is involved. |
| **3** | Degraded but working | Emails delayed; monitoring sweep skipped; PDFs not generating | Next business day. |
| **4** | Cosmetic | Copy errors, layout issues | Backlog. |

## First fifteen minutes

1. **Do not fix anything yet.** Establish blast radius: how many accounts, since
   when, is data involved.
2. Open an incident channel and start a timestamped log. Write down what you
   observe before you act — you will not reconstruct it later.
3. Check `/api/health` and the worker's `/health`.
4. Check `audit_log` for the window. It records ids, not values, so it is safe
   to read and share.

## Sev 1: suspected exposure of an EIN or credit data

Assume the scrubber failed until you prove otherwise.

1. **Stop the bleeding.** If a specific log sink or error tracker is receiving
   it, disable that integration.
2. **Scope it.** Which fields, how many records, which downstream systems
   (logs, Sentry, analytics, backups) hold copies.
3. **Preserve evidence.** Do not purge logs before scoping is complete.
4. **Notify Legal/Compliance immediately.** Notification obligations are theirs
   to determine, and the clock may already be running.
5. **Fix the scrubber and add a test.** Every leak class in
   `packages/observability/src/redact.test.ts` is there because absence is the
   only assertion that proves the control. Add the new case.

## Sev 1: leaked credential

1. Rotate the key at the provider **first**. Revocation beats investigation.
2. Update the secret store (Vercel env vars, worker host secrets). Redeploy.
3. If it was a Stripe key: review the Stripe dashboard for activity you did not
   initiate.
4. If it was `SESSION_SECRET`: rotating it invalidates fingerprints — see the
   key-rotation notes below.
5. If it was `ENCRYPTION_KEY` or the KMS key: **do not rotate blindly.**
   Existing EIN ciphertext is wrapped with the old key. Re-wrap first.
6. Work out how it leaked. CI runs gitleaks over full history, so a committed
   secret should have been caught — if it was not, that gap is part of the
   incident.

## Sev 2: report pulls failing

1. Is it one bureau or all? `credit_reports.failure_code` groups it.
2. `provider_error` across the board → provider outage. Jobs retry with backoff;
   confirm they are retrying rather than dead-lettering.
3. Check the dead-letter set:

   ```sql
   SELECT queue, count(*) FROM jobs WHERE dead_lettered_at IS NOT NULL GROUP BY queue;
   ```

4. Users whose pulls failed were **not** charged an allowance — that is enforced
   in the consumer. Confirm before telling anyone otherwise.

## Sev 2: billing state wrong

See `webhook-replay.md`. Never hand-edit the mirror.

## Key rotation notes

- **`SESSION_SECRET`** — invalidates every session (fine, users re-authenticate)
  **and** changes every EIN fingerprint. Fingerprints are only used for
  duplicate detection, so a rebuild is needed but nothing breaks meanwhile.
- **`ENCRYPTION_KEY` / KMS key** — envelope encryption means data keys are
  wrapped by the master key. Rotating requires re-wrapping every data key.
  Plan it as a migration, not an incident action.

## After

Write the postmortem within five working days. Blameless, with a timeline, and
with each action item assigned to a person. Add a regression test for anything
that could recur — the tests in this repo exist because of exactly that habit.
