/**
 * PII scrubbing.
 *
 * TASK-08: "PII in logs is the most common leak. The scrubber must be verified
 * by tests, not assumed." Both defences run, because either alone is porous:
 *
 *   1. Key-name matching  — catches `{ ein: '123456789' }` regardless of format.
 *   2. Value patterns     — catches an EIN concatenated into a message string,
 *                           where there is no key to inspect.
 *
 * This module is the last line before output. It is deliberately aggressive:
 * over-redacting a log line costs nothing, under-redacting is a breach.
 */

export const REDACTED = '[redacted]';

/** Key names whose values never appear in output, at any nesting depth. */
const SENSITIVE_KEY_PATTERN =
  /(^|[_.-])(ein|ssn|tax_?id|taxid|password|passwd|pwd|secret|token|api_?key|apikey|authorization|auth|cookie|session|card|cvc|cvv|pan|account_?number|raw_?payload|payload_raw|mfa_?secret|private_?key)($|[_.-])/i;

/** An EIN or SSN written as digits, with or without the usual separators. */
const EIN_PATTERN = /\b\d{2}-\d{7}\b/g;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const NINE_DIGIT_PATTERN = /\b\d{9}\b/g;
const CARD_PATTERN = /\b(?:\d[ -]?){13,19}\b/g;
const BEARER_PATTERN = /\b(bearer|basic)\s+[\w\-._~+/]+=*/gi;
const STRIPE_KEY_PATTERN = /\b(sk|rk|whsec|pk)_(test|live)?_?[A-Za-z0-9]{8,}/g;

const MAX_DEPTH = 8;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 2000;

/** Redacts sensitive substrings from a free-text value. */
export function redactString(value: string): string {
  let out = value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]` : value;
  out = out.replace(BEARER_PATTERN, `$1 ${REDACTED}`);
  out = out.replace(STRIPE_KEY_PATTERN, REDACTED);
  out = out.replace(SSN_PATTERN, REDACTED);
  out = out.replace(EIN_PATTERN, REDACTED);
  out = out.replace(CARD_PATTERN, (match) => {
    // Only treat it as a card if it really is 13–19 digits once separators go.
    const digits = match.replace(/[^\d]/g, '');
    return digits.length >= 13 && digits.length <= 19 ? REDACTED : match;
  });
  out = out.replace(NINE_DIGIT_PATTERN, REDACTED);
  return out;
}

/**
 * Recursively redacts a value of any shape. Safe against cycles, deep nesting,
 * and huge arrays — a logger must never be the thing that takes a process down.
 */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return '[max depth]';

  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }
  if (typeof value === 'function' || typeof value === 'symbol') return '[non-serializable]';

  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);

    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ARRAY_ITEMS).map((v) => redact(v, depth + 1, seen));
      if (value.length > MAX_ARRAY_ITEMS) items.push(`…${value.length - MAX_ARRAY_ITEMS} more`);
      return items;
    }

    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(val, depth + 1, seen);
    }
    return out;
  }

  return '[unknown]';
}

/**
 * Sentry `beforeSend` hook. Error traces are the sneakiest leak path: local
 * variables and request bodies get attached automatically.
 */
export function scrubEvent<T extends Record<string, unknown>>(event: T): T {
  return redact(event) as T;
}
