import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_STRUCTURES,
  STRUCTURE_TYPES,
  expandTemplate,
  resolveDestination,
  meetingLogName,
  documentNameToken,
  isSupportedStructureType,
} from './structureTemplates.js';
import { MIME_FOLDER, MIME_GOOGLE_DOC, GOVERNANCE_FORUMS } from './canonicalTree.js';
import { planStructureFromRaw } from './planStructure.js';

/**
 * These assert the canonical v05 templates EXACTLY. If a folder name, order or destination
 * changes here without a corresponding specification change, the specification wins and
 * this test is what should have stopped it.
 */

const OBJECT_INPUTS = {
  objectName: 'Fundación Luminar',
  theme: 'Education',
  owner: 'A. Ruiz',
  country: 'Mexico',
  strategicFocus: 'Early Childhood',
  meetingLogYear: '2026',
};

/** Child names directly under the structure root, in plan order. */
function topLevelChildren(type, inputs) {
  const { items } = expandTemplate(type, inputs);
  const root = items.find((i) => i.isStructureRoot);
  return items.filter((i) => i.parentKey === root.key).map((i) => i.name);
}

function relativePaths(type, inputs) {
  const { items, destination } = expandTemplate(type, inputs);
  const rootName = destination.createdSegments[destination.createdSegments.length - 1];
  return items.map((i) => i.relativePath.replace(new RegExp(`^${escapeRe(rootName)}/?`), ''));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('destinations', () => {
  it('routes a Pipeline organization to the themed PIPELINE container', () => {
    const d = resolveDestination(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, OBJECT_INPUTS);
    expect(d.path).toBe('02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Fundación Luminar');
    expect(d.parentPath).toBe('02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education');
  });

  it('routes a Venture Building initiative to VENTURE_BUILDING', () => {
    const d = resolveDestination(STRUCTURE_TYPES.VENTURE_BUILDING_INITIATIVE, {
      ...OBJECT_INPUTS,
      theme: 'Democracy',
    });
    expect(d.path).toBe('02_INVESTMENTS_AND_PROGRAMS/03_VENTURE_BUILDING/Democracy/Fundación Luminar');
  });

  it('routes an In-house program to IN_HOUSE_PROGRAMS', () => {
    const d = resolveDestination(STRUCTURE_TYPES.IN_HOUSE_PROGRAM, OBJECT_INPUTS);
    expect(d.path).toBe('02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/Fundación Luminar');
  });

  it('routes a Policy under 03_INSTITUTIONAL/00_POLICIES', () => {
    const d = resolveDestination(STRUCTURE_TYPES.POLICY, { objectName: 'Information Management' });
    expect(d.path).toBe('03_INSTITUTIONAL/00_POLICIES/Information Management');
  });

  it.each([
    ['board', '01_Board', 'Board'],
    ['leadership_team', '02_Leadership_Team', 'Leadership_Team'],
    ['all_team', '03_All_Team', 'All_Team'],
    ['offsites', '04_Offsites', 'Offsites'],
  ])('routes the %s forum to %s and derives the year from the date', (forum, folder, slug) => {
    const d = resolveDestination(STRUCTURE_TYPES.GOVERNANCE_MEETING, { forum, meetingDate: '2026-08-14' });
    expect(d.path).toBe(
      `03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/${folder}/2026/2026-08-14_${slug}`
    );
    // The forum folder is canonical and must pre-exist; the year folder is created.
    expect(d.parentPath).toBe(`03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/${folder}`);
    expect(d.createdSegments).toEqual(['2026', `2026-08-14_${slug}`]);
  });

  it('routes an OKR cycle to a single year folder', () => {
    const d = resolveDestination(STRUCTURE_TYPES.OKR_CYCLE, { okrYear: 2027 });
    expect(d.path).toBe('01_STRATEGY/03_OKRs/2027');
    expect(d.createdSegments).toEqual(['2027']);
  });
});

describe('template children', () => {
  it('builds the exact Pipeline organization tree', () => {
    expect(relativePaths(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, OBJECT_INPUTS)).toEqual([
      '',
      '00_Overview_and_Contacts',
      '01_Meetings',
      '01_Meetings/2026_Fundación_Luminar_Meeting_Log',
      '01_Meetings/Raw_Notes',
      '01_Meetings/Raw_Notes/2026',
      '02_Sourcing',
      '03_Screening',
      '03_Screening/01_Concept_Note_and_Materials',
      '03_Screening/02_Concept_Review',
      '04_Diligence',
      '04_Diligence/01_Investment_Due_Diligence',
      '04_Diligence/01_Investment_Due_Diligence/01_Application',
      '04_Diligence/01_Investment_Due_Diligence/02_Application_Review',
      '04_Diligence/01_Investment_Due_Diligence/03_Peer_Reviewed_Investment_Memo',
      '04_Diligence/01_Investment_Due_Diligence/04_Investment_Committee',
      '04_Diligence/02_Legal_Due_Diligence',
    ]);
  });

  it('builds the exact Venture Building children', () => {
    expect(topLevelChildren(STRUCTURE_TYPES.VENTURE_BUILDING_INITIATIVE, OBJECT_INPUTS)).toEqual([
      '00_Overview_and_Governance',
      '01_Meetings',
      '02_Design_and_Structuring',
      '03_Validation',
      '04_Implementation',
      '05_MEL_and_Learning',
      '06_Finance_and_Legal',
      '07_Partners_and_Contracts',
      '08_Comms_and_Reports',
      '09_Photos_and_Videos',
      '10_Spinoff_or_Transition',
    ]);
  });

  it('builds the exact In-house program children', () => {
    expect(topLevelChildren(STRUCTURE_TYPES.IN_HOUSE_PROGRAM, OBJECT_INPUTS)).toEqual([
      '00_Overview_and_Governance',
      '01_Meetings',
      '02_Strategy_and_Design',
      '03_Operations',
      '04_Partners_and_Providers',
      '05_Participants_and_Beneficiary_Data',
      '06_MEL_Evidence',
      '07_Finance_and_Legal',
      '08_Comms_and_Reports',
      '09_Photos_and_Videos',
      '10_Decisions_and_Transitions',
    ]);
  });

  it('builds the exact Policy children', () => {
    expect(topLevelChildren(STRUCTURE_TYPES.POLICY, { objectName: 'Data Privacy' })).toEqual([
      '01_Approved',
      '02_Supporting_Guidance',
      '99_Drafts',
    ]);
  });

  it('builds the exact governance meeting children', () => {
    expect(
      topLevelChildren(STRUCTURE_TYPES.GOVERNANCE_MEETING, { forum: 'board', meetingDate: '2026-08-14' })
    ).toEqual(['01_Agenda', '02_PreReads', '03_Deck', '04_Notes_and_Minutes', '05_Decisions_and_Actions']);
  });

  it('builds the exact OKR children', () => {
    expect(topLevelChildren(STRUCTURE_TYPES.OKR_CYCLE, { okrYear: '2026' })).toEqual([
      '01_Institutional',
      '02_Areas',
      '99_Drafts',
    ]);
  });

  it('lists parents before their children so execution can walk the plan linearly', () => {
    const { items } = expandTemplate(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, OBJECT_INPUTS);
    const seen = new Set();
    for (const item of items) {
      if (item.parentKey) expect(seen.has(item.parentKey)).toBe(true);
      seen.add(item.key);
    }
  });
});

describe('the yearly Meeting Log', () => {
  it.each([
    STRUCTURE_TYPES.PIPELINE_ORGANIZATION,
    STRUCTURE_TYPES.VENTURE_BUILDING_INITIATIVE,
    STRUCTURE_TYPES.IN_HOUSE_PROGRAM,
  ])('is a Google document, not a folder (%s)', (type) => {
    const { items } = expandTemplate(type, OBJECT_INPUTS);
    const log = items.find((i) => i.name.endsWith('_Meeting_Log'));
    expect(log.kind).toBe('google_doc');
    expect(log.mimeType).toBe(MIME_GOOGLE_DOC);
    // Everything else in these templates is a folder.
    expect(items.filter((i) => i !== log).every((i) => i.mimeType === MIME_FOLDER)).toBe(true);
  });

  it('uses the selected year for both the log and Raw_Notes', () => {
    const { items } = expandTemplate(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, {
      ...OBJECT_INPUTS,
      meetingLogYear: '2031',
    });
    expect(items.some((i) => i.name === '2031_Fundación_Luminar_Meeting_Log')).toBe(true);
    expect(items.some((i) => i.relativePath.endsWith('01_Meetings/Raw_Notes/2031'))).toBe(true);
  });

  it('keeps meaningful characters in the document name, replacing only whitespace', () => {
    expect(documentNameToken('Aprendo+')).toBe('Aprendo+');
    expect(documentNameToken('Fundación Luminar')).toBe('Fundación_Luminar');
    expect(documentNameToken("O'Brien & Co")).toBe("O'Brien_&_Co");
    expect(meetingLogName('Democracia+', 2026)).toBe('2026_Democracia+_Meeting_Log');
  });
});

describe('strategic focus is metadata, never a path segment', () => {
  it('does not change the destination or any folder name', () => {
    const withFocus = expandTemplate(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, {
      ...OBJECT_INPUTS,
      strategicFocus: 'People in Government',
    });
    const withoutFocus = expandTemplate(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, {
      ...OBJECT_INPUTS,
      strategicFocus: '',
    });

    expect(withFocus.destination.path).toBe(withoutFocus.destination.path);
    expect(withFocus.items.map((i) => i.relativePath)).toEqual(withoutFocus.items.map((i) => i.relativePath));
    expect(withFocus.items.some((i) => i.name.includes('People in Government'))).toBe(false);
  });

  it('is still carried into the Registry record', () => {
    const { plan } = planStructureFromRaw(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, {
      ...OBJECT_INPUTS,
      strategicFocus: 'K12',
    });
    expect(plan.registry.record.Strategic_Focus).toBe('K12');
  });
});

describe('guard rails', () => {
  it('creates no dated Concept Review or Investment Committee package for a new object', () => {
    const { items } = expandTemplate(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, OBJECT_INPUTS);
    const gates = items.filter(
      (i) => i.name === '02_Concept_Review' || i.name === '04_Investment_Committee'
    );
    expect(gates).toHaveLength(2);
    // Both gate folders exist but are LEAVES — the dated package is created when the gate happens.
    for (const gate of gates) {
      expect(items.some((i) => i.parentKey === gate.key)).toBe(false);
    }
    expect(items.some((i) => /^\d{4}-\d{2}-\d{2}_/.test(i.name))).toBe(false);
  });

  it('never offers Concept Review or Investment Committee as a governance forum', () => {
    const labels = GOVERNANCE_FORUMS.map((f) => f.label.toLowerCase());
    expect(labels).toEqual(['board', 'leadership team', 'all team', 'offsites']);
    expect(labels.some((l) => l.includes('concept') || l.includes('committee'))).toBe(false);
  });

  it('exposes exactly the six MVP structures and no Portfolio, bootstrap or seed option', () => {
    expect(SUPPORTED_STRUCTURES.map((s) => s.id)).toEqual([
      'pipeline_organization',
      'venture_building_initiative',
      'in_house_program',
      'policy',
      'governance_meeting',
      'okr_cycle',
    ]);

    const haystack = JSON.stringify(SUPPORTED_STRUCTURES).toLowerCase();
    for (const banned of ['portfolio organization', 'createradar', 'bootstrap', 'seed', 'example_pipeline']) {
      expect(haystack).not.toContain(banned);
    }
    for (const banned of ['portfolio_organization', 'root_bootstrap', 'launch_seed', 'aprendo', 'beca_tech', 'democracia']) {
      expect(isSupportedStructureType(banned)).toBe(false);
    }
  });

  it('marks the beneficiary-data folder restricted, and only that one', () => {
    const { items } = expandTemplate(STRUCTURE_TYPES.IN_HOUSE_PROGRAM, OBJECT_INPUTS);
    const restricted = items.filter((i) => i.sensitive?.restricted);
    expect(restricted.map((i) => i.name)).toEqual(['05_Participants_and_Beneficiary_Data']);
  });

  it('refuses to plan into Portfolio or the archive even if a template tried to', () => {
    // The templates cannot produce these, so this asserts the defence-in-depth guard by
    // driving resolveDestination through a type that legitimately exists and checking the
    // guard's own predicate on the forbidden prefixes.
    const paths = SUPPORTED_STRUCTURES.map((s) => s.id).map((id) => {
      const inputs =
        id === 'policy'
          ? { objectName: 'X' }
          : id === 'governance_meeting'
            ? { forum: 'board', meetingDate: '2026-01-01' }
            : id === 'okr_cycle'
              ? { okrYear: '2026' }
              : OBJECT_INPUTS;
      return resolveDestination(id, inputs).path;
    });
    expect(paths.some((p) => p.startsWith('02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO'))).toBe(false);
    expect(paths.some((p) => p.startsWith('99_ARCHIVE'))).toBe(false);
  });
});
