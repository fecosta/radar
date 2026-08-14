/**
 * Error taxonomy shared by the Drive and Sheets adapters.
 *
 * Low-level API failures are mapped to a small set of codes with an actionable, non-sensitive
 * user message. Drive IDs, query strings and raw API payloads stay in `details` for the
 * structured log and never reach the UI copy.
 */

export const ERROR_CODE = Object.freeze({
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',
  NETWORK: 'NETWORK',
  CONFIGURATION: 'CONFIGURATION',
  API_ERROR: 'API_ERROR',
});

const USER_MESSAGE = {
  [ERROR_CODE.AUTH_EXPIRED]: 'Your Google session expired. Sign in again to continue.',
  [ERROR_CODE.PERMISSION_DENIED]:
    'Google refused this operation. You need Content Manager access on the RADAR Shared Drive to create folders.',
  [ERROR_CODE.NOT_FOUND]: 'The requested Drive item no longer exists.',
  [ERROR_CODE.RATE_LIMITED]: 'Google is rate-limiting requests. Wait a moment and retry — retrying is safe.',
  [ERROR_CODE.TIMEOUT]: 'Google did not respond in time. Retrying is safe.',
  [ERROR_CODE.NETWORK]: 'Could not reach Google. Check your connection and retry — retrying is safe.',
  [ERROR_CODE.CONFIGURATION]: 'RADAR is not configured correctly. Contact the RADAR owner.',
  [ERROR_CODE.API_ERROR]: 'Google returned an unexpected error.',
};

export class DriveError extends Error {
  constructor(code, { message, status, reason, details } = {}) {
    super(message || USER_MESSAGE[code] || USER_MESSAGE[ERROR_CODE.API_ERROR]);
    this.name = 'DriveError';
    this.code = code;
    this.status = status ?? null;
    this.reason = reason ?? null;
    /**
     * A caller-supplied, already-safe message. Only RADAR's own code sets this — mapApiError
     * deliberately never does, so Google's error text (which can name drives and folders)
     * cannot reach the UI through it.
     */
    this.safeMessage = message ?? null;
    /** Structured, log-only context. Never rendered to the user. */
    this.details = details ?? null;
  }

  /** Copy safe to show in the UI. */
  get userMessage() {
    return this.safeMessage || USER_MESSAGE[this.code] || USER_MESSAGE[ERROR_CODE.API_ERROR];
  }

  /** Rate limits, timeouts and transport failures are worth another attempt. */
  get retryable() {
    return (
      this.code === ERROR_CODE.RATE_LIMITED ||
      this.code === ERROR_CODE.TIMEOUT ||
      this.code === ERROR_CODE.NETWORK
    );
  }
}

/** Google signals rate limiting with 403 as well as 429, distinguished only by `reason`. */
const RATE_LIMIT_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'quotaExceeded',
  'sharingRateLimitExceeded',
]);

/**
 * Map an HTTP response body from the Drive or Sheets API onto the taxonomy above.
 *
 * @param {number} status
 * @param {object} body parsed Google error envelope, if any
 * @param {object} details log-only context
 */
export function mapApiError(status, body, details) {
  const apiError = body?.error;
  const reason = apiError?.errors?.[0]?.reason || apiError?.status || null;
  const message = apiError?.message || null;

  let code;
  if (status === 401) code = ERROR_CODE.AUTH_EXPIRED;
  else if (status === 429) code = ERROR_CODE.RATE_LIMITED;
  else if (status === 403) {
    code = RATE_LIMIT_REASONS.has(reason) ? ERROR_CODE.RATE_LIMITED : ERROR_CODE.PERMISSION_DENIED;
  } else if (status === 404) code = ERROR_CODE.NOT_FOUND;
  else if (status >= 500) code = ERROR_CODE.TIMEOUT;
  else code = ERROR_CODE.API_ERROR;

  // `message` goes to details only — Google's text can name folders and drives.
  return new DriveError(code, { status, reason, details: { ...details, apiMessage: message } });
}

/** Normalize a thrown transport failure (offline, DNS, aborted request). */
export function mapTransportError(error, details) {
  const code = error?.name === 'AbortError' ? ERROR_CODE.TIMEOUT : ERROR_CODE.NETWORK;
  return new DriveError(code, { details: { ...details, cause: String(error?.message || error) } });
}
