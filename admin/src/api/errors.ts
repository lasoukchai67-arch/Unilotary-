// Error format from the API: HTTP 4xx/5xx with body { error, message, details? }.

export const API_ERROR_CODES = [
  'VALIDATION',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'DRAW_NOT_OPEN',
  'USER_NOT_ALLOWED',
  'NUMBER_LIMIT',
  'INSUFFICIENT_BALANCE',
  'DAILY_CAP',
  'PIN_REQUIRED',
  'PIN_INVALID',
  'PIN_LOCKED',
  'PROVIDER_ERROR',
  'INTERNAL',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Client-side only codes (never sent by the server). */
export type ClientErrorCode = 'NETWORK' | 'BAD_RESPONSE';

export type ErrorCode = ApiErrorCode | ClientErrorCode;

/** Lao fallback messages used when the server did not send a usable `message`. */
export const FALLBACK_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: 'ຂໍ້ມູນບໍ່ຖືກຕ້ອງ',
  UNAUTHORIZED: 'ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່',
  FORBIDDEN: 'ທ່ານບໍ່ມີສິດເຮັດລາຍການນີ້',
  NOT_FOUND: 'ບໍ່ພົບຂໍ້ມູນ',
  CONFLICT: 'ສະຖານະຂໍ້ມູນບໍ່ອະນຸຍາດໃຫ້ເຮັດລາຍການນີ້',
  RATE_LIMITED: 'ສົ່ງຄຳຂໍຖີ່ເກີນໄປ ກະລຸນາລໍຖ້າແລ້ວລອງໃໝ່',
  DRAW_NOT_OPEN: 'ງວດນີ້ບໍ່ໄດ້ເປີດຂາຍ',
  USER_NOT_ALLOWED: 'ຜູ້ໃຊ້ນີ້ບໍ່ໄດ້ຮັບອະນຸຍາດ',
  NUMBER_LIMIT: 'ເລກນີ້ເຕັມ ຫຼື ຖືກປິດ',
  INSUFFICIENT_BALANCE: 'ຍອດເງິນບໍ່ພໍ',
  DAILY_CAP: 'ເກີນວົງເງິນຕໍ່ມື້',
  PIN_REQUIRED: 'ກະລຸນາໃສ່ລະຫັດ PIN',
  PIN_INVALID: 'ລະຫັດ PIN ບໍ່ຖືກຕ້ອງ',
  PIN_LOCKED: 'PIN ຖືກລັອກຊົ່ວຄາວ ກະລຸນາລອງໃໝ່ພາຍຫຼັງ 15 ນາທີ',
  PROVIDER_ERROR: 'ລະບົບຜູ້ໃຫ້ບໍລິການຂັດຂ້ອງ',
  INTERNAL: 'ເກີດຂໍ້ຜິດພາດໃນລະບົບ ກະລຸນາລອງໃໝ່',
  NETWORK: 'ບໍ່ສາມາດເຊື່ອມຕໍ່ເຊີບເວີໄດ້ ກະລຸນາກວດອິນເຕີເນັດ',
  BAD_RESPONSE: 'ເຊີບເວີຕອບກັບຂໍ້ມູນທີ່ບໍ່ຖືກຕ້ອງ',
};

export class ApiError extends Error {
  readonly status: number;
  /** Server code (see docs/API.md) or a client code. Unknown server codes are kept as-is. */
  readonly code: ErrorCode | (string & {});
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Best-effort code when the response body is not the contract JSON (e.g. an nginx HTML page). */
export function codeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
    case 422:
      return 'VALIDATION';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 423:
      return 'PIN_LOCKED';
    case 429:
      return 'RATE_LIMITED';
    case 502:
      return 'PROVIDER_ERROR';
    default:
      return 'INTERNAL';
  }
}

/** Map an HTTP error status + (possibly unparsed) body to an ApiError. */
export function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') {
    const b = body as { error?: unknown; message?: unknown; details?: unknown };
    const code = typeof b.error === 'string' && b.error ? b.error : codeForStatus(status);
    const fallback = FALLBACK_MESSAGES[code as ErrorCode] ?? FALLBACK_MESSAGES[codeForStatus(status)];
    const message = typeof b.message === 'string' && b.message.trim() ? b.message : fallback;
    return new ApiError(status, code, message, b.details);
  }
  const code = codeForStatus(status);
  return new ApiError(status, code, FALLBACK_MESSAGES[code]);
}

export function networkError(cause?: unknown): ApiError {
  const err = new ApiError(0, 'NETWORK', FALLBACK_MESSAGES.NETWORK);
  if (cause !== undefined) (err as { cause?: unknown }).cause = cause;
  return err;
}

/** Human-readable Lao message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return FALLBACK_MESSAGES.INTERNAL;
}
