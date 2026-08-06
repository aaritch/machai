import { randomInt } from 'node:crypto';
import { REFERRAL_CODE_ALPHABET, REFERRAL_CODE_LENGTH } from '@machai/config';

/**
 * Generates a referral code.
 *
 * `randomInt` rather than `Math.random`: these codes are public identifiers, so
 * predictability is not a secrecy problem — but a weak generator produces
 * clustered values and avoidable collisions, and the crypto version costs
 * nothing here.
 */
export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)];
  }
  return code;
}

/** Normalizes user input — codes are uppercase and read from URLs. */
export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
