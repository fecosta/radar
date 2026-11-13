/**
 * Narrow Google Drive adapter for canonical structure creation.
 *
 * Deliberately small: verify the drive, resolve a canonical path, list exact children,
 * create a folder, create a Google document, read capabilities. Nothing here knows what a
 * RADAR template is, and nothing outside here talks to Drive.
 *
 * Every operation is pinned to the configured Shared Drive. The drive id comes from build
 * configuration, never from the caller, so no request can retarget another drive.
 */

import { MIME_FOLDER, MIME_GOOGLE_DOC } from '../radar/canonicalTree.js';
import { nameMatchKey, nameVariants } from '../radar/structureInputs.js';
import { DriveError, ERROR_CODE, mapApiError, mapTransportError } from './driveErrors.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/** Fields requested for any item RADAR reasons about. */
const ITEM_FIELDS = 'id, name, mimeType, webViewLink, driveId, parents, trashed';

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;

/** Upper bound on pages for one listing; 50 × 1000 items. Exceeding it fails closed. */
const MAX_PAGES = 50;

/**
 * Escape a value for interpolation into a Drive `q` expression.
 *
 * Backslash first, then apostrophe — reversing the order would double-escape. The existing
 * read-only search helper in utils/driveApi.js escapes only apostrophes; that is untouched
 * here so Search behavior does not change, and is noted in the operations guide.
 */
export function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Walk a canonical path from a starting folder, one exact-name segment at a time.
 *
 * Never creates anything: a missing segment is architecture drift for the caller to report,
 * and more than one match for a segment is ambiguous and equally blocking.
 *
 * Extracted from the client so the in-memory test double resolves paths through this exact
 * code rather than a parallel reimplementation that could quietly disagree with it.
 *
 * @param {Function} findExactChildren (parentId, name) => Promise<Array>
 * @returns {{ ok: true, items: Array }
 *          | { ok: false, code: 'MISSING_CANONICAL_PARENT'|'DUPLICATE_PARENT_MATCH',
 *              missingSegment: string, resolvedPath: string }}
 */
export async function resolveCanonicalPath({ findExactChildren, rootId, segments }) {
  let parentId = rootId;
  const items = [];

  for (const segment of segments) {
    const matches = (await findExactChildren(parentId, segment)).filter(
      (f) => f.mimeType === MIME_FOLDER
    );

    if (matches.length !== 1) {
      return {
        ok: false,
        code: matches.length === 0 ? 'MISSING_CANONICAL_PARENT' : 'DUPLICATE_PARENT_MATCH',
        missingSegment: segment,
        resolvedPath: items.map((i) => i.name).join('/'),
      };
    }

    items.push(matches[0]);
    parentId = matches[0].id;
  }

  return { ok: true, items };
}

/**
 * @param {object} options
 * @param {string} options.token          OAuth access token carrying the write scopes
 * @param {string} options.sharedDriveId  configured Shared Drive; the only writable target
 * @param {Function} [options.fetchImpl]  injectable for tests
 * @param {Function} [options.sleepImpl]  injectable backoff, so tests do not wait
 */
export function createDriveStructureClient({
  token,
  sharedDriveId,
  fetchImpl,
  sleepImpl = sleep,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!token) throw new DriveError(ERROR_CODE.AUTH_EXPIRED, { details: { stage: 'client_init' } });
  if (!sharedDriveId) {
    throw new DriveError(ERROR_CODE.CONFIGURATION, {
      message: 'No Shared Drive is configured. Set VITE_SHARED_DRIVE_ID.',
      details: { stage: 'client_init' },
    });
  }

  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));

  /** Shared-Drive parameters every call must carry. */
  const driveScope = {
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'drive',
    driveId: sharedDriveId,
  };

  async function request(path, { method = 'GET', params = {}, body, stage } = {}) {
    const url = new URL(`${DRIVE_API}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }

    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await doFetch(url.toString(), {
          method,
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });

        // Awaited so a body that fails to arrive after a 200 is caught as a transport error.
        if (res.ok) return res.status === 204 ? null : await res.json();

        const payload = await res.json().catch(() => null);
        // `url` is omitted from details: it embeds the drive id and the query.
        lastError = mapApiError(res.status, payload, { stage, method, attempt });
      } catch (error) {
        lastError = mapTransportError(error, { stage, method, attempt });
      } finally {
        clearTimeout(timer);
      }

      // A write is retried only after a rate limit, which Google rejects without applying. Any
      // other failure may hide a create that happened, so resending could make a duplicate; the
      // caller reports it and the explicit retry's re-preview reconciles.
      const safeToRepeat = method === 'GET' || lastError.code === ERROR_CODE.RATE_LIMITED;
      if (!lastError.retryable || !safeToRepeat || attempt === MAX_ATTEMPTS) throw lastError;
      await sleepImpl(2 ** (attempt - 1) * 250);
    }
    throw lastError;
  }

  /**
   * Every page of a `files.list` query. Drive may return a partial or empty page that still
   * carries a nextPageToken, so the first page alone is never proof that something is absent.
   * A failed page, a repeated token, too many pages or an incomplete search all throw: an
   * incomplete answer must not be mistaken for "not there" (fail closed).
   */
  async function listAll(params, stage) {
    const files = [];
    const seenTokens = new Set();
    let pageToken;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await request('/files', {
        params: { ...params, ...driveScope, pageSize: 1000, pageToken, fields: `nextPageToken, incompleteSearch, files(${ITEM_FIELDS})` },
        stage,
      });
      if (result?.incompleteSearch) throw incompleteListing(stage, 'incomplete_search');
      files.push(...(result?.files || []));
      pageToken = result?.nextPageToken;
      if (!pageToken) return files;
      if (seenTokens.has(pageToken)) throw incompleteListing(stage, 'repeated_page_token');
      seenTokens.add(pageToken);
    }
    throw incompleteListing(stage, 'page_limit');
  }

  function incompleteListing(stage, reason) {
    return new DriveError(ERROR_CODE.API_ERROR, {
      message: 'Google Drive returned an incomplete listing, so RADAR stopped rather than guess what exists.',
      details: { stage, reason },
    });
  }

  /** Assert an item Google returned actually lives in the configured Shared Drive. */
  function assertInSharedDrive(item, stage) {
    if (item?.driveId !== sharedDriveId) {
      throw new DriveError(ERROR_CODE.CONFIGURATION, {
        message:
          'A Drive item was reported outside the configured Shared Drive. The operation was stopped for safety.',
        details: { stage, reportedDriveId: item?.driveId ?? null, itemId: item?.id ?? null },
      });
    }
    return item;
  }

  return {
    sharedDriveId,

    /** Confirm the configured Shared Drive exists and is reachable. */
    async verifySharedDrive() {
      const drive = await request(`/drives/${encodeURIComponent(sharedDriveId)}`, {
        params: { fields: 'id, name' },
        stage: 'verify_shared_drive',
      });
      if (drive?.id !== sharedDriveId) {
        throw new DriveError(ERROR_CODE.CONFIGURATION, {
          message: 'The configured Shared Drive could not be verified.',
          details: { stage: 'verify_shared_drive' },
        });
      }
      return { id: drive.id, name: drive.name };
    },

    /**
     * All non-trashed children of `parentId` whose name matches exactly.
     *
     * Drive's `name =` operator is case-insensitive, so results are filtered again in JS
     * with a strict comparison. Without that, `Aprendo+` would silently match `aprendo+`
     * and the creator would reuse the wrong folder.
     */
    async findExactChildren(parentId, name) {
      const q = [
        `'${escapeDriveQueryValue(parentId)}' in parents`,
        `name = '${escapeDriveQueryValue(name)}'`,
        'trashed = false',
      ].join(' and ');

      const files = await listAll({ q, orderBy: 'createdTime' }, 'find_exact_children');
      return files.filter((f) => f.name === name);
    },

    /**
     * Every non-trashed child of `parentId`. Read-only; used to tell RADAR's own partial
     * closed-object folder from one holding anything else (see previewStructure).
     */
    async listChildren(parentId) {
      return listAll({ q: `'${escapeDriveQueryValue(parentId)}' in parents and trashed = false` }, 'list_children');
    },

    /**
     * Every non-trashed FOLDER anywhere in the Shared Drive whose name matches, case-insensitively.
     *
     * The opposite matching policy to findExactChildren, deliberately. That one is strict
     * because it decides what to REUSE, and reusing `aprendo+` for `Aprendo+` would adopt the
     * wrong folder. This one decides what to PROHIBIT, so it must fail closed: a near-miss it
     * does not return becomes a second official home. Drive's `name =` is already
     * case-insensitive (see findExactChildren), so this is the unfiltered result — the loose
     * comparison is free, not extra work.
     *
     * A Drive-wide search instead of walking every lifecycle area, so it finds homes nobody
     * thought to enumerate. Two queries:
     *   1. the name's exact spellings (nameVariants): other encoding, underscores. Every result
     *      is a hit, exactly as before.
     *   2. every folder with a name term starting with the first word, kept only when its
     *      nameMatchKey equals the name's. This catches doubled and non-breaking spaces, which
     *      `name =` cannot be asked for. It relies on Drive's documented prefix matching for
     *      `contains`, and can only add hits.
     * It cannot fold accents — the residual gap recorded in ADR 0005 and 0007.
     */
    async findFoldersNamedAnywhere(name) {
      const stage = 'find_folders_named_anywhere';
      const folders = `mimeType = '${MIME_FOLDER}' and trashed = false`;
      const anyOf = (clauses) => `(${clauses.join(' or ')}) and ${folders}`;

      const exact = nameVariants(name).map((v) => `name = '${escapeDriveQueryValue(v)}'`);
      const hits = await listAll({ q: anyOf(exact), orderBy: 'createdTime' }, stage);

      const first = name.split(/[\s_]+/).find(Boolean);
      if (first) {
        const terms = [...new Set([first.normalize('NFC'), first.normalize('NFD')])].map(
          (t) => `name contains '${escapeDriveQueryValue(t)}'`
        );
        const key = nameMatchKey(name);
        const seen = new Set(hits.map((f) => f.id));
        for (const f of await listAll({ q: anyOf(terms), orderBy: 'createdTime' }, stage)) {
          if (!seen.has(f.id) && nameMatchKey(f.name) === key) {
            hits.push(f);
            seen.add(f.id);
          }
        }
      }

      return hits.map((item) => assertInSharedDrive(item, stage));
    },

    /**
     * The canonical path of a file, walked up through its parents. Used to tell an
     * administrator WHERE a conflicting folder is — "it already exists" is not actionable on
     * its own. Stops at the Shared Drive root; a broken chain degrades to what it resolved.
     */
    async pathOf(fileId) {
      const segments = [];
      let currentId = fileId;
      // Bounded: a canonical path is 4-5 deep, and a cycle must not hang the preview.
      for (let hops = 0; hops < 12 && currentId && currentId !== sharedDriveId; hops += 1) {
        const file = await request(`/files/${encodeURIComponent(currentId)}`, {
          params: { supportsAllDrives: 'true', fields: 'id, name, parents' },
          stage: 'path_of',
        });
        if (!file?.name) break;
        segments.unshift(file.name);
        currentId = file.parents?.[0];
      }
      return segments.join('/');
    },

    /** Walk a canonical path from the Shared Drive root. See resolveCanonicalPath. */
    async resolvePath(segments) {
      const result = await resolveCanonicalPath({
        findExactChildren: (parentId, name) => this.findExactChildren(parentId, name),
        rootId: sharedDriveId,
        segments,
      });
      if (result.ok) result.items.forEach((item) => assertInSharedDrive(item, 'resolve_path'));
      return result;
    },

    /**
     * Whether the signed-in user may add children to a folder.
     *
     * This is the authorization probe: RADAR does not maintain its own admin list, so the
     * user's Shared Drive role is the authority and Google enforces it.
     */
    async canAddChildren(fileId) {
      const file = await request(`/files/${encodeURIComponent(fileId)}`, {
        params: { supportsAllDrives: 'true', fields: 'id, capabilities/canAddChildren' },
        stage: 'check_capabilities',
      });
      return Boolean(file?.capabilities?.canAddChildren);
    },

    async createFolder(parentId, name) {
      return this._create(parentId, name, MIME_FOLDER, 'create_folder');
    },

    /** The yearly Meeting Log is a Google document, created through Drive with a Docs MIME type. */
    async createGoogleDoc(parentId, name) {
      return this._create(parentId, name, MIME_GOOGLE_DOC, 'create_google_doc');
    },

    async _create(parentId, name, mimeType, stage) {
      const created = await request('/files', {
        method: 'POST',
        params: { supportsAllDrives: 'true', fields: ITEM_FIELDS },
        body: { name, mimeType, parents: [parentId] },
        stage,
      });
      // Verify after the fact, not only before: this catches a parent that moved between
      // the preview and the write.
      return assertInSharedDrive(created, stage);
    },
  };
}
