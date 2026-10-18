export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'DRAW_NOT_OPEN'
  | 'USER_NOT_ALLOWED'
  | 'NUMBER_LIMIT'
  | 'INSUFFICIENT_BALANCE'
  | 'DAILY_CAP'
  | 'PIN_REQUIRED'
  | 'PIN_INVALID'
  | 'PIN_LOCKED'
  | 'PROVIDER_ERROR';

const HTTP: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  DRAW_NOT_OPEN: 409,
  USER_NOT_ALLOWED: 403,
  NUMBER_LIMIT: 409,
  INSUFFICIENT_BALANCE: 402,
  DAILY_CAP: 409,
  PIN_REQUIRED: 401,
  PIN_INVALID: 401,
  PIN_LOCKED: 423,
  PROVIDER_ERROR: 502,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.status = HTTP[code];
  }
}

export const notFound = (what: string) => new AppError('NOT_FOUND', `ບໍ່ພົບ${what}`);
