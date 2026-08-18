import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isDomainAllowed } from '../utils/allowedDomains.js';
import {
  ACCESS_LOG_CATEGORY,
  ACCESS_REASON,
  readAccessConfig,
  verifyDriveAccess,
} from '../services/driveAccess.js';

/**
 * The RADAR authorization lifecycle.
 *
 * One status, never a set of booleans. `isLoggedIn && !isAllowed && isChecking` has sixteen
 * combinations, most of them meaningless and one of them a security bug; this has ten, all of
 * them reachable and each rendering exactly one screen.
 */
export const ACCESS_STATUS = Object.freeze({
  /** Google Identity Services is loading and the silent token request has not settled. */
  INITIALIZING: 'initializing',
  SIGNED_OUT: 'signed_out',
  /** A token exists but Google's userinfo has not answered yet, so there is no email to judge. */
  CHECKING_IDENTITY: 'checking_identity',
  CHECKING_DOMAIN: 'checking_domain',
  CHECKING_DRIVE: 'checking_drive',
  AUTHORIZED: 'authorized',
  DOMAIN_DENIED: 'domain_denied',
  DRIVE_DENIED: 'drive_denied',
  /** RADAR could not get an answer from Google. Not a denial. */
  VERIFICATION_ERROR: 'verification_error',
  CONFIGURATION_ERROR: 'configuration_error',
});

/** Only this status may render protected content. Everything else is a gate. */
export function isAuthorized(status) {
  return status === ACCESS_STATUS.AUTHORIZED;
}

function statusForReason(reason) {
  switch (reason) {
    case ACCESS_REASON.AUTHORIZED:
      return ACCESS_STATUS.AUTHORIZED;
    case ACCESS_REASON.DRIVE_ACCESS_DENIED:
      return ACCESS_STATUS.DRIVE_DENIED;
    case ACCESS_REASON.CONFIGURATION_ERROR:
      return ACCESS_STATUS.CONFIGURATION_ERROR;
    // The token died mid-check. That is a session problem, so it returns to the ordinary
    // sign-in path rather than telling the user anything about permissions.
    case ACCESS_REASON.SESSION_EXPIRED:
      return ACCESS_STATUS.SIGNED_OUT;
    default:
      return ACCESS_STATUS.VERIFICATION_ERROR;
  }
}

/**
 * Decide whether the signed-in identity may use RADAR.
 *
 *     verified Google identity → approved organization → Shared Drive access → authorized
 *
 * The two checks are ordered and the order matters: an unapproved organization returns before
 * the Drive verifier is ever called, so RADAR asks Google nothing about accounts it has
 * already decided not to admit.
 *
 * The state is derived from `(user, token)` rather than accumulated. That is what makes
 * sign-out and account switching correct by construction: there is no authorization to
 * "clear", because a different identity simply produces a different answer. A check already
 * in flight when the identity changes is invalidated by the run guard and its result
 * discarded, so an earlier success can never land on a later user.
 *
 * @param {object} options
 * @param {object|null} options.user           `{ name, email, picture }` once userinfo resolves
 * @param {string|null} options.token          the signed-in user's own read-only OAuth token
 * @param {boolean} [options.identityFailed]   userinfo could not be read at all
 * @param {object} [options.config]            injectable; defaults to build configuration
 * @param {Function} [options.verify]          injectable Drive verifier, for tests
 * @param {object} [options.logger]            injectable; defaults to console
 */
export function useRadarAccess({
  user,
  token,
  identityFailed = false,
  config,
  verify = verifyDriveAccess,
  logger = console,
} = {}) {
  const [status, setStatus] = useState(ACCESS_STATUS.SIGNED_OUT);
  const [attempt, setAttempt] = useState(0);

  /**
   * Monotonic id of the newest check. Incremented on every run and again on cleanup, so a
   * StrictMode double-mount, a token refresh and a sign-out all invalidate whatever was in
   * flight. Only the current run may write status.
   */
  const runIdRef = useRef(0);

  const resolvedConfig = useMemo(() => config || readAccessConfig(), [config]);

  // Depend on the email itself, not the object identity: a new userinfo object for the same
  // person should not re-run the Drive check.
  const email = user?.email ?? null;
  const hasUser = user != null;

  useEffect(() => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const isCurrent = () => runIdRef.current === runId;

    if (!token) {
      setStatus(ACCESS_STATUS.SIGNED_OUT);
      return undefined;
    }

    // Signed in, but RADAR never learned who. Denying on an unknown identity would be a lie
    // ("your organization is not authorized" — which organization?), so this is an error.
    if (identityFailed) {
      logger.warn('[RADAR] access check failed', {
        category: ACCESS_LOG_CATEGORY.DRIVE_ACCESS_CHECK_FAILED,
        cause: 'the Google account profile could not be read',
      });
      setStatus(ACCESS_STATUS.VERIFICATION_ERROR);
      return undefined;
    }

    if (!hasUser) {
      setStatus(ACCESS_STATUS.CHECKING_IDENTITY);
      return undefined;
    }

    // An unconfigured RADAR admits nobody. This is a setup failure and says so; it must never
    // degrade into "allow everyone" and must never be shown as a permission problem.
    if (resolvedConfig.allowedDomains.length === 0 || !resolvedConfig.sharedDriveId) {
      logger.warn('[RADAR] access check skipped', {
        category: ACCESS_LOG_CATEGORY.DRIVE_ACCESS_CHECK_FAILED,
        cause:
          resolvedConfig.allowedDomains.length === 0
            ? 'VITE_RADAR_ALLOWED_DOMAINS is not configured'
            : 'VITE_SHARED_DRIVE_ID is not configured',
      });
      setStatus(ACCESS_STATUS.CONFIGURATION_ERROR);
      return undefined;
    }

    setStatus(ACCESS_STATUS.CHECKING_DOMAIN);

    // Gate one. `user.email` present but unparseable also lands here, which is the fail-closed
    // answer. Returning here is what keeps the Drive verifier from ever seeing this account.
    if (!isDomainAllowed(email, resolvedConfig.allowedDomains)) {
      logger.warn('[RADAR] access denied', { category: ACCESS_LOG_CATEGORY.DOMAIN_DENIED });
      setStatus(ACCESS_STATUS.DOMAIN_DENIED);
      return undefined;
    }

    // Gate two. The organization is approved; only Google can say whether this individual
    // account may actually reach the Shared Drive.
    setStatus(ACCESS_STATUS.CHECKING_DRIVE);

    verify({ token, sharedDriveId: resolvedConfig.sharedDriveId, logger })
      .then((result) => {
        if (!isCurrent()) return;
        setStatus(statusForReason(result?.reason));
      })
      .catch(() => {
        // The verifier resolves rather than throws, so this is a defensive path only. Fail
        // closed, and as "unknown" rather than as a denial.
        if (!isCurrent()) return;
        setStatus(ACCESS_STATUS.VERIFICATION_ERROR);
      });

    return () => {
      runIdRef.current += 1;
    };
  }, [token, identityFailed, hasUser, email, resolvedConfig, verify, logger, attempt]);

  /** Re-run the check. Offered for the two states where the answer may legitimately change. */
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { status, retry };
}
