# Task Files — Index

**Project:** Business Credit Platform
**Companion to:** *Technical Specification v1.0* and *Project Plan, File Tree & Contracts*
**Stack:** Next.js (Vercel) + Node worker · PostgreSQL · Redis/BullMQ · Stripe
**Date:** 2026-08-03

Each task file below is a self-contained work package. All follow the same structure: **Objective → Scope → Implementation details → Data touched → Test scenarios → Caveats → Definition of done.** None contain code — implementation is described by behavior, inputs, outputs, and invariants so any developer can build it their own way.

## The task files

| File | Task | Phase | Depends on |
|------|------|-------|------------|
| TASK-01 | Foundations & infrastructure | 0 | — |
| TASK-02 | Authentication & onboarding wizard | 1 | TASK-01 |
| TASK-03 | Marketing site & help center | 1 | TASK-01 |
| TASK-04 | Stripe billing & subscriptions | 2 | TASK-01, TASK-02 |
| TASK-05 | Credit report pulling & dashboard (Direction A) | 3 | TASK-02, TASK-04 |
| TASK-06 | Bureau furnishing pipeline (Direction B) | 4 | TASK-05 + legal approval |
| TASK-07 | Engagement: checklist, achievements, support, marketplace | 1–3 | TASK-02 |
| TASK-08 | Security, compliance & observability (cross-cutting) | all | TASK-01 |

## How to read a test-scenario table

Each task lists scenarios in four buckets: **Happy path** (the intended flow), **Edge** (unusual-but-valid inputs), **Failure** (things going wrong that must be handled gracefully), and **Security** (attempts to bypass rules). A scenario is "given → when → then": the starting state, the action, and the expected result. Treat every row as at least one automated test.

## Global conventions used across all task files

- **Authoritative validation is server-side.** Client validation is UX only; every rule is re-checked on the backend.
- **Ownership + entitlement on every sensitive call**, and each such call writes an `audit_log` entry.
- **Idempotency** wherever an external system can retry (webhooks, jobs).
- **No sensitive value in logs** — EIN/SSN/report payloads are referenced by id, never printed.
- **Test/sandbox credentials** for Stripe and every bureau in all non-production environments.

## Suggested labels for your tracker

`phase:0–4`, `area:auth|billing|reports|furnishing|marketing|engagement|security`, `risk:legal` (attach to TASK-06 and any reporting-claim work), `needs:legal-signoff`, `needs:bureau-agreement`.
