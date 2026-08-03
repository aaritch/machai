'use client';

import { useEffect } from 'react';

/**
 * Root error boundary.
 *
 * Shows a generic message and nothing else. An internal error string can carry
 * a query fragment, a provider response, or an identifier, and this component
 * renders straight into the page — so the detail goes to the server log via the
 * digest, never to the browser.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest correlates this screen with the server-side log entry, which
    // is where the actual detail lives.
    // eslint-disable-next-line no-restricted-globals
    console.error('Application error', error.digest ?? 'no-digest');
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          We hit an unexpected error. It has been logged and we will look into it.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-neutral-500 dark:text-neutral-500">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center rounded-lg bg-accent-700 px-4 text-sm font-semibold text-white hover:bg-accent-800"
          >
            Try again
          </button>
          <a
            href="/contact"
            className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 dark:text-neutral-300 dark:ring-neutral-700"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
