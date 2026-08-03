'use client';

import Link from 'next/link';
import { useState } from 'react';
import { brand } from '@machai/config/public';
import { Button, LinkButton, cn } from '@machai/ui';

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

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<'company' | 'learn' | null>(null);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded font-semibold tracking-tight text-neutral-900 focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-neutral-50"
        >
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-lg bg-accent-700 text-sm font-bold text-white"
          >
            {brand.name.charAt(0)}
          </span>
          {brand.name}
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
          <Link
            href="/pricing"
            className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
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
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
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
        <div
          id="mobile-nav"
          className="border-t border-neutral-200 bg-white px-4 py-4 md:hidden dark:border-neutral-800 dark:bg-neutral-950"
        >
          <MobileGroup label="Company" links={COMPANY_LINKS} onNavigate={() => setMobileOpen(false)} />
          <MobileGroup label="Learn" links={LEARN_LINKS} onNavigate={() => setMobileOpen(false)} />
          <Link
            href="/pricing"
            onClick={() => setMobileOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Pricing
          </Link>
          <div className="mt-3 flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
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
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
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
        <div className="absolute left-0 top-full w-60 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
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
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          className="block rounded-lg px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
