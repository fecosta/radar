/**
 * Minimal Google Sheets v4 adapter — read a range, append rows, update a row.
 *
 * Used by the Master Registry and the audit log. Kept separate from the Drive adapter
 * because they are different APIs with different scopes, and because a Registry outage
 * must not look like a Drive outage.
 */

import { DriveError, ERROR_CODE, mapApiError, mapTransportError } from './driveErrors.js';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Quote a sheet/tab name for use in an A1 range.
 * Single quotes inside a tab name are escaped by doubling them.
 */
export function quoteSheetName(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

/** Convert a zero-based column index to its A1 letter(s): 0 → A, 26 → AA. */
export function columnLetter(index) {
  let n = index;
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

export function createSheetsClient({ token, fetchImpl, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (!token) throw new DriveError(ERROR_CODE.AUTH_EXPIRED, { details: { stage: 'sheets_client_init' } });
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));

  async function request(path, { method = 'GET', params = {}, body, stage } = {}) {
    const url = new URL(`${SHEETS_API}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }

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
      throw mapApiError(res.status, payload, { stage, method });
    } catch (error) {
      if (error instanceof DriveError) throw error;
      throw mapTransportError(error, { stage, method });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /** Values for an A1 range. Trailing empty cells are omitted by the API. */
    async getValues(spreadsheetId, range, stage = 'sheets_get_values') {
      const result = await request(
        `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
        { params: { majorDimension: 'ROWS' }, stage }
      );
      return result?.values || [];
    },

    /** Append rows below the last populated row of the range. */
    async appendRow(spreadsheetId, range, values, stage = 'sheets_append_row') {
      return request(
        `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append`,
        {
          method: 'POST',
          params: {
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            includeValuesInResponse: 'false',
          },
          body: { values: [values] },
          stage,
        }
      );
    },

    /** Overwrite an exact range. Used to update one existing Registry row in place. */
    async updateRow(spreadsheetId, range, values, stage = 'sheets_update_row') {
      return request(
        `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
        {
          method: 'PUT',
          params: { valueInputOption: 'RAW' },
          body: { values: [values] },
          stage,
        }
      );
    },

    /** Tab titles, so the adapters can target the first tab without hardcoding a name. */
    async listSheetTitles(spreadsheetId, stage = 'sheets_list_titles') {
      const result = await request(`/${encodeURIComponent(spreadsheetId)}`, {
        params: { fields: 'sheets(properties(title))' },
        stage,
      });
      return (result?.sheets || []).map((s) => s.properties?.title).filter(Boolean);
    },
  };
}
