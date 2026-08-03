import Link from 'next/link';
import { brand } from '@machai/config/public';

/** Minimal chrome for the auth routes — no marketing nav to distract. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded font-semibold tracking-tight text-neutral-900 dark:text-neutral-50"
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
      </header>

      <main id="main" className="flex-1 px-4 py-12 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-neutral-200 py-6 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-4 px-4 text-xs text-neutral-500 sm:px-6 dark:text-neutral-400">
          <Link href="/legal/terms" className="hover:underline">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link href="/contact" className="hover:underline">
            Contact
          </Link>
        </div>
      </footer>
    </div>
  );
}
