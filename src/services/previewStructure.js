/**
 * Preview: compare a deterministic plan against LIVE Drive state.
 *
 * Read-only by construction — only the Drive client's read methods are reachable from here.
 * The preview is what the administrator confirms, and execution re-runs this exact function
 * immediately before writing, because Drive may have changed in between.
 */

import { LIFECYCLE_CONFLICT_SCOPES } from '../radar/canonicalTree.js';
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
  WRONG_MIME_TYPE: 'WRONG_MIME_TYPE',
  DUPLICATE_EXACT_MATCH: 'DUPLICATE_EXACT_MATCH',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  REGISTRY_OFFICIAL_FOLDER_CONFLICT: 'REGISTRY_OFFICIAL_FOLDER_CONFLICT',
});

export const ACKNOWLEDGEMENT_CODE = Object.freeze({
  SENSITIVE_FOLDER: PLAN_WARNING.PERMISSIONS_CONFIGURATION_REQUIRED,
  LIFECYCLE_LOCATION_CONFLICT: 'LIFECYCLE_LOCATION_CONFLICT',
});

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

  const parentFolder = parent.items[parent.items.length - 1];

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

  /* 4. Warnings the plan already knows about (restricted folders). */
  const acknowledgements = plan.warnings.map((w) => ({ code: w.code, message: w.message, items: w.items }));

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
      const location = await drive.resolvePath(scope.segments(plan.inputs.theme));
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
