'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, LinkButton, cn } from '@machai/ui';
import { LogoLockup } from '@/components/brand/logo';

/**
 * Sticky marketing nav (spec §5.1).
 *
 * Company and Learn are dropdowns on pointer devices and plain expandable
 * groups in the mobile sheet. The menus open on click rather than hover:
 * hover-only menus are unreachable by keyboard and awkward on touch.
 */

const COMPANY_LINKS = [
  { href: '/about', label: 'About us' },
  { href: '/about#story', label: 'Our story' },
  { href: '/contact', label: 'Contact' },
];

const LEARN_LINKS = [
  { href: '/learn', label: 'What is business credit?' },
  { href: '/help', label: 'Help center' },
  { href: '/help/getting-started', label: 'Getting started guide' },
];

const navLink =
  'rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-neutral-100';

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<'company' | 'learn' | null>(null);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-neutral-950/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-500">
          <LogoLockup markClassName="h-5" wordClassName="text-sm" />
          <span className="sr-only">Machai — home</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <DropdownNav
            label="Company"
            links={COMPANY_LINKS}
            open={openMenu === 'company'}
            onToggle={() => setOpenMenu(openMenu === 'company' ? null : 'company')}
            onClose={() => setOpenMenu(null)}
          />
          <DropdownNav
            label="Learn"
            links={LEARN_LINKS}
            open={openMenu === 'learn'}
            onToggle={() => setOpenMenu(openMenu === 'learn' ? null : 'learn')}
            onClose={() => setOpenMenu(null)}
          />
          <Link href="/pricing" className={navLink}>
            Pricing
          </Link>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <LinkButton href="/dashboard" size="sm">
              Dashboard
            </LinkButton>
          ) : (
            <>
              <Link href="/login" className={navLink}>
                Log in
              </Link>
              <LinkButton href="/signup" size="sm">
                Sign up
              </LinkButton>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <span className="sr-only">{mobileOpen ? 'Close menu' : 'Open menu'}</span>
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            {mobileOpen ? (
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            ) : (
              <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
            )}
          </svg>
        </Button>
      </nav>

      {mobileOpen ? (
        <div id="mobile-nav" className="border-t border-neutral-800 bg-neutral-950 px-4 py-4 md:hidden">
          <MobileGroup label="Company" links={COMPANY_LINKS} onNavigate={() => setMobileOpen(false)} />
          <MobileGroup label="Learn" links={LEARN_LINKS} onNavigate={() => setMobileOpen(false)} />
          <Link
            href="/pricing"
            onClick={() => setMobileOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-300"
          >
            Pricing
          </Link>
          <div className="mt-3 flex flex-col gap-2 border-t border-neutral-800 pt-3">
            {signedIn ? (
              <LinkButton href="/dashboard" fullWidth>
                Dashboard
              </LinkButton>
            ) : (
              <>
                <LinkButton href="/login" variant="secondary" fullWidth>
                  Log in
                </LinkButton>
                <LinkButton href="/signup" fullWidth>
                  Sign up
                </LinkButton>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function DropdownNav({
  label,
  links,
  open,
  onToggle,
  onClose,
}: {
  label: string;
  links: { href: string; label: string }[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative" onMouseLeave={onClose}>
      <button type="button" aria-expanded={open} onClick={onToggle} className={cn(navLink, 'flex items-center gap-1')}>
        {label}
        <svg
          viewBox="0 0 20 20"
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="absolute left-0 top-full w-60 rounded-lg border border-neutral-700 bg-neutral-900 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.65)]">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="block rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MobileGroup({
  label,
  links,
  onNavigate,
}: {
  label: string;
  links: { href: string; label: string }[];
  onNavigate: () => void;
}) {
  return (
    <div className="mb-2">
      <p className="px-3 pb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-600">{label}</p>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          className="block rounded-lg px-3 py-2 text-sm text-neutral-300"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
