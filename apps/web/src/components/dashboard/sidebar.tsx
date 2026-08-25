'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { brand } from '@machai/config/public';
import { Badge, Button, cn } from '@machai/ui';

/**
 * Dashboard sidebar (spec §7, pic3/pic7).
 *
 * Groups: Core, Tools, Account. Tools entries are marked `locked` when the plan
 * does not include them — the lock is a visual affordance only; the pages
 * themselves re-check entitlement server-side.
 */

interface NavItem {
  href: string;
  label: string;
  badge?: string;
  requiresEntitlement?: boolean;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Core',
    items: [
      { href: '/dashboard', label: 'Home' },
      { href: '/dashboard/purchases', label: 'My purchases' },
      { href: '/dashboard/products', label: 'Products' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { href: '/dashboard/tradelines', label: 'Tradeline tracker', badge: 'New' },
      { href: '/dashboard/checklist', label: 'Credit checklist' },
      { href: '/dashboard/marketplace', label: 'Marketplace' },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/dashboard/billing', label: 'Subscriptions & billing' },
      { href: '/dashboard/affiliate', label: 'Affiliate program' },
      { href: '/dashboard/company', label: 'Company info' },
      { href: '/dashboard/tickets', label: 'Support tickets' },
      { href: '/dashboard/feedback', label: 'Feedback' },
      { href: '/dashboard/settings', label: 'Settings' },
    ],
  },
];

export function Sidebar({
  userEmail,
  businessName,
  planLabel,
  hasEntitlements,
  isStaff,
}: {
  userEmail: string;
  businessName: string | null;
  planLabel: string;
  hasEntitlements: boolean;
  isStaff: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex h-full flex-col" aria-label="Dashboard">
      <div className="flex-1 space-y-6 px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                // Exact match for /dashboard so it does not stay highlighted on
                // every child route.
                const active =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);
                const locked = item.requiresEntitlement && !hasEntitlements;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-accent-50 font-semibold text-accent-900 dark:bg-accent-900/40 dark:text-accent-100'
                          : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
                      )}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.badge ? <Badge tone="accent">{item.badge}</Badge> : null}
                      {locked ? (
                        <span
                          className="text-xs text-neutral-400"
                          title="Included with a paid plan"
                          aria-label="Requires a paid plan"
                        >
                          🔒
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {isStaff ? (
          <div>
            <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Staff
            </p>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Admin
                </Link>
              </li>
            </ul>
          </div>
        ) : null}
      </div>

      <div className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {businessName ?? 'No business yet'}
        </p>
        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{userEmail}</p>
        <p className="mt-1.5 text-xs font-medium text-accent-700 dark:text-accent-300">
          {planLabel}
        </p>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile trigger */}
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 lg:hidden dark:border-neutral-800 dark:bg-neutral-950">
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={open}
          aria-controls="dashboard-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Close' : 'Menu'}
        </Button>
        <span className="font-semibold text-neutral-900 dark:text-neutral-50">{brand.name}</span>
      </div>

      {open ? (
        <div
          id="dashboard-nav"
          className="border-b border-neutral-200 bg-white lg:hidden dark:border-neutral-800 dark:bg-neutral-950"
        >
          {nav}
        </div>
      ) : null}

      <aside className="hidden w-64 shrink-0 border-r border-neutral-200 bg-white lg:block dark:border-neutral-800 dark:bg-neutral-950">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex h-16 items-center border-b border-neutral-200 px-4 dark:border-neutral-800">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold tracking-tight text-neutral-900 dark:text-neutral-50"
            >
              <span
                aria-hidden="true"
                className="grid h-7 w-7 place-items-center rounded-lg bg-accent-700 text-sm font-bold text-white"
              >
                {brand.name.charAt(0)}
              </span>
              {brand.name}
            </Link>
          </div>
          {nav}
        </div>
      </aside>
    </>
  );
}
