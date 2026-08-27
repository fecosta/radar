import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_STRUCTURES,
  STRUCTURE_TYPES,
  expandTemplate,
  resolveDestination,
  meetingLogName,
  documentNameToken,
  isSupportedStructureType,
  getTemplate,
  forbiddenDestinationReason,
} from './structureTemplates.js';
import { MIME_FOLDER, MIME_GOOGLE_DOC, GOVERNANCE_FORUMS, SEGMENTS } from './canonicalTree.js';
import { planStructureFromRaw } from './planStructure.js';

/**
 * These assert the canonical v06 templates EXACTLY. If a folder name, order or destination
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

/**
 * Child names directly under the structure root, in plan order.
 *
 * A structure that creates no root of its own — Portfolio operating folders, which adds to a
 * folder a human already moved — has no root item, and its top-level children are the items
 * with no parent.
 */
function topLevelChildren(type, inputs) {
  const { items } = expandTemplate(type, inputs);
  const root = items.find((i) => i.isStructureRoot);
  const rootKey = root ? root.key : null;
  return items.filter((i) => i.parentKey === rootKey).map((i) => i.name);
}

function relativePaths(type, inputs) {
  const { items, destination } = expandTemplate(type, inputs);
  const rootName = destination.createdSegments[destination.createdSegments.length - 1];
  if (!rootName) return items.map((i) => i.relativePath);
  return items.map((i) => i.relativePath.replace(new RegExp(`^${escapeRe(rootName)}/?`), ''));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Valid sample inputs for any supported structure, so invariants can iterate all of them. */
function inputsFor(id) {
  if (id === 'policy') return { objectName: 'X' };
  if (id === 'governance_meeting') return { forum: 'board', meetingDate: '2026-01-01' };
  if (id === 'okr_cycle') return { okrYear: '2026' };
  return OBJECT_INPUTS;
}

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

  /**
   * v06 SPECIAL CASE - EMERGENCY RESPONSE. No dedicated structure type: it is an In-house
   * program whose theme is Cross_Thematic, using the standard template unchanged.
   */
  it('routes a Cross_Thematic In-house program, including Emergency_Response', () => {
    const d = resolveDestination(STRUCTURE_TYPES.IN_HOUSE_PROGRAM, {
      ...OBJECT_INPUTS,
      objectName: 'Emergency_Response',
      theme: 'Cross_Thematic',
    });
    expect(d.path).toBe(
      '02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Cross_Thematic/Emergency_Response'
    );
    expect(d.parentPath).toBe('02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Cross_Thematic');

    // Same template as any other In-house program — Cross_Thematic changes only the theme.
    expect(topLevelChildren(STRUCTURE_TYPES.IN_HOUSE_PROGRAM, {
      ...OBJECT_INPUTS,
      objectName: 'Emergency_Response',
      theme: 'Cross_Thematic',
    })).toEqual(topLevelChildren(STRUCTURE_TYPES.IN_HOUSE_PROGRAM, OBJECT_INPUTS));
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

  it('exposes exactly the seven approved structures, and no from-scratch Portfolio object', () => {
    expect(SUPPORTED_STRUCTURES.map((s) => s.id)).toEqual([
      'pipeline_organization',
      // Second, so the picker reads in lifecycle order.
      'portfolio_operating_folders',
      'venture_building_initiative',
      'in_house_program',
      'policy',
      'governance_meeting',
      'okr_cycle',
    ]);

    /**
     * The additive Portfolio structure ships; a Portfolio ORGANIZATION structure still must
     * not. These bans stay exactly as they were: 'portfolio organization' names the
     * object-creating structure the PORTFOLIO CREATION RULE forbids, so any copy that drifts
     * into that phrasing is a real regression, not a false alarm.
     */
    const haystack = JSON.stringify(SUPPORTED_STRUCTURES).toLowerCase();
    for (const banned of ['portfolio organization', 'createradar', 'bootstrap', 'seed', 'example_pipeline']) {
      expect(haystack).not.toContain(banned);
    }
    for (const banned of ['portfolio_organization', 'root_bootstrap', 'launch_seed', 'aprendo', 'beca_tech', 'democracia']) {
      expect(isSupportedStructureType(banned)).toBe(false);
    }
  });

  /**
   * v06 permits Cross_Thematic only where the canonical tree defines it. Every themed
   * structure must therefore offer exactly the themes its own area allows.
   */
  it('offers Cross_Thematic only where the canonical tree defines it', () => {
    const themesById = Object.fromEntries(SUPPORTED_STRUCTURES.map((s) => [s.id, s.themes]));
    expect(themesById.pipeline_organization).toEqual(['Education', 'Democracy']);
    expect(themesById.portfolio_operating_folders).toEqual(['Education', 'Democracy']);
    expect(themesById.venture_building_initiative).toEqual(['Education', 'Democracy']);
    expect(themesById.in_house_program).toEqual(['Education', 'Democracy', 'Cross_Thematic']);
    // Unthemed structures must not acquire a theme selector.
    for (const id of ['policy', 'governance_meeting', 'okr_cycle']) {
      expect(themesById[id]).toBeNull();
    }
  });

  /**
   * 0A_EXPLORATION is pre-Pipeline staging with no template of its own (v06 lists exactly six
   * structure types). The creator must not be able to target it.
   */
  it('never resolves a destination inside 0A_EXPLORATION or the Weekly email folder', () => {
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
    expect(paths.some((p) => p.includes(SEGMENTS.EXPLORATION))).toBe(false);
    expect(paths.some((p) => p.includes(SEGMENTS.WEEKLY_EMAIL))).toBe(false);
  });

  it('marks the beneficiary-data folder restricted, and only that one', () => {
    const { items } = expandTemplate(STRUCTURE_TYPES.IN_HOUSE_PROGRAM, OBJECT_INPUTS);
    const restricted = items.filter((i) => i.sensitive?.restricted);
    expect(restricted.map((i) => i.name)).toEqual(['05_Participants_and_Beneficiary_Data']);
  });

  it('never resolves a destination inside the archive', () => {
    // 99_ARCHIVE is reachable only by a decline/closure MOVE, which does not exist. Unlike
    // Portfolio there is no additive archive structure, so this has no exceptions.
    const paths = SUPPORTED_STRUCTURES.map((s) => resolveDestination(s.id, inputsFor(s.id)).path);
    expect(paths.some((p) => p.startsWith('99_ARCHIVE'))).toBe(false);
  });

  /**
   * The load-bearing invariant of the additive Portfolio structure.
   *
   * A structure may ADD folders inside a Portfolio object folder that already exists. It may
   * never CREATE one — spec PORTFOLIO CREATION RULE: "do not create/copy a new object folder".
   * Asserted over every supported structure, so a seventh or eighth type is covered without
   * anyone remembering to extend this test.
   */
  it('creates no folder of its own anywhere under Portfolio', () => {
    for (const { id } of SUPPORTED_STRUCTURES) {
      const destination = resolveDestination(id, inputsFor(id));
      if (!destination.path.startsWith('02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO')) continue;
      expect(destination.createdSegments).toEqual([]);
    }
  });

  it('never plans an item that would be a Portfolio object folder', () => {
    for (const { id } of SUPPORTED_STRUCTURES) {
      const { items } = expandTemplate(id, inputsFor(id));
      for (const item of items) {
        const isPortfolioObjectFolder =
          item.fullPath.startsWith('02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO') &&
          item.fullPath.split('/').length === 4;
        expect(isPortfolioObjectFolder).toBe(false);
      }
    }
  });

  describe('the destination guard itself', () => {
    const ARCHIVE = { path: '99_ARCHIVE/01_Declined_Pipeline/Org', createdSegments: ['Org'] };
    const PORTFOLIO_OBJECT = {
      path: '02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Org',
      createdSegments: ['Org'],
    };
    const PORTFOLIO_ADDITIVE = {
      path: '02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Org',
      createdSegments: [],
    };

    it('refuses a hypothetical template that would build a Portfolio object folder', () => {
      expect(forbiddenDestinationReason(PORTFOLIO_OBJECT)).toMatch(/only by moving an approved/);
    });

    it('permits adding folders inside a Portfolio object folder that already exists', () => {
      expect(forbiddenDestinationReason(PORTFOLIO_ADDITIVE)).toBeNull();
    });

    it('refuses the archive even for an additive template', () => {
      expect(forbiddenDestinationReason({ ...ARCHIVE, createdSegments: [] })).toMatch(/decline or closure move/);
    });

    /**
     * Rule C. Rule B reads a summary path; this catches a template that smuggles the object
     * name into parentSegments so its createdSegments looks innocent.
     */
    it('refuses a smuggled object folder found among the plan items', () => {
      const items = [{ fullPath: '02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Org' }];
      expect(forbiddenDestinationReason(PORTFOLIO_ADDITIVE, items)).toMatch(/only a lifecycle move may create/);
    });

    it('permits an ordinary destination', () => {
      expect(
        forbiddenDestinationReason({
          path: '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Org',
          createdSegments: ['Org'],
        })
      ).toBeNull();
    });
  });
});

describe('Portfolio operating folders', () => {
  const PORTFOLIO_INPUTS = { objectName: 'Aprendo+', theme: 'Education' };

  it('targets an organization folder that must already exist, and creates no root', () => {
    const destination = resolveDestination(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS, PORTFOLIO_INPUTS);

    expect(destination.parentSegments).toEqual([
      '02_INVESTMENTS_AND_PROGRAMS',
      '02_PORTFOLIO',
      'Education',
    ]);
    expect(destination.requireExistingSegments).toEqual(['Aprendo+']);
    // The whole safety argument: nothing to create means nothing that CAN create the object.
    expect(destination.createdSegments).toEqual([]);
    expect(destination.path).toBe('02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Aprendo+');
    expect(destination.parentPath).toBe('02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Aprendo+');
  });

  it('builds exactly the eight operating folders from the specification', () => {
    // Spec DYNAMIC TEMPLATE - PORTFOLIO ORGANIZATION, subfolders 05-12.
    expect(topLevelChildren(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS, PORTFOLIO_INPUTS)).toEqual([
      '05_Onboarding',
      '06_Investment_Docs',
      '07_Execution',
      '08_Disbursements',
      '09_Reports',
      '10_MEL_Evidence',
      '11_Photos_and_Videos',
      '12_Decisions_and_Transitions',
    ]);

    const { items } = expandTemplate(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS, PORTFOLIO_INPUTS);
    expect(items).toHaveLength(8);
    // No Meeting Log document: 01_Meetings came with the move and already has one.
    expect(items.every((i) => i.kind === 'folder')).toBe(true);
    expect(items.some((i) => i.isStructureRoot)).toBe(false);
  });

  /**
   * Spec clause 2: the approval preserves Sourcing, Screening/Concept Review and Diligence.
   * Those folders must be absent from the PLAN entirely — not merely reused — so that RADAR
   * never probes, resolves or touches the retained history.
   */
  it('never plans the retained Pipeline history', () => {
    const { items } = expandTemplate(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS, PORTFOLIO_INPUTS);
    const retained = [
      '00_Overview_and_Contacts',
      '01_Meetings',
      '02_Sourcing',
      '03_Screening',
      '04_Diligence',
    ];
    for (const name of retained) {
      expect(items.some((i) => i.name === name)).toBe(false);
      expect(items.some((i) => i.relativePath.includes(name))).toBe(false);
    }
  });

  it('includes Photos_and_Videos as 11_, per the audiovisual rule', () => {
    // v06 AUDIOVISUAL RULE: Portfolio is 11_, Venture Building and In-house are 09_.
    const names = topLevelChildren(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS, PORTFOLIO_INPUTS);
    expect(names).toContain('11_Photos_and_Videos');
    expect(names).not.toContain('09_Photos_and_Videos');
  });

  it('plans no Master Registry record, but carries the manual transition advisory', () => {
    const template = getTemplate(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS);
    expect(template.registry.applicable).toBe(false);
    expect(template.registry.manualTransition.message).toMatch(/Object_Type/);
    expect(template.registry.manualTransition.message).toMatch(/by hand/);
  });

  it('declares the pre-existing-object requirement for the wizard to explain', () => {
    const entry = SUPPORTED_STRUCTURES.find((s) => s.id === STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS);
    expect(entry.requiresExistingObject).toBe(true);
    expect(entry.confirmNote).toMatch(/not read, moved or changed/);
    // Every other structure creates its own root and must not claim otherwise.
    for (const other of SUPPORTED_STRUCTURES.filter((s) => s.id !== entry.id)) {
      expect(other.requiresExistingObject).toBe(false);
    }
  });
});
