import type { Bureau, BureauResult } from '@machai/types';

/**
 * The BureauClient contract (spec §11.1, project plan C.3).
 *
 * Promise: given a verified business, return a NormalizedReport or a TYPED
 * failure. Every implementation satisfies the same shape, so the application
 * never branches on which bureau it is talking to — adding a bureau is adding
 * a file here, not a change to the UI.
 *
 * Invariants every implementation must hold:
 *  - Never throws a provider-specific error past this boundary. Map everything
 *    to a BureauFailure code.
 *  - Always attaches the raw payload on success, for audit and re-parsing.
 *  - Reports unmapped fields rather than silently dropping them, so a provider
 *    format change is visible instead of producing quietly wrong values.
 */
export interface BureauClient {
  readonly bureau: Bureau;
  /** False when credentials are absent — callers surface a clear state. */
  readonly configured: boolean;
  fetchReport(business: BureauBusinessQuery): Promise<BureauResult>;
}

/**
 * What a bureau needs to find a business.
 *
 * The EIN arrives here decrypted, which is exactly why this interface is
 * narrow: it is a decrypt-at-the-last-moment boundary, and the value must not
 * be logged, cached, or copied into a job payload.
 */
export interface BureauBusinessQuery {
  businessId: string;
  legalName: string;
  dbaName: string | null;
  ein: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export class BureauClientRegistry {
  private readonly clients = new Map<Bureau, BureauClient>();

  register(client: BureauClient): void {
    this.clients.set(client.bureau, client);
  }

  get(bureau: Bureau): BureauClient | null {
    return this.clients.get(bureau) ?? null;
  }

  list(): BureauClient[] {
    return [...this.clients.values()];
  }
}
