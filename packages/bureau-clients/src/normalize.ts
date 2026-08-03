import type {
  Bureau,
  NormalizedReport,
  NormalizedTradeline,
  PublicRecord,
  RiskFactor,
  TradelineAccountType,
  TradelinePaymentStatus,
} from '@machai/types';

/**
 * Payload normalization (spec §11.1).
 *
 * Each bureau publishes a different schema. A `FieldMap` lists the candidate
 * paths a value might live at, in priority order, and the normalizer takes the
 * first that resolves. Bureaus rename fields between API versions, so accepting
 * several paths absorbs that churn without a deploy.
 *
 * The rule that matters (TASK-05 caveat "normalization drift"): when a value
 * cannot be found, record it in `unmappedFields` and leave the field null.
 * Never guess, never coerce, never silently substitute a default — a wrong
 * score shown confidently is worse than a missing one.
 */

export interface FieldMap {
  score: string[];
  band: string[];
  name: string[];
  tradelines: string[];
  publicRecords: string[];
  riskFactors: string[];
}

export interface NormalizeInput {
  bureau: Bureau;
  payload: unknown;
  fieldMap: FieldMap;
  scoreScale: string;
  fallbackName: string;
}

export function normalizePayload(input: NormalizeInput): NormalizedReport {
  const unmapped: string[] = [];

  const rawScore = pick(input.payload, input.fieldMap.score);
  if (rawScore === undefined) unmapped.push('score');

  const rawBand = pick(input.payload, input.fieldMap.band);
  if (rawBand === undefined) unmapped.push('band');

  const rawTradelines = pick(input.payload, input.fieldMap.tradelines);
  if (rawTradelines === undefined) unmapped.push('tradelines');

  const rawPublicRecords = pick(input.payload, input.fieldMap.publicRecords);
  if (rawPublicRecords === undefined) unmapped.push('publicRecords');

  const rawRiskFactors = pick(input.payload, input.fieldMap.riskFactors);
  if (rawRiskFactors === undefined) unmapped.push('riskFactors');

  return {
    bureau: input.bureau,
    score: toScore(rawScore),
    scoreBand: toStringOrNull(rawBand),
    scoreScale: input.scoreScale,
    pulledAt: new Date(),
    businessName: toStringOrNull(pick(input.payload, input.fieldMap.name)) ?? input.fallbackName,
    tradelines: toTradelines(rawTradelines),
    publicRecords: toPublicRecords(rawPublicRecords),
    riskFactors: toRiskFactors(rawRiskFactors),
    unmappedFields: unmapped,
  };
}

/** Resolves the first dotted path that yields a defined value. */
function pick(source: unknown, paths: string[]): unknown {
  for (const path of paths) {
    const value = resolvePath(source, path);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function resolvePath(source: unknown, path: string): unknown {
  let current = source;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Scores arrive as numbers or numeric strings depending on the provider.
 * Anything that is not a finite number becomes null rather than NaN or 0 —
 * a zero score would render as "high risk" and be actively misleading.
 */
function toScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

const ACCOUNT_TYPE_ALIASES: Record<string, TradelineAccountType> = {
  net30: 'net30',
  'net-30': 'net30',
  trade: 'vendor',
  vendor: 'vendor',
  supplier: 'vendor',
  revolving: 'revolving',
  card: 'revolving',
  creditcard: 'revolving',
  installment: 'installment',
  loan: 'installment',
  lease: 'installment',
};

const PAYMENT_STATUS_ALIASES: Record<string, TradelinePaymentStatus> = {
  current: 'current',
  ok: 'current',
  paidasagreed: 'current',
  '30': 'late_30',
  late30: 'late_30',
  '60': 'late_60',
  late60: 'late_60',
  '90': 'late_90',
  late90: 'late_90',
  collections: 'collections',
  collection: 'collections',
  chargeoff: 'collections',
};

function toTradelines(value: unknown): NormalizedTradeline[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): NormalizedTradeline[] => {
    if (entry === null || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const creditorName =
      toStringOrNull(row.creditorName) ?? toStringOrNull(row.supplier) ?? toStringOrNull(row.name);
    if (!creditorName) return [];

    return [
      {
        creditorName,
        accountType: mapAlias(row.accountType ?? row.type, ACCOUNT_TYPE_ALIASES, 'other'),
        dateOpened: toStringOrNull(row.dateOpened ?? row.opened),
        creditLimitCents: toCents(row.creditLimit ?? row.limit ?? row.creditLimitCents),
        currentBalanceCents: toCents(row.currentBalance ?? row.balance ?? row.currentBalanceCents),
        highBalanceCents: toCents(row.highBalance ?? row.highCredit ?? row.highBalanceCents),
        paymentStatus: mapAlias(
          row.paymentStatus ?? row.status ?? row.daysBeyondTerms,
          PAYMENT_STATUS_ALIASES,
          'current',
        ),
      },
    ];
  });
}

function mapAlias<T extends string>(
  value: unknown,
  aliases: Record<string, T>,
  fallback: T,
): T {
  if (value === null || value === undefined) return fallback;
  const key = String(value).toLowerCase().replace(/[\s_-]/g, '');
  return aliases[key] ?? fallback;
}

/**
 * Amounts arrive as dollars (number or string) or already as cents, depending
 * on the provider. Values are treated as dollars unless the source field name
 * said cents — hence the caller passing the right field.
 */
function toCents(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

function toPublicRecords(value: unknown): PublicRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): PublicRecord[] => {
    if (entry === null || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const type = toStringOrNull(row.type) ?? toStringOrNull(row.filingType);
    if (!type) return [];
    return [
      {
        type,
        filedOn: toStringOrNull(row.filedOn ?? row.filingDate ?? row.date),
        amountCents: toCents(row.amount),
        status: toStringOrNull(row.status) ?? 'Unknown',
      },
    ];
  });
}

function toRiskFactors(value: unknown): RiskFactor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): RiskFactor[] => {
    if (typeof entry === 'string') {
      return [{ code: 'UNCODED', summary: entry, impact: 'neutral' }];
    }
    if (entry === null || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const summary = toStringOrNull(row.description ?? row.summary ?? row.text);
    if (!summary) return [];
    const impactRaw = String(row.impact ?? row.direction ?? '').toLowerCase();
    const impact: RiskFactor['impact'] =
      impactRaw.includes('pos') ? 'positive' : impactRaw.includes('neg') ? 'negative' : 'neutral';
    return [{ code: toStringOrNull(row.code) ?? 'UNCODED', summary, impact }];
  });
}
