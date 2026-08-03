/**
 * @machai/types — the contract hub.
 *
 * Per the project plan (Part C.1) this package owns shared domain types, DTOs,
 * event/job payload shapes, and validation schemas. It must NOT import from
 * apps, hold runtime logic, or touch secrets. When a shape changes here both
 * apps recompile against it — that lockstep is the point.
 */

export * from './domain/enums';
export * from './domain/entities';
export * from './domain/report';
export * from './dto/auth';
export * from './dto/onboarding';
export * from './dto/support';
export * from './dto/tradeline';
export * from './events/jobs';
export * from './validation/primitives';
export * from './errors';
