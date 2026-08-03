import { getConfig } from '@machai/config';
import { BUREAUS, type Bureau } from '@machai/types';
import { BureauClientRegistry, type BureauClient } from './interface';
import {
  createCreditsafeClient,
  createDnbClient,
  createEquifaxBusinessClient,
} from './live-clients';
import { MockBureauClient } from './mock';

export * from './interface';
export * from './normalize';
export * from './furnishing';
export { MockBureauClient } from './mock';

let cached: BureauClientRegistry | null = null;

/**
 * Builds the registry for the current environment.
 *
 * `BUREAU_MODE` decides which implementations are registered, and config
 * refuses to allow `live` outside production — so a non-production environment
 * physically cannot make a billable provider call.
 */
export function getBureauRegistry(): BureauClientRegistry {
  if (cached) return cached;
  const config = getConfig();
  const registry = new BureauClientRegistry();

  if (config.BUREAU_MODE === 'mock') {
    for (const bureau of BUREAUS) registry.register(new MockBureauClient(bureau));
  } else {
    registry.register(createCreditsafeClient(config.CREDITSAFE_API_URL, config.CREDITSAFE_API_KEY));
    registry.register(
      createEquifaxBusinessClient(config.EQUIFAX_BUSINESS_API_URL, config.EQUIFAX_BUSINESS_API_KEY),
    );
    registry.register(createDnbClient(config.DNB_API_URL, config.DNB_API_KEY));
  }

  cached = registry;
  return cached;
}

export function getBureauClient(bureau: Bureau): BureauClient | null {
  return getBureauRegistry().get(bureau);
}

export function resetBureauRegistryForTest(): void {
  cached = null;
}
