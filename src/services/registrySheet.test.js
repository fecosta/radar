import { describe, it, expect, vi } from 'vitest';
import { createSheetRegistry } from './registrySheet.js';
import { createSheetAudit } from './auditSheet.js';
import { REGISTRY_STATUS } from './registryPort.js';
import { AUDIT_COLUMNS, AUDIT_STATUS, buildAuditEvent, auditEventToRow } from './auditPort.js';
import { REGISTRY_FIELDS } from '../radar/canonicalTree.js';
import { ERROR_CODE } from './driveErrors.js';
import { columnLetter, quoteSheetName } from './sheetsApi.js';

const SHEET_ID = 'registry-sheet-id';

/** In-memory Sheets client covering the surface the adapters use. */
function fakeSheets({ titles = ['Registry'], rows = [] } = {}) {
  const grid = rows.map((r) => [...r]);
  const appended = [];
  const updated = [];

  return {
    async listSheetTitles() {
      return titles;
    },
    async getValues(_id, range) {
      if (range.endsWith('!1:1')) return grid.length ? [grid[0]] : [];
      return grid.slice(1);
    },
    async appendRow(_id, range, values) {
      appended.push({ range, values });
      grid.push(values);
    },
    async updateRow(_id, range, values) {
      updated.push({ range, values });
      const rowNumber = Number(/\d+/.exec(range.split('!')[1])[0]);
      grid[rowNumber - 1] = values;
    },
    _grid: grid,
    _appended: appended,
    _updated: updated,
  };
}

const HEADER = [...REGISTRY_FIELDS];
const IDENTITY = { objectName: 'Fundación Luminar', theme: 'Education', objectType: 'Pipeline' };
const RECORD = {
  Object_Name: 'Fundación Luminar',
  Theme: 'Education',
  Strategic_Focus: 'Early Childhood',
  Object_Type: 'Pipeline',
  Current_Stage_or_Status: '',
  Country_or_Geography: 'Mexico',
  Owner: 'A. Ruiz',
};

const registryOver = (sheets) =>
  createSheetRegistry({
    sheetsClient: sheets,
    spreadsheetId: SHEET_ID,
    now: () => new Date('2026-08-14T10:00:00Z'),
  });

describe('schema discovery', () => {
  it('matches columns by NAME, so a reordered sheet still works', async () => {
    // Deliberately shuffled, with an extra column the team added themselves.
    const header = ['Notes', 'Object_Type', 'Official_Folder_Link', 'Theme', 'Object_Name', 'Owner', 'Last_Updated'];
    const sheets = fakeSheets({ rows: [header] });

    await registryOver(sheets).upsert({ identity: IDENTITY, record: RECORD, officialFolderLink: 'https://x/1' });

    const written = sheets._appended[0].values;
    expect(written[header.indexOf('Object_Name')]).toBe('Fundación Luminar');
    expect(written[header.indexOf('Object_Type')]).toBe('Pipeline');
    expect(written[header.indexOf('Official_Folder_Link')]).toBe('https://x/1');
    // The column RADAR does not own is left empty rather than guessed at.
    expect(written[header.indexOf('Notes')]).toBe('');
  });

  it('fails with a clear configuration error when a required column is missing', async () => {
    const sheets = fakeSheets({ rows: [['Object_Name', 'Theme']] });
    await expect(registryOver(sheets).lookup(IDENTITY)).rejects.toMatchObject({
      code: ERROR_CODE.CONFIGURATION,
    });
    await expect(registryOver(sheets).lookup(IDENTITY)).rejects.toThrow(/Object_Type, Official_Folder_Link/);
  });

  it('does not cache a failed schema load, so a fixed sheet recovers', async () => {
    const sheets = fakeSheets({ rows: [['Object_Name']] });
    const registry = registryOver(sheets);

    await expect(registry.lookup(IDENTITY)).rejects.toThrow();
    sheets._grid[0] = [...HEADER];
    await expect(registry.lookup(IDENTITY)).resolves.toMatchObject({ found: false });
  });

  it('quotes a tab name containing an apostrophe', () => {
    expect(quoteSheetName("Laura's Registry")).toBe("'Laura''s Registry'");
  });

  it('computes A1 column letters past Z', () => {
    expect([0, 25, 26, 27].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AB']);
  });
});

describe('idempotent upsert', () => {
  it('appends a new row when the object is unknown', async () => {
    const sheets = fakeSheets({ rows: [HEADER] });
    const result = await registryOver(sheets).upsert({
      identity: IDENTITY,
      record: RECORD,
      officialFolderLink: 'https://drive/folder-1',
    });

    expect(result.status).toBe(REGISTRY_STATUS.CREATED);
    expect(sheets._appended).toHaveLength(1);
    expect(sheets._appended[0].values[HEADER.indexOf('Last_Updated')]).toBe('2026-08-14T10:00:00.000Z');
  });

  it('reports UNCHANGED and writes nothing on a rerun', async () => {
    const existing = new Array(HEADER.length).fill('');
    existing[HEADER.indexOf('Object_Name')] = 'Fundación Luminar';
    existing[HEADER.indexOf('Theme')] = 'Education';
    existing[HEADER.indexOf('Object_Type')] = 'Pipeline';
    existing[HEADER.indexOf('Official_Folder_Link')] = 'https://drive/folder-1';

    const sheets = fakeSheets({ rows: [HEADER, existing] });
    const result = await registryOver(sheets).upsert({
      identity: IDENTITY,
      record: RECORD,
      officialFolderLink: 'https://drive/folder-1',
    });

    expect(result.status).toBe(REGISTRY_STATUS.UNCHANGED);
    expect(sheets._appended).toHaveLength(0);
    expect(sheets._updated).toHaveLength(0);
  });

  it('fills in a missing link without clobbering columns a human maintains', async () => {
    const existing = new Array(HEADER.length).fill('');
    existing[HEADER.indexOf('Object_Name')] = 'Fundación Luminar';
    existing[HEADER.indexOf('Theme')] = 'Education';
    existing[HEADER.indexOf('Object_Type')] = 'Pipeline';
    existing[HEADER.indexOf('Current_Stage_or_Status')] = 'Screening';
    existing[HEADER.indexOf('Official_Folder_Link')] = '';

    const sheets = fakeSheets({ rows: [HEADER, existing] });
    const result = await registryOver(sheets).upsert({
      identity: IDENTITY,
      record: RECORD,
      officialFolderLink: 'https://drive/folder-1',
    });

    expect(result.status).toBe(REGISTRY_STATUS.UPDATED);
    const written = sheets._updated[0].values;
    expect(written[HEADER.indexOf('Official_Folder_Link')]).toBe('https://drive/folder-1');
    // The human-owned stage survives: automation must not infer an investment decision.
    expect(written[HEADER.indexOf('Current_Stage_or_Status')]).toBe('Screening');
    expect(sheets._updated[0].range).toContain('!A2:');
  });

  it('refuses to overwrite a different official folder link', async () => {
    const existing = new Array(HEADER.length).fill('');
    existing[HEADER.indexOf('Object_Name')] = 'Fundación Luminar';
    existing[HEADER.indexOf('Theme')] = 'Education';
    existing[HEADER.indexOf('Object_Type')] = 'Pipeline';
    existing[HEADER.indexOf('Official_Folder_Link')] = 'https://drive/somewhere-else';

    const sheets = fakeSheets({ rows: [HEADER, existing] });
    const result = await registryOver(sheets).upsert({
      identity: IDENTITY,
      record: RECORD,
      officialFolderLink: 'https://drive/folder-1',
    });

    expect(result.status).toBe(REGISTRY_STATUS.CONFLICT);
    expect(result.existingOfficialFolderLink).toBe('https://drive/somewhere-else');
    expect(sheets._updated).toHaveLength(0);
    expect(sheets._appended).toHaveLength(0);
  });

  it('matches identity case-insensitively and ignores surrounding whitespace', async () => {
    const existing = new Array(HEADER.length).fill('');
    existing[HEADER.indexOf('Object_Name')] = '  fundación luminar  ';
    existing[HEADER.indexOf('Theme')] = 'education';
    existing[HEADER.indexOf('Object_Type')] = 'pipeline';
    existing[HEADER.indexOf('Official_Folder_Link')] = 'https://drive/folder-1';

    const sheets = fakeSheets({ rows: [HEADER, existing] });
    const lookup = await registryOver(sheets).lookup(IDENTITY);
    expect(lookup.found).toBe(true);
    expect(lookup.rowNumber).toBe(2);
  });

  it('does not confuse two objects that differ only by theme or type', async () => {
    const row = (name, theme, type) => {
      const r = new Array(HEADER.length).fill('');
      r[HEADER.indexOf('Object_Name')] = name;
      r[HEADER.indexOf('Theme')] = theme;
      r[HEADER.indexOf('Object_Type')] = type;
      r[HEADER.indexOf('Official_Folder_Link')] = `https://drive/${type}-${theme}`;
      return r;
    };

    const sheets = fakeSheets({
      rows: [
        HEADER,
        row('Fundación Luminar', 'Democracy', 'Pipeline'),
        row('Fundación Luminar', 'Education', 'Venture_Building'),
        row('Fundación Luminar', 'Education', 'Pipeline'),
      ],
    });

    const lookup = await registryOver(sheets).lookup(IDENTITY);
    expect(lookup.rowNumber).toBe(4);
    expect(lookup.officialFolderLink).toBe('https://drive/Pipeline-Education');
  });
});

describe('audit sheet', () => {
  const event = () =>
    buildAuditEvent({
      timestamp: '2026-08-14T10:00:00.000Z',
      actor: 'admin@example.test',
      structureType: 'pipeline_organization',
      inputs: { objectName: 'Fundación Luminar', theme: 'Education' },
      destinationPath: '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Fundación Luminar',
      planHash: 'abcdef0123456789',
      operationId: 'abcdef0123456789-0',
      outcome: 'success',
      created: [{ id: 'i1', name: '02_Sourcing', path: 'a/02_Sourcing' }],
      reused: [],
      registryResult: 'CREATED',
      warnings: [{ code: 'PERMISSIONS_CONFIGURATION_REQUIRED' }],
    });

  it('appends one row per event in the documented column order', async () => {
    const sheets = fakeSheets({ titles: ['Audit'], rows: [[...AUDIT_COLUMNS]] });
    const result = await createSheetAudit({ sheetsClient: sheets, spreadsheetId: 'audit-id' }).record(event());

    expect(result.status).toBe(AUDIT_STATUS.RECORDED);
    const row = sheets._appended[0].values;
    expect(row).toHaveLength(AUDIT_COLUMNS.length);
    expect(row[AUDIT_COLUMNS.indexOf('Actor')]).toBe('admin@example.test');
    expect(row[AUDIT_COLUMNS.indexOf('Plan_Hash')]).toBe('abcdef0123456789');
    expect(row[AUDIT_COLUMNS.indexOf('Created_Items')]).toBe('02_Sourcing (i1)');
    expect(row[AUDIT_COLUMNS.indexOf('Outcome')]).toBe('success');
  });

  it('refuses a spreadsheet missing audit columns', async () => {
    const sheets = fakeSheets({ titles: ['Audit'], rows: [['Timestamp', 'Actor']] });
    await expect(
      createSheetAudit({ sheetsClient: sheets, spreadsheetId: 'audit-id' }).record(event())
    ).rejects.toMatchObject({ code: ERROR_CODE.CONFIGURATION });
  });

  it('accepts a reordered header row and still lands values in the right columns', async () => {
    // Columns are matched by name, so a hand-built sheet does not have to match a memorised
    // order — the most likely way manual setup goes wrong.
    const shuffled = [AUDIT_COLUMNS[1], AUDIT_COLUMNS[0], ...AUDIT_COLUMNS.slice(2).reverse()];
    const sheets = fakeSheets({ titles: ['Audit'], rows: [shuffled] });

    await createSheetAudit({ sheetsClient: sheets, spreadsheetId: 'audit-id' }).record(event());

    const row = sheets._appended[0].values;
    expect(row[shuffled.indexOf('Actor')]).toBe('admin@example.test');
    expect(row[shuffled.indexOf('Timestamp')]).toBe('2026-08-14T10:00:00.000Z');
    expect(row[shuffled.indexOf('Outcome')]).toBe('success');
    expect(row[shuffled.indexOf('Created_Items')]).toBe('02_Sourcing (i1)');
  });

  it('tolerates extra columns the team added, leaving them empty', async () => {
    const header = ['Reviewed_By', ...AUDIT_COLUMNS, 'Notes'];
    const sheets = fakeSheets({ titles: ['Audit'], rows: [header] });

    await createSheetAudit({ sheetsClient: sheets, spreadsheetId: 'audit-id' }).record(event());

    const row = sheets._appended[0].values;
    expect(row[header.indexOf('Actor')]).toBe('admin@example.test');
    expect(row[header.indexOf('Reviewed_By')]).toBe('');
    expect(row[header.indexOf('Notes')]).toBe('');
  });

  it('names exactly which columns are missing', async () => {
    const sheets = fakeSheets({
      titles: ['Audit'],
      rows: [AUDIT_COLUMNS.filter((c) => c !== 'Plan_Hash' && c !== 'Outcome')],
    });
    await expect(
      createSheetAudit({ sheetsClient: sheets, spreadsheetId: 'audit-id' }).record(event())
    ).rejects.toThrow(/Plan_Hash, Outcome/);
  });

  it('verifies the header only once across repeated writes', async () => {
    const sheets = fakeSheets({ titles: ['Audit'], rows: [[...AUDIT_COLUMNS]] });
    const spy = vi.spyOn(sheets, 'getValues');
    const audit = createSheetAudit({ sheetsClient: sheets, spreadsheetId: 'audit-id' });

    await audit.record(event());
    await audit.record(event());

    expect(spy).toHaveBeenCalledTimes(1);
    expect(sheets._appended).toHaveLength(2);
  });

  it('strips secrets out of error details before they reach a row', () => {
    const row = auditEventToRow(
      buildAuditEvent({
        timestamp: 't',
        actor: 'a',
        structureType: 'policy',
        inputs: {},
        destinationPath: 'p',
        planHash: 'h',
        operationId: 'o',
        outcome: 'failed',
        error: {
          code: 'API_ERROR',
          details: { access_token: 'ya29.SECRET', apiKey: 'AIza-SECRET', stage: 'create_folder' },
        },
      })
    );

    const serialized = row.join('|');
    expect(serialized).not.toContain('ya29.SECRET');
    expect(serialized).not.toContain('AIza-SECRET');
    expect(serialized).toContain('create_folder');
  });
});
