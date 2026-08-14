import { describe, it, expect, vi } from 'vitest';
import { createDriveStructureClient, escapeDriveQueryValue } from './driveStructureApi.js';
import { DriveError, ERROR_CODE, mapApiError } from './driveErrors.js';

const DRIVE_ID = 'shared-drive-1';

/** Build a client over a scripted fetch. Each entry is one response, in order. */
function clientWith(responses) {
  const calls = [];
  const queue = [...responses];

  const fetchImpl = vi.fn(async (url, init) => {
    calls.push({ url: new URL(url), init });
    const next = queue.shift() ?? { ok: true, status: 200, body: {} };
    if (next.throws) throw next.throws;
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.body ?? {},
    };
  });

  const client = createDriveStructureClient({
    token: 'test-token',
    sharedDriveId: DRIVE_ID,
    fetchImpl,
    sleepImpl: async () => {}, // no real backoff in tests
  });

  return { client, calls, fetchImpl };
}

const folder = (over = {}) => ({
  id: 'f1',
  name: 'Education',
  mimeType: 'application/vnd.google-apps.folder',
  driveId: DRIVE_ID,
  webViewLink: 'https://drive.google.com/drive/folders/f1',
  ...over,
});

describe('query escaping', () => {
  it('escapes backslashes before apostrophes', () => {
    expect(escapeDriveQueryValue("O'Brien")).toBe("O\\'Brien");
    expect(escapeDriveQueryValue('a\\b')).toBe('a\\\\b');
    // A backslash-apostrophe pair must not collapse into a single escape.
    expect(escapeDriveQueryValue("a\\'b")).toBe("a\\\\\\'b");
  });

  it('leaves ordinary canonical names untouched', () => {
    expect(escapeDriveQueryValue('Fundación Luminar')).toBe('Fundación Luminar');
    expect(escapeDriveQueryValue('Aprendo+')).toBe('Aprendo+');
  });

  it('sends the escaped name in the Drive query', async () => {
    const { client, calls } = clientWith([{ body: { files: [] } }]);
    await client.findExactChildren('parent-1', "O'Brien & Co");

    const q = calls[0].url.searchParams.get('q');
    expect(q).toContain("name = 'O\\'Brien & Co'");
    expect(q).toContain("'parent-1' in parents");
    expect(q).toContain('trashed = false');
  });
});

describe('Shared Drive scoping', () => {
  it('pins every listing to the configured drive', async () => {
    const { client, calls } = clientWith([{ body: { files: [] } }]);
    await client.findExactChildren('parent-1', 'X');

    const params = calls[0].url.searchParams;
    expect(params.get('driveId')).toBe(DRIVE_ID);
    expect(params.get('corpora')).toBe('drive');
    expect(params.get('supportsAllDrives')).toBe('true');
    expect(params.get('includeItemsFromAllDrives')).toBe('true');
  });

  it('creates with supportsAllDrives and the given parent', async () => {
    const { client, calls } = clientWith([{ body: folder({ id: 'new-1', name: 'New Folder' }) }]);
    const created = await client.createFolder('parent-1', 'New Folder');

    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].url.searchParams.get('supportsAllDrives')).toBe('true');
    expect(JSON.parse(calls[0].init.body)).toEqual({
      name: 'New Folder',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['parent-1'],
    });
    expect(created.id).toBe('new-1');
  });

  it('creates the Meeting Log with the Google document MIME type', async () => {
    const { client, calls } = clientWith([
      { body: folder({ id: 'doc-1', mimeType: 'application/vnd.google-apps.document' }) },
    ]);
    await client.createGoogleDoc('parent-1', '2026_Org_Meeting_Log');
    expect(JSON.parse(calls[0].init.body).mimeType).toBe('application/vnd.google-apps.document');
  });

  it('rejects an item Google reports in a different drive', async () => {
    const { client } = clientWith([{ body: folder({ driveId: 'someone-elses-drive' }) }]);
    await expect(client.createFolder('parent-1', 'X')).rejects.toMatchObject({
      code: ERROR_CODE.CONFIGURATION,
    });
  });

  it('refuses to construct without a configured drive', () => {
    expect(() => createDriveStructureClient({ token: 't', sharedDriveId: '' })).toThrow(DriveError);
  });

  it('refuses to construct without a token', () => {
    expect(() => createDriveStructureClient({ token: '', sharedDriveId: DRIVE_ID })).toThrow(DriveError);
  });
});

describe('exact matching', () => {
  it('filters out case-insensitive matches Drive returns', async () => {
    // Drive's `name =` is case-insensitive; RADAR must not reuse "aprendo+" for "Aprendo+".
    const { client } = clientWith([
      { body: { files: [folder({ id: 'a', name: 'aprendo+' }), folder({ id: 'b', name: 'Aprendo+' })] } },
    ]);

    const matches = await client.findExactChildren('parent-1', 'Aprendo+');
    expect(matches.map((m) => m.id)).toEqual(['b']);
  });
});

describe('path resolution', () => {
  it('walks segments and returns each resolved folder', async () => {
    const { client } = clientWith([
      { body: { files: [folder({ id: 'root-1', name: '02_INVESTMENTS_AND_PROGRAMS' })] } },
      { body: { files: [folder({ id: 'pipe-1', name: '01_PIPELINE' })] } },
      { body: { files: [folder({ id: 'edu-1', name: 'Education' })] } },
    ]);

    const result = await client.resolvePath(['02_INVESTMENTS_AND_PROGRAMS', '01_PIPELINE', 'Education']);
    expect(result.ok).toBe(true);
    expect(result.items.map((i) => i.id)).toEqual(['root-1', 'pipe-1', 'edu-1']);
  });

  it('reports the missing segment instead of creating it', async () => {
    const { client, fetchImpl } = clientWith([
      { body: { files: [folder({ id: 'root-1', name: '02_INVESTMENTS_AND_PROGRAMS' })] } },
      { body: { files: [] } },
    ]);

    const result = await client.resolvePath(['02_INVESTMENTS_AND_PROGRAMS', '01_PIPELINE']);
    expect(result).toMatchObject({ ok: false, code: 'MISSING_CANONICAL_PARENT', missingSegment: '01_PIPELINE' });
    // Nothing was POSTed.
    expect(fetchImpl.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true);
  });

  it('reports ambiguity when a segment matches twice', async () => {
    const { client } = clientWith([
      { body: { files: [folder({ id: 'a', name: 'Education' }), folder({ id: 'b', name: 'Education' })] } },
    ]);
    const result = await client.resolvePath(['Education']);
    expect(result).toMatchObject({ ok: false, code: 'DUPLICATE_PARENT_MATCH' });
  });

  it('ignores a non-folder with the right name', async () => {
    const { client } = clientWith([
      { body: { files: [folder({ id: 'a', name: 'Education', mimeType: 'application/pdf' })] } },
    ]);
    const result = await client.resolvePath(['Education']);
    expect(result).toMatchObject({ ok: false, code: 'MISSING_CANONICAL_PARENT' });
  });
});

describe('error mapping', () => {
  it.each([
    [401, {}, ERROR_CODE.AUTH_EXPIRED],
    [403, { error: { errors: [{ reason: 'insufficientFilePermissions' }] } }, ERROR_CODE.PERMISSION_DENIED],
    [403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }, ERROR_CODE.RATE_LIMITED],
    [404, {}, ERROR_CODE.NOT_FOUND],
    [429, {}, ERROR_CODE.RATE_LIMITED],
    [500, {}, ERROR_CODE.TIMEOUT],
    [400, {}, ERROR_CODE.API_ERROR],
  ])('maps HTTP %s to %s', (status, body, code) => {
    expect(mapApiError(status, body, {}).code).toBe(code);
  });

  it('keeps Google error text out of the user-facing message', () => {
    const error = mapApiError(
      404,
      { error: { message: 'File not found: 1AbC_secretDriveFolderId' } },
      { stage: 'find_exact_children' }
    );
    expect(error.userMessage).not.toContain('1AbC_secretDriveFolderId');
    // ...but keeps it for the structured log.
    expect(error.details.apiMessage).toContain('1AbC_secretDriveFolderId');
  });

  it('surfaces a permission denial as an actionable message', async () => {
    const { client } = clientWith([{ ok: false, status: 403, body: { error: { errors: [{ reason: 'forbidden' }] } } }]);
    await expect(client.createFolder('p', 'X')).rejects.toMatchObject({
      code: ERROR_CODE.PERMISSION_DENIED,
    });
  });

  it('classifies a transport failure as a network error', async () => {
    const { client } = clientWith([
      { throws: new TypeError('Failed to fetch') },
      { throws: new TypeError('Failed to fetch') },
      { throws: new TypeError('Failed to fetch') },
    ]);
    await expect(client.findExactChildren('p', 'X')).rejects.toMatchObject({ code: ERROR_CODE.NETWORK });
  });

  it('classifies an aborted request as a timeout', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    const { client } = clientWith([{ throws: abort }, { throws: abort }, { throws: abort }]);
    await expect(client.findExactChildren('p', 'X')).rejects.toMatchObject({ code: ERROR_CODE.TIMEOUT });
  });
});

describe('retry behaviour', () => {
  it('retries a rate limit and succeeds', async () => {
    const { client, fetchImpl } = clientWith([
      { ok: false, status: 429, body: {} },
      { body: { files: [folder()] } },
    ]);
    const matches = await client.findExactChildren('p', 'Education');
    expect(matches).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('gives up after three attempts', async () => {
    const { client, fetchImpl } = clientWith([
      { ok: false, status: 429, body: {} },
      { ok: false, status: 429, body: {} },
      { ok: false, status: 429, body: {} },
    ]);
    await expect(client.findExactChildren('p', 'X')).rejects.toMatchObject({ code: ERROR_CODE.RATE_LIMITED });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not retry a permission denial', async () => {
    const { client, fetchImpl } = clientWith([
      { ok: false, status: 403, body: { error: { errors: [{ reason: 'forbidden' }] } } },
    ]);
    await expect(client.findExactChildren('p', 'X')).rejects.toMatchObject({
      code: ERROR_CODE.PERMISSION_DENIED,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('authorization probe', () => {
  it('reads canAddChildren from Drive rather than assuming a role', async () => {
    const { client, calls } = clientWith([{ body: { id: 'f1', capabilities: { canAddChildren: false } } }]);
    expect(await client.canAddChildren('f1')).toBe(false);
    expect(calls[0].url.searchParams.get('fields')).toContain('capabilities/canAddChildren');
  });
});

describe('drive verification', () => {
  it('accepts the configured drive', async () => {
    const { client } = clientWith([{ body: { id: DRIVE_ID, name: 'RADAR' } }]);
    expect(await client.verifySharedDrive()).toEqual({ id: DRIVE_ID, name: 'RADAR' });
  });

  it('rejects a drive whose id does not match the configuration', async () => {
    const { client } = clientWith([{ body: { id: 'another-drive', name: 'Not RADAR' } }]);
    await expect(client.verifySharedDrive()).rejects.toMatchObject({ code: ERROR_CODE.CONFIGURATION });
  });
});
