import { ZodError, type ZodTypeAny, type z } from 'zod';
import { AppError, ERROR_CODES, type ErrorCode } from '@machai/types';

/**
 * Shared shape for every Server Action result.
 *
 * `useActionState` needs a serialisable value, and forms need field-level
 * errors to attach to inputs. One shape across the app means one set of form
 * components rather than per-form error handling.
 */
export interface FormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  code?: ErrorCode;
  fieldErrors?: Record<string, string[]>;
  /** Where to send the user on success, when the action does not redirect. */
  redirectTo?: string;
}

export const IDLE_STATE: FormState = { status: 'idle' };

export function successState(message?: string, redirectTo?: string): FormState {
  return { status: 'success', message, redirectTo };
}

export function errorState(
  message: string,
  code: ErrorCode = ERROR_CODES.VALIDATION_FAILED,
  fieldErrors?: Record<string, string[]>,
): FormState {
  return { status: 'error', message, code, fieldErrors };
}

/** Flattens a Zod error into the field-error map the inputs consume. */
export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Turns anything thrown inside an action into a FormState.
 *
 * Unexpected errors deliberately return a generic message: an internal error
 * string can carry a query fragment or a provider response, and this value is
 * rendered straight into the page.
 */
export function toFormState(error: unknown): FormState {
  if (error instanceof ZodError) {
    return errorState('Please correct the highlighted fields.', ERROR_CODES.VALIDATION_FAILED, zodFieldErrors(error));
  }
  if (error instanceof AppError) {
    return errorState(error.message, error.code, error.fieldErrors);
  }
  return errorState('Something went wrong on our end. Please try again.', ERROR_CODES.INTERNAL);
}

/** Parses FormData against a schema, throwing a ZodError the caller maps. */
export function parseForm<T extends ZodTypeAny>(schema: T, formData: FormData): z.infer<T> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    // Checkboxes submit 'on' when ticked and are absent otherwise.
    raw[key] = value === 'on' ? true : value;
  }
  return schema.parse(raw) as z.infer<T>;
}

export function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export function formBoolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === 'on' || value === 'true';
}
