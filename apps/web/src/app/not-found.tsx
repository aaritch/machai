import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-700 dark:text-accent-300">
          404
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          We could not find that page
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          The link may be out of date, or the page may have moved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-lg bg-accent-700 px-4 text-sm font-semibold text-white hover:bg-accent-800"
          >
            Go home
          </Link>
          <Link
            href="/help"
            className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 dark:text-neutral-300 dark:ring-neutral-700"
          >
            Help center
          </Link>
        </div>
      </div>
    </div>
  );
}
