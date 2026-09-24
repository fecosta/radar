/**
 * RADAR v06 canonical folder model — the single source of truth.
 *
 * Derived from "RADAR v06 — CANONICAL FOLDER TREE / AUTOMATION SPEC"
 * (docs/specs/2026-08-18_RADAR_Folder_Tree_v06.txt) and the approved
 * RADAR Information & File Management Policy. Governance documents outrank this file:
 * if they disagree, the specification wins and this file is the bug.
 *
 * Everything downstream — destination resolution, template expansion, preview, execution
 * and tests — reads from here. Nothing re-declares a folder name of its own.
 *
 * Deliberately NOT modelled here:
 *   - the full root-tree bootstrap; missing canonical roots are reported
 *     as architecture drift, never created;
 *   - launch seed / example objects;
 *   - the lifecycle MOVES themselves (Pipeline → Portfolio, decline, graduation). RADAR has
 *     no move verb and is not getting one on this architecture (ADR 0001). The additive half
 *     of the Portfolio transition — adding the operating folders 05-12 to a folder a human
 *     already moved — does ship; see ADR 0004 and structureTemplates.js.
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

/**
 * Spec design rule 2. The two core programmatic themes. Required wherever a theme appears,
 * and an allowlist rather than free text.
 */
export const THEMES = Object.freeze(['Education', 'Democracy']);

/**
 * Spec design rule 2 / v06 "Cross_Thematic rule": used ONLY where the canonical tree
 * explicitly defines it, and explicitly "not a general 'other' folder". There is therefore
 * no global theme enum containing it — see THEMES_BY_AREA.
 */
export const CROSS_THEMATIC = 'Cross_Thematic';

/** The theme list for locations v06 permits Cross_Thematic in. */
export const THEMES_WITH_CROSS_THEMATIC = Object.freeze([...THEMES, CROSS_THEMATIC]);

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
  // v06 design rule 18: pre-Pipeline staging, inside 02_ — not a fifth canonical root.
  EXPLORATION: '0A_EXPLORATION',
  PIPELINE: '01_PIPELINE',
  PORTFOLIO: '02_PORTFOLIO',
  VENTURE_BUILDING: '03_VENTURE_BUILDING',
  IN_HOUSE_PROGRAMS: '04_IN_HOUSE_PROGRAMS',
  /**
   * Spelled as the live Shared Drive folder is, confirmed by the RADAR Owner (ADR 0006). The
   * specification prose says "Beca Tech" and names no folder literal. The classifier reads
   * this constant, so the two cannot disagree on it.
   */
  BECA_TECH: 'BecaTech+',
  PARTNERS_AND_PROVIDERS: '04_Partners_and_Providers',

  // 03_INSTITUTIONAL
  POLICIES: '00_POLICIES',
  GOVERNANCE_AND_DECISIONS: '01_GOVERNANCE_AND_DECISIONS',
  /**
   * v06 WEEKLY EMAIL RULE, spelled as the live Shared Drive folder spells it.
   *
   * The v06 specification text still reads `05_Weekly email` — one space, lowercase — and the
   * folder was since renamed to snake_case, matching the rest of the tree. The RADAR Owner
   * chose to follow the Drive, so this literal does, because a path the classifier hands out
   * has to resolve. The specification text needs the same correction; until it lands, this is
   * a known and recorded divergence from precedence authority #2. See ADR 0003.
   */
  WEEKLY_EMAIL: '05_Weekly_Email',

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
  EXPLORATION: SEGMENTS.EXPLORATION,
  PIPELINE: SEGMENTS.PIPELINE,
  PORTFOLIO: SEGMENTS.PORTFOLIO,
  VENTURE_BUILDING: SEGMENTS.VENTURE_BUILDING,
  IN_HOUSE_PROGRAMS: SEGMENTS.IN_HOUSE_PROGRAMS,
});

/**
 * Which themes each themed container accepts.
 *
 * Deliberately per-area rather than one global enum: v06 design rule 2 permits
 * Cross_Thematic only where the canonical tree defines it, so a Cross_Thematic Pipeline
 * organization or Venture Building initiative must remain impossible to express.
 */
export const THEMES_BY_AREA = Object.freeze({
  [OBJECT_AREAS.EXPLORATION]: THEMES_WITH_CROSS_THEMATIC,
  [OBJECT_AREAS.PIPELINE]: THEMES,
  [OBJECT_AREAS.PORTFOLIO]: THEMES,
  [OBJECT_AREAS.VENTURE_BUILDING]: THEMES,
  [OBJECT_AREAS.IN_HOUSE_PROGRAMS]: THEMES_WITH_CROSS_THEMATIC,
});

/** Where a policy folder lives (spec design rule 13). */
export const POLICIES_SEGMENTS = Object.freeze([INSTITUTIONAL, SEGMENTS.POLICIES]);

/** Where institutional governance forums live. */
export const GOVERNANCE_SEGMENTS = Object.freeze([INSTITUTIONAL, SEGMENTS.GOVERNANCE_AND_DECISIONS]);

/**
 * Central home for the recurring weekly email package (v06 WEEKLY EMAIL RULE).
 *
 * Restricted to the Leadership Team. RADAR records that fact and never applies it: the
 * restriction is a Drive "Limited access" setting applied by a Shared Drive manager.
 * See docs/operations/access-control.md.
 */
export const WEEKLY_EMAIL_SEGMENTS = Object.freeze([
  INSTITUTIONAL,
  SEGMENTS.GOVERNANCE_AND_DECISIONS,
  SEGMENTS.WEEKLY_EMAIL,
]);

/**
 * BecaTech+'s partner/provider area (ADR 0006). BecaTech+-specific: the generic
 * In-house Program template creates `04_Partners_and_Providers` empty and nothing more.
 */
export const BECA_TECH_PARTNERS_AND_PROVIDERS_SEGMENTS = Object.freeze([
  INVESTMENTS_AND_PROGRAMS,
  SEGMENTS.IN_HOUSE_PROGRAMS,
  'Education',
  SEGMENTS.BECA_TECH,
  SEGMENTS.PARTNERS_AND_PROVIDERS,
]);

/**
 * The two organization containers under Beca Tech's `04_Partners_and_Providers`. A closed
 * allowlist, like GOVERNANCE_FORUMS: `structureInputs` validates the id against it, so no
 * other container can be reached. Both folders must already exist; RADAR never creates them.
 */
export const BECA_TECH_ORGANIZATION_KINDS = Object.freeze([
  { id: 'partner', label: 'Partner', folder: 'Partners' },
  { id: 'provider', label: 'Provider', folder: 'Providers' },
]);

export function becaTechOrganizationKindById(id) {
  return BECA_TECH_ORGANIZATION_KINDS.find((k) => k.id === id) || null;
}

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
  /**
   * v06 design rule 19: once a formal object exists, its exploration material moves into it
   * and no second official home is kept. Every exploration theme is checked, because an
   * exploration filed as Cross_Thematic can graduate into an Education or Democracy object.
   */
  ...THEMES_WITH_CROSS_THEMATIC.map((theme) => ({
    label: `Exploration (${theme})`,
    segments: () => [INVESTMENTS_AND_PROGRAMS, SEGMENTS.EXPLORATION, theme],
  })),
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

/**
 * Registry Object_Type allowlist
 * (spec: Exploration|Pipeline|Portfolio|Venture_Building|In_House_Program).
 *
 * EXPLORATION is recorded for hand-maintained Registry rows: v06 keeps explorations visible
 * in the Registry and Opportunity Map even when no dedicated folder exists, and no structure
 * type creates one.
 */
export const REGISTRY_OBJECT_TYPES = Object.freeze({
  EXPLORATION: 'Exploration',
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

/** The themes a themed container accepts. Throws for an area with no declared rule. */
export function themesForArea(area) {
  const themes = THEMES_BY_AREA[area];
  if (!themes) {
    throw new Error(`No canonical theme rule for area: ${String(area)}`);
  }
  return themes;
}

/** Is `value` a permitted theme *for this area*? Theme validity is never global. */
export function isCanonicalTheme(value, area) {
  return themesForArea(area).includes(value);
}
