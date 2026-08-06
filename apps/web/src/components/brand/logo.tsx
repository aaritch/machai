import { cn } from '@machai/ui';

/**
 * The Machai mark — a mitred shield holding three bars that climb and lighten
 * as they rise: cover, and a score improving.
 *
 * `tone="brand"` is the full-colour mark. `tone="mono"` paints in
 * currentColor for single-colour contexts (reversed out of a dark ground,
 * or solid on light).
 */
export function LogoMark({
  className,
  tone = 'brand',
  compact = false,
}: {
  className?: string;
  tone?: 'brand' | 'mono';
  /** Drops the shortest bar — use below ~20px, where it closes up. */
  compact?: boolean;
}) {
  const mono = tone === 'mono';
  return (
    <svg
      viewBox="0 0 64 76"
      fill="none"
      aria-hidden="true"
      className={cn('h-6 w-auto', className)}
    >
      <path
        d="M32 3 L61 13 V37 L32 73 L3 37 V13 Z"
        stroke={mono ? 'currentColor' : 'var(--color-accent-500)'}
        strokeWidth={compact ? 6 : 4}
        strokeLinejoin="miter"
      />
      {compact ? null : (
        <rect
          x="16"
          y="37"
          width="8.5"
          height="9"
          fill={mono ? 'currentColor' : 'var(--color-accent-700)'}
        />
      )}
      <rect
        x="27.75"
        y="30"
        width="8.5"
        height="16"
        fill={mono ? 'currentColor' : 'var(--color-accent-500)'}
      />
      <rect
        x="39.5"
        y="23"
        width="8.5"
        height="23"
        fill={mono ? 'currentColor' : 'var(--color-accent-300)'}
      />
    </svg>
  );
}

/** Horizontal lockup: mark + wordmark, tracked wide. */
export function LogoLockup({
  className,
  markClassName,
  wordClassName,
  tone = 'brand',
  compact = false,
}: {
  className?: string;
  markClassName?: string;
  wordClassName?: string;
  tone?: 'brand' | 'mono';
  compact?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark tone={tone} compact={compact} className={cn('h-6', markClassName)} />
      <span
        className={cn(
          'font-medium tracking-[0.24em] text-neutral-100',
          tone === 'mono' && 'text-current',
          wordClassName,
        )}
      >
        MACHAI
      </span>
    </span>
  );
}

/** Stacked lockup with the descriptor — for the footer and auth screens. */
export function LogoStacked({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex flex-col items-center gap-3', className)}>
      <LogoMark className="h-11" />
      <span className="text-lg font-medium tracking-[0.28em] pl-[0.28em] text-neutral-100">
        MACHAI
      </span>
      <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-600">
        Business credit on your EIN
      </span>
    </span>
  );
}
