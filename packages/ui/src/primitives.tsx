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
 * Design-system primitives.
 *
 * Card-based, generous whitespace, a single muted-green accent — matching the
 * reference UI described in spec §5. Colour, focus, and spacing decisions live
 * here so every screen inherits them rather than re-deciding.
 *
 * Accessibility is built into the primitives, not bolted on per screen
 * (WCAG AA is a cross-cutting requirement in the project plan): every
 * interactive element has a visible focus ring, disabled states carry
 * `aria-disabled`, and error text is wired to its input via `aria-describedby`.
 */

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950';

// --- Button -----------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-700 text-white hover:bg-accent-800 active:bg-accent-900 disabled:bg-accent-700/50',
  secondary:
    'bg-white text-neutral-900 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 disabled:text-neutral-400 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700 dark:hover:bg-neutral-800',
  ghost:
    'bg-transparent text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50',
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
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
        'disabled:cursor-not-allowed',
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
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
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
      className={cn(
        'rounded-xl border border-neutral-200 bg-white shadow-sm',
        'dark:border-neutral-800 dark:bg-neutral-900',
        className,
      )}
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
        'flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
        ) : null}
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

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  accent: 'bg-accent-50 text-accent-800 dark:bg-accent-900/40 dark:text-accent-200',
  success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  warning: 'bg-amber-50 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  danger: 'bg-red-50 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  info: 'bg-sky-50 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
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
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        BADGE_TONES[tone],
        className,
      )}
    />
  );
}

// --- Alert ------------------------------------------------------------------

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const ALERT_TONES: Record<AlertTone, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100',
  danger:
    'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100',
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
      // `alert` for anything the user must act on; polite status otherwise.
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-lg border px-4 py-3 text-sm', ALERT_TONES[tone], className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className={cn(title && 'mt-1', 'leading-relaxed')}>{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

// --- Form fields ------------------------------------------------------------

const controlBase =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100';

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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
        {label}
        {required ? (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-red-600 dark:text-red-400">
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
      aria-describedby={
        props.id ? (invalid ? `${props.id}-error` : `${props.id}-hint`) : undefined
      }
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
      aria-describedby={
        props.id ? (invalid ? `${props.id}-error` : `${props.id}-hint`) : undefined
      }
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
            'mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-accent-700 dark:border-neutral-600 dark:bg-neutral-900',
            focusRing,
          )}
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
      </div>
      {error ? <p className="ml-6.5 text-xs font-medium text-red-600">{error}</p> : null}
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
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
          {description}
        </p>
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
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3.5 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 text-2xl font-semibold tabular-nums',
          tone === 'accent'
            ? 'text-accent-700 dark:text-accent-300'
            : 'text-neutral-900 dark:text-neutral-50',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p> : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-neutral-200 dark:border-neutral-800', className)} />;
}
