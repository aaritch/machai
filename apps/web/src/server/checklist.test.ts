import { describe, expect, it } from 'vitest';
import type { AchievementCriteria } from '@machai/db';
import { meetsCriteria, type AchievementFacts } from './checklist';
import { deriveOnboardingSteps } from './context';

/** TASK-07 scenarios: derived onboarding state and idempotent achievements. */

const FACTS: AchievementFacts = {
  emailVerified: true,
  hasBusiness: true,
  kybVerified: false,
  subscriptionActive: false,
  reportsPulled: 0,
  checklistCompleted: 0,
  tradelinesTracked: 0,
  tradelinesAllCurrent: false,
  monthsActive: 0,
};

describe('achievement criteria', () => {
  it('awards on a satisfied simple criterion (happy path)', () => {
    expect(meetsCriteria({ type: 'email_verified' }, FACTS)).toBe(true);
    expect(meetsCriteria({ type: 'kyb_verified' }, FACTS)).toBe(false);
  });

  it('respects count thresholds', () => {
    const facts = { ...FACTS, checklistCompleted: 5 };
    expect(meetsCriteria({ type: 'checklist_items_completed', count: 3 }, facts)).toBe(true);
    expect(meetsCriteria({ type: 'checklist_items_completed', count: 6 }, facts)).toBe(false);
  });

  it('does not award "all current" to someone with no tradelines (edge)', () => {
    // "Every tradeline is current" is vacuously true with zero tradelines.
    // Awarding a payment badge to someone with no accounts would be meaningless
    // and would imply an outcome we have no evidence for.
    const empty = { ...FACTS, tradelinesTracked: 0, tradelinesAllCurrent: false };
    expect(meetsCriteria({ type: 'all_tradelines_current', minimumTradelines: 3 }, empty)).toBe(false);

    const withLines = { ...FACTS, tradelinesTracked: 3, tradelinesAllCurrent: true };
    expect(meetsCriteria({ type: 'all_tradelines_current', minimumTradelines: 3 }, withLines)).toBe(true);
  });

  it('is a pure function of the facts, so re-evaluation is stable (idempotency)', () => {
    const criteria: AchievementCriteria = { type: 'reports_pulled', count: 2 };
    const facts = { ...FACTS, reportsPulled: 2 };
    expect(meetsCriteria(criteria, facts)).toBe(meetsCriteria(criteria, facts));
  });

  it('reflects reality when the underlying state reverses (edge)', () => {
    const active = { ...FACTS, subscriptionActive: true };
    expect(meetsCriteria({ type: 'subscription_active' }, active)).toBe(true);
    expect(meetsCriteria({ type: 'subscription_active' }, { ...active, subscriptionActive: false })).toBe(
      false,
    );
  });
});

describe('onboarding steps', () => {
  it('derives completion from real state, never a stored toggle', () => {
    // TASK-07 caveat: "If steps are manually flagged, they drift from reality
    // (e.g. 'plan chosen' stays green after cancellation)."
    const withPlan = deriveOnboardingSteps({
      emailVerified: true,
      hasBusiness: true,
      hasPlan: true,
      hasConnectedBureau: false,
      profileComplete: false,
    });
    expect(withPlan.find((s) => s.key === 'choose_plan')?.complete).toBe(true);

    const afterCancellation = deriveOnboardingSteps({
      emailVerified: true,
      hasBusiness: true,
      hasPlan: false,
      hasConnectedBureau: false,
      profileComplete: false,
    });
    expect(afterCancellation.find((s) => s.key === 'choose_plan')?.complete).toBe(false);
  });

  it('always returns the same five steps in the same order', () => {
    const steps = deriveOnboardingSteps({
      emailVerified: false,
      hasBusiness: false,
      hasPlan: false,
      hasConnectedBureau: false,
      profileComplete: false,
    });
    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.key)).toEqual([
      'verify_email',
      'business_info',
      'choose_plan',
      'connect_bureau',
      'complete_profile',
    ]);
    expect(steps.every((s) => !s.complete)).toBe(true);
  });

  it('gives every step a destination the user can act on', () => {
    const steps = deriveOnboardingSteps({
      emailVerified: false,
      hasBusiness: false,
      hasPlan: false,
      hasConnectedBureau: false,
      profileComplete: false,
    });
    expect(steps.every((s) => s.href.startsWith('/'))).toBe(true);
  });
});
