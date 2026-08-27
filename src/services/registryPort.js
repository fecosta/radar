/**
 * Master Registry port.
 *
 * The specification requires ONE canonical `00_Master_Registry`; every other index is an
 * automated view. RADAR therefore reads and writes a single configured Registry and never
 * creates a competing one.
 *
 * Two implementations exist:
 *   - createSheetRegistry (registrySheet.js) — the real Google Sheet
 *   - createUnconfiguredRegistry (here)      — reports PENDING_CONFIGURATION honestly
 *
 * Contract:
 *   isConfigured() -> boolean
 *   lookup(identity) -> { status, found, officialFolderLink?, rowNumber? }
 *   lookupAnyType({ objectName, theme }) -> same shape, ignoring Object_Type
 *   upsert({ identity, record, officialFolderLink }) -> { status, ... }
 *
 * `lookupAnyType` exists because Object_Type is part of a row's identity for writing but must
 * NOT be part of it when asking "does this object already have an official folder?". An object
 * being onboarded into Portfolio may already have a Pipeline or Exploration row; a typed lookup
 * would miss it and a duplicate would be appended.
 */

export const REGISTRY_STATUS = Object.freeze({
  /** No Registry spreadsheet configured; the Drive structure was still created. */
  PENDING_CONFIGURATION: 'PENDING_CONFIGURATION',
  /** A new Registry row was appended. */
  CREATED: 'CREATED',
  /** An existing row was updated (typically filling in the official folder link). */
  UPDATED: 'UPDATED',
  /** An existing row already matched exactly; nothing was written. */
  UNCHANGED: 'UNCHANGED',
  /**
   * A row for this canonical identity already points at a DIFFERENT official folder.
   * Never overwritten silently — one object has exactly one official home, so a human
   * resolves this in the Registry first.
   */
  CONFLICT: 'CONFLICT',
  /** The Registry write failed after Drive creation succeeded. Retry is safe. */
  FAILED: 'FAILED',
  /** This structure type does not produce a Registry record at all. */
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

/** Compare Registry text the way a human maintaining the sheet would. */
export function normalizeRegistryValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Fallback used when no Registry spreadsheet is configured. Reports its own absence rather
 * than pretending a record was written — the result UI surfaces this as a pending action.
 */
export function createUnconfiguredRegistry(reason = 'No Master Registry spreadsheet is configured.') {
  return {
    isConfigured: () => false,
    async lookup() {
      return { status: REGISTRY_STATUS.PENDING_CONFIGURATION, found: false, reason };
    },
    async lookupAnyType() {
      return { status: REGISTRY_STATUS.PENDING_CONFIGURATION, found: false, reason };
    },
    async upsert() {
      return { status: REGISTRY_STATUS.PENDING_CONFIGURATION, reason };
    },
  };
}
