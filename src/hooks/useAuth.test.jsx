/**
 * @vitest-environment jsdom
 *
 * The sign-in lifecycle, with the access checks composed in.
 *
 * The point of this suite is regression protection for behavior that predates the
 * access-control feature — silent re-authentication above all — plus the two paths where the
 * two hooks meet: an unreadable profile, and sign-out clearing everything.
 *
 * Google Identity Services is stubbed the way CreateStructure.test.jsx stubs it, and userinfo
 * is a stubbed fetch. Nothing here reaches Google.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useAuth } from './useAuth.js';
import { ACCESS_STATUS } from './useRadarAccess.js';
import { ACCESS_REASON } from '../services/driveAccess.js';

const CONFIG = {
  allowedDomains: ['velezreyesmas.com'],
  sharedDriveId: 'test-shared-drive',
};

const silentLogger = { warn: () => {} };

/**
 * Stub Google Identity Services.
 *
 * `grant` decides whether the silent request returns a token or falls through to
 * error_callback, which is what happens on a first visit or with third-party cookies blocked.
 */
function stubGis({ grant = true, token = 'token-1' } = {}) {
  const requests = [];
  const scopes = [];
  const revoke = vi.fn();

  window.google = {
    accounts: {
      oauth2: {
        revoke,
        initTokenClient: ({ scope, callback, error_callback: errorCallback }) => {
          scopes.push(scope);
          return {
          requestAccessToken: (opts) => {
            requests.push(opts);
            if (grant) callback({ access_token: token });
            else errorCallback({ type: 'popup_closed' });
          },
          };
        },
      },
    },
  };

  return { requests, scopes, revoke };
}

/** Stub the userinfo endpoint. */
function stubUserinfo({ ok = true, body = { name: 'Approved', email: 'user@velezreyesmas.com' } } = {}) {
  const fetchImpl = vi.fn(async () => ({ ok, status: ok ? 200 : 401, json: async () => body }));
  vi.stubGlobal('fetch', fetchImpl);
  return fetchImpl;
}

function setup({ verify } = {}) {
  const resolvedVerify =
    verify || vi.fn(async () => ({ allowed: true, reason: ACCESS_REASON.AUTHORIZED }));
  const view = renderHook(() =>
    useAuth({ config: CONFIG, verify: resolvedVerify, logger: silentLogger })
  );
  return { ...view, verify: resolvedVerify };
}

afterEach(() => {
  cleanup();
  delete window.google;
  vi.unstubAllGlobals();
});

describe('useAuth — silent re-authentication', () => {
  /** The behavior most at risk from this change, so it is asserted first and directly. */
  it('asks Google for a token silently, without any UI', async () => {
    const { requests } = stubGis({ grant: true });
    stubUserinfo();
    const { result } = setup();

    await waitFor(() => expect(requests).toHaveLength(1));
    // `prompt: ''` is what makes the request silent.
    expect(requests[0]).toEqual({ prompt: '' });
    await waitFor(() => expect(result.current.accessStatus).toBe(ACCESS_STATUS.AUTHORIZED));
  });

  it('requests only the read-only Drive scope', async () => {
    const { scopes } = stubGis();
    stubUserinfo();
    setup();

    // The scope the token client was actually constructed with. Verifying Shared Drive access
    // must not have introduced a write scope.
    await waitFor(() => expect(scopes.length).toBeGreaterThan(0));
    for (const scope of scopes) {
      expect(scope).toBe('https://www.googleapis.com/auth/drive.readonly');
      expect(scope).not.toContain('spreadsheets');
    }
  });

  it('signs a returning approved user straight back in', async () => {
    stubGis({ grant: true });
    stubUserinfo();
    const { result } = setup();

    await waitFor(() => expect(result.current.accessStatus).toBe(ACCESS_STATUS.AUTHORIZED));
    expect(result.current.user).toMatchObject({ email: 'user@velezreyesmas.com' });
    expect(result.current.initializing).toBe(false);
  });

  it('falls through to the sign-in screen when there is no Google session', async () => {
    stubGis({ grant: false });
    stubUserinfo();
    const { result } = setup();

    await waitFor(() => expect(result.current.accessStatus).toBe(ACCESS_STATUS.SIGNED_OUT));
    // A first visit is not an error; LoginScreen renders this string verbatim.
    expect(result.current.error).toBeNull();
  });
});

describe('useAuth — identity failures', () => {
  /**
   * A userinfo failure used to leave `user` null beside a live token and the app rendered
   * anyway. It must now deny — and as a verification error, because RADAR has no organization
   * to judge and must not claim one was refused.
   */
  it('denies with a verification error when the profile cannot be read', async () => {
    stubGis();
    stubUserinfo({ ok: false, body: { error: 'invalid_token' } });
    const { result } = setup();

    await waitFor(() => expect(result.current.accessStatus).toBe(ACCESS_STATUS.VERIFICATION_ERROR));
    expect(result.current.accessStatus).not.toBe(ACCESS_STATUS.DOMAIN_DENIED);
    expect(result.current.accessStatus).not.toBe(ACCESS_STATUS.AUTHORIZED);
  });

  it('denies when the profile carries no email at all', async () => {
    stubGis();
    stubUserinfo({ ok: true, body: { name: 'No Email' } });
    const { result } = setup();

    await waitFor(() => expect(result.current.accessStatus).toBe(ACCESS_STATUS.VERIFICATION_ERROR));
  });

  it('never calls the Drive verifier for an unapproved organization', async () => {
    stubGis();
    stubUserinfo({ body: { name: 'Outsider', email: 'user@gmail.com' } });
    const { result, verify } = setup();

    await waitFor(() => expect(result.current.accessStatus).toBe(ACCESS_STATUS.DOMAIN_DENIED));
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('useAuth — sign-out', () => {
  it('revokes the token and clears every trace of the session', async () => {
    const { revoke } = stubGis();
    stubUserinfo();
    const { result } = setup();

    await waitFor(() => expect(result.current.accessStatus).toBe(ACCESS_STATUS.AUTHORIZED));

    act(() => result.current.signOut());

    await waitFor(() => expect(result.current.accessStatus).toBe(ACCESS_STATUS.SIGNED_OUT));
    expect(revoke).toHaveBeenCalledWith('token-1');
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('does not persist the token anywhere', async () => {
    stubGis();
    stubUserinfo();
    const { result } = setup();

    await waitFor(() => expect(result.current.accessStatus).toBe(ACCESS_STATUS.AUTHORIZED));

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });
});
