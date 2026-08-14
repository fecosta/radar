/**
 * Google Sheets implementation of the audit port — append-only.
 *
 * The audit spreadsheet must already exist with the columns from AUDIT_COLUMNS in its header
 * row. RADAR does not create or repair it: an audit trail that the audited system can
 * silently recreate is not much of an audit trail (see ADR 0001).
 *
 * Columns are matched BY NAME, so a sheet whose columns are reordered, or which carries extra
 * columns of the team's own, still works. Only a missing required column is an error.
 */

import { DriveError, ERROR_CODE } from './driveErrors.js';
import { AUDIT_COLUMNS, AUDIT_STATUS, auditEventToValues } from './auditPort.js';
import { quoteSheetName } from './sheetsApi.js';

export function createSheetAudit({ sheetsClient, spreadsheetId, sheetTitle }) {
  let schemaPromise = null;

  async function loadSchema() {
    const title = sheetTitle || (await sheetsClient.listSheetTitles(spreadsheetId))[0];
    if (!title) {
      throw new DriveError(ERROR_CODE.CONFIGURATION, {
        message: 'The audit spreadsheet has no readable sheet tab.',
        details: { stage: 'audit_header' },
      });
    }

    const quoted = quoteSheetName(title);
    const rows = await sheetsClient.getValues(spreadsheetId, `${quoted}!1:1`, 'audit_header');
    const header = (rows[0] || []).map((h) => String(h || '').trim());

    const index = new Map();
    header.forEach((name, i) => {
      // First occurrence wins; a duplicated header would otherwise shift writes silently.
      if (name && !index.has(name)) index.set(name, i);
    });

    const missing = AUDIT_COLUMNS.filter((c) => !index.has(c));
    if (missing.length > 0) {
      throw new DriveError(ERROR_CODE.CONFIGURATION, {
        message: `The audit spreadsheet is missing required column(s): ${missing.join(', ')}.`,
        details: { stage: 'audit_header', missing },
      });
    }

    return { quoted, index, width: Math.max(header.length, index.size) };
  }

  function schema() {
    // Cached per client instance; a failed load is not cached, so a corrected sheet recovers
    // without a page reload.
    if (!schemaPromise) {
      schemaPromise = loadSchema().catch((error) => {
        schemaPromise = null;
        throw error;
      });
    }
    return schemaPromise;
  }

  return {
    isConfigured: () => true,

    async record(event) {
      const { quoted, index, width } = await schema();

      const values = auditEventToValues(event);
      const row = new Array(width).fill('');
      for (const [column, value] of Object.entries(values)) {
        const at = index.get(column);
        if (at !== undefined) row[at] = value;
      }

      await sheetsClient.appendRow(spreadsheetId, `${quoted}!A1`, row, 'audit_append');
      return { status: AUDIT_STATUS.RECORDED };
    },
  };
}
