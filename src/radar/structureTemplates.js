/**
 * The seven canonical structures RADAR can create.
 *
 * Every template is a pure data definition plus a pure destination resolver. Nothing here
 * knows about Google Drive, React, or the network — which is what lets the whole rule set
 * be tested without credentials.
 *
 * A template's destination has three parts, and the split is the safety boundary:
 *
 *   parentSegments          canonical path that must already exist. Missing => architecture
 *                           drift, reported and never repaired.
 *   requireExistingSegments further segments that must ALSO already exist, but which are not
 *                           canonical architecture — today, an organization folder a human
 *                           moved into Portfolio. Missing => a type-specific block.
 *   createdSegments         what the plan itself creates, ending at the structure root.
 *
 * Structures deliberately NOT offered, each guarded by a test in structureTemplates.test.js:
 *
 *   A Portfolio object from scratch — approval MOVES the complete Pipeline folder to
 *     Portfolio and preserves its history (spec design rule 7 / PORTFOLIO CREATION RULE,
 *     restated for this tool at spec L394). Building a new object folder there would produce
 *     exactly the rebuilt-instead-of-moved folder the policy forbids.
 *
 *     PORTFOLIO_OPERATING_FOLDERS serves the rule's third clause — "Add subfolders 05-12
 *     after approval" — and only that clause. It creates NO object folder: its
 *     createdSegments is empty and the organization folder sits in
 *     requireExistingSegments, so `createFolder(parent, objectName)` is not merely blocked,
 *     it is never a plan item. See forbiddenDestinationReason, rules B and C.
 *
 *   The Pipeline -> Portfolio MOVE itself — RADAR has no move verb and is not getting one on
 *     this architecture (ADR 0001). A human moves the folder; RADAR then adds 05-12.
 *
 *   Root-tree bootstrap and launch seed examples — creating canonical roots or sample
 *     organizations is not normal product use. Missing roots are architecture drift and are
 *     reported, not repaired.
 *
 *   Dated Concept Review / Investment Committee packages — these are created when the gate
 *     actually happens, not preemptively for a brand-new pipeline object.
 */

import {
  CANONICAL_ROOTS,
  SEGMENTS,
  OBJECT_AREAS,
  POLICIES_SEGMENTS,
  GOVERNANCE_SEGMENTS,
  OKR_SEGMENTS,
  ITEM_KIND,
  MIME_FOR_KIND,
  REGISTRY_OBJECT_TYPES,
  themedContainerSegments,
  themesForArea,
  forumById,
  joinSegments,
} from './canonicalTree.js';

/* ─── Structure type identifiers ──────────────────────────── */

export const STRUCTURE_TYPES = Object.freeze({
  PIPELINE_ORGANIZATION: 'pipeline_organization',
  VENTURE_BUILDING_INITIATIVE: 'venture_building_initiative',
  IN_HOUSE_PROGRAM: 'in_house_program',
  POLICY: 'policy',
  GOVERNANCE_MEETING: 'governance_meeting',
  OKR_CYCLE: 'okr_cycle',
  /**
   * Deliberately not `portfolio_organization`: that id names an object-creating structure
   * this tool must never offer, and structureInputs.test.js asserts it stays unsupported.
   */
  PORTFOLIO_OPERATING_FOLDERS: 'portfolio_operating_folders',
});

/* ─── Naming helpers ──────────────────────────────────────── */

/**
 * Object token for a Google document name.
 *
 * Folder names keep the administrator's text verbatim, but RADAR has an approved DOCUMENT
 * naming convention — `YYYY-MM-DD_[Object]_[DocumentType]_[Status]_v##` (policy §3.2) — so
 * the Meeting Log document uses underscore-joined tokens. Only whitespace is transformed;
 * accents, `+`, `&`, `-` and apostrophes survive, so `Fundación Luminar` becomes
 * `Fundación_Luminar` and `Aprendo+` stays `Aprendo+`.
 */
export function documentNameToken(name) {
  return String(name).trim().replace(/\s+/g, '_');
}

/** Yearly living Meeting Log document name (spec: MEETING RULES). */
export function meetingLogName(objectName, year) {
  return `${year}_${documentNameToken(objectName)}_Meeting_Log`;
}

/* ─── Shared template fragments ───────────────────────────── */

/**
 * `01_Meetings` with the yearly living log and dated raw notes. Shared verbatim by the
 * Pipeline, Venture Building and In-house templates, which is why it is defined once.
 */
function meetingsNode(objectName, year) {
  return {
    name: '01_Meetings',
    children: [
      { name: meetingLogName(objectName, year), kind: ITEM_KIND.GOOGLE_DOC },
      { name: 'Raw_Notes', children: [{ name: String(year) }] },
    ],
  };
}

/* ─── Template definitions ────────────────────────────────── */

/**
 * A template describes:
 *   fields          which inputs the wizard collects
 *   themeArea       for themed structures, which canonical area decides the permitted themes
 *   themeHint       the guidance shown under the wizard's theme selector
 *   registry        whether a Master Registry record applies, and its Object_Type
 *   destination()   { parentSegments, requireExistingSegments?, createdSegments } — both
 *                   parentSegments and requireExistingSegments MUST already exist
 *   nodes()         the nested tree created beneath the anchor folder
 *
 * Any template collecting the `theme` field MUST declare `themeArea`: theme validity is
 * per-location in v06, never a global enum.
 */
const TEMPLATES = {
  [STRUCTURE_TYPES.PIPELINE_ORGANIZATION]: {
    id: STRUCTURE_TYPES.PIPELINE_ORGANIZATION,
    label: 'Pipeline organization',
    description:
      'A new opportunity under evaluation. Sourcing, Screening and Diligence are subfolders inside the object — advancing a stage never moves the folder.',
    objectNameLabel: 'Organization name',
    fields: ['objectName', 'theme', 'owner', 'country', 'strategicFocus', 'meetingLogYear'],
    themeArea: OBJECT_AREAS.PIPELINE,
    themeHint: 'Education and Democracy are the only themes for a Pipeline organization.',
    registry: { applicable: true, objectType: REGISTRY_OBJECT_TYPES.PIPELINE },
    destination: ({ theme, objectName }) => ({
      parentSegments: themedContainerSegments(OBJECT_AREAS.PIPELINE, theme),
      createdSegments: [objectName],
    }),
    nodes: ({ objectName, meetingLogYear }) => [
      { name: '00_Overview_and_Contacts' },
      meetingsNode(objectName, meetingLogYear),
      { name: '02_Sourcing' },
      {
        name: '03_Screening',
        children: [
          { name: '01_Concept_Note_and_Materials' },
          // Empty by design: the dated [YYYY-MM-DD_Concept_Review] package is created when
          // the gate is actually held, not when the opportunity is opened.
          { name: '02_Concept_Review' },
        ],
      },
      {
        name: '04_Diligence',
        children: [
          {
            name: '01_Investment_Due_Diligence',
            children: [
              { name: '01_Application' },
              { name: '02_Application_Review' },
              { name: '03_Peer_Reviewed_Investment_Memo' },
              // Likewise empty: the dated Investment Committee package comes later.
              { name: '04_Investment_Committee' },
            ],
          },
          { name: '02_Legal_Due_Diligence' },
        ],
      },
    ],
  },

  [STRUCTURE_TYPES.VENTURE_BUILDING_INITIATIVE]: {
    id: STRUCTURE_TYPES.VENTURE_BUILDING_INITIATIVE,
    label: 'Venture Building initiative',
    description:
      'An initiative ver+ is building. If its operating model later changes, the complete folder is moved rather than rebuilt.',
    objectNameLabel: 'Initiative name',
    fields: ['objectName', 'theme', 'owner', 'country', 'strategicFocus', 'meetingLogYear'],
    themeArea: OBJECT_AREAS.VENTURE_BUILDING,
    themeHint: 'Education and Democracy are the only themes for a Venture Building initiative.',
    registry: { applicable: true, objectType: REGISTRY_OBJECT_TYPES.VENTURE_BUILDING },
    destination: ({ theme, objectName }) => ({
      parentSegments: themedContainerSegments(OBJECT_AREAS.VENTURE_BUILDING, theme),
      createdSegments: [objectName],
    }),
    nodes: ({ objectName, meetingLogYear }) => [
      { name: '00_Overview_and_Governance' },
      meetingsNode(objectName, meetingLogYear),
      { name: '02_Design_and_Structuring' },
      { name: '03_Validation' },
      { name: '04_Implementation' },
      { name: '05_MEL_and_Learning' },
      { name: '06_Finance_and_Legal' },
      { name: '07_Partners_and_Contracts' },
      { name: '08_Comms_and_Reports' },
      { name: '09_Photos_and_Videos' },
      { name: '10_Spinoff_or_Transition' },
    ],
  },

  [STRUCTURE_TYPES.IN_HOUSE_PROGRAM]: {
    id: STRUCTURE_TYPES.IN_HOUSE_PROGRAM,
    label: 'In-house program',
    description:
      'A program ver+ operates directly. Includes a restricted participant/beneficiary data folder that needs access configured by hand after creation.',
    objectNameLabel: 'Program name',
    fields: ['objectName', 'theme', 'owner', 'country', 'strategicFocus', 'meetingLogYear'],
    themeArea: OBJECT_AREAS.IN_HOUSE_PROGRAMS,
    themeHint:
      'Use Cross_Thematic only when the program cannot reasonably be assigned to Education or Democracy (v06 Cross_Thematic rule).',
    registry: { applicable: true, objectType: REGISTRY_OBJECT_TYPES.IN_HOUSE_PROGRAM },
    destination: ({ theme, objectName }) => ({
      parentSegments: themedContainerSegments(OBJECT_AREAS.IN_HOUSE_PROGRAMS, theme),
      createdSegments: [objectName],
    }),
    nodes: ({ objectName, meetingLogYear }) => [
      { name: '00_Overview_and_Governance' },
      meetingsNode(objectName, meetingLogYear),
      { name: '02_Strategy_and_Design' },
      { name: '03_Operations' },
      { name: '04_Partners_and_Providers' },
      {
        name: '05_Participants_and_Beneficiary_Data',
        // Policy §3.2 / spec SPECIAL ACCESS RULE. RADAR marks this folder as restricted but
        // does NOT apply permissions: no group or user is invented, and the result never
        // claims access was restricted. See PERMISSIONS_CONFIGURATION_REQUIRED.
        sensitive: {
          restricted: true,
          reason:
            'Participant and beneficiary data must be limited to the roles that need it. RADAR creates this folder but cannot configure its access.',
        },
      },
      { name: '06_MEL_Evidence' },
      { name: '07_Finance_and_Legal' },
      { name: '08_Comms_and_Reports' },
      { name: '09_Photos_and_Videos' },
      { name: '10_Decisions_and_Transitions' },
    ],
  },

  [STRUCTURE_TYPES.POLICY]: {
    id: STRUCTURE_TYPES.POLICY,
    label: 'Policy',
    description:
      'An organization-wide policy and its supporting guidance. Policies live only here — use a shortcut if a function needs visibility elsewhere.',
    objectNameLabel: 'Policy name',
    fields: ['objectName'],
    registry: { applicable: false },
    destination: ({ objectName }) => ({
      parentSegments: [...POLICIES_SEGMENTS],
      createdSegments: [objectName],
    }),
    nodes: () => [
      { name: '01_Approved' },
      { name: '02_Supporting_Guidance' },
      { name: '99_Drafts' },
    ],
  },

  [STRUCTURE_TYPES.GOVERNANCE_MEETING]: {
    id: STRUCTURE_TYPES.GOVERNANCE_MEETING,
    label: 'Formal governance meeting',
    description:
      'A Board, Leadership Team, All Team or Offsite meeting package. Concept Review and Investment Committee are project gates and are never stored here.',
    fields: ['forum', 'meetingDate'],
    registry: { applicable: false },
    destination: ({ forum, meetingDate }) => {
      const definition = forumById(forum);
      const year = meetingDate.slice(0, 4);
      return {
        // The forum folder is part of the canonical root tree and must already exist.
        parentSegments: [...GOVERNANCE_SEGMENTS, definition.folder],
        // The year folder is dynamic, so the plan creates it alongside the dated package.
        createdSegments: [year, `${meetingDate}_${definition.slug}`],
      };
    },
    nodes: () => [
      { name: '01_Agenda' },
      { name: '02_PreReads' },
      { name: '03_Deck' },
      { name: '04_Notes_and_Minutes' },
      { name: '05_Decisions_and_Actions' },
    ],
  },

  [STRUCTURE_TYPES.OKR_CYCLE]: {
    id: STRUCTURE_TYPES.OKR_CYCLE,
    label: 'Annual OKR cycle',
    description:
      'One OKR folder per year. Years are never mixed in the same folder (spec: ANNUAL OKR AUTOMATION RULE).',
    fields: ['okrYear'],
    registry: { applicable: false },
    destination: ({ okrYear }) => ({
      parentSegments: [...OKR_SEGMENTS],
      createdSegments: [String(okrYear)],
    }),
    nodes: () => [
      { name: '01_Institutional' },
      { name: '02_Areas' },
      { name: '99_Drafts' },
    ],
  },

  /**
   * Spec PORTFOLIO CREATION RULE, third clause: "Add subfolders 05-12 after approval."
   *
   * This template adds those eight folders to an organization folder a human has ALREADY
   * moved into Portfolio. It deliberately does not model 00-04: those are the retained
   * Pipeline history the first two clauses protect, and listing them would both suggest
   * RADAR rebuilds them and risk creating them in a folder that legitimately lacks one.
   *
   * `createdSegments` is empty by design — see the file header.
   */
  [STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS]: {
    id: STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS,
    label: 'Portfolio operating folders',
    description:
      'Adds the post-approval operating folders 05-12 to an organization already moved into Portfolio. ' +
      'RADAR does not perform the move and never builds the object folder itself.',
    objectNameLabel: 'Organization already in Portfolio',
    fields: ['objectName', 'theme'],
    themeArea: OBJECT_AREAS.PORTFOLIO,
    themeHint:
      'Education and Democracy are the only themes in Portfolio. Pick the theme folder the ' +
      'organization was actually moved into.',
    /**
     * Drives explanatory copy only. The actual guarantee is structural: createdSegments is
     * empty, so no plan item can ever be the object folder.
     */
    requiresExistingObject: true,
    /**
     * Shown on the confirmation step. This is the only structure that writes inside a folder
     * holding irreplaceable history, so the guarantee is stated where the decision is made.
     */
    confirmNote:
      'The Sourcing, Screening and Diligence history already in this folder is not read, ' +
      'moved or changed. RADAR only adds the eight folders listed above.',
    /**
     * No Registry record. The object already has one from its Pipeline (or Venture Building)
     * life, and registrySheet matches a row on Object_Name + Theme + Object_Type — so an
     * upsert under a Portfolio type would not find that row and would APPEND a duplicate, in
     * the register the specification requires to be singular. The spec is also explicit that
     * "Human action determines status/type", so RADAR reports the change instead of making it.
     */
    registry: {
      applicable: false,
      manualTransition: {
        message:
          'The Master Registry row for this organization still records its pre-approval ' +
          'Object_Type. RADAR does not change it: a row is matched on Object_Name + Theme + ' +
          'Object_Type, so an automatic write would append a second row rather than update the ' +
          'existing one — and the specification is explicit that a human determines type and ' +
          'status. After this runs, set Object_Type to "Portfolio" and update the stage by hand. ' +
          'Confirm as well that the folder was moved here, not copied.',
      },
    },
    destination: ({ theme, objectName }) => ({
      parentSegments: themedContainerSegments(OBJECT_AREAS.PORTFOLIO, theme),
      requireExistingSegments: [objectName],
      createdSegments: [],
    }),
    nodes: () => [
      { name: '05_Onboarding' },
      { name: '06_Investment_Docs' },
      { name: '07_Execution' },
      { name: '08_Disbursements' },
      { name: '09_Reports' },
      { name: '10_MEL_Evidence' },
      // v06 AUDIOVISUAL RULE: Portfolio uses 11_, unlike Venture Building and In-house (09_).
      { name: '11_Photos_and_Videos' },
      { name: '12_Decisions_and_Transitions' },
    ],
  },
};

/* ─── Public accessors ────────────────────────────────────── */

/** Ordered list of templates for the wizard's type picker. */
export const SUPPORTED_STRUCTURES = Object.freeze(
  [
    STRUCTURE_TYPES.PIPELINE_ORGANIZATION,
    // Immediately after Pipeline: the picker then reads in lifecycle order and teaches that
    // approval moves the folder rather than building a second one.
    STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS,
    STRUCTURE_TYPES.VENTURE_BUILDING_INITIATIVE,
    STRUCTURE_TYPES.IN_HOUSE_PROGRAM,
    STRUCTURE_TYPES.POLICY,
    STRUCTURE_TYPES.GOVERNANCE_MEETING,
    STRUCTURE_TYPES.OKR_CYCLE,
  ].map((id) => {
    const t = TEMPLATES[id];
    return Object.freeze({
      id: t.id,
      label: t.label,
      description: t.description,
      objectNameLabel: t.objectNameLabel || null,
      fields: Object.freeze([...t.fields]),
      // Resolved here so the wizard renders the permitted themes without owning a list.
      themes: t.themeArea ? themesForArea(t.themeArea) : null,
      themeHint: t.themeHint || null,
      registryApplicable: t.registry.applicable,
      requiresExistingObject: Boolean(t.requiresExistingObject),
      confirmNote: t.confirmNote || null,
    });
  })
);

export function isSupportedStructureType(type) {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, type);
}

export function getTemplate(type) {
  if (!isSupportedStructureType(type)) {
    throw new Error(`Unsupported structure type: ${String(type)}`);
  }
  return TEMPLATES[type];
}

/* ─── Expansion ───────────────────────────────────────────── */

/**
 * Resolve the destination for validated inputs.
 *
 * Three-part split, because the two "must already exist" cases fail for different reasons and
 * need different messages:
 *
 *   parentSegments           canonical architecture. Missing => drift; RADAR never repairs it.
 *   requireExistingSegments  an object folder a human must have moved. Missing => that move
 *                            has not happened yet, which is a workflow step, not drift.
 *   createdSegments          what the plan creates, ending at the structure root. May be empty,
 *                            in which case the plan creates no root and `anchorSegments` is the
 *                            existing folder the nodes are added to.
 *
 * `parentPath` is the anchor — the folder plan items attach to — so it spans parentSegments
 * AND requireExistingSegments. Preview resolves and authorizes against that folder.
 */
export function resolveDestination(type, inputs) {
  const template = getTemplate(type);
  const { parentSegments, requireExistingSegments = [], createdSegments } = template.destination(inputs);
  const anchorSegments = [...parentSegments, ...requireExistingSegments];
  const segments = [...anchorSegments, ...createdSegments];
  return Object.freeze({
    parentSegments: Object.freeze([...parentSegments]),
    requireExistingSegments: Object.freeze([...requireExistingSegments]),
    createdSegments: Object.freeze([...createdSegments]),
    anchorSegments: Object.freeze([...anchorSegments]),
    segments: Object.freeze(segments),
    parentPath: joinSegments(anchorSegments),
    path: joinSegments(segments),
  });
}

/**
 * Flatten a template into ordered plan items, parents strictly before children so that
 * execution can walk the list linearly and always find its parent already resolved.
 *
 * Item paths are relative to `destination.parentSegments`, so the first item is the
 * structure root itself.
 */
export function expandTemplate(type, inputs) {
  const template = getTemplate(type);
  const destination = resolveDestination(type, inputs);
  const items = [];

  const push = (name, kind, parentKey, extra = {}) => {
    const relativePath = parentKey ? `${parentKey}/${name}` : name;
    items.push({
      key: relativePath,
      name,
      relativePath,
      fullPath: `${destination.parentPath}/${relativePath}`,
      parentKey,
      kind,
      mimeType: MIME_FOR_KIND[kind],
      ...extra,
    });
    return relativePath;
  };

  // The created chain (e.g. [YYYY] then [YYYY-MM-DD_Board]); its last element is the root.
  let parentKey = null;
  destination.createdSegments.forEach((segment, i) => {
    const isRoot = i === destination.createdSegments.length - 1;
    parentKey = push(segment, ITEM_KIND.FOLDER, parentKey, isRoot ? { isStructureRoot: true } : {});
  });

  const walk = (nodes, ancestorKey) => {
    for (const node of nodes) {
      const extra = node.sensitive ? { sensitive: node.sensitive } : {};
      const key = push(node.name, node.kind || ITEM_KIND.FOLDER, ancestorKey, extra);
      if (node.children) walk(node.children, key);
    }
  };
  walk(template.nodes(inputs), parentKey);

  return { destination, items };
}

/* ─── Guard rails ─────────────────────────────────────────── */

export const PORTFOLIO_PREFIX = `${CANONICAL_ROOTS.INVESTMENTS_AND_PROGRAMS}/${SEGMENTS.PORTFOLIO}`;

/**
 * Depth of a Portfolio object folder: 02_INVESTMENTS_AND_PROGRAMS / 02_PORTFOLIO / Theme / Org.
 * A created item at exactly this depth would BE an object folder, which only a move may produce.
 */
const PORTFOLIO_OBJECT_DEPTH = 4;

/**
 * Destinations the creator must never produce, expressed as rules over the plan's own data
 * rather than as a list of exempt structure types.
 *
 * A type-keyed allowlist was the obvious alternative and is deliberately rejected: it is
 * exactly the hole the guard exists to close, since a new type only has to add itself. These
 * rules instead describe the forbidden OUTCOME, so a future template is judged by what it
 * would write, not by its name. They are strictly stricter than the flat prefix list they
 * replace — the six original structures satisfy all three trivially.
 *
 * @param {{ path: string, createdSegments: readonly string[] }} destination
 * @param {Array<{ fullPath: string }>} items  the expanded plan items
 * @returns {string|null} the violated rule's explanation, or null when permitted
 */
export function forbiddenDestinationReason(destination, items = []) {
  // A. The archive is reachable only by a decline/closure MOVE, which does not exist. No
  //    exceptions: unlike Portfolio, there is no additive archive structure.
  if (destination.path.startsWith(CANONICAL_ROOTS.ARCHIVE)) {
    return `${CANONICAL_ROOTS.ARCHIVE} is reachable only through a decline or closure move`;
  }

  // B. Under Portfolio a plan may ADD to a folder that already exists and may create no root
  //    of its own (v06 PORTFOLIO CREATION RULE: "do not create/copy a new object folder").
  if (destination.path.startsWith(PORTFOLIO_PREFIX) && destination.createdSegments.length > 0) {
    return (
      `${PORTFOLIO_PREFIX} may only receive folders added inside an object folder that already ` +
      'exists; a Portfolio object folder is created only by moving an approved Pipeline folder'
    );
  }

  // C. Belt and braces over the actual write targets. Rule B reads a summary path; this reads
  //    every item that would be created, so a template cannot smuggle an object folder through
  //    by hiding the organization name somewhere other than createdSegments.
  const objectFolder = items.find(
    (item) =>
      item.fullPath.startsWith(PORTFOLIO_PREFIX) &&
      item.fullPath.split('/').length === PORTFOLIO_OBJECT_DEPTH
  );
  if (objectFolder) {
    return `${objectFolder.fullPath} is a Portfolio object folder, which only a lifecycle move may create`;
  }

  return null;
}
