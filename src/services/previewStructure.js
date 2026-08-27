/**
 * Preview: compare a deterministic plan against LIVE Drive state.
 *
 * Read-only by construction — only the Drive client's read methods are reachable from here.
 * The preview is what the administrator confirms, and execution re-runs this exact function
 * immediately before writing, because Drive may have changed in between.
 */

import { LIFECYCLE_CONFLICT_SCOPES, MIME_FOLDER, joinSegments } from '../radar/canonicalTree.js';
import { PLAN_WARNING } from '../radar/planStructure.js';
import { REGISTRY_STATUS } from './registryPort.js';

/** Per-item outcome against live Drive. */
export const ITEM_STATUS = Object.freeze({
  /** Missing; will be created. */
  CREATE: 'create',
  /** Already present with the expected type; will be reused (safe idempotent reuse). */
  EXISTS: 'exists',
  /** Present but unusable — wrong type, or ambiguous duplicates. Blocking. */
  CONFLICT: 'conflict',
  /** Not evaluated because something above it blocks the operation. */
  BLOCKED: 'blocked',
});

export const PREVIEW_STATUS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

export const CONFLICT_CODE = Object.freeze({
  MISSING_CANONICAL_PARENT: 'MISSING_CANONICAL_PARENT',
  DUPLICATE_PARENT_MATCH: 'DUPLICATE_PARENT_MATCH',
  /**
   * A folder the structure must be added INSIDE does not exist yet. Distinct from
   * MISSING_CANONICAL_PARENT: that one means the approved architecture has drifted, this one
   * means a workflow step (moving an approved folder) has not happened. The advice differs,
   * so the code and the message do too.
   */
  OBJECT_FOLDER_NOT_FOUND: 'OBJECT_FOLDER_NOT_FOUND',
  AMBIGUOUS_OBJECT_FOLDER: 'AMBIGUOUS_OBJECT_FOLDER',
  WRONG_MIME_TYPE: 'WRONG_MIME_TYPE',
  DUPLICATE_EXACT_MATCH: 'DUPLICATE_EXACT_MATCH',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  REGISTRY_OFFICIAL_FOLDER_CONFLICT: 'REGISTRY_OFFICIAL_FOLDER_CONFLICT',
});

export const ACKNOWLEDGEMENT_CODE = Object.freeze({
  SENSITIVE_FOLDER: PLAN_WARNING.PERMISSIONS_CONFIGURATION_REQUIRED,
  REGISTRY_TRANSITION: PLAN_WARNING.REGISTRY_TRANSITION_REQUIRED,
  LIFECYCLE_LOCATION_CONFLICT: 'LIFECYCLE_LOCATION_CONFLICT',
  NO_RETAINED_HISTORY: 'NO_RETAINED_HISTORY',
});

/**
 * Folders whose presence proves an object folder carries its pre-approval history.
 *
 * Spec PORTFOLIO CREATION RULE clause 2 requires that history be preserved. "The folder
 * exists" cannot distinguish a folder moved with its history from an empty shell a human
 * created by hand — and helping RADAR fill in an empty shell would produce the
 * rebuilt-instead-of-moved object the rule forbids. `01_Meetings` appears in all three object
 * templates; the rest cover a Pipeline object and a graduating Venture Building initiative,
 * which v06 design rule 9 also moves into Portfolio.
 */
const RETAINED_HISTORY_MARKERS = Object.freeze([
  '01_Meetings',
  '02_Sourcing',
  '02_Design_and_Structuring',
  '00_Overview_and_Contacts',
  '00_Overview_and_Governance',
]);

const blocked = (code, message, extra = {}) => ({ code, message, ...extra });

/**
 * @param {object} options
 * @param {object} options.drive     Drive client (createDriveStructureClient)
 * @param {object} options.registry  Registry port
 * @param {object} options.plan      plan from planStructure
 */
export async function previewStructure({ drive, registry, plan }) {
  const driveInfo = await drive.verifySharedDrive();

  const base = {
    status: PREVIEW_STATUS.BLOCKED,
    drive: driveInfo,
    structureType: plan.structureType,
    destination: plan.destination,
    planHash: plan.hash,
    items: plan.items.map((item) => ({ ...item, status: ITEM_STATUS.BLOCKED })),
    counts: { create: 0, exists: 0, conflict: 0 },
    blocking: [],
    acknowledgements: [],
    registry: { applicable: plan.registry.applicable, status: null },
  };

  /* 1. The canonical parent must already exist. Missing roots are architecture drift and
        are reported to the administrator — the MVP never bootstraps them. */
  const parent = await drive.resolvePath(plan.destination.parentSegments);
  if (!parent.ok) {
    const message =
      parent.code === CONFLICT_CODE.MISSING_CANONICAL_PARENT
        ? `The canonical folder "${parent.missingSegment}" does not exist in ${driveInfo.name}. ` +
          'This is drift from the approved architecture — RADAR will not create canonical roots. ' +
          'Ask the RADAR owner to restore it before creating this structure.'
        : `More than one folder named "${parent.missingSegment}" exists on the canonical path, so the ` +
          'destination is ambiguous. Resolve the duplicate in Drive before continuing.';
    return { ...base, blocking: [blocked(parent.code, message, { segment: parent.missingSegment })] };
  }

  let parentFolder = parent.items[parent.items.length - 1];

  /* 1b. Segments that must already exist but are NOT canonical architecture — today, an
         organization folder a human moved into Portfolio after approval.

         This is why the structure cannot fabricate a Portfolio object: the object folder is
         resolved here, never planned. `createdSegments` is empty for such a template, so no
         plan item is the object folder and `createFolder(parent, objectName)` is not merely
         blocked, it does not exist as a call. Resolving it here also means the authorization
         probe below tests the folder RADAR will really write into.

         No explicit assertInSharedDrive is needed on what this resolves, unlike resolvePath:
         findExactChildren is scoped by the Drive API itself (corpora=drive, driveId), so a
         match cannot come from another drive, and every item actually created is verified by
         _create. */
  const mustExist = plan.destination.requireExistingSegments || [];
  const requiredHistory = [];
  for (const segment of mustExist) {
    const matches = await drive.findExactChildren(parentFolder.id, segment);

    if (matches.length === 0) {
      const message =
        `No folder named "${segment}" exists in ${joinSegments(plan.destination.parentSegments)}. ` +
        'RADAR adds the Portfolio operating folders to an organization whose folder has already ' +
        'been moved here after approval — it never creates that folder, because a rebuilt folder ' +
        'loses the Sourcing, Screening and Diligence history the approval is supposed to preserve. ' +
        'Move the approved folder into Portfolio first, and check you picked the theme it was ' +
        'moved into. Names are matched exactly, including accents and capitalisation.';
      return {
        ...base,
        blocking: [blocked(CONFLICT_CODE.OBJECT_FOLDER_NOT_FOUND, message, { segment })],
      };
    }

    if (matches.length > 1) {
      const message =
        `${matches.length} folders named "${segment}" exist in ` +
        `${joinSegments(plan.destination.parentSegments)}, so RADAR cannot tell which one is the ` +
        'official home. De-duplicate them in Drive first.';
      return {
        ...base,
        blocking: [blocked(CONFLICT_CODE.AMBIGUOUS_OBJECT_FOLDER, message, { segment })],
      };
    }

    if (matches[0].mimeType !== MIME_FOLDER) {
      const message = `"${segment}" exists in ${joinSegments(plan.destination.parentSegments)} but is not a folder.`;
      return {
        ...base,
        blocking: [blocked(CONFLICT_CODE.WRONG_MIME_TYPE, message, { segment })],
      };
    }

    parentFolder = matches[0];
    requiredHistory.push(parentFolder);
  }

  /* 2. Authorization probe. RADAR keeps no admin list of its own: the user's Shared Drive
        role is the authority and Google enforces it on the write itself. */
  const authorized = await drive.canAddChildren(parentFolder.id);
  if (!authorized) {
    return {
      ...base,
      parent: { id: parentFolder.id, path: plan.destination.parentPath, webViewLink: parentFolder.webViewLink },
      blocking: [
        blocked(
          CONFLICT_CODE.NOT_AUTHORIZED,
          `You do not have permission to add folders under ${plan.destination.parentPath}. ` +
            'Creating canonical structures requires Content Manager access on the RADAR Shared Drive.'
        ),
      ],
    };
  }

  /* 3. Resolve every planned item against live Drive. */
  const resolved = new Map(); // item key -> { id, status, webViewLink }
  const items = [];
  const blocking = [];

  for (const item of plan.items) {
    const parentEntry = item.parentKey ? resolved.get(item.parentKey) : { id: parentFolder.id };

    // If the parent will be created, every descendant will be too — no query needed, which
    // keeps a full pipeline preview to a handful of API calls.
    if (!parentEntry || !parentEntry.id) {
      resolved.set(item.key, { id: null, status: ITEM_STATUS.CREATE });
      items.push({ ...item, status: ITEM_STATUS.CREATE });
      continue;
    }

    const matches = await drive.findExactChildren(parentEntry.id, item.name);

    if (matches.length === 0) {
      resolved.set(item.key, { id: null, status: ITEM_STATUS.CREATE });
      items.push({ ...item, status: ITEM_STATUS.CREATE });
      continue;
    }

    if (matches.length > 1) {
      const message = `${matches.length} items named "${item.name}" already exist in ${item.fullPath}. ` +
        'RADAR will not guess which one is official — de-duplicate them in Drive first.';
      resolved.set(item.key, { id: null, status: ITEM_STATUS.CONFLICT });
      items.push({
        ...item,
        status: ITEM_STATUS.CONFLICT,
        conflict: { code: CONFLICT_CODE.DUPLICATE_EXACT_MATCH, message },
      });
      blocking.push(blocked(CONFLICT_CODE.DUPLICATE_EXACT_MATCH, message, { path: item.fullPath }));
      continue;
    }

    const match = matches[0];
    if (match.mimeType !== item.mimeType) {
      const expected = item.kind === 'google_doc' ? 'a Google document' : 'a folder';
      const message = `"${item.name}" already exists in ${item.fullPath} but is not ${expected}. ` +
        'Rename or move the existing item before continuing.';
      resolved.set(item.key, { id: null, status: ITEM_STATUS.CONFLICT });
      items.push({
        ...item,
        status: ITEM_STATUS.CONFLICT,
        existing: { id: match.id, mimeType: match.mimeType, webViewLink: match.webViewLink },
        conflict: { code: CONFLICT_CODE.WRONG_MIME_TYPE, message },
      });
      blocking.push(blocked(CONFLICT_CODE.WRONG_MIME_TYPE, message, { path: item.fullPath }));
      continue;
    }

    resolved.set(item.key, { id: match.id, status: ITEM_STATUS.EXISTS, webViewLink: match.webViewLink });
    items.push({
      ...item,
      status: ITEM_STATUS.EXISTS,
      existing: { id: match.id, mimeType: match.mimeType, webViewLink: match.webViewLink },
    });
  }

  /* 4. Warnings the plan already knows about (restricted folders, Registry transitions). */
  const acknowledgements = plan.warnings.map((w) => ({ code: w.code, message: w.message, items: w.items }));

  /* 4b. Does the object folder actually carry the history the approval preserved?

         "The folder exists" alone would rubber-stamp an empty shell somebody created by hand,
         which is the rebuilt-instead-of-moved object the PORTFOLIO CREATION RULE forbids. This
         is an acknowledgement rather than a block because the evidence is heuristic: a legacy
         organization may keep its history under non-canonical names, and blocking it outright
         would strand a legitimate object with no way forward. Raised only when no marker is
         found, so it never becomes a checkbox the administrator ticks by reflex. */
  if (requiredHistory.length > 0) {
    const objectFolder = requiredHistory[requiredHistory.length - 1];
    const found = [];
    for (const marker of RETAINED_HISTORY_MARKERS) {
      const hits = await drive.findExactChildren(objectFolder.id, marker);
      if (hits.length > 0) found.push(marker);
    }
    if (found.length === 0) {
      acknowledgements.push({
        code: ACKNOWLEDGEMENT_CODE.NO_RETAINED_HISTORY,
        message:
          `"${objectFolder.name}" contains none of the folders a moved Pipeline or Venture ` +
          `Building object would carry (${RETAINED_HISTORY_MARKERS.join(', ')}). If you created ` +
          'this folder by hand, stop and move the approved folder instead — rebuilding an object ' +
          'loses the history the approval is meant to preserve. Continue only if this folder ' +
          'already holds the organization\'s record under different names.',
        items: [objectFolder.name],
      });
    }
  }

  /* 5. Registry: refuse to create a second official home for a known object. */
  let registryState = { applicable: plan.registry.applicable, status: null };
  if (plan.registry.applicable && registry?.isConfigured?.()) {
    const rootEntry = resolved.get(plan.items.find((i) => i.isStructureRoot)?.key);
    const lookup = await registry.lookup(plan.registry.identity);
    const existingLink = String(lookup.officialFolderLink || '').trim();

    if (lookup.found && existingLink && existingLink !== (rootEntry?.webViewLink || '')) {
      const message =
        `The Master Registry already records "${plan.registry.identity.objectName}" with a different ` +
        'official folder. One object has exactly one official home, so RADAR will not create a second ' +
        'one. Resolve the Registry record first.';
      blocking.push(
        blocked(CONFLICT_CODE.REGISTRY_OFFICIAL_FOLDER_CONFLICT, message, { existingOfficialFolderLink: existingLink })
      );
      registryState = { applicable: true, status: REGISTRY_STATUS.CONFLICT, existingOfficialFolderLink: existingLink };
    } else {
      registryState = { applicable: true, status: lookup.found ? REGISTRY_STATUS.UPDATED : REGISTRY_STATUS.CREATED };
    }
  } else if (plan.registry.applicable) {
    registryState = { applicable: true, status: REGISTRY_STATUS.PENDING_CONFIGURATION };
  } else {
    registryState = { applicable: false, status: REGISTRY_STATUS.NOT_APPLICABLE };
  }

  /* 6. Is this object name already sitting in a conflicting lifecycle location? Detection
        only — a conflicting home is reported, never moved. */
  if (plan.inputs.theme && plan.inputs.objectName) {
    for (const scope of LIFECYCLE_CONFLICT_SCOPES) {
      const segments = scope.segments(plan.inputs.theme);
      /**
       * A scope that IS this structure's own destination is not a conflicting home: finding
       * the object there is the entire point (Portfolio operating folders) or an idempotent
       * re-run. Derived from the plan rather than keyed on structure type, so it stays correct
       * for any future structure — and it changes nothing for the original six, none of whose
       * destinations equal a lifecycle scope.
       *
       * Without this, the Portfolio scope would fire on every run of an additive Portfolio
       * structure and force the administrator to tick an acknowledgement stating the opposite
       * of what they are doing — which corrodes the one mechanism whose value is that ticking
       * it means something.
       */
      if (joinSegments(segments) === joinSegments(plan.destination.parentSegments)) continue;
      const location = await drive.resolvePath(segments);
      if (!location.ok) continue; // that area may legitimately not exist yet
      const container = location.items[location.items.length - 1];
      const hits = await drive.findExactChildren(container.id, plan.inputs.objectName);
      if (hits.length > 0) {
        acknowledgements.push({
          code: ACKNOWLEDGEMENT_CODE.LIFECYCLE_LOCATION_CONFLICT,
          message:
            `A folder named "${plan.inputs.objectName}" already exists in ${scope.label}. If this is the same ` +
            'object, its lifecycle should move the existing folder rather than create a new one.',
          items: [scope.label],
        });
      }
    }
  }

  const counts = items.reduce(
    (acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }),
    { create: 0, exists: 0, conflict: 0 }
  );

  return {
    status: blocking.length > 0 ? PREVIEW_STATUS.BLOCKED : PREVIEW_STATUS.READY,
    drive: driveInfo,
    structureType: plan.structureType,
    destination: plan.destination,
    planHash: plan.hash,
    parent: { id: parentFolder.id, path: plan.destination.parentPath, webViewLink: parentFolder.webViewLink },
    items,
    counts,
    blocking,
    acknowledgements,
    registry: registryState,
  };
}
