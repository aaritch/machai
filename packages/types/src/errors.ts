/**
 * Stable, typed error codes.
 *
 * Every route returns one of these rather than a free-text message, so clients
 * can branch on the code and the copy can change without breaking callers.
 */
export const ERROR_CODES = {
  UNAUTHENTICATED: 'unauthenticated',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  VALIDATION_FAILED: 'validation_failed',
  RATE_LIMITED: 'rate_limited',
  EMAIL_UNVERIFIED: 'email_unverified',
  KYB_REQUIRED: 'kyb_required',
  ENTITLEMENT_REQUIRED: 'entitlement_required',
  ALLOWANCE_EXCEEDED: 'allowance_exceeded',
  CONFLICT: 'conflict',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  SPAM_REJECTED: 'spam_rejected',
  INTERNAL: 'internal_error',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ApiErrorShape {
  code: ErrorCode;
  message: string;
  /** Field-level messages keyed by form path, for wiring into inputs. */
  fieldErrors?: Record<string, string[]>;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: ErrorCode,
    message: string,
    options: { status?: number; fieldErrors?: Record<string, string[]>; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? defaultStatusFor(code);
    this.fieldErrors = options.fieldErrors;
  }

  toShape(): ApiErrorShape {
    return { code: this.code, message: this.message, fieldErrors: this.fieldErrors };
  }
}

function defaultStatusFor(code: ErrorCode): number {
  switch (code) {
    case ERROR_CODES.UNAUTHENTICATED:
      return 401;
    case ERROR_CODES.FORBIDDEN:
    case ERROR_CODES.EMAIL_UNVERIFIED:
    case ERROR_CODES.KYB_REQUIRED:
    case ERROR_CODES.ENTITLEMENT_REQUIRED:
    case ERROR_CODES.SPAM_REJECTED:
      return 403;
    case ERROR_CODES.NOT_FOUND:
      return 404;
    case ERROR_CODES.CONFLICT:
      return 409;
    case ERROR_CODES.VALIDATION_FAILED:
      return 422;
    case ERROR_CODES.RATE_LIMITED:
    case ERROR_CODES.ALLOWANCE_EXCEEDED:
      return 429;
    case ERROR_CODES.PROVIDER_UNAVAILABLE:
      return 503;
    default:
      return 500;
  }
}

/**
 * Ownership failures return 404, not 403.
 *
 * Telling someone "that resource exists but is not yours" confirms the id is
 * real. The guard still writes an audit entry recording the attempt
 * (TASK-02 / TASK-05 security scenarios).
 */
export function notFoundOrForbidden(message = 'Not found'): AppError {
  return new AppError(ERROR_CODES.NOT_FOUND, message, { status: 404 });
}
