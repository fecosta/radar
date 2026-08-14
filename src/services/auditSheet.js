/**
 * Google Sheets implementation of the audit port — append-only.
 *
 * The audit spreadsheet must already exist with the header row from AUDIT_COLUMNS. RADAR
 * does not create or repair it: an audit trail that the audited system can silently
 * recreate is not much of an audit trail.
 */

import { DriveError, ERROR_CODE } from './driveErrors.js';
import { AUDIT_COLUMNS, AUDIT_STATUS, auditEventToRow } from './auditPort.js';
import { quoteSheetName } from './sheetsApi.js';

export function createSheetAudit({ sheetsClient, spreadsheetId, sheetTitle }) {
  let resolvedTitle = sheetTitle || null;
  let verified = false;

  async function ensureHeader() {
    if (verified) return resolvedTitle;

    if (!resolvedTitle) {
      resolvedTitle = (await sheetsClient.listSheetTitles(spreadsheetId))[0] || null;
    }
    if (!resolvedTitle) {
      throw new DriveError(ERROR_CODE.CONFIGURATION, {
        message: 'The audit spreadsheet has no readable sheet tab.',
        details: { stage: 'audit_header' },
      });
    }

    const quoted = quoteSheetName(resolvedTitle);
    const rows = await sheetsClient.getValues(spreadsheetId, `${quoted}!1:1`, 'audit_header');
    const header = (rows[0] || []).map((h) => String(h || '').trim());

    const missing = AUDIT_COLUMNS.filter((c) => !header.includes(c));
    if (missing.length > 0) {
      throw new DriveError(ERROR_CODE.CONFIGURATION, {
        message: `The audit spreadsheet is missing required column(s): ${missing.join(', ')}.`,
        details: { stage: 'audit_header', missing },
      });
    }

    // Rows are written in AUDIT_COLUMNS order, so a reordered header would misalign them.
    const inOrder = AUDIT_COLUMNS.every((c, i) => header[i] === c);
    if (!inOrder) {
      throw new DriveError(ERROR_CODE.CONFIGURATION, {
        message: 'The audit spreadsheet columns are not in the expected order.',
        details: { stage: 'audit_header', expected: AUDIT_COLUMNS, found: header },
      });
    }

    verified = true;
    return resolvedTitle;
  }

  return {
    isConfigured: () => true,

    async record(event) {
      const title = await ensureHeader();
      await sheetsClient.appendRow(
        spreadsheetId,
        `${quoteSheetName(title)}!A1`,
        auditEventToRow(event),
        'audit_append'
      );
      return { status: AUDIT_STATUS.RECORDED };
    },
  };
}
