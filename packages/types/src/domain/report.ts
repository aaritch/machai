import type { Bureau, TradelineAccountType, TradelinePaymentStatus } from './enums';

/**
 * The normalized report shape every BureauClient returns (spec §11.1).
 *
 * The whole point is that the app never branches on which bureau produced a
 * report. Add a bureau by adding a client; the UI does not change.
 */
export interface NormalizedReport {
  bureau: Bureau;
  /** null when the bureau has a file but publishes no score. */
  score: number | null;
  scoreBand: string | null;
  /** e.g. '0–100' for Creditsafe, '0–650' for Equifax Business. */
  scoreScale: string;
  pulledAt: Date;
  businessName: string | null;
  tradelines: NormalizedTradeline[];
  publicRecords: PublicRecord[];
  riskFactors: RiskFactor[];
  /**
   * Fields the normalizer did not recognize. Non-empty means the provider
   * changed its payload: flag it loudly rather than silently mapping wrong
   * values (TASK-05 edge case).
   */
  unmappedFields: string[];
}

export interface NormalizedTradeline {
  creditorName: string;
  accountType: TradelineAccountType;
  dateOpened: string | null;
  creditLimitCents: number | null;
  currentBalanceCents: number | null;
  highBalanceCents: number | null;
  paymentStatus: TradelinePaymentStatus;
}

export interface PublicRecord {
  type: string;
  filedOn: string | null;
  amountCents: number | null;
  status: string;
}

export interface RiskFactor {
  code: string;
  summary: string;
  impact: 'positive' | 'neutral' | 'negative';
}

/**
 * Typed failures. A bureau client never throws a provider-specific error past
 * its boundary — it returns one of these so callers handle a closed set.
 */
export type BureauFailureCode = 'no_file' | 'provider_error' | 'rate_limited' | 'not_configured';

export interface BureauFailure {
  ok: false;
  code: BureauFailureCode;
  message: string;
  /** True when a retry could plausibly succeed (drives worker backoff). */
  retryable: boolean;
}

export interface BureauSuccess {
  ok: true;
  report: NormalizedReport;
  /** Retained verbatim for audit and re-parsing. Never discarded. */
  rawPayload: unknown;
}

export type BureauResult = BureauSuccess | BureauFailure;

/** `no_file` is an expected, first-class state — not an error (TASK-05). */
export function isNoFile(result: BureauResult): boolean {
  return !result.ok && result.code === 'no_file';
}

export interface ScorePoint {
  bureau: Bureau;
  score: number;
  recordedOn: string;
}
