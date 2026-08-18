/**
 * Individual-access verification against the configured RADAR Shared Drive.
 *
 * RADAR does not decide who may read RADAR data — Google does. This module asks Google the
 * question and reports the answer; it never grants, requests or modifies access. There is no
 * permissions write anywhere in this file, and none belongs here.
 *
 * The request is the smallest one that can answer it: a single `drives.get` against exactly
 * the configured Shared Drive. It works on the application's existing `drive.readonly` scope,
 * so no new consent is required. Nothing is enumerated and no content is searched — asking
 * "can you see this drive?" should not involve reading anything inside it.
 *
 * The drive id comes from build configuration only. It is never accepted from a caller, a
 * URL, storage or an API response, which is what guarantees the check cannot be pointed at a
 * drive the user does happen to have access to.
 */

import { ERROR_CODE, mapApiError, mapTransportError } from './driveErrors.js';
import { parseAllowedDomains } from '../utils/allowedDomains.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Outcomes of the access check.
 *
 * Deliberately distinct from ERROR_CODE: that taxonomy describes what Google said, this one
 * describes what RADAR should do about it. Several codes collapse to one reason, and one code
 * (403) splits across three — which is the whole point of keeping them separate.
 */
export const ACCESS_REASON = Object.freeze({
  AUTHORIZED: 'authorized',
  /** Google will not show this account the configured Shared Drive. A real permission answer. */
  DRIVE_ACCESS_DENIED: 'drive_access_denied',
  /** RADAR could not get an answer. NOT a denial — the user may well have access. */
  VERIFICATION_ERROR: 'verification_error',
  /** RADAR or its Cloud project is set up wrong. Nothing the end user can fix. */
  CONFIGURATION_ERROR: 'configuration_error',
  /** The token expired mid-check. An authentication problem, handled by the sign-in path. */
  SESSION_EXPIRED: 'session_expired',
});

/**
 * Diagnostic categories for the console. Generic on purpose: enough to tell an owner which
 * of the three layers refused, with nothing sensitive in them.
 */
export const ACCESS_LOG_CATEGORY = Object.freeze({
  DOMAIN_DENIED: 'DOMAIN_DENIED',
  DRIVE_ACCESS_DENIED: 'DRIVE_ACCESS_DENIED',
  DRIVE_ACCESS_CHECK_FAILED: 'DRIVE_ACCESS_CHECK_FAILED',
});

/**
 * Read access configuration once, mirroring readStructureConfig.
 *
 * `env` is a defaulted parameter rather than a module-scope read so tests can supply their
 * own configuration without stubbing import.meta.
 */
export function readAccessConfig(env = import.meta.env) {
  return {
    allowedDomains: parseAllowedDomains(env.VITE_RADAR_ALLOWED_DOMAINS),
    sharedDriveId: env.VITE_SHARED_DRIVE_ID || '',
  };
}

/** Map the shared error taxonomy onto an access outcome. */
function reasonForCode(code) {
  switch (code) {
    // The session, not the person, is the problem. Telling this user they lack Drive access
    // would be a lie and would send them to an administrator for nothing.
    case ERROR_CODE.AUTH_EXPIRED:
      return ACCESS_REASON.SESSION_EXPIRED;

    // A real refusal. 404 is included deliberately: Google returns it for a Shared Drive the
    // caller may not see, and from the user's side that is indistinguishable from — and has
    // the same remedy as — a 403. The UI must not speculate about which it was.
    case ERROR_CODE.PERMISSION_DENIED:
    case ERROR_CODE.NOT_FOUND:
      return ACCESS_REASON.DRIVE_ACCESS_DENIED;

    // Also a 403, but a setup mistake dressed as an access mistake. Reporting it as a denial
    // is what made an unenabled API look like a sharing problem once already; see the
    // API_NOT_ENABLED note in driveErrors.js.
    case ERROR_CODE.API_NOT_ENABLED:
    case ERROR_CODE.CONFIGURATION:
      return ACCESS_REASON.CONFIGURATION_ERROR;

    // Everything else — rate limits, timeouts, transport failures, a missing scope, an
    // unexpected status — leaves the question unanswered. Retrying is the right offer.
    default:
      return ACCESS_REASON.VERIFICATION_ERROR;
  }
}

/**
 * Who does this token belong to?
 *
 * Asks the Drive API rather than the OpenID Connect userinfo endpoint, for one decisive
 * reason: userinfo requires `openid`, `email` or `profile`, and RADAR's token carries only
 * `drive.readonly`. It therefore rejected every request RADAR ever made to it, which went
 * unnoticed because the failure was swallowed and the app rendered with no identity at all.
 * `drive.about.get` accepts `drive.readonly`, so this needs no new scope and no re-consent.
 *
 * It also puts identity and enforcement behind the same authority: the email the domain rule
 * judges now comes from the same API that evaluates the Shared Drive ACL.
 *
 * @param {object} options
 * @param {string} options.token         the signed-in user's own read-only OAuth token
 * @param {Function} [options.fetchImpl] injectable for tests
 * @param {object} [options.logger]      injectable for tests; defaults to console
 * @returns {Promise<{ok: true, user: {name: string, email: string, picture: string|null}}
 *                 | {ok: false, status: number|null}>}
 */
export async function fetchDriveIdentity({
  token,
  fetchImpl,
  logger = console,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!token) return { ok: false, status: null };

  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));

  const url = new URL(`${DRIVE_API}/about`);
  // Required on this method. `user` is requested whole rather than sub-selected: the payload is
  // a few hundred bytes and it keeps the request syntactically trivial.
  url.searchParams.set('fields', 'user');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let failure;
  try {
    const res = await doFetch(url.toString(), {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const body = await res.json().catch(() => null);
      const identity = body?.user;

      /**
       * An identity with no email is not an identity RADAR can use, and must never become a
       * partial `user` object. `useRadarAccess` reads a present-but-emailless user as
       * "approved organization unknown" and answers DOMAIN_DENIED — telling someone their
       * organization was refused when the truth is that RADAR never learned who they are.
       */
      if (!identity?.emailAddress) {
        logger.warn('[RADAR] identity lookup failed', {
          category: ACCESS_LOG_CATEGORY.DRIVE_ACCESS_CHECK_FAILED,
          status: res.status,
          cause: 'the Drive profile carried no email address',
        });
        return { ok: false, status: res.status };
      }

      return {
        ok: true,
        user: {
          name: identity.displayName || identity.emailAddress,
          email: identity.emailAddress,
          picture: identity.photoLink || null,
        },
      };
    }

    failure = mapApiError(res.status, await res.json().catch(() => null), {
      stage: 'fetch_drive_identity',
    });
  } catch (error) {
    failure = mapTransportError(error, { stage: 'fetch_drive_identity' });
  } finally {
    clearTimeout(timer);
  }

  // Status and classification only. Never the token, and never Google's message text.
  logger.warn('[RADAR] identity lookup failed', {
    category: ACCESS_LOG_CATEGORY.DRIVE_ACCESS_CHECK_FAILED,
    code: failure.code,
    status: failure.status,
  });

  return { ok: false, status: failure.status };
}

/**
 * Can this token's identity access the configured RADAR Shared Drive?
 *
 * Resolves with a verdict rather than throwing, because every outcome here is a normal state
 * the UI must render — including the failures.
 *
 * @param {object} options
 * @param {string} options.token         the signed-in user's own read-only OAuth token
 * @param {string} options.sharedDriveId from configuration; never from a caller or a URL
 * @param {Function} [options.fetchImpl] injectable for tests
 * @param {object} [options.logger]      injectable for tests; defaults to console
 * @returns {Promise<{allowed: boolean, reason: string}>}
 */
export async function verifyDriveAccess({
  token,
  sharedDriveId,
  fetchImpl,
  logger = console,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!sharedDriveId) {
    // A deployment with no Shared Drive configured cannot authorize anyone. This is a setup
    // failure, not a statement about this user.
    logger.warn('[RADAR] access check skipped', {
      category: ACCESS_LOG_CATEGORY.DRIVE_ACCESS_CHECK_FAILED,
      cause: 'VITE_SHARED_DRIVE_ID is not configured',
    });
    return { allowed: false, reason: ACCESS_REASON.CONFIGURATION_ERROR };
  }

  if (!token) {
    return { allowed: false, reason: ACCESS_REASON.SESSION_EXPIRED };
  }

  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));

  const url = new URL(`${DRIVE_API}/drives/${encodeURIComponent(sharedDriveId)}`);
  url.searchParams.set('fields', 'id, name');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let failure;
  try {
    const res = await doFetch(url.toString(), {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const drive = await res.json().catch(() => null);

      // Google answered about some other drive. Never seen in practice, but treating a
      // mismatch as success would defeat the point of pinning the id.
      if (drive?.id !== sharedDriveId) {
        logger.warn('[RADAR] access check inconclusive', {
          category: ACCESS_LOG_CATEGORY.DRIVE_ACCESS_CHECK_FAILED,
          cause: 'the drive returned did not match the configured id',
        });
        return { allowed: false, reason: ACCESS_REASON.CONFIGURATION_ERROR };
      }

      return { allowed: true, reason: ACCESS_REASON.AUTHORIZED };
    }

    const payload = await res.json().catch(() => null);
    // The URL is omitted from the log on purpose: it embeds the Shared Drive id.
    failure = mapApiError(res.status, payload, { stage: 'verify_radar_access' });
  } catch (error) {
    failure = mapTransportError(error, { stage: 'verify_radar_access' });
  } finally {
    clearTimeout(timer);
  }

  const reason = reasonForCode(failure.code);

  // Never the token, never the email, never Google's message — `failure.details` can carry
  // API text that names drives, so only the classification is logged.
  logger.warn('[RADAR] access check refused', {
    category:
      reason === ACCESS_REASON.DRIVE_ACCESS_DENIED
        ? ACCESS_LOG_CATEGORY.DRIVE_ACCESS_DENIED
        : ACCESS_LOG_CATEGORY.DRIVE_ACCESS_CHECK_FAILED,
    code: failure.code,
    status: failure.status,
    reason,
  });

  return { allowed: false, reason };
}
