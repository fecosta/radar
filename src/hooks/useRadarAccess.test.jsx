/**
 * @vitest-environment jsdom
 *
 * The authorization lifecycle. First hook suite in the repository, so it uses `renderHook`
 * from Testing Library; the Drive verifier and the configuration are injected, exactly as the
 * service suites inject `fetchImpl`. Nothing here reaches Google.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useRadarAccess, ACCESS_STATUS, isAuthorized } from './useRadarAccess.js';
import { ACCESS_REASON } from '../services/driveAccess.js';

const CONFIG = {
  allowedDomains: ['velezreyesmas.com', 'democraciamas.com'],
  sharedDriveId: 'test-shared-drive',
};

const APPROVED = { name: 'Approved', email: 'user@velezreyesmas.com', picture: null };
const PARTNER = { name: 'Partner', email: 'user@democraciamas.com', picture: null };
const OUTSIDER = { name: 'Outsider', email: 'user@gmail.com', picture: null };

const silentLogger = { warn: () => {} };

/** A verifier that always answers the same way, plus a call log. */
function verifierFor(reason) {
  return vi.fn(async () => ({
    allowed: reason === ACCESS_REASON.AUTHORIZED,
    reason,
  }));
}

function setup({ user = APPROVED, token = 'token-1', identityFailed = false, verify, config = CONFIG } = {}) {
  const resolvedVerify = verify || verifierFor(ACCESS_REASON.AUTHORIZED);
  const view = renderHook(
    (props) => useRadarAccess({ ...props, config, verify: resolvedVerify, logger: silentLogger }),
    { initialProps: { user, token, identityFailed } }
  );
  return { ...view, verify: resolvedVerify };
}

afterEach(cleanup);

describe('useRadarAccess — the happy path', () => {
  it('authorizes an approved domain that can reach the Shared Drive', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.AUTHORIZED));
    expect(isAuthorized(result.current.status)).toBe(true);
  });

  it('authorizes a second approved organization', async () => {
    const { result } = setup({ user: PARTNER });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.AUTHORIZED));
  });

  it('verifies against exactly the configured Shared Drive', async () => {
    const { verify, result } = setup();
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.AUTHORIZED));

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.calls[0][0]).toMatchObject({
      token: 'token-1',
      sharedDriveId: CONFIG.sharedDriveId,
    });
  });
});

describe('useRadarAccess — the domain gate', () => {
  it('denies an unapproved organization', async () => {
    const { result } = setup({ user: OUTSIDER });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.DOMAIN_DENIED));
  });

  /**
   * The ordering requirement, asserted directly: RADAR must ask Google nothing about an
   * account it has already decided not to admit.
   */
  it('never calls the Drive verifier when the domain is refused', async () => {
    const { result, verify } = setup({ user: OUTSIDER });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.DOMAIN_DENIED));
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([
    ['a lookalike domain', 'user@fake-velezreyesmas.com'],
    ['a suffixed domain', 'user@velezreyesmas.com.example.org'],
    ['a malformed address', 'not-an-email'],
    ['an empty address', ''],
  ])('denies %s without calling the verifier', async (_label, email) => {
    const { result, verify } = setup({ user: { name: 'X', email } });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.DOMAIN_DENIED));
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('useRadarAccess — the Drive gate', () => {
  it('denies an approved user without Shared Drive access', async () => {
    const { result } = setup({ verify: verifierFor(ACCESS_REASON.DRIVE_ACCESS_DENIED) });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.DRIVE_DENIED));
  });

  /** A failure to reach Google is not a statement about this user's permissions. */
  it('reports a verification error rather than a denial when the check fails', async () => {
    const { result } = setup({ verify: verifierFor(ACCESS_REASON.VERIFICATION_ERROR) });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.VERIFICATION_ERROR));
    expect(result.current.status).not.toBe(ACCESS_STATUS.DRIVE_DENIED);
  });

  it('routes an expired session back to sign-in, not to a permissions message', async () => {
    const { result } = setup({ verify: verifierFor(ACCESS_REASON.SESSION_EXPIRED) });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.SIGNED_OUT));
  });

  it('surfaces a Cloud-project misconfiguration as a configuration error', async () => {
    const { result } = setup({ verify: verifierFor(ACCESS_REASON.CONFIGURATION_ERROR) });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.CONFIGURATION_ERROR));
  });

  it('fails closed if the verifier throws', async () => {
    const verify = vi.fn(async () => {
      throw new Error('unexpected');
    });
    const { result } = setup({ verify });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.VERIFICATION_ERROR));
  });

  it('re-runs the check on retry', async () => {
    const verify = vi
      .fn()
      .mockResolvedValueOnce({ allowed: false, reason: ACCESS_REASON.VERIFICATION_ERROR })
      .mockResolvedValueOnce({ allowed: true, reason: ACCESS_REASON.AUTHORIZED });

    const { result } = setup({ verify });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.VERIFICATION_ERROR));

    result.current.retry();

    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.AUTHORIZED));
    expect(verify).toHaveBeenCalledTimes(2);
  });
});

describe('useRadarAccess — identity', () => {
  it('waits while userinfo is still in flight instead of judging an absent email', async () => {
    const { result, verify } = setup({ user: null });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.CHECKING_IDENTITY));
    expect(verify).not.toHaveBeenCalled();
  });

  it('reports an unreadable profile as a verification error, not a domain denial', async () => {
    const { result } = setup({ user: null, identityFailed: true });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.VERIFICATION_ERROR));
    expect(result.current.status).not.toBe(ACCESS_STATUS.DOMAIN_DENIED);
  });

  it('is signed out with no token', async () => {
    const { result, verify } = setup({ user: null, token: null });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.SIGNED_OUT));
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('useRadarAccess — configuration', () => {
  it('fails closed when no domains are configured, and does not call Google', async () => {
    const { result, verify } = setup({
      config: { allowedDomains: [], sharedDriveId: 'test-shared-drive' },
    });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.CONFIGURATION_ERROR));
    expect(verify).not.toHaveBeenCalled();
  });

  /** An empty allowlist must never mean "admit everyone". */
  it('does not authorize anyone when the allowlist is empty', async () => {
    const { result } = setup({
      user: APPROVED,
      config: { allowedDomains: [], sharedDriveId: 'test-shared-drive' },
    });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.CONFIGURATION_ERROR));
    expect(isAuthorized(result.current.status)).toBe(false);
  });

  it('fails closed when no Shared Drive is configured', async () => {
    const { result, verify } = setup({
      config: { allowedDomains: ['velezreyesmas.com'], sharedDriveId: '' },
    });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.CONFIGURATION_ERROR));
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('useRadarAccess — session transitions', () => {
  it('resets to signed out when the session ends', async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.AUTHORIZED));

    rerender({ user: null, token: null, identityFailed: false });

    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.SIGNED_OUT));
    expect(isAuthorized(result.current.status)).toBe(false);
  });

  /**
   * The account-switching leak: an authorization earned by one identity must not survive into
   * the next one. State is derived from (user, token), so the second identity is judged on its
   * own merits.
   */
  it('does not carry a previous authorization into an unapproved account', async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.AUTHORIZED));

    rerender({ user: OUTSIDER, token: 'token-2', identityFailed: false });

    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.DOMAIN_DENIED));
    expect(isAuthorized(result.current.status)).toBe(false);
  });

  it('re-verifies when the same person returns on a new token', async () => {
    const verify = verifierFor(ACCESS_REASON.AUTHORIZED);
    const { result, rerender } = setup({ verify });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.AUTHORIZED));

    rerender({ user: APPROVED, token: 'token-2', identityFailed: false });

    await waitFor(() => expect(verify).toHaveBeenCalledTimes(2));
    expect(verify.mock.calls[1][0].token).toBe('token-2');
  });

  /**
   * A slow check for a departing identity must not land on the arriving one. Without the run
   * guard, the first (authorized) answer would resolve after the switch and authorize an
   * account that was never verified.
   */
  it('discards an in-flight result that resolves after the identity changed', async () => {
    let releaseFirst;
    const verify = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          releaseFirst = () => resolve({ allowed: true, reason: ACCESS_REASON.AUTHORIZED });
        })
      )
      .mockResolvedValueOnce({ allowed: false, reason: ACCESS_REASON.DRIVE_ACCESS_DENIED });

    const { result, rerender } = setup({ verify });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.CHECKING_DRIVE));

    rerender({ user: PARTNER, token: 'token-2', identityFailed: false });
    await waitFor(() => expect(result.current.status).toBe(ACCESS_STATUS.DRIVE_DENIED));

    // The first identity's success arrives late and must be ignored.
    releaseFirst();
    await Promise.resolve();

    expect(result.current.status).toBe(ACCESS_STATUS.DRIVE_DENIED);
    expect(isAuthorized(result.current.status)).toBe(false);
  });
});
