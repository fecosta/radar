/**
 * In-memory Google Drive double for tests.
 *
 * Implements the same surface as createDriveStructureClient and delegates path walking to
 * the REAL resolveCanonicalPath, so preview and execution exercise production resolution
 * logic rather than a parallel reimplementation that could drift from it.
 *
 * All fictional data. No test in this repository requires live Google credentials.
 */

import { MIME_FOLDER, MIME_GOOGLE_DOC } from '../../radar/canonicalTree.js';
import { resolveCanonicalPath } from '../driveStructureApi.js';
import { DriveError, ERROR_CODE } from '../driveErrors.js';

export const TEST_DRIVE_ID = 'test-shared-drive';

/** Canonical parents that must exist before any structure can be created. */
export const CANONICAL_PARENT_PATHS = [
  '01_STRATEGY/03_OKRs',
  // v06 0A_EXPLORATION: no structure type targets it, but preview scans it for a
  // conflicting pre-Pipeline home (design rule 19).
  '02_INVESTMENTS_AND_PROGRAMS/0A_EXPLORATION/Education',
  '02_INVESTMENTS_AND_PROGRAMS/0A_EXPLORATION/Democracy',
  '02_INVESTMENTS_AND_PROGRAMS/0A_EXPLORATION/Cross_Thematic',
  '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education',
  '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Democracy',
  '02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education',
  '02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Democracy',
  '02_INVESTMENTS_AND_PROGRAMS/03_VENTURE_BUILDING/Education',
  '02_INVESTMENTS_AND_PROGRAMS/03_VENTURE_BUILDING/Democracy',
  '02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education',
  '02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Democracy',
  // v06: the only themed container outside Exploration that permits Cross_Thematic.
  '02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Cross_Thematic',
  '03_INSTITUTIONAL/00_POLICIES',
  '03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/01_Board',
  '03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/02_Leadership_Team',
  '03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/03_All_Team',
  '03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/04_Offsites',
  // v06 WEEKLY EMAIL RULE. Restricted to the Leadership Team by a Drive "Limited access"
  // setting applied by hand; no structure type creates or touches it.
  '03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/05_Weekly email',
  '99_ARCHIVE/01_Declined_Pipeline',
];

/**
 * @param {object} [options]
 * @param {string[]} [options.paths]        folder paths to pre-create
 * @param {boolean} [options.canAddChildren] authorization probe result
 * @param {string}  [options.driveName]
 */
export function createFakeDrive({
  paths = CANONICAL_PARENT_PATHS,
  canAddChildren = true,
  driveName = 'RADAR (test)',
  sharedDriveId = TEST_DRIVE_ID,
} = {}) {
  /** id -> { id, name, mimeType, parentId, driveId, webViewLink } */
  const items = new Map();
  let nextId = 1;
  const calls = { findExactChildren: 0, createFolder: 0, createGoogleDoc: 0 };

  /** Fault injection: a queue of one-shot behaviours keyed by item name. */
  const failures = new Map();

  function add(parentId, name, mimeType, { driveId = sharedDriveId } = {}) {
    const id = `item-${nextId}`;
    nextId += 1;
    const item = {
      id,
      name,
      mimeType,
      parentId,
      driveId,
      webViewLink: `https://drive.google.com/drive/folders/${id}`,
    };
    items.set(id, item);
    return item;
  }

  function childrenOf(parentId) {
    return [...items.values()].filter((i) => i.parentId === parentId);
  }

  /** Create a folder path, reusing segments that already exist. */
  function seedPath(path, mimeType = MIME_FOLDER) {
    let parentId = sharedDriveId;
    const segments = path.split('/').filter(Boolean);
    let last = null;
    segments.forEach((segment, i) => {
      const isLast = i === segments.length - 1;
      const wanted = isLast ? mimeType : MIME_FOLDER;
      const found = childrenOf(parentId).find((c) => c.name === segment && c.mimeType === wanted);
      last = found || add(parentId, segment, wanted);
      parentId = last.id;
    });
    return last;
  }

  paths.forEach((p) => seedPath(p));

  const drive = {
    sharedDriveId,

    async verifySharedDrive() {
      return { id: sharedDriveId, name: driveName };
    },

    async findExactChildren(parentId, name) {
      calls.findExactChildren += 1;
      // Exact, case-sensitive — mirrors the production client's post-filter.
      return childrenOf(parentId).filter((i) => i.name === name);
    },

    async resolvePath(segments) {
      return resolveCanonicalPath({
        findExactChildren: (parentId, name) => drive.findExactChildren(parentId, name),
        rootId: sharedDriveId,
        segments,
      });
    },

    async canAddChildren() {
      return canAddChildren;
    },

    async createFolder(parentId, name) {
      calls.createFolder += 1;
      return drive._create(parentId, name, MIME_FOLDER);
    },

    async createGoogleDoc(parentId, name) {
      calls.createGoogleDoc += 1;
      return drive._create(parentId, name, MIME_GOOGLE_DOC);
    },

    async _create(parentId, name, mimeType) {
      const fault = failures.get(name);
      if (fault) {
        failures.delete(name);
        if (fault.throw) throw fault.throw;
        if (fault.driveId) {
          // Simulate Drive reporting the item outside the configured Shared Drive.
          const rogue = add(parentId, name, mimeType, { driveId: fault.driveId });
          throw new DriveError(ERROR_CODE.CONFIGURATION, {
            message:
              'A Drive item was reported outside the configured Shared Drive. The operation was stopped for safety.',
            details: { reportedDriveId: rogue.driveId },
          });
        }
      }
      return add(parentId, name, mimeType);
    },

    /* ── test helpers ── */
    _seedPath: seedPath,
    _add: add,
    _childrenOf: childrenOf,
    _items: items,
    _calls: calls,
    /** Make the next create of `name` fail with `error`. */
    _failOnCreate(name, error) {
      failures.set(name, { throw: error });
    },
    /** Make the next create of `name` land in the wrong drive. */
    _createInWrongDrive(name, driveId = 'some-other-drive') {
      failures.set(name, { driveId });
    },
    /** Path of an item, for assertions. */
    _pathOf(id) {
      const parts = [];
      let current = items.get(id);
      while (current) {
        parts.unshift(current.name);
        current = items.get(current.parentId);
      }
      return parts.join('/');
    },
  };

  return drive;
}

/** In-memory Registry double implementing the Registry port. */
export function createFakeRegistry({ rows = [], configured = true, failOnUpsert = null } = {}) {
  const store = [...rows];
  const norm = (v) => String(v ?? '').trim().toLowerCase();
  const match = (r, identity) =>
    norm(r.Object_Name) === norm(identity.objectName) &&
    norm(r.Theme) === norm(identity.theme) &&
    norm(r.Object_Type) === norm(identity.objectType);

  return {
    isConfigured: () => configured,
    async lookup(identity) {
      // Mirrors createUnconfiguredRegistry: an unconfigured Registry reports its own absence
      // rather than silently behaving like an empty one.
      if (!configured) return { status: 'PENDING_CONFIGURATION', found: false };
      const found = store.find((r) => match(r, identity));
      return found
        ? { found: true, officialFolderLink: found.Official_Folder_Link || '' }
        : { found: false };
    },
    async upsert({ identity, record, officialFolderLink }) {
      if (!configured) return { status: 'PENDING_CONFIGURATION' };
      if (failOnUpsert) throw failOnUpsert;
      const existing = store.find((r) => match(r, identity));
      if (!existing) {
        store.push({ ...record, Official_Folder_Link: officialFolderLink });
        return { status: 'CREATED' };
      }
      const current = String(existing.Official_Folder_Link || '').trim();
      if (current && current !== officialFolderLink) {
        return { status: 'CONFLICT', existingOfficialFolderLink: current };
      }
      if (current === officialFolderLink) return { status: 'UNCHANGED' };
      existing.Official_Folder_Link = officialFolderLink;
      return { status: 'UPDATED' };
    },
    _rows: store,
  };
}

/** In-memory audit double. */
export function createFakeAudit({ configured = true, failOnRecord = null } = {}) {
  const events = [];
  return {
    isConfigured: () => configured,
    async record(event) {
      if (failOnRecord) throw failOnRecord;
      events.push(event);
      return { status: configured ? 'RECORDED' : 'NOT_CONFIGURED' };
    },
    _events: events,
  };
}
