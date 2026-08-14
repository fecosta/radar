/**
 * Wires the Drive, Registry and audit adapters from build configuration.
 *
 * The Shared Drive id and both spreadsheet ids come from environment variables at build
 * time. They are never accepted from a caller, which is what guarantees that no request can
 * retarget another drive or another registry.
 */

import { createDriveStructureClient } from './driveStructureApi.js';
import { createSheetsClient } from './sheetsApi.js';
import { createSheetRegistry } from './registrySheet.js';
import { createUnconfiguredRegistry } from './registryPort.js';
import { createSheetAudit } from './auditSheet.js';
import { createUnconfiguredAudit } from './auditPort.js';

/**
 * Google scopes needed to create structures, requested incrementally when the
 * administrator opens the Create workflow — Search and Classify stay on drive.readonly.
 *
 * `drive.file` would be narrower but is unusable here: idempotency depends on listing the
 * children of canonical parents this app did not create, which drive.file does not grant.
 * That trade-off is documented in docs/operations/create-structure.md.
 */
export const STRUCTURE_WRITE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

/** Read configuration once, so the UI can explain exactly what is and is not set up. */
export function readStructureConfig(env = import.meta.env) {
  return {
    sharedDriveId: env.VITE_SHARED_DRIVE_ID || '',
    registrySheetId: env.VITE_RADAR_REGISTRY_SHEET_ID || '',
    auditSheetId: env.VITE_RADAR_AUDIT_SHEET_ID || '',
  };
}

/**
 * Build the service trio for one elevated session.
 *
 * A missing Registry or audit spreadsheet does not disable creation — it degrades to the
 * "unconfigured" adapter, which reports its own absence rather than silently doing nothing.
 */
export function createStructureServices({ token, config, fetchImpl }) {
  const drive = createDriveStructureClient({
    token,
    sharedDriveId: config.sharedDriveId,
    fetchImpl,
  });

  const sheets =
    config.registrySheetId || config.auditSheetId
      ? createSheetsClient({ token, fetchImpl })
      : null;

  const registry = config.registrySheetId
    ? createSheetRegistry({ sheetsClient: sheets, spreadsheetId: config.registrySheetId })
    : createUnconfiguredRegistry(
        'No Master Registry spreadsheet is configured (VITE_RADAR_REGISTRY_SHEET_ID).'
      );

  const audit = config.auditSheetId
    ? createSheetAudit({ sheetsClient: sheets, spreadsheetId: config.auditSheetId })
    : createUnconfiguredAudit();

  return { drive, registry, audit };
}
