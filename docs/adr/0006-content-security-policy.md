# ADR-0006 — Security headers and the CSP gap

**Status:** Accepted, with a known gap · **Date:** 2026-08-03
**Relates to:** TASK-08 app-sec baseline

## Decision

`apps/web/next.config.ts` sets, on every response:

- `Strict-Transport-Security` with a two-year max-age and preload
- `X-Frame-Options: DENY` and `frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` denying camera, microphone, and geolocation
- A `Content-Security-Policy` restricting `default-src`, `object-src`,
  `base-uri`, and `form-action` to `'self'`, with Stripe and Cloudflare
  Turnstile allowlisted where they are actually needed

## The gap: `script-src` includes `'unsafe-inline'`

This is stated plainly rather than buried, because a CSP that looks strict and
is not is worse than an honest one.

Next.js emits an inline bootstrap script and inline hydration data. Locking
`script-src` down properly requires a per-request nonce threaded through the
document, which in the App Router forces every page onto dynamic rendering —
losing the static generation that the marketing pages depend on for SEO and
speed.

Setting a nonce *and* leaving `'unsafe-inline'` in place is the worst option:
browsers ignore `'unsafe-inline'` when a nonce is present in some contexts and
honour it in others, producing a policy nobody can reason about.

## What compensates in the meantime

- No `dangerouslySetInnerHTML` anywhere. Help-center Markdown renders to React
  elements (`apps/web/src/components/markdown.tsx`), and ticket bodies render as
  text nodes — React escapes both, so stored XSS has no injection point.
- `object-src 'none'` and `base-uri 'self'` close the common bypasses.
- `frame-ancestors 'none'` prevents clickjacking regardless of script policy.

## Next step

Adopt nonce-based `script-src` when the marketing pages can afford dynamic
rendering, or when Next offers static-compatible nonces. Until then this ADR is
the record that the gap is known and deliberate.
