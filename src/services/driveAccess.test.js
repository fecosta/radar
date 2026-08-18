/**
 * Shared Drive access verification.
 *
 * Every response is scripted through an injected fetch, so the suite never reaches Google and
 * needs no credentials.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  verifyDriveAccess,
  fetchDriveIdentity,
  readAccessConfig,
  ACCESS_REASON,
  ACCESS_LOG_CATEGORY,
} from './driveAccess.js';

const DRIVE_ID = 'shared-drive-1';
const TOKEN = 'test-token';

/** Build a verifier call over a single scripted response. */
function verifyWith(response, overrides = {}) {
  const calls = [];
  const fetchImpl = vi.fn(async (url, init) => {
    calls.push({ url: new URL(url), init });
    if (response.throws) throw response.throws;
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.body ?? {},
    };
  });

  const logs = [];
  const logger = { warn: (...args) => logs.push(args) };

  const result = verifyDriveAccess({
    token: TOKEN,
    sharedDriveId: DRIVE_ID,
    fetchImpl,
    logger,
    ...overrides,
  });

  return { result, calls, fetchImpl, logs };
}

const googleError = (reason) => ({ error: { errors: [{ reason }] } });

describe('verifyDriveAccess — success', () => {
  it('authorizes when Google returns the configured drive', async () => {
    const { result } = verifyWith({ ok: true, status: 200, body: { id: DRIVE_ID, name: 'RADAR' } });
    await expect(result).resolves.toEqual({ allowed: true, reason: ACCESS_REASON.AUTHORIZED });
  });

  it('asks only about the configured drive, with no content query', async () => {
    const { result, calls } = verifyWith({ body: { id: DRIVE_ID, name: 'RADAR' } });
    await result;

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url.pathname).toBe(`/drive/v3/drives/${DRIVE_ID}`);
    expect(url.searchParams.get('fields')).toBe('id, name');
    // No listing, no search, nothing that reads content.
    expect(url.searchParams.get('q')).toBeNull();
    expect(url.pathname).not.toContain('/files');
    // Read-only: a GET with no body.
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('percent-encodes the configured id rather than interpolating it raw', async () => {
    const { result, calls } = verifyWith(
      { body: { id: 'a/b?c', name: 'RADAR' } },
      { sharedDriveId: 'a/b?c' }
    );
    await result;
    expect(calls[0].url.pathname).toBe('/drive/v3/drives/a%2Fb%3Fc');
  });

  it('refuses a 200 that describes a different drive', async () => {
    const { result } = verifyWith({ body: { id: 'some-other-drive', name: 'Not RADAR' } });
    await expect(result).resolves.toEqual({
      allowed: false,
      reason: ACCESS_REASON.CONFIGURATION_ERROR,
    });
  });
});

describe('verifyDriveAccess — denial', () => {
  it('denies on 403', async () => {
    const { result } = verifyWith({
      ok: false,
      status: 403,
      body: googleError('insufficientFilePermissions'),
    });
    await expect(result).resolves.toEqual({
      allowed: false,
      reason: ACCESS_REASON.DRIVE_ACCESS_DENIED,
    });
  });

  it('denies on 404, which the user cannot distinguish from 403 anyway', async () => {
    const { result } = verifyWith({ ok: false, status: 404, body: {} });
    await expect(result).resolves.toEqual({
      allowed: false,
      reason: ACCESS_REASON.DRIVE_ACCESS_DENIED,
    });
  });
});

describe('verifyDriveAccess — not a denial', () => {
  /**
   * Regression guard for the distinction commit 6a4112f introduced: an unenabled Drive API
   * arrives as a 403 and used to be indistinguishable from a sharing problem. Reporting it as
   * drive_access_denied would send every user to an administrator who cannot help them.
   */
  it.each([
    ['accessNotConfigured', 'accessNotConfigured'],
    ['SERVICE_DISABLED', 'SERVICE_DISABLED'],
  ])('treats a 403 with reason %s as a configuration error', async (_label, reason) => {
    const { result } = verifyWith({ ok: false, status: 403, body: googleError(reason) });
    await expect(result).resolves.toEqual({
      allowed: false,
      reason: ACCESS_REASON.CONFIGURATION_ERROR,
    });
  });

  it('treats a 403 for a missing scope as a verification error, not a denial', async () => {
    const { result } = verifyWith({
      ok: false,
      status: 403,
      body: googleError('ACCESS_TOKEN_SCOPE_INSUFFICIENT'),
    });
    await expect(result).resolves.toEqual({
      allowed: false,
      reason: ACCESS_REASON.VERIFICATION_ERROR,
    });
  });

  it('routes an expired token to the session path, never to a permissions message', async () => {
    const { result } = verifyWith({ ok: false, status: 401, body: {} });
    await expect(result).resolves.toEqual({
      allowed: false,
      reason: ACCESS_REASON.SESSION_EXPIRED,
    });
  });

  /** A network failure means "we do not know", which is not the same as "you may not". */
  it('reports a rejected fetch as a verification error, not a denial', async () => {
    const { result } = verifyWith({ throws: new TypeError('Failed to fetch') });
    const verdict = await result;
    expect(verdict).toEqual({ allowed: false, reason: ACCESS_REASON.VERIFICATION_ERROR });
    expect(verdict.reason).not.toBe(ACCESS_REASON.DRIVE_ACCESS_DENIED);
  });

  it('reports an aborted request as a verification error', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    const { result } = verifyWith({ throws: abort });
    await expect(result).resolves.toEqual({
      allowed: false,
      reason: ACCESS_REASON.VERIFICATION_ERROR,
    });
  });

  it.each([
    [429, ACCESS_REASON.VERIFICATION_ERROR],
    [500, ACCESS_REASON.VERIFICATION_ERROR],
    [503, ACCESS_REASON.VERIFICATION_ERROR],
    [400, ACCESS_REASON.VERIFICATION_ERROR],
  ])('reports HTTP %s as %s', async (status, reason) => {
    const { result } = verifyWith({ ok: false, status, body: {} });
    await expect(result).resolves.toEqual({ allowed: false, reason });
  });
});

describe('verifyDriveAccess — configuration', () => {
  it('fails closed and never calls Google when no Shared Drive is configured', async () => {
    const { result, fetchImpl } = verifyWith({ body: {} }, { sharedDriveId: '' });
    await expect(result).resolves.toEqual({
      allowed: false,
      reason: ACCESS_REASON.CONFIGURATION_ERROR,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed without calling Google when there is no token', async () => {
    const { result, fetchImpl } = verifyWith({ body: {} }, { token: null });
    await expect(result).resolves.toEqual({
      allowed: false,
      reason: ACCESS_REASON.SESSION_EXPIRED,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('verifyDriveAccess — logging', () => {
  it('logs a generic category and never the token, the drive id or Google text', async () => {
    const { result, logs } = verifyWith({
      ok: false,
      status: 403,
      body: { error: { errors: [{ reason: 'insufficientFilePermissions' }], message: 'The user does not have sufficient permissions for shared drive Confidential Investments.' } },
    });
    await result;

    expect(logs).toHaveLength(1);
    const serialized = JSON.stringify(logs[0]);
    expect(serialized).toContain(ACCESS_LOG_CATEGORY.DRIVE_ACCESS_DENIED);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain(DRIVE_ID);
    expect(serialized).not.toContain('Confidential Investments');
  });

  it('logs the check-failed category when the answer is unknown', async () => {
    const { result, logs } = verifyWith({ throws: new TypeError('Failed to fetch') });
    await result;
    expect(JSON.stringify(logs[0])).toContain(ACCESS_LOG_CATEGORY.DRIVE_ACCESS_CHECK_FAILED);
  });

  it('does not log at all on success', async () => {
    const { result, logs } = verifyWith({ body: { id: DRIVE_ID, name: 'RADAR' } });
    await result;
    expect(logs).toHaveLength(0);
  });
});

/** Build an identity lookup over a single scripted response. */
function identityWith(response, overrides = {}) {
  const calls = [];
  const fetchImpl = vi.fn(async (url, init) => {
    calls.push({ url: new URL(url), init });
    if (response.throws) throw response.throws;
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.body ?? {},
    };
  });

  const logs = [];
  const logger = { warn: (...args) => logs.push(args) };

  const result = fetchDriveIdentity({ token: TOKEN, fetchImpl, logger, ...overrides });
  return { result, calls, fetchImpl, logs };
}

const driveUser = (over = {}) => ({
  user: {
    kind: 'drive#user',
    displayName: 'Approved User',
    emailAddress: 'user@velezreyesmas.com',
    photoLink: 'https://lh3.googleusercontent.com/a/example',
    me: true,
    ...over,
  },
});

describe('fetchDriveIdentity — success', () => {
  it('returns the signed-in identity in the shape the app already consumes', async () => {
    const { result } = identityWith({ body: driveUser() });
    await expect(result).resolves.toEqual({
      ok: true,
      user: {
        name: 'Approved User',
        email: 'user@velezreyesmas.com',
        picture: 'https://lh3.googleusercontent.com/a/example',
      },
    });
  });

  /**
   * The whole point of using Drive rather than the OIDC userinfo endpoint: this must be
   * answerable on drive.readonly alone. Asserted as a request shape, since the scope lives on
   * the token rather than in the URL.
   */
  it('asks the Drive about endpoint, not the OpenID userinfo endpoint', async () => {
    const { result, calls } = identityWith({ body: driveUser() });
    await result;

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url.host).toBe('www.googleapis.com');
    expect(url.pathname).toBe('/drive/v3/about');
    expect(url.pathname).not.toContain('userinfo');
    // `fields` is mandatory on about.get; omitting it is a 400.
    expect(url.searchParams.get('fields')).toBe('user');
    expect(init.method).toBeUndefined();
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('falls back to the email when Drive reports no display name', async () => {
    const { result } = identityWith({ body: driveUser({ displayName: '' }) });
    const identity = await result;
    expect(identity.ok).toBe(true);
    expect(identity.user.name).toBe('user@velezreyesmas.com');
  });

  it('normalizes a missing photo to null rather than undefined', async () => {
    const { result } = identityWith({ body: driveUser({ photoLink: undefined }) });
    const identity = await result;
    expect(identity.user.picture).toBeNull();
  });
});

describe('fetchDriveIdentity — failure', () => {
  /**
   * The invariant that keeps a missing email from being misreported as a rejected
   * organization: a partial user must never be produced.
   */
  it('refuses a 200 that carries no email address', async () => {
    const { result } = identityWith({ body: driveUser({ emailAddress: undefined }) });
    await expect(result).resolves.toEqual({ ok: false, status: 200 });
  });

  it('refuses a 200 with no user object at all', async () => {
    const { result } = identityWith({ body: {} });
    const identity = await result;
    expect(identity.ok).toBe(false);
    expect(identity.user).toBeUndefined();
  });

  it.each([
    ['an expired token', 401],
    ['a refused request', 403],
    ['an unexpected status', 500],
  ])('reports %s as a failure carrying the status', async (_label, status) => {
    const { result } = identityWith({ ok: false, status, body: {} });
    await expect(result).resolves.toEqual({ ok: false, status });
  });

  it('reports a rejected fetch as a failure', async () => {
    const { result } = identityWith({ throws: new TypeError('Failed to fetch') });
    const identity = await result;
    expect(identity.ok).toBe(false);
  });

  it('fails without calling Google when there is no token', async () => {
    const { result, fetchImpl } = identityWith({ body: driveUser() }, { token: null });
    await expect(result).resolves.toEqual({ ok: false, status: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('fetchDriveIdentity — logging', () => {
  /** The missing diagnostic that made this bug need a screenshot to identify. */
  it('logs the status so the cause is identifiable from the console alone', async () => {
    const { result, logs } = identityWith({ ok: false, status: 403, body: {} });
    await result;

    expect(logs).toHaveLength(1);
    const serialized = JSON.stringify(logs[0]);
    expect(serialized).toContain('identity lookup failed');
    expect(serialized).toContain('403');
  });

  it('never logs the token or Google error text', async () => {
    const { result, logs } = identityWith({
      ok: false,
      status: 403,
      body: { error: { message: 'Request had insufficient authentication scopes.' } },
    });
    await result;

    const serialized = JSON.stringify(logs[0]);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain('insufficient authentication scopes');
  });

  it('does not log on success', async () => {
    const { result, logs } = identityWith({ body: driveUser() });
    await result;
    expect(logs).toHaveLength(0);
  });
});

describe('readAccessConfig', () => {
  it('parses both values from the environment', () => {
    expect(
      readAccessConfig({
        VITE_RADAR_ALLOWED_DOMAINS: ' Example-Org.com , partner.org ',
        VITE_SHARED_DRIVE_ID: DRIVE_ID,
      })
    ).toEqual({ allowedDomains: ['example-org.com', 'partner.org'], sharedDriveId: DRIVE_ID });
  });

  it('reports an unconfigured allowlist as empty, never as permissive', () => {
    expect(readAccessConfig({ VITE_SHARED_DRIVE_ID: DRIVE_ID })).toEqual({
      allowedDomains: [],
      sharedDriveId: DRIVE_ID,
    });
  });

  it('reports a missing Shared Drive as an empty string', () => {
    expect(readAccessConfig({ VITE_RADAR_ALLOWED_DOMAINS: 'example-org.com' })).toEqual({
      allowedDomains: ['example-org.com'],
      sharedDriveId: '',
    });
  });
});
