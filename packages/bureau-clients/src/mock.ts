import { createHash } from 'node:crypto';
import {
  BUREAU_SCORE_SCALES,
  type Bureau,
  type BureauResult,
  type NormalizedReport,
  type NormalizedTradeline,
  type RiskFactor,
} from '@machai/types';
import type { BureauBusinessQuery, BureauClient } from './interface';

/**
 * Deterministic fixture client.
 *
 * STATE.md §6 permits TASK-05 to be built against a mock while the pull data
 * agreement is unsigned. This is that mock. It makes no network calls and costs
 * nothing per pull, so development and staging can exercise the full pull flow
 * — including the `no_file` and `provider_error` paths, which are otherwise
 * hard to reproduce on demand.
 *
 * Determinism matters: the same business always gets the same file, so the
 * progress chart and score history behave sensibly across repeated pulls
 * instead of jittering randomly.
 */
export class MockBureauClient implements BureauClient {
  readonly configured = true;

  constructor(readonly bureau: Bureau) {}

  async fetchReport(business: BureauBusinessQuery): Promise<BureauResult> {
    const seed = hashToInt(`${business.ein}:${this.bureau}`);

    // ~1 business in 5 has no file. Common in reality for newer companies, and
    // the empty state is a first-class experience we need to be able to see.
    if (seed % 5 === 0) {
      return {
        ok: false,
        code: 'no_file',
        message: `${business.legalName} has no file with this bureau yet.`,
        retryable: false,
      };
    }

    // ~1 in 17 simulates a provider outage, so retry/backoff has something to
    // exercise outside of production.
    if (seed % 17 === 0) {
      return {
        ok: false,
        code: 'provider_error',
        message: 'The bureau did not respond in time.',
        retryable: true,
      };
    }

    const scale = BUREAU_SCORE_SCALES[this.bureau];
    // Drift the score slowly by month so the progress chart has a trend rather
    // than a flat line, but keep it bounded and reproducible.
    const monthIndex = new Date().getUTCFullYear() * 12 + new Date().getUTCMonth();
    const base = 0.45 + ((seed % 30) / 100);
    const drift = ((monthIndex + (seed % 7)) % 12) * 0.008;
    const score = Math.round(Math.min(scale.max, scale.max * Math.min(0.95, base + drift)));

    const report: NormalizedReport = {
      bureau: this.bureau,
      score,
      scoreBand: bandFor(score / scale.max),
      scoreScale: scale.label,
      pulledAt: new Date(),
      businessName: business.legalName,
      tradelines: buildTradelines(seed),
      publicRecords:
        seed % 11 === 0
          ? [
              {
                type: 'UCC filing',
                filedOn: `${new Date().getUTCFullYear() - 1}-06-14`,
                amountCents: null,
                status: 'Open',
              },
            ]
          : [],
      riskFactors: buildRiskFactors(seed, score / scale.max),
      unmappedFields: [],
    };

    return {
      ok: true,
      report,
      rawPayload: {
        provider: `mock-${this.bureau}`,
        generatedAt: new Date().toISOString(),
        note: 'Fixture data. BUREAU_MODE=mock — no provider was contacted.',
        score,
      },
    };
  }
}

function hashToInt(input: string): number {
  const digest = createHash('sha256').update(input).digest();
  return digest.readUInt32BE(0);
}

function bandFor(ratio: number): string {
  if (ratio >= 0.8) return 'Very low risk';
  if (ratio >= 0.65) return 'Low risk';
  if (ratio >= 0.45) return 'Moderate risk';
  if (ratio >= 0.3) return 'Elevated risk';
  return 'High risk';
}

const CREDITORS = [
  'Uline',
  'Grainger',
  'Quill',
  'Summit Office Supply',
  'Northwind Freight',
  'Crown Equipment Leasing',
];

function buildTradelines(seed: number): NormalizedTradeline[] {
  const count = (seed % 4) + 1;
  return Array.from({ length: count }, (_, i) => {
    const s = seed + i * 7919;
    const limit = ((s % 20) + 1) * 100_000;
    return {
      creditorName: CREDITORS[s % CREDITORS.length] ?? 'Trade supplier',
      accountType: (['net30', 'revolving', 'vendor', 'installment'] as const)[s % 4] ?? 'net30',
      dateOpened: `${new Date().getUTCFullYear() - ((s % 4) + 1)}-0${(s % 9) + 1}-15`,
      creditLimitCents: limit,
      currentBalanceCents: Math.round(limit * ((s % 60) / 100)),
      highBalanceCents: Math.round(limit * 0.8),
      paymentStatus: s % 9 === 0 ? 'late_30' : 'current',
    };
  });
}

function buildRiskFactors(seed: number, ratio: number): RiskFactor[] {
  const factors: RiskFactor[] = [];
  if (ratio >= 0.65) {
    factors.push({
      code: 'PAY_HISTORY_STRONG',
      summary: 'Payments have consistently been made on or before terms.',
      impact: 'positive',
    });
  } else {
    factors.push({
      code: 'PAY_HISTORY_MIXED',
      summary: 'At least one account has been paid beyond terms in the last 12 months.',
      impact: 'negative',
    });
  }
  factors.push({
    code: 'FILE_DEPTH',
    summary:
      seed % 3 === 0
        ? 'The file is thin — few reporting accounts limit how confidently the business can be scored.'
        : 'The file has enough reporting accounts to support a stable score.',
    impact: seed % 3 === 0 ? 'negative' : 'positive',
  });
  factors.push({
    code: 'UTILIZATION',
    summary:
      seed % 4 === 0
        ? 'Balances are high relative to available limits.'
        : 'Balances are comfortably below available limits.',
    impact: seed % 4 === 0 ? 'negative' : 'neutral',
  });
  return factors;
}
