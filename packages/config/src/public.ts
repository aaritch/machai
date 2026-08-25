/**
 * Browser-safe configuration.
 *
 * Only NEXT_PUBLIC_* values may appear here — this module is bundled into the
 * client. Anything secret belongs in ./server.ts, which throws if imported
 * from a browser bundle.
 */

export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Machai',
  tagline: 'Business credit built on your EIN — not your personal score.',
  supportEmail: 'support@machaibusinesssolutions.com',
  salesEmail: 'sales@machaibusinesssolutions.com',
  responseTime: 'Most inquiries get a reply within 24 hours',
  hours: 'Mon–Fri, 9:00 AM – 6:00 PM Eastern',
  supportScope: 'Billing, reporting, onboarding, account access, and questions about your file',
} as const;

export const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

/**
 * Compliance copy used wherever the product describes what it does.
 *
 * Kept in one place so a claim cannot be softened in one page and overstated in
 * another. Spec §12.4 and §14.3/§14.4: no guaranteed outcomes, no reporting
 * claim ahead of an approved furnisher agreement.
 */
export const disclosures = {
  noGuarantee:
    'Credit outcomes depend on your business activity and each bureau’s own criteria. No score increase or funding approval is guaranteed.',
  // Renamed from `einOnly`: the EIN-only / no-SSN claim was removed from the
  // site, and a constant whose name still advertises it would invite the copy
  // creeping back in.
  freeToStart: 'Free to start — no card required.',
  reportingRoadmap:
    'Bureau reporting is added only after that bureau approves us as a data furnisher. Bureaus not yet approved are shown as roadmap, never as active reporting.',
  // Replaced `pullDisclosure`, which described live report pulls — a
  // capability no plan includes. What a subscriber needs told instead is what
  // reporting requires of them and what it cannot promise.
  reportingDisclosure:
    'Reporting requires an active plan and a verified business. Each bureau decides what it accepts and how it scores it, and a file can take several cycles to appear.',
} as const;
