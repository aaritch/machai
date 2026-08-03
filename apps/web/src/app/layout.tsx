import type { Metadata, Viewport } from 'next';
import { appUrl, brand } from '@machai/config/public';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: `${brand.name} — Build business credit on your EIN`,
    template: `%s · ${brand.name}`,
  },
  description:
    'Establish and monitor business credit using your EIN, not your personal score. Live bureau reports, score monitoring, and a checklist that tells you what to do next.',
  openGraph: {
    type: 'website',
    siteName: brand.name,
    url: appUrl,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8f7' },
    { media: '(prefers-color-scheme: dark)', color: '#111412' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        {/* Keyboard users should not have to tab through the whole nav. */}
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
