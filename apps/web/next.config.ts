import type { NextConfig } from 'next';

/**
 * Security headers (TASK-08 app-sec baseline).
 *
 * The CSP is deliberately strict about framing and object embedding. It does
 * NOT lock down scripts to a nonce yet, because Next's inline bootstrap and
 * Stripe's redirect flow both need care there — doing it half-way produces a
 * policy that looks protective while silently falling back to
 * `unsafe-inline`. Tracked in docs/adr/0006-content-security-policy.md.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Stripe Checkout and the Customer Portal are hosted redirects; the
      // publishable-key surface loads js.stripe.com.
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Workspace packages ship TypeScript source rather than a build step, so Next
  // compiles them alongside app code. One fewer build artifact to keep in sync.
  transpilePackages: [
    '@machai/billing',
    '@machai/billing-sync',
    '@machai/bureau-clients',
    '@machai/config',
    '@machai/db',
    '@machai/emails',
    '@machai/entitlements',
    '@machai/kyb',
    '@machai/observability',
    '@machai/queue',
    '@machai/storage',
    '@machai/types',
    '@machai/ui',
  ],

  // These are node-only and must not be bundled into serverless output.
  serverExternalPackages: ['postgres', 'bullmq', 'ioredis', '@aws-sdk/client-s3', '@aws-sdk/client-kms'],

  experimental: {
    // Server Actions carry every state-changing form in this app. Next enforces
    // an Origin/Host check on them, which is our CSRF defence.
    serverActions: { bodySizeLimit: '1mb' },
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
