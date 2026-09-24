/**
 * Input validation and normalization for structure creation.
 *
 * Runs twice: in the browser before preview, and again inside executeStructure immediately
 * before writing. Both call the same function, so there is exactly one definition of what
 * a valid input is.
 *
 * Naming policy: folder names keep the administrator's text. RADAR has an approved naming
 * convention for DOCUMENTS (policy §3.2) but none for folder names, and the canonical spec's
 * own examples (`Aprendo+`, `Democracia+`) contain characters a slug would destroy — so this
 * module rejects unsafe names rather than silently rewriting them into something lossy.
 */

import {
  GOVERNANCE_FORUMS,
  BECA_TECH_ORGANIZATION_KINDS,
  becaTechOrganizationKindById,
  forumById,
  themesForArea,
} from './canonicalTree.js';
import { getTemplate, isSupportedStructureType } from './structureTemplates.js';

/* ─── Documented limits ───────────────────────────────────── */

/**
 * Drive itself allows names up to 32767 characters, which is useless as a governance limit.
 * 120 keeps a full canonical path comfortably readable in Drive's UI, in the Registry, and
 * in the audit log.
 */
export const MAX_NAME_LENGTH = 120;

/** Registry metadata fields are never path segments, so they get a looser limit. */
export const MAX_METADATA_LENGTH = 200;

/** Supported calendar range for OKR cycles and meeting-log years. */
export const SUPPORTED_YEAR_RANGE = Object.freeze({ min: 2000, max: 2100 });

/**
 * Control and invisible formatting characters. C0/C1 controls plus zero-width, bidi
 * override and line/paragraph separators — all of which can make one folder name render
 * as another, which is precisely the ambiguity a governance system must not accept.
 *
 * Written with escape sequences on purpose: literal control characters in source are
 * invisible to a reviewer.
 */
const UNSAFE_INVISIBLE = new RegExp(
  '[' +
    '\\u0000-\\u001F' + // C0 controls
    '\\u007F-\\u009F' + // DEL and C1 controls
    '\\u200B-\\u200F' + // zero-width and directional marks
    '\\u2028\\u2029' + // line and paragraph separators
    '\\u202A-\\u202E' + // bidi embedding and override
    '\\u2066-\\u2069' + // bidi isolates
    '\\uFEFF' + // zero-width no-break space
    ']'
);

/** Path separators, including the Windows form, so no input can traverse a path. */
const PATH_SEPARATOR = /[/\\]/;

/**
 * Raw keys that look like an attempt to override where or what gets created. These are
 * rejected loudly rather than dropped quietly, so a bug or a tampered request surfaces.
 */
const FORBIDDEN_OVERRIDE_KEYS = Object.freeze([
  'destination',
  'destinationPath',
  'path',
  'segments',
  'items',
  'template',
  'nodes',
  'parentId',
  'parentSegments',
  'driveId',
  'sharedDriveId',
  'hash',
]);

/* ─── Error helper ────────────────────────────────────────── */

function err(field, code, message) {
  return { field, code, message };
}

/* ─── Field validators ────────────────────────────────────── */

/**
 * Validate a value destined to become a literal Drive folder name.
 * Returns `{ value }` or `{ error }`.
 */
export function validateFolderName(raw, field, label) {
  if (typeof raw !== 'string') {
    return { error: err(field, 'REQUIRED', `${label} is required.`) };
  }

  const value = raw.trim();

  if (value === '') {
    return { error: err(field, 'EMPTY', `${label} is required.`) };
  }
  if (PATH_SEPARATOR.test(value)) {
    return { error: err(field, 'PATH_SEPARATOR', `${label} cannot contain "/" or "\\".`) };
  }
  if (UNSAFE_INVISIBLE.test(value)) {
    return {
      error: err(field, 'CONTROL_CHARACTER', `${label} contains control or invisible characters.`),
    };
  }
  // "." and ".." are relative path references; any all-dots name is ambiguous.
  if (/^\.+$/.test(value)) {
    return { error: err(field, 'RELATIVE_PATH', `${label} cannot be "." or "..".`) };
  }
  // A leading dot creates a hidden-looking segment.
  if (value.startsWith('.')) {
    return { error: err(field, 'HIDDEN_SEGMENT', `${label} cannot start with ".".`) };
  }
  if (value.length > MAX_NAME_LENGTH) {
    return {
      error: err(field, 'TOO_LONG', `${label} cannot be longer than ${MAX_NAME_LENGTH} characters.`),
    };
  }

  return { value };
}

/** Optional Registry metadata — never becomes a path segment. */
function validateMetadata(raw, field, label) {
  if (raw === undefined || raw === null || raw === '') return { value: '' };
  if (typeof raw !== 'string') {
    return { error: err(field, 'INVALID', `${label} must be text.`) };
  }
  const value = raw.trim();
  if (value === '') return { value: '' };
  if (UNSAFE_INVISIBLE.test(value)) {
    return {
      error: err(field, 'CONTROL_CHARACTER', `${label} contains control or invisible characters.`),
    };
  }
  if (value.length > MAX_METADATA_LENGTH) {
    return {
      error: err(field, 'TOO_LONG', `${label} cannot be longer than ${MAX_METADATA_LENGTH} characters.`),
    };
  }
  return { value };
}

/**
 * Themes are validated against the allowlist for the structure's own canonical area, not a
 * global enum: v06 permits Cross_Thematic under In-house Programs and Exploration and
 * forbids it under Pipeline and Venture Building.
 */
function validateTheme(raw, themes) {
  if (!themes.includes(raw)) {
    return {
      error: err('theme', 'INVALID_THEME', `Theme must be one of: ${themes.join(', ')}.`),
    };
  }
  return { value: raw };
}

function validateForum(raw) {
  if (!forumById(raw)) {
    const labels = GOVERNANCE_FORUMS.map((f) => f.label).join(', ');
    return {
      error: err('forum', 'INVALID_FORUM', `Forum must be one of: ${labels}.`),
    };
  }
  return { value: raw };
}

function validateOrganizationKind(raw) {
  if (!becaTechOrganizationKindById(raw)) {
    const labels = BECA_TECH_ORGANIZATION_KINDS.map((k) => k.label).join(', ');
    return {
      error: err('organizationKind', 'INVALID_ORGANIZATION_KIND', `Organization type must be one of: ${labels}.`),
    };
  }
  return { value: raw };
}

function validateYear(raw, field, label) {
  const value = typeof raw === 'string' ? raw.trim() : raw;
  // Reject "2026.5", "26", " 2026abc" and similar before Number() coerces them.
  if (!/^\d{4}$/.test(String(value))) {
    return { error: err(field, 'INVALID_YEAR', `${label} must be a four-digit year.`) };
  }
  const year = Number(value);
  if (year < SUPPORTED_YEAR_RANGE.min || year > SUPPORTED_YEAR_RANGE.max) {
    return {
      error: err(
        field,
        'YEAR_OUT_OF_RANGE',
        `${label} must be between ${SUPPORTED_YEAR_RANGE.min} and ${SUPPORTED_YEAR_RANGE.max}.`
      ),
    };
  }
  return { value: year };
}

/**
 * Strict calendar-date validation. The regex only proves the shape; round-tripping through
 * UTC is what rejects 2026-02-30 and 2025-02-29 while accepting 2024-02-29.
 */
function validateMeetingDate(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return { error: err('meetingDate', 'INVALID_DATE_FORMAT', 'Date must use the format YYYY-MM-DD.') };
  }

  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);

  const date = new Date(Date.UTC(year, month - 1, day));
  const roundTrips =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  if (!roundTrips) {
    return { error: err('meetingDate', 'INVALID_DATE', `${value} is not a real calendar date.`) };
  }
  if (year < SUPPORTED_YEAR_RANGE.min || year > SUPPORTED_YEAR_RANGE.max) {
    return {
      error: err(
        'meetingDate',
        'YEAR_OUT_OF_RANGE',
        `Meeting year must be between ${SUPPORTED_YEAR_RANGE.min} and ${SUPPORTED_YEAR_RANGE.max}.`
      ),
    };
  }

  return { value };
}

/* ─── Field dispatch ──────────────────────────────────────── */

const FIELD_VALIDATORS = {
  objectName: (raw, ctx) => validateFolderName(raw, 'objectName', ctx.objectNameLabel),
  theme: (raw, ctx) => validateTheme(raw, ctx.themes),
  owner: (raw) => validateMetadata(raw, 'owner', 'Owner'),
  country: (raw) => validateMetadata(raw, 'country', 'Country or geography'),
  strategicFocus: (raw) => validateMetadata(raw, 'strategicFocus', 'Strategic focus'),
  meetingLogYear: (raw) => validateYear(raw, 'meetingLogYear', 'Meeting log year'),
  forum: (raw) => validateForum(raw),
  organizationKind: (raw) => validateOrganizationKind(raw),
  meetingDate: (raw) => validateMeetingDate(raw),
  okrYear: (raw) => validateYear(raw, 'okrYear', 'OKR year'),
};

/* ─── Public API ──────────────────────────────────────────── */

/**
 * Validate and normalize raw wizard input for a structure type.
 *
 * Only fields the template declares are read; everything else is discarded, so a caller
 * cannot smuggle a destination, a parent id or a template into the plan. Keys that clearly
 * attempt such an override are rejected with an explicit error instead.
 *
 * @returns {{ ok: true, value: object } | { ok: false, errors: Array<{field,code,message}> }}
 */
export function validateStructureInput(type, raw) {
  if (!isSupportedStructureType(type)) {
    return {
      ok: false,
      errors: [err('structureType', 'UNSUPPORTED_TYPE', 'That structure type is not supported.')],
    };
  }

  const input = raw && typeof raw === 'object' ? raw : {};
  const errors = [];

  for (const key of FORBIDDEN_OVERRIDE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      errors.push(
        err(key, 'OVERRIDE_REJECTED', 'The destination is derived from the structure type and cannot be supplied.')
      );
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const template = getTemplate(type);
  const ctx = {
    objectNameLabel: template.objectNameLabel || 'Name',
    // A template collecting `theme` must declare `themeArea`; themesForArea throws if not.
    themes: template.fields.includes('theme') ? themesForArea(template.themeArea) : [],
  };
  const value = {};

  for (const field of template.fields) {
    const result = FIELD_VALIDATORS[field](input[field], ctx);
    if (result.error) errors.push(result.error);
    else value[field] = result.value;
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value };
}

/** Sensible starting values for the wizard. `now` is injectable so tests stay deterministic. */
export function defaultInputsFor(type, now = new Date()) {
  const year = now.getFullYear();
  const iso = [
    String(year),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  const template = getTemplate(type);
  const defaults = {
    objectName: '',
    theme: '',
    owner: '',
    country: '',
    strategicFocus: '',
    meetingLogYear: String(year),
    forum: '',
    organizationKind: '',
    meetingDate: iso,
    okrYear: String(year),
  };

  return Object.fromEntries(template.fields.map((f) => [f, defaults[f]]));
}
