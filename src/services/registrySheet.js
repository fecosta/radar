/**
 * Google Sheets implementation of the Master Registry port.
 *
 * The Registry's spreadsheet id and column order were not supplied to this build, so the
 * adapter reads the header row at runtime and matches columns BY NAME. A sheet whose
 * columns are reordered still works; a sheet missing a required column fails with a clear
 * configuration error rather than writing to a guessed position.
 */

import { REGISTRY_FIELDS, REGISTRY_REQUIRED_FIELDS } from '../radar/canonicalTree.js';
import { DriveError, ERROR_CODE } from './driveErrors.js';
import { REGISTRY_STATUS, normalizeRegistryValue } from './registryPort.js';
import { quoteSheetName, columnLetter } from './sheetsApi.js';

/**
 * @param {object} options
 * @param {object} options.sheetsClient   from createSheetsClient
 * @param {string} options.spreadsheetId  configured Master Registry spreadsheet
 * @param {string} [options.sheetTitle]   tab to use; defaults to the first tab
 * @param {Function} [options.now]        injectable clock for Last_Updated
 */
export function createSheetRegistry({ sheetsClient, spreadsheetId, sheetTitle, now = () => new Date() }) {
  let schemaPromise = null;

  async function loadSchema() {
    const title = sheetTitle || (await sheetsClient.listSheetTitles(spreadsheetId))[0];
    if (!title) {
      throw new DriveError(ERROR_CODE.CONFIGURATION, {
        message: 'The Master Registry spreadsheet has no readable sheet tab.',
        details: { stage: 'registry_schema' },
      });
    }

    const quoted = quoteSheetName(title);
    const headerRows = await sheetsClient.getValues(spreadsheetId, `${quoted}!1:1`, 'registry_header');
    const header = headerRows[0] || [];

    const index = new Map();
    header.forEach((name, i) => {
      const key = String(name || '').trim();
      // First occurrence wins; a duplicated header would otherwise silently shift writes.
      if (key && !index.has(key)) index.set(key, i);
    });

    const missing = REGISTRY_REQUIRED_FIELDS.filter((f) => !index.has(f));
    if (missing.length > 0) {
      throw new DriveError(ERROR_CODE.CONFIGURATION, {
        message: `The Master Registry is missing required column(s): ${missing.join(', ')}.`,
        details: { stage: 'registry_schema', missing },
      });
    }

    return { title, quoted, index, width: Math.max(header.length, index.size) };
  }

  function schema() {
    // Cached per client instance; a failed load is not cached so a fixed sheet recovers.
    if (!schemaPromise) {
      schemaPromise = loadSchema().catch((error) => {
        schemaPromise = null;
        throw error;
      });
    }
    return schemaPromise;
  }

  const cell = (row, i) => (i === undefined || i === null ? '' : row[i] ?? '');

  /**
   * Find the row whose canonical identity matches. Returns a 1-based sheet row number.
   *
   * `matchObjectType: false` answers a different question: "does this object have a row under
   * ANY type?" Used only by the conflict check, never by the upsert — the strict three-field
   * match is what makes re-running a creation find its own row instead of appending.
   */
  async function findRow(identity, { matchObjectType = true } = {}) {
    const { quoted, index } = await schema();
    const rows = await sheetsClient.getValues(spreadsheetId, `${quoted}!A2:ZZ`, 'registry_rows');

    const wantName = normalizeRegistryValue(identity.objectName);
    const wantTheme = normalizeRegistryValue(identity.theme);
    const wantType = normalizeRegistryValue(identity.objectType);

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (normalizeRegistryValue(cell(row, index.get('Object_Name'))) !== wantName) continue;
      if (normalizeRegistryValue(cell(row, index.get('Theme'))) !== wantTheme) continue;
      if (matchObjectType && normalizeRegistryValue(cell(row, index.get('Object_Type'))) !== wantType) continue;
      return { rowNumber: i + 2, row };
    }
    return null;
  }

  /** Shape a findRow result the way both lookups report it. */
  async function reportRow(match) {
    if (!match) return { status: REGISTRY_STATUS.UNCHANGED, found: false };
    const { index } = await schema();
    return {
      found: true,
      rowNumber: match.rowNumber,
      officialFolderLink: String(cell(match.row, index.get('Official_Folder_Link')) || '').trim(),
      objectType: String(cell(match.row, index.get('Object_Type')) || '').trim(),
    };
  }

  return {
    isConfigured: () => true,

    async lookup(identity) {
      return reportRow(await findRow(identity));
    },

    /**
     * Name + theme only. Reports the row's Object_Type so the caller can say what it found —
     * "already recorded as Pipeline" is far more actionable than "already recorded".
     */
    async lookupAnyType(identity) {
      return reportRow(await findRow(identity, { matchObjectType: false }));
    },

    /**
     * Idempotent upsert.
     *
     * Re-running creation finds the same row and reports UNCHANGED rather than appending a
     * duplicate. A row already pointing at a different official folder is reported as
     * CONFLICT and left untouched.
     */
    async upsert({ identity, record, officialFolderLink }) {
      const { quoted, index, width } = await schema();
      const existing = await findRow(identity);

      const values = { ...record, Official_Folder_Link: officialFolderLink };
      values.Last_Updated = now().toISOString();

      if (!existing) {
        const row = new Array(Math.max(width, index.size)).fill('');
        for (const field of REGISTRY_FIELDS) {
          const at = index.get(field);
          if (at !== undefined && values[field] !== undefined) row[at] = values[field];
        }
        await sheetsClient.appendRow(spreadsheetId, `${quoted}!A1`, row, 'registry_append');
        return { status: REGISTRY_STATUS.CREATED, identity };
      }

      const currentLink = String(cell(existing.row, index.get('Official_Folder_Link')) || '').trim();
      if (currentLink && currentLink !== officialFolderLink) {
        return {
          status: REGISTRY_STATUS.CONFLICT,
          identity,
          existingOfficialFolderLink: currentLink,
          rowNumber: existing.rowNumber,
        };
      }
      if (currentLink === officialFolderLink) {
        return { status: REGISTRY_STATUS.UNCHANGED, identity, rowNumber: existing.rowNumber };
      }

      // Fill in the link (and refresh metadata) without clobbering columns RADAR does not own,
      // such as Current_Stage_or_Status, which a human maintains.
      const row = [...existing.row];
      while (row.length < width) row.push('');
      for (const field of ['Official_Folder_Link', 'Last_Updated']) {
        const at = index.get(field);
        if (at !== undefined) row[at] = values[field];
      }
      const lastColumn = columnLetter(Math.max(width, row.length) - 1);
      await sheetsClient.updateRow(
        spreadsheetId,
        `${quoted}!A${existing.rowNumber}:${lastColumn}${existing.rowNumber}`,
        row,
        'registry_update'
      );
      return { status: REGISTRY_STATUS.UPDATED, identity, rowNumber: existing.rowNumber };
    },
  };
}
