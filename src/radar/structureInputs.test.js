import { describe, it, expect } from 'vitest';
import {
  validateStructureInput,
  defaultInputsFor,
  MAX_NAME_LENGTH,
  SUPPORTED_YEAR_RANGE,
} from './structureInputs.js';
import { STRUCTURE_TYPES } from './structureTemplates.js';

const policy = (objectName) => validateStructureInput(STRUCTURE_TYPES.POLICY, { objectName });
const meeting = (meetingDate, forum = 'board') =>
  validateStructureInput(STRUCTURE_TYPES.GOVERNANCE_MEETING, { forum, meetingDate });

const codeOf = (result) => result.errors[0].code;

describe('folder names — accepted', () => {
  it.each([
    ['accents', 'Fundación Educación'],
    ['spaces', 'Luminar Foundation'],
    ['plus sign', 'Aprendo+'],
    ['ampersand', 'Teach & Learn'],
    ['hyphen', 'Ver-Mas'],
    ['apostrophe', "O'Brien Trust"],
    ['portuguese', 'Ação Democrática'],
    ['mixed', "Educação & Futuro+ (O'Neil)"],
    ['at the length limit', 'x'.repeat(MAX_NAME_LENGTH)],
  ])('keeps %s verbatim', (_label, name) => {
    const result = policy(name);
    expect(result.ok).toBe(true);
    // Crucially NOT slugged: the canonical spec's own examples depend on these characters.
    expect(result.value.objectName).toBe(name);
  });

  it('trims surrounding whitespace rather than rejecting it', () => {
    const result = policy('  Data Privacy  ');
    expect(result.ok).toBe(true);
    expect(result.value.objectName).toBe('Data Privacy');
  });
});

describe('folder names — rejected', () => {
  it.each([
    ['empty', '', 'EMPTY'],
    ['whitespace only', '     ', 'EMPTY'],
    ['tab and newline only', '\t\n', 'EMPTY'],
    ['single dot', '.', 'RELATIVE_PATH'],
    ['double dot', '..', 'RELATIVE_PATH'],
    ['many dots', '...', 'RELATIVE_PATH'],
    ['forward slash', 'a/b', 'PATH_SEPARATOR'],
    ['backslash', 'a\\b', 'PATH_SEPARATOR'],
    ['traversal attempt', '../../99_ARCHIVE', 'PATH_SEPARATOR'],
    ['leading dot', '.hidden', 'HIDDEN_SEGMENT'],
    ['null byte', 'a\u0000b', 'CONTROL_CHARACTER'],
    ['newline', 'a\nb', 'CONTROL_CHARACTER'],
    ['zero-width space', 'a\u200Bb', 'CONTROL_CHARACTER'],
    ['right-to-left override', 'a\u202Eb', 'CONTROL_CHARACTER'],
    ['byte order mark', 'a\uFEFFb', 'CONTROL_CHARACTER'],
    ['over the length limit', 'x'.repeat(MAX_NAME_LENGTH + 1), 'TOO_LONG'],
  ])('rejects %s', (_label, name, code) => {
    const result = policy(name);
    expect(result.ok).toBe(false);
    expect(codeOf(result)).toBe(code);
  });

  it('rejects a non-string name', () => {
    expect(policy(undefined).ok).toBe(false);
    expect(policy(42).ok).toBe(false);
    expect(policy({}).ok).toBe(false);
  });
});

describe('theme allowlist', () => {
  const withTheme = (theme) =>
    validateStructureInput(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, {
      objectName: 'X',
      theme,
      owner: '',
      country: '',
      strategicFocus: '',
      meetingLogYear: '2026',
    });

  it.each(['Education', 'Democracy'])('accepts %s', (theme) => {
    expect(withTheme(theme).ok).toBe(true);
  });

  it.each(['education', 'DEMOCRACY', 'Health', '', 'Education ', null, undefined])(
    'rejects %s',
    (theme) => {
      const result = withTheme(theme);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_THEME')).toBe(true);
    }
  );
});

describe('governance forum allowlist', () => {
  it.each(['board', 'leadership_team', 'all_team', 'offsites'])('accepts %s', (forum) => {
    expect(meeting('2026-08-14', forum).ok).toBe(true);
  });

  it.each(['concept_review', 'investment_committee', 'Board', '01_Board', '', 'anything'])(
    'rejects %s',
    (forum) => {
      const result = meeting('2026-08-14', forum);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_FORUM')).toBe(true);
    }
  );
});

describe('calendar dates', () => {
  it.each(['2026-08-14', '2024-02-29', '2026-12-31', '2026-01-01'])('accepts %s', (date) => {
    expect(meeting(date).ok).toBe(true);
  });

  it.each([
    ['February 30th', '2026-02-30', 'INVALID_DATE'],
    ['February 29th in a non-leap year', '2026-02-29', 'INVALID_DATE'],
    ['February 29th in 1900, not a leap year', '1900-02-29', 'INVALID_DATE'],
    ['April 31st', '2026-04-31', 'INVALID_DATE'],
    ['month 13', '2026-13-01', 'INVALID_DATE'],
    ['month 00', '2026-00-10', 'INVALID_DATE'],
    ['day 00', '2026-01-00', 'INVALID_DATE'],
    ['no zero padding', '2026-8-14', 'INVALID_DATE_FORMAT'],
    ['slashes', '2026/08/14', 'INVALID_DATE_FORMAT'],
    // Caught by the shape check before the calendar check: the year group needs four digits.
    ['US order', '08-14-2026', 'INVALID_DATE_FORMAT'],
    ['empty', '', 'INVALID_DATE_FORMAT'],
    ['out of supported range', '1899-01-01', 'YEAR_OUT_OF_RANGE'],
  ])('rejects %s', (_label, date, code) => {
    const result = meeting(date);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === code)).toBe(true);
  });

  it('accepts leap years that really are leap years', () => {
    expect(meeting('2000-02-29').ok).toBe(true); // divisible by 400
    expect(meeting('2020-02-29').ok).toBe(true);
  });
});

describe('years', () => {
  const okr = (okrYear) => validateStructureInput(STRUCTURE_TYPES.OKR_CYCLE, { okrYear });

  it.each(['2026', 2026, String(SUPPORTED_YEAR_RANGE.min), String(SUPPORTED_YEAR_RANGE.max)])(
    'accepts %s',
    (year) => {
      expect(okr(year).ok).toBe(true);
    }
  );

  it('normalizes to a number', () => {
    expect(okr('2026').value.okrYear).toBe(2026);
  });

  it.each([
    ['two digits', '26', 'INVALID_YEAR'],
    ['five digits', '20261', 'INVALID_YEAR'],
    ['fractional', '2026.5', 'INVALID_YEAR'],
    ['not a number', 'twenty', 'INVALID_YEAR'],
    ['empty', '', 'INVALID_YEAR'],
    ['before the range', '1999', 'YEAR_OUT_OF_RANGE'],
    ['after the range', '2101', 'YEAR_OUT_OF_RANGE'],
  ])('rejects %s', (_label, year, code) => {
    const result = okr(year);
    expect(result.ok).toBe(false);
    expect(codeOf(result)).toBe(code);
  });
});

describe('injection and override attempts', () => {
  it.each([
    'destination',
    'destinationPath',
    'path',
    'segments',
    'items',
    'template',
    'parentId',
    'driveId',
    'sharedDriveId',
    'hash',
  ])('rejects a client-supplied %s', (key) => {
    const result = validateStructureInput(STRUCTURE_TYPES.POLICY, {
      objectName: 'Legit Policy',
      [key]: '99_ARCHIVE/somewhere-else',
    });
    expect(result.ok).toBe(false);
    expect(codeOf(result)).toBe('OVERRIDE_REJECTED');
  });

  it('silently drops unrecognized fields rather than carrying them into the plan', () => {
    const result = validateStructureInput(STRUCTURE_TYPES.POLICY, {
      objectName: 'Legit Policy',
      somethingElse: 'ignored',
      __proto__hack: 'ignored',
    });
    expect(result.ok).toBe(true);
    expect(Object.keys(result.value)).toEqual(['objectName']);
  });

  it('rejects an unsupported structure type', () => {
    const result = validateStructureInput('portfolio_organization', { objectName: 'X' });
    expect(result.ok).toBe(false);
    expect(codeOf(result)).toBe('UNSUPPORTED_TYPE');
  });

  it('reports every invalid field at once, not just the first', () => {
    const result = validateStructureInput(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, {
      objectName: '',
      theme: 'Health',
      meetingLogYear: 'nope',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.field).sort()).toEqual(['meetingLogYear', 'objectName', 'theme']);
  });
});

describe('optional metadata', () => {
  const withMetadata = (extra) =>
    validateStructureInput(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, {
      objectName: 'X',
      theme: 'Education',
      meetingLogYear: '2026',
      owner: '',
      country: '',
      strategicFocus: '',
      ...extra,
    });

  it('treats owner, country and strategic focus as optional', () => {
    const result = withMetadata({});
    expect(result.ok).toBe(true);
    expect(result.value.owner).toBe('');
  });

  it('still rejects control characters in metadata', () => {
    const result = withMetadata({ owner: 'A\u0000B' });
    expect(result.ok).toBe(false);
    expect(codeOf(result)).toBe('CONTROL_CHARACTER');
  });

  it('allows metadata that would be invalid as a folder name', () => {
    // Metadata never becomes a path segment, so a slash is harmless there.
    expect(withMetadata({ country: 'Mexico / LATAM' }).ok).toBe(true);
  });
});

describe('defaults', () => {
  it('offers only the fields the template needs, defaulting to the current year', () => {
    const now = new Date('2026-08-14T00:00:00Z');
    expect(defaultInputsFor(STRUCTURE_TYPES.OKR_CYCLE, now)).toEqual({ okrYear: '2026' });
    expect(defaultInputsFor(STRUCTURE_TYPES.POLICY, now)).toEqual({ objectName: '' });
    expect(Object.keys(defaultInputsFor(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, now)).sort()).toEqual([
      'country',
      'meetingLogYear',
      'objectName',
      'owner',
      'strategicFocus',
      'theme',
    ]);
  });
});
