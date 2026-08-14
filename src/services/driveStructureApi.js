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
import { DriveError, ERROR_CODE, mapApiError, mapTransportError } from './driveErrors.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/** Fields requested for any item RADAR reasons about. */
const ITEM_FIELDS = 'id, name, mimeType, webViewLink, driveId, parents, trashed';

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;

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

        if (res.ok) return res.status === 204 ? null : res.json();

        const payload = await res.json().catch(() => null);
        // `url` is omitted from details: it embeds the drive id and the query.
        lastError = mapApiError(res.status, payload, { stage, method, attempt });
      } catch (error) {
        lastError = mapTransportError(error, { stage, method, attempt });
      } finally {
        clearTimeout(timer);
      }

      if (!lastError.retryable || attempt === MAX_ATTEMPTS) throw lastError;
      await sleepImpl(2 ** (attempt - 1) * 250);
    }
    throw lastError;
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

      const result = await request('/files', {
        params: {
          q,
          ...driveScope,
          fields: `files(${ITEM_FIELDS})`,
          pageSize: 100,
          orderBy: 'createdTime',
        },
        stage: 'find_exact_children',
      });

      return (result?.files || []).filter((f) => f.name === name);
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
