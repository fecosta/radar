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

  it('searches the Drive for every exact spelling, then every first-word candidate, read-only', async () => {
    const { client, calls } = clientWith([{ body: { files: [] } }, { body: { files: [] } }]);

    await client.findFoldersNamedAnywhere("Fundación d'Ejemplo");

    expect(calls).toHaveLength(2);
    expect(calls.every((c) => (c.init?.method ?? 'GET') === 'GET')).toBe(true);
    const exact = calls[0].url.searchParams.get('q');
    for (const variant of ["Fundación d\\'Ejemplo", "Fundación_d\\'Ejemplo"]) {
      expect(exact).toContain(`name = '${variant.normalize('NFC')}'`);
      expect(exact).toContain(`name = '${variant.normalize('NFD')}'`);
    }
    expect(exact).toMatch(/^\(name = .+\) and mimeType = 'application\/vnd\.google-apps\.folder' and trashed = false$/);
    const candidates = calls[1].url.searchParams.get('q');
    expect(candidates).toContain(`name contains '${'Fundación'.normalize('NFC')}'`);
    expect(candidates).toContain(`name contains '${'Fundación'.normalize('NFD')}'`);
  });

  it('keeps a first-word candidate only when it is the same name apart from spacing', async () => {
    const { client } = clientWith([
      { body: { files: [] } },
      {
        body: {
          files: [
            folder({ id: 'double', name: 'Escuela  Viva' }),
            folder({ id: 'nbsp', name: 'Escuela\u00A0Viva' }),
            folder({ id: 'other', name: 'Escuela Nueva' }),
            folder({ id: 'longer', name: 'Escuela Viva 2' }),
          ],
        },
      },
    ]);
    const hits = await client.findFoldersNamedAnywhere('Escuela Viva');
    expect(hits.map((f) => f.id)).toEqual(['double', 'nbsp']);
  });

  it('never drops an exact-spelling hit the candidate filter would not keep', async () => {
    // Drive's own case folding decides query 1; the JS key must not overrule it.
    const { client } = clientWith([{ body: { files: [folder({ id: 'drive-says', name: 'ESCUELA VİVA' })] } }]);
    expect((await client.findFoldersNamedAnywhere('Escuela Viva')).map((f) => f.id)).toEqual(['drive-says']);
  });

  it('lists every child of a folder with a scoped, read-only query', async () => {
    const { client, calls } = clientWith([
      { body: { files: [folder({ id: 'a', name: 'MEL Evidence' }), folder({ id: 'b', name: 'notes.pdf' })] } },
    ]);

    const children = await client.listChildren("it's-1");
    expect(children.map((c) => c.id)).toEqual(['a', 'b']);
    expect(calls[0].init?.method ?? 'GET').toBe('GET');
    expect(calls[0].url.searchParams.get('q')).toBe("'it\\'s-1' in parents and trashed = false");
    expect(calls[0].url.searchParams.get('driveId')).toBe(DRIVE_ID);
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

  /**
   * Regression: every non-rate-limit 403 used to collapse into PERMISSION_DENIED, so an
   * unenabled Sheets API reported itself as a sharing problem. Envelopes below are the real
   * shapes Google returns.
   */
  describe('403 sub-causes', () => {
    it('recognizes an API that is not enabled, from the legacy errors[] shape', () => {
      const error = mapApiError(
        403,
        {
          error: {
            code: 403,
            message:
              'Google Sheets API has not been used in project 000000000000 before or it is disabled.',
            errors: [{ domain: 'usageLimits', reason: 'accessNotConfigured' }],
            status: 'PERMISSION_DENIED',
          },
        },
        { stage: 'sheets_list_titles' }
      );
      expect(error.code).toBe(ERROR_CODE.API_NOT_ENABLED);
      expect(error.retryable).toBe(false);
    });

    it('recognizes an API that is not enabled, from the ErrorInfo details[] shape', () => {
      const error = mapApiError(403, {
        error: {
          code: 403,
          status: 'PERMISSION_DENIED',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
              reason: 'SERVICE_DISABLED',
              domain: 'googleapis.com',
              metadata: { service: 'sheets.googleapis.com' },
            },
          ],
        },
      });
      expect(error.code).toBe(ERROR_CODE.API_NOT_ENABLED);
    });

    it('recognizes an insufficient token scope', () => {
      const error = mapApiError(403, {
        error: {
          code: 403,
          message: 'Request had insufficient authentication scopes.',
          status: 'PERMISSION_DENIED',
          details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }],
        },
      });
      expect(error.code).toBe(ERROR_CODE.SCOPE_INSUFFICIENT);
      expect(error.retryable).toBe(false);
    });

    it('still treats an ordinary 403 as a genuine access problem', () => {
      const error = mapApiError(403, {
        error: { code: 403, status: 'PERMISSION_DENIED', errors: [{ reason: 'forbidden' }] },
      });
      expect(error.code).toBe(ERROR_CODE.PERMISSION_DENIED);
    });

    it('prefers the more specific ErrorInfo reason when both shapes are present', () => {
      const error = mapApiError(403, {
        error: {
          errors: [{ reason: 'forbidden' }],
          details: [{ reason: 'SERVICE_DISABLED' }],
          status: 'PERMISSION_DENIED',
        },
      });
      expect(error.code).toBe(ERROR_CODE.API_NOT_ENABLED);
    });

    it('keeps rate limiting distinct from all of them', () => {
      const error = mapApiError(403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } });
      expect(error.code).toBe(ERROR_CODE.RATE_LIMITED);
      expect(error.retryable).toBe(true);
    });
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

describe('pagination', () => {
  /** Drive may return a partial or even empty page that still carries a nextPageToken. */
  it.each([
    ['listChildren', (c) => c.listChildren('p')],
    ['findExactChildren', (c) => c.findExactChildren('p', 'Escuela Viva')],
  ])('%s reads past an empty first page', async (_label, call) => {
    const { client, calls } = clientWith([
      { body: { files: [], nextPageToken: 't1' } },
      { body: { files: [folder({ id: 'late', name: 'Escuela Viva' })] } },
    ]);
    const result = await call(client);
    expect(result.map((f) => f.id)).toEqual(['late']);
    expect(calls).toHaveLength(2);
    expect(calls[1].url.searchParams.get('pageToken')).toBe('t1');
    expect(calls[0].url.searchParams.get('fields')).toMatch(/nextPageToken/);
    expect(calls[0].url.searchParams.get('pageSize')).toBe('1000');
  });

  it('finds an existing historical document on a later page of a listing', async () => {
    const { client } = clientWith([
      { body: { files: [folder({ id: 'a', name: 'MEL Evidence' })], nextPageToken: 't1' } },
      { body: { files: [folder({ id: 'doc', name: '2019 closure memo', mimeType: 'application/pdf' })] } },
    ]);
    expect((await client.listChildren('p')).map((f) => f.id)).toEqual(['a', 'doc']);
  });

  it('returns duplicate exact matches split across pages', async () => {
    const { client } = clientWith([
      { body: { files: [folder({ id: 'one', name: 'Aprendo+' })], nextPageToken: 't1' } },
      { body: { files: [folder({ id: 'two', name: 'Aprendo+' })] } },
    ]);
    expect((await client.findExactChildren('p', 'Aprendo+')).map((f) => f.id)).toEqual(['one', 'two']);
  });

  it('finds another home that only appears on a later page of the Drive-wide search', async () => {
    const { client } = clientWith([
      { body: { files: [], nextPageToken: 't1' } },
      { body: { files: [folder({ id: 'home', name: 'Escuela Viva' })] } },
    ]);
    expect((await client.findFoldersNamedAnywhere('Escuela Viva')).map((f) => f.id)).toContain('home');
  });

  it('fails closed when a later page fails', async () => {
    const { client } = clientWith([
      { body: { files: [], nextPageToken: 't1' } },
      { ok: false, status: 403, body: { error: { errors: [{ reason: 'forbidden' }] } } },
    ]);
    await expect(client.listChildren('p')).rejects.toMatchObject({ code: ERROR_CODE.PERMISSION_DENIED });
  });

  it('fails closed when Drive repeats a page token instead of progressing', async () => {
    const { client, calls } = clientWith([
      { body: { files: [], nextPageToken: 'same' } },
      { body: { files: [], nextPageToken: 'same' } },
    ]);
    await expect(client.listChildren('p')).rejects.toMatchObject({ code: ERROR_CODE.API_ERROR });
    expect(calls).toHaveLength(2);
  });

  it('fails closed when Drive reports an incomplete search', async () => {
    const { client } = clientWith([{ body: { files: [], incompleteSearch: true } }]);
    await expect(client.findExactChildren('p', 'X')).rejects.toMatchObject({ code: ERROR_CODE.API_ERROR });
  });

  it('stops at a page limit rather than looping forever', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ files: [], nextPageToken: `t${(n += 1)}` }),
    }));
    const client = createDriveStructureClient({ token: 't', sharedDriveId: DRIVE_ID, fetchImpl, sleepImpl: async () => {} });
    await expect(client.listChildren('p')).rejects.toMatchObject({ code: ERROR_CODE.API_ERROR });
    expect(fetchImpl).toHaveBeenCalledTimes(50);
  });
});

describe('folder creation is never retried automatically', () => {
  const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });

  /**
   * Drive may have created the folder before the response was lost. Sending the same POST again
   * could create a second one, so an ambiguous write is reported, not repeated.
   */
  it.each([
    ['a timeout', { throws: abort }, ERROR_CODE.TIMEOUT],
    ['a network failure', { throws: new TypeError('Failed to fetch') }, ERROR_CODE.NETWORK],
    ['a 503', { ok: false, status: 503, body: {} }, ERROR_CODE.TIMEOUT],
  ])('sends one POST after %s', async (_label, response, code) => {
    const { client, fetchImpl } = clientWith([response, { body: folder({ id: 'dup' }) }]);
    await expect(client.createFolder('parent-1', 'Escuela Viva')).rejects.toMatchObject({ code });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sends one POST when a 200 arrives but its body cannot be read', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new TypeError('body stream interrupted');
      },
    }));
    const client = createDriveStructureClient({ token: 't', sharedDriveId: DRIVE_ID, fetchImpl, sleepImpl: async () => {} });
    await expect(client.createFolder('parent-1', 'Escuela Viva')).rejects.toMatchObject({ code: ERROR_CODE.NETWORK });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a create that Google rejected with a rate limit, which applies nothing', async () => {
    const { client, fetchImpl } = clientWith([{ ok: false, status: 429, body: {} }, { body: folder({ id: 'made' }) }]);
    expect((await client.createFolder('parent-1', 'Escuela Viva')).id).toBe('made');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('still retries a read', async () => {
    const { client, fetchImpl } = clientWith([{ throws: abort }, { body: { files: [] } }]);
    await client.findExactChildren('p', 'X');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
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

describe('client surface', () => {
  /** ADR 0003/0006: the absence of these verbs is the control, so a new one must be deliberate. */
  it('exposes no permission, move, rename or delete verb', () => {
    const { client } = clientWith([]);
    const verbs = Object.keys(client).filter((k) => typeof client[k] === 'function');
    expect(verbs.filter((k) => /permission|move|update|rename|delete|trash|parent/i.test(k))).toEqual([]);
  });
});
