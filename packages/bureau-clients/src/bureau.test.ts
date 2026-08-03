import { describe, expect, it } from 'vitest';
import { checkFurnishingEligibility, createFurnishingBuilder, FurnishingNotApprovedError } from './furnishing';
import { MockBureauClient } from './mock';
import { normalizePayload, type FieldMap } from './normalize';

const FIELD_MAP: FieldMap = {
  score: ['result.score', 'score'],
  band: ['result.band'],
  name: ['result.name'],
  tradelines: ['result.tradelines'],
  publicRecords: ['result.publicRecords'],
  riskFactors: ['result.riskFactors'],
};

describe('normalization', () => {
  it('maps a well-formed payload (happy path)', () => {
    const report = normalizePayload({
      bureau: 'creditsafe',
      scoreScale: '0–100',
      fallbackName: 'Fallback Co',
      fieldMap: FIELD_MAP,
      payload: {
        result: {
          score: 78,
          band: 'Low risk',
          name: 'Acme Supply Co',
          tradelines: [
            { creditorName: 'Uline', type: 'net-30', balance: 1200.5, limit: 5000, status: 'current' },
          ],
          publicRecords: [],
          riskFactors: [{ code: 'PAY', description: 'Pays early', impact: 'positive' }],
        },
      },
    });

    expect(report.score).toBe(78);
    expect(report.businessName).toBe('Acme Supply Co');
    expect(report.tradelines[0]?.accountType).toBe('net30');
    expect(report.tradelines[0]?.currentBalanceCents).toBe(120050);
    expect(report.riskFactors[0]?.impact).toBe('positive');
    expect(report.unmappedFields).toHaveLength(0);
  });

  it('flags unmapped fields rather than guessing (edge)', () => {
    // TASK-05: "Given a bureau that changes its score scale or payload, when
    // normalization runs, then unknown fields are preserved in raw and the
    // normalized mapping fails safely (flagged, not silently wrong)."
    const report = normalizePayload({
      bureau: 'creditsafe',
      scoreScale: '0–100',
      fallbackName: 'Acme',
      fieldMap: FIELD_MAP,
      payload: { totallyDifferentShape: { rating: 'A' } },
    });

    expect(report.score).toBeNull();
    expect(report.unmappedFields).toContain('score');
    expect(report.unmappedFields).toContain('tradelines');
    // Critically: no invented default. A zero score would read as "high risk".
    expect(report.score).not.toBe(0);
  });

  it('falls back to the next candidate path when the first is absent', () => {
    const report = normalizePayload({
      bureau: 'creditsafe',
      scoreScale: '0–100',
      fallbackName: 'Acme',
      fieldMap: FIELD_MAP,
      payload: { score: '64' },
    });
    expect(report.score).toBe(64);
  });

  it('uses the fallback business name when the payload omits it', () => {
    const report = normalizePayload({
      bureau: 'creditsafe',
      scoreScale: '0–100',
      fallbackName: 'Fallback Co',
      fieldMap: FIELD_MAP,
      payload: { score: 50 },
    });
    expect(report.businessName).toBe('Fallback Co');
  });

  it('drops malformed tradeline rows without failing the whole report', () => {
    const report = normalizePayload({
      bureau: 'creditsafe',
      scoreScale: '0–100',
      fallbackName: 'Acme',
      fieldMap: FIELD_MAP,
      payload: { result: { tradelines: [null, 'nonsense', { creditorName: 'Grainger' }] } },
    });
    expect(report.tradelines).toHaveLength(1);
    expect(report.tradelines[0]?.creditorName).toBe('Grainger');
  });
});

describe('mock bureau client', () => {
  const business = {
    businessId: 'b1',
    legalName: 'Acme Supply Co',
    dbaName: null,
    ein: '123456782',
    streetAddress: '1 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    phone: '5125550100',
  };

  it('is deterministic for the same business', async () => {
    const client = new MockBureauClient('creditsafe');
    const a = await client.fetchReport(business);
    const b = await client.fetchReport(business);
    expect(a.ok).toBe(b.ok);
    if (a.ok && b.ok) expect(a.report.score).toBe(b.report.score);
  });

  it('keeps scores inside the bureau scale', async () => {
    const client = new MockBureauClient('equifax_business');
    for (let i = 0; i < 40; i++) {
      const result = await client.fetchReport({ ...business, ein: `1234567${String(i).padStart(2, '0')}` });
      if (result.ok && result.report.score !== null) {
        expect(result.report.score).toBeGreaterThanOrEqual(0);
        expect(result.report.score).toBeLessThanOrEqual(650);
      }
    }
  });

  it('produces no_file for some businesses, so the empty state is reachable', async () => {
    const client = new MockBureauClient('creditsafe');
    const outcomes = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        client.fetchReport({ ...business, ein: `9876543${String(i).padStart(2, '0')}` }),
      ),
    );
    expect(outcomes.some((r) => !r.ok && r.code === 'no_file')).toBe(true);
  });

  it('always attaches a raw payload on success (audit invariant)', async () => {
    const client = new MockBureauClient('creditsafe');
    const result = await client.fetchReport(business);
    if (result.ok) expect(result.rawPayload).toBeDefined();
  });
});

describe('furnishing guard (Direction B)', () => {
  const record = {
    tradelineId: 't1',
    businessId: 'b1',
    source: 'user_added' as const,
    armsLength: true,
    derivedFromSubscription: false,
    creditorName: 'Real Vendor',
  };

  it('cannot build a submission file at all (compliance)', async () => {
    // TASK-06 is BLOCKED. Nothing in this codebase may furnish.
    const builder = createFurnishingBuilder('equifax_business');
    await expect(builder.buildSubmissionFile([record], '2026-08')).rejects.toThrow(
      FurnishingNotApprovedError,
    );
  });

  it('rejects a subscription-derived tradeline (compliance)', () => {
    // spec §12.2: reporting a tradeline on yourself is a bureau disqualifier.
    const decision = checkFurnishingEligibility({ ...record, derivedFromSubscription: true });
    expect(decision.eligible).toBe(false);
    expect(decision.reason).toContain('subscription');
  });

  it('rejects a non-arm’s-length record (compliance)', () => {
    const decision = checkFurnishingEligibility({ ...record, armsLength: false });
    expect(decision.eligible).toBe(false);
  });

  it('rejects a platform-generated record (compliance)', () => {
    const decision = checkFurnishingEligibility({ ...record, source: 'platform_reported' });
    expect(decision.eligible).toBe(false);
  });

  it('accepts only a genuine arm’s-length obligation', () => {
    expect(checkFurnishingEligibility(record).eligible).toBe(true);
  });
});
