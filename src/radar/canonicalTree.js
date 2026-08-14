/**
 * RADAR v05 canonical folder model — the single source of truth.
 *
 * Derived from "RADAR v05 — CANONICAL FOLDER TREE — AUTOMATION SPEC" and the approved
 * RADAR Information & File Management Policy. Governance documents outrank this file:
 * if they disagree, the specification wins and this file is the bug.
 *
 * Everything downstream — destination resolution, template expansion, preview, execution
 * and tests — reads from here. Nothing re-declares a folder name of its own.
 *
 * Deliberately NOT modelled here:
 *   - the full root-tree bootstrap (createRADARv05); missing canonical roots are reported
 *     as architecture drift, never created;
 *   - launch seed / example objects;
 *   - lifecycle transitions (Pipeline → Portfolio, decline, graduation).
 * See docs/operations/create-structure.md for why, and where the extension points are.
 */

/* ─── Fixed roots ─────────────────────────────────────────── */

/** Spec design rule 1. The only four permitted roots. */
export const CANONICAL_ROOTS = Object.freeze({
  STRATEGY: '01_STRATEGY',
  INVESTMENTS_AND_PROGRAMS: '02_INVESTMENTS_AND_PROGRAMS',
  INSTITUTIONAL: '03_INSTITUTIONAL',
  ARCHIVE: '99_ARCHIVE',
});

/** Spec design rule 2. Themes are an allowlist, never free text. */
export const THEMES = Object.freeze(['Education', 'Democracy']);

/* ─── Canonical path segments ─────────────────────────────── */

/**
 * Named segments used to build destinations. Kept as constants so a rename happens
 * in exactly one place and so tests can assert against names rather than string literals
 * copied from the implementation.
 */
export const SEGMENTS = Object.freeze({
  // 01_STRATEGY
  OKRS: '03_OKRs',

  // 02_INVESTMENTS_AND_PROGRAMS
  MASTER_INDEXES: '00_MASTER_INDEXES',
  MASTER_REGISTRY: '00_Master_Registry',
  PIPELINE: '01_PIPELINE',
  PORTFOLIO: '02_PORTFOLIO',
  VENTURE_BUILDING: '03_VENTURE_BUILDING',
  IN_HOUSE_PROGRAMS: '04_IN_HOUSE_PROGRAMS',

  // 03_INSTITUTIONAL
  POLICIES: '00_POLICIES',
  GOVERNANCE_AND_DECISIONS: '01_GOVERNANCE_AND_DECISIONS',

  // 99_ARCHIVE
  DECLINED_PIPELINE: '01_Declined_Pipeline',
});

/**
 * Formal institutional governance forums (spec: "Applies only to Board, Leadership Team,
 * All Team, Offsites").
 *
 * Concept Review and Investment Committee are project-level investment gates and are
 * absent by design — policy §3.1 and spec design rule 6 forbid storing them as central
 * governance meetings. `structureInputs` validates against this allowlist, so they cannot
 * be reached even by a hand-crafted request.
 */
export const GOVERNANCE_FORUMS = Object.freeze([
  { id: 'board', label: 'Board', folder: '01_Board', slug: 'Board' },
  { id: 'leadership_team', label: 'Leadership Team', folder: '02_Leadership_Team', slug: 'Leadership_Team' },
  { id: 'all_team', label: 'All Team', folder: '03_All_Team', slug: 'All_Team' },
  { id: 'offsites', label: 'Offsites', folder: '04_Offsites', slug: 'Offsites' },
]);

/* ─── Drive MIME types ────────────────────────────────────── */

export const MIME_FOLDER = 'application/vnd.google-apps.folder';
export const MIME_GOOGLE_DOC = 'application/vnd.google-apps.document';

/** Plan item kinds. The yearly Meeting Log is a Google document, not a folder. */
export const ITEM_KIND = Object.freeze({
  FOLDER: 'folder',
  GOOGLE_DOC: 'google_doc',
});

export const MIME_FOR_KIND = Object.freeze({
  [ITEM_KIND.FOLDER]: MIME_FOLDER,
  [ITEM_KIND.GOOGLE_DOC]: MIME_GOOGLE_DOC,
});

/* ─── Object-folder container paths ───────────────────────── */

const { STRATEGY, INVESTMENTS_AND_PROGRAMS, INSTITUTIONAL, ARCHIVE } = CANONICAL_ROOTS;

/**
 * The canonical parent a themed object folder lives directly inside, e.g.
 * `02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education`. These parents must already exist:
 * the creator never bootstraps them.
 */
export function themedContainerSegments(area, theme) {
  return [INVESTMENTS_AND_PROGRAMS, area, theme];
}

export const OBJECT_AREAS = Object.freeze({
  PIPELINE: SEGMENTS.PIPELINE,
  PORTFOLIO: SEGMENTS.PORTFOLIO,
  VENTURE_BUILDING: SEGMENTS.VENTURE_BUILDING,
  IN_HOUSE_PROGRAMS: SEGMENTS.IN_HOUSE_PROGRAMS,
});

/** Where a policy folder lives (spec design rule 13). */
export const POLICIES_SEGMENTS = Object.freeze([INSTITUTIONAL, SEGMENTS.POLICIES]);

/** Where institutional governance forums live. */
export const GOVERNANCE_SEGMENTS = Object.freeze([INSTITUTIONAL, SEGMENTS.GOVERNANCE_AND_DECISIONS]);

/** Where annual OKR cycles live. */
export const OKR_SEGMENTS = Object.freeze([STRATEGY, SEGMENTS.OKRS]);

/** Master Registry location, used to explain Registry configuration to administrators. */
export const MASTER_REGISTRY_SEGMENTS = Object.freeze([
  INVESTMENTS_AND_PROGRAMS,
  SEGMENTS.MASTER_INDEXES,
  SEGMENTS.MASTER_REGISTRY,
]);

/**
 * Lifecycle locations scanned to warn when an object name already exists somewhere
 * incompatible. Read-only: detecting a conflicting home never triggers a move.
 */
export const LIFECYCLE_CONFLICT_SCOPES = Object.freeze([
  { label: 'Portfolio', segments: (theme) => [INVESTMENTS_AND_PROGRAMS, SEGMENTS.PORTFOLIO, theme] },
  { label: 'Declined Pipeline archive', segments: () => [ARCHIVE, SEGMENTS.DECLINED_PIPELINE] },
]);

/* ─── Registry ────────────────────────────────────────────── */

/**
 * Master Registry columns, in the order given by the specification's
 * "RECOMMENDED MINIMUM FIELDS". The Sheets adapter matches on header NAME rather than
 * position, so a differently ordered sheet still works; this order is only the
 * canonical reference used for validation and documentation.
 */
export const REGISTRY_FIELDS = Object.freeze([
  'Object_Name',
  'Theme',
  'Strategic_Focus',
  'Object_Type',
  'Current_Stage_or_Status',
  'Country_or_Geography',
  'Owner',
  'Official_Folder_Link',
  'Last_Updated',
  'Decline_or_Closure_Reason',
  'Decision_Link',
]);

/** Columns without which the Registry cannot be used safely. */
export const REGISTRY_REQUIRED_FIELDS = Object.freeze([
  'Object_Name',
  'Theme',
  'Object_Type',
  'Official_Folder_Link',
]);

/** Registry Object_Type allowlist (spec: Pipeline|Portfolio|Venture_Building|In_House_Program). */
export const REGISTRY_OBJECT_TYPES = Object.freeze({
  PIPELINE: 'Pipeline',
  PORTFOLIO: 'Portfolio',
  VENTURE_BUILDING: 'Venture_Building',
  IN_HOUSE_PROGRAM: 'In_House_Program',
});

/* ─── Helpers ─────────────────────────────────────────────── */

/** Join canonical segments into the display path used across the UI, logs and audit. */
export function joinSegments(segments) {
  return segments.join('/');
}

export function forumById(id) {
  return GOVERNANCE_FORUMS.find((f) => f.id === id) || null;
}

export function isCanonicalTheme(value) {
  return THEMES.includes(value);
}
