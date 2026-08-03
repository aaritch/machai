/**
 * Minimal class-name joiner.
 *
 * Deliberately not `clsx` + `tailwind-merge`: this design system composes
 * classes additively and never needs conflict resolution, so two dependencies
 * would buy nothing. If variants ever start fighting, that is the signal the
 * variant API is wrong, not that a merge library is missing.
 *
 * Non-string values are accepted because `cond && 'class'` idioms leak
 * whatever `cond` is when it is falsy — including `0` and `''` — and callers
 * should not have to wrap every guard in `Boolean()`.
 */
export type ClassValue = string | number | bigint | boolean | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}
