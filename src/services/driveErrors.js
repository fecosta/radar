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
  /**
   * The Google API itself is not enabled for the Cloud project. Arrives as a 403, which is
   * why it used to masquerade as a sharing problem — a setup mistake dressed as an access
   * mistake, and the reason enabling the Sheets API took so long to identify.
   */
  API_NOT_ENABLED: 'API_NOT_ENABLED',
  /** The access token was issued without a scope the request needs. Also a 403. */
  SCOPE_INSUFFICIENT: 'SCOPE_INSUFFICIENT',
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
  // Deliberately carries no activation URL or project number: those stay in the structured
  // console log. This is a RADAR owner's job, not something an end user can act on.
  [ERROR_CODE.API_NOT_ENABLED]:
    'A required Google API is not enabled for this Google Cloud project. Ask the RADAR owner to enable it.',
  [ERROR_CODE.SCOPE_INSUFFICIENT]:
    'Your Google sign-in is missing a permission this needs. Sign out and back in, and accept the request.',
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

/**
 * Google returns 403 for several unrelated situations, distinguished only by `reason`.
 * Treating them all as "permission denied" is what made an unenabled Sheets API look like a
 * sharing problem, so each family is matched explicitly.
 */
const RATE_LIMIT_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'quotaExceeded',
  'sharingRateLimitExceeded',
]);

/** The API is not enabled for the Cloud project. Legacy and ErrorInfo spellings. */
const API_NOT_ENABLED_REASONS = new Set(['accessNotConfigured', 'SERVICE_DISABLED']);

/** The token lacks a required scope. */
const SCOPE_REASONS = new Set(['ACCESS_TOKEN_SCOPE_INSUFFICIENT', 'insufficientScopes']);

/**
 * Pull the machine-readable reason out of whichever envelope Google used.
 *
 * Two shapes are in circulation and a single response often carries both:
 *   legacy    error.errors[].reason        e.g. "accessNotConfigured"
 *   ErrorInfo error.details[].reason       e.g. "SERVICE_DISABLED"
 *
 * The ErrorInfo entries are checked first because they are the more specific of the two;
 * `error.status` is only a coarse fallback ("PERMISSION_DENIED").
 */
export function extractReason(apiError) {
  const fromDetails = (apiError?.details || [])
    .map((d) => d?.reason)
    .find(Boolean);
  return fromDetails || apiError?.errors?.[0]?.reason || apiError?.status || null;
}

/**
 * Map an HTTP response body from the Drive or Sheets API onto the taxonomy above.
 *
 * @param {number} status
 * @param {object} body parsed Google error envelope, if any
 * @param {object} details log-only context
 */
export function mapApiError(status, body, details) {
  const apiError = body?.error;
  const reason = extractReason(apiError);
  const message = apiError?.message || null;

  let code;
  if (status === 401) code = ERROR_CODE.AUTH_EXPIRED;
  else if (status === 429) code = ERROR_CODE.RATE_LIMITED;
  else if (status === 403) {
    // Order matters: the specific families are checked before falling back to the generic
    // "you do not have access", which is what 403 means once the others are excluded.
    if (RATE_LIMIT_REASONS.has(reason)) code = ERROR_CODE.RATE_LIMITED;
    else if (API_NOT_ENABLED_REASONS.has(reason)) code = ERROR_CODE.API_NOT_ENABLED;
    else if (SCOPE_REASONS.has(reason)) code = ERROR_CODE.SCOPE_INSUFFICIENT;
    else code = ERROR_CODE.PERMISSION_DENIED;
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
