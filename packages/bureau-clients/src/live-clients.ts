import {
  BUREAU_SCORE_SCALES,
  type Bureau,
  type BureauResult,
  type NormalizedReport,
} from '@machai/types';
import { logger } from '@machai/observability';
import type { BureauBusinessQuery, BureauClient } from './interface';
import { normalizePayload, type FieldMap } from './normalize';

/**
 * Live pull clients — Direction A.
 *
 * These are real HTTP clients with the request/response plumbing, retry
 * semantics, and normalization in place. What they do NOT have is a verified
 * request contract: the exact endpoint paths, auth scheme, and payload shape
 * come from each bureau's integration documentation, which is only issued once
 * the data agreement is signed (STATE.md §6, decision D2 still open).
 *
 * The `FieldMap` per bureau is the seam. When the contract arrives, adjust the
 * map and the endpoint — no other file changes, because everything downstream
 * only ever sees a NormalizedReport.
 *
 * Until then `BUREAU_MODE=mock` routes to the fixture client, and config
 * refuses to let `live` be set outside production.
 */

interface LiveClientOptions {
  bureau: Bureau;
  baseUrl: string | undefined;
  apiKey: string | undefined;
  /** Path template for the search/report endpoint. */
  reportPath: string;
  fieldMap: FieldMap;
}

class LiveBureauClient implements BureauClient {
  readonly bureau: Bureau;
  readonly configured: boolean;

  constructor(private readonly options: LiveClientOptions) {
    this.bureau = options.bureau;
    this.configured = Boolean(options.baseUrl && options.apiKey);
  }

  async fetchReport(business: BureauBusinessQuery): Promise<BureauResult> {
    if (!this.configured) {
      return {
        ok: false,
        code: 'not_configured',
        message: `No credentials configured for ${this.bureau}.`,
        retryable: false,
      };
    }

    const url = `${this.options.baseUrl}${this.options.reportPath}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey}`,
          accept: 'application/json',
        },
        // The EIN goes over the wire here and nowhere else. It is never logged,
        // and never placed in a job payload.
        body: JSON.stringify({
          taxId: business.ein,
          name: business.legalName,
          address: {
            line1: business.streetAddress,
            city: business.city,
            state: business.state,
            postalCode: business.zip,
          },
          phone: business.phone,
        }),
        signal: controller.signal,
      });

      if (response.status === 404) {
        return {
          ok: false,
          code: 'no_file',
          message: 'The bureau has no file for this business.',
          retryable: false,
        };
      }
      if (response.status === 429) {
        return {
          ok: false,
          code: 'rate_limited',
          message: 'The bureau rate-limited this request.',
          retryable: true,
        };
      }
      if (!response.ok) {
        // Log the status, never the body — a bureau error body can echo the
        // identifiers we sent it.
        logger.warn('bureau pull returned an error status', {
          bureau: this.bureau,
          status: response.status,
        });
        return {
          ok: false,
          code: 'provider_error',
          message: `The bureau returned status ${response.status}.`,
          retryable: response.status >= 500,
        };
      }

      const rawPayload: unknown = await response.json();
      const report = this.normalize(rawPayload, business);
      if (report.unmappedFields.length > 0) {
        // Loud, not silent. A format change that quietly maps to wrong values
        // is worse than a failed pull (TASK-05 edge case).
        logger.warn('bureau payload contained unmapped fields', {
          bureau: this.bureau,
          unmappedCount: report.unmappedFields.length,
          fields: report.unmappedFields,
        });
      }
      return { ok: true, report, rawPayload };
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      logger.error('bureau pull failed', { bureau: this.bureau, aborted, error });
      return {
        ok: false,
        code: 'provider_error',
        message: aborted ? 'The bureau did not respond in time.' : 'The bureau request failed.',
        retryable: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalize(payload: unknown, business: BureauBusinessQuery): NormalizedReport {
    return normalizePayload({
      bureau: this.bureau,
      payload,
      fieldMap: this.options.fieldMap,
      scoreScale: BUREAU_SCORE_SCALES[this.bureau].label,
      fallbackName: business.legalName,
    });
  }
}

export function createCreditsafeClient(baseUrl?: string, apiKey?: string): BureauClient {
  return new LiveBureauClient({
    bureau: 'creditsafe',
    baseUrl,
    apiKey,
    reportPath: '/v1/companies/search',
    fieldMap: {
      score: ['creditScore.currentCreditRating.providerValue.value', 'score'],
      band: ['creditScore.currentCreditRating.commonDescription', 'riskBand'],
      name: ['companySummary.businessName', 'name'],
      tradelines: ['tradePaymentData.tradelines', 'tradelines'],
      publicRecords: ['negativeInformation.filings', 'publicRecords'],
      riskFactors: ['creditScore.reasons', 'riskFactors'],
    },
  });
}

export function createEquifaxBusinessClient(baseUrl?: string, apiKey?: string): BureauClient {
  return new LiveBureauClient({
    bureau: 'equifax_business',
    baseUrl,
    apiKey,
    reportPath: '/business/commercial-credit/v1/reports',
    fieldMap: {
      score: ['products.businessCreditRisk.score', 'score'],
      band: ['products.businessCreditRisk.riskClass', 'riskBand'],
      name: ['businessIdentity.legalName', 'name'],
      tradelines: ['products.tradeCredit.accounts', 'tradelines'],
      publicRecords: ['products.publicRecords.items', 'publicRecords'],
      riskFactors: ['products.businessCreditRisk.scoreFactors', 'riskFactors'],
    },
  });
}

export function createDnbClient(baseUrl?: string, apiKey?: string): BureauClient {
  return new LiveBureauClient({
    bureau: 'dnb',
    baseUrl,
    apiKey,
    reportPath: '/v1/data/duns',
    fieldMap: {
      score: ['organization.dnbAssessment.paydexScore', 'paydex'],
      band: ['organization.dnbAssessment.standardRatingDescription', 'riskBand'],
      name: ['organization.primaryName', 'name'],
      tradelines: ['organization.tradeExperience.accounts', 'tradelines'],
      publicRecords: ['organization.legalEvents.filings', 'publicRecords'],
      riskFactors: ['organization.dnbAssessment.factors', 'riskFactors'],
    },
  });
}
