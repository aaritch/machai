import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { appUrl, brand } from '@machai/config/public';
import './globals.css';

// Nocturne sets Inter for headings and body alike; hierarchy is size and space.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

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
  icons: {
    icon: [
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/machai-mark.svg', type: 'image/svg+xml' },
    ],
    apple: '/brand/apple-touch-icon-180.png',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#161826',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `dark` is set here, not inferred: Nocturne is a dark system, so the dark
    // variant is the site's only theme.
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="font-sans">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
