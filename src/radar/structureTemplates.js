/**
 * The six canonical structures RADAR can create.
 *
 * Every template is a pure data definition plus a pure destination resolver. Nothing here
 * knows about Google Drive, React, or the network — which is what lets the whole rule set
 * be tested without credentials.
 *
 * Structures deliberately NOT offered, each guarded by a test in structureTemplates.test.js:
 *
 *   Portfolio organization — approval MOVES the complete Pipeline folder to Portfolio and
 *     preserves its history (spec design rule 7 / PORTFOLIO CREATION RULE). Offering a
 *     "new Portfolio object" button would produce exactly the rebuilt-instead-of-moved
 *     folder the policy forbids. The transition workflow is a separate, out-of-scope feature.
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
 *   registry        whether a Master Registry record applies, and its Object_Type
 *   destination()   { parentSegments, createdSegments } — parentSegments MUST already exist
 *   nodes()         the nested tree created beneath the structure root
 */
const TEMPLATES = {
  [STRUCTURE_TYPES.PIPELINE_ORGANIZATION]: {
    id: STRUCTURE_TYPES.PIPELINE_ORGANIZATION,
    label: 'Pipeline organization',
    description:
      'A new opportunity under evaluation. Sourcing, Screening and Diligence are subfolders inside the object — advancing a stage never moves the folder.',
    objectNameLabel: 'Organization name',
    fields: ['objectName', 'theme', 'owner', 'country', 'strategicFocus', 'meetingLogYear'],
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
};

/* ─── Public accessors ────────────────────────────────────── */

/** Ordered list of templates for the wizard's type picker. */
export const SUPPORTED_STRUCTURES = Object.freeze(
  [
    STRUCTURE_TYPES.PIPELINE_ORGANIZATION,
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
      registryApplicable: t.registry.applicable,
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
 * `parentSegments` is the canonical path that must already exist — a missing segment is
 * architecture drift and blocks the operation. `createdSegments` is what the plan itself
 * creates, ending at the structure root.
 */
export function resolveDestination(type, inputs) {
  const template = getTemplate(type);
  const { parentSegments, createdSegments } = template.destination(inputs);
  const segments = [...parentSegments, ...createdSegments];
  return Object.freeze({
    parentSegments: Object.freeze([...parentSegments]),
    createdSegments: Object.freeze([...createdSegments]),
    segments: Object.freeze(segments),
    parentPath: joinSegments(parentSegments),
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

/**
 * Paths the creator must never target, asserted by tests. Portfolio is reachable only by
 * moving an approved Pipeline folder; the archive only by a decline/closure transition.
 * Neither transition exists yet, so neither destination may be produced.
 */
export const FORBIDDEN_DESTINATION_SEGMENTS = Object.freeze([
  `${CANONICAL_ROOTS.INVESTMENTS_AND_PROGRAMS}/${SEGMENTS.PORTFOLIO}`,
  CANONICAL_ROOTS.ARCHIVE,
]);
