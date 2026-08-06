import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

/**
 * Design-system primitives — Nocturne.
 *
 * A near-neutral blue-grey ground, 8px radii, and an accent used as a line and
 * a glow rather than a flood: the primary action is an accent outline on
 * transparent, never a filled block. Elevation on a dark ground is a hairline
 * edge plus ambient darkness, so surfaces carry a border, not a spread shadow.
 *
 * Accessibility is built in rather than bolted on per screen: focus is the
 * themed 2px accent ring, disabled states carry `aria-disabled`, and error
 * text is wired to its input via `aria-describedby`. Accent-to-ground is
 * tuned to 3:1 — good for chrome and large text — so accent body copy uses
 * accent-200/300, never the base accent.
 */

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500';

// --- Button -----------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Outlined, not filled — the accent is a line here.
  primary:
    'border border-accent-500 bg-transparent text-accent-200 hover:bg-accent-500/12 active:bg-accent-500/20 disabled:border-accent-800 disabled:text-accent-700',
  secondary:
    'border border-neutral-800 bg-neutral-900 text-neutral-100 hover:border-neutral-700 hover:bg-neutral-800 active:bg-neutral-900 disabled:text-neutral-600',
  ghost:
    'border border-transparent bg-transparent text-neutral-300 hover:bg-neutral-800 active:bg-neutral-900',
  danger:
    'border border-red-500/70 bg-red-500/10 text-red-200 hover:bg-red-500/20 active:bg-red-500/25 disabled:opacity-45',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-45',
        focusRing,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    />
  );
}

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  ...props
}: LinkButtonProps) {
  return (
    <a
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors',
        focusRing,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    />
  );
}

// --- Card -------------------------------------------------------------------

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn('rounded-lg border border-neutral-800 bg-neutral-900', className)}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-neutral-800 px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-medium text-neutral-100">{title}</h2>
        {description ? <p className="mt-1 text-sm text-neutral-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('px-5 py-4', className)} />;
}

// --- Badge ------------------------------------------------------------------

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

// Tinted from the dark steps of each ramp, with light text on the tint.
const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-800 text-neutral-300',
  accent: 'bg-accent-900 text-accent-200 ring-1 ring-inset ring-accent-800',
  success: 'bg-emerald-950 text-emerald-200 ring-1 ring-inset ring-emerald-900',
  warning: 'bg-amber-950 text-amber-200 ring-1 ring-inset ring-amber-900',
  danger: 'bg-red-950 text-red-200 ring-1 ring-inset ring-red-900',
  info: 'bg-sky-950 text-sky-200 ring-1 ring-inset ring-sky-900',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        BADGE_TONES[tone],
        className,
      )}
    />
  );
}

// --- Alert ------------------------------------------------------------------

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const ALERT_TONES: Record<AlertTone, string> = {
  info: 'border-sky-900 bg-sky-950/60 text-sky-100',
  success: 'border-emerald-900 bg-emerald-950/60 text-emerald-100',
  warning: 'border-amber-900 bg-amber-950/60 text-amber-100',
  danger: 'border-red-900 bg-red-950/60 text-red-100',
};

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-lg border px-4 py-3 text-sm', ALERT_TONES[tone], className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? <p className="font-medium">{title}</p> : null}
          {children ? <div className={cn(title && 'mt-1', 'leading-relaxed')}>{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

// --- Form fields ------------------------------------------------------------

const controlBase =
  'w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 hover:border-neutral-700 disabled:opacity-45';

export interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, hint, required, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-200">
        {label}
        {required ? (
          <span className="ml-0.5 text-red-400" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={props.id ? (invalid ? `${props.id}-error` : `${props.id}-hint`) : undefined}
      className={cn(controlBase, focusRing, invalid && 'border-red-500', className)}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={props.id ? (invalid ? `${props.id}-error` : `${props.id}-hint`) : undefined}
      className={cn(controlBase, focusRing, 'min-h-28 resize-y', invalid && 'border-red-500', className)}
    />
  );
}

export function Select({
  className,
  invalid,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, focusRing, invalid && 'border-red-500', className)}
    />
  );
}

export function Checkbox({
  label,
  className,
  id,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string }) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-start gap-2.5">
        <input
          {...props}
          id={id}
          type="checkbox"
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-700 bg-neutral-950 text-accent-500',
            focusRing,
          )}
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-neutral-300">
          {label}
        </label>
      </div>
      {error ? <p className="ml-6.5 text-xs font-medium text-red-300">{error}</p> : null}
    </div>
  );
}

// --- Layout helpers ---------------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-5 py-12 text-center', className)}>
      <h3 className="text-sm font-medium text-neutral-100">{title}</h3>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-neutral-400">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'accent';
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={cn(
          'mt-1.5 text-2xl font-medium tabular-nums',
          tone === 'accent' ? 'text-accent-300' : 'text-neutral-50',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

/** A rule that fades to transparent at its ends rather than stopping cleanly. */
export function Divider({ className }: { className?: string }) {
  return <hr className={cn('rule-fade', className)} />;
}
