import { describe, it, expect } from 'vitest';
import { classifyRadar } from '../utils/radarClassify.js';
import { resolveDestination, expandTemplate, STRUCTURE_TYPES } from './structureTemplates.js';
import {
  CANONICAL_ROOTS,
  SEGMENTS,
  THEMES,
  GOVERNANCE_FORUMS,
  POLICIES_SEGMENTS,
  OKR_SEGMENTS,
  joinSegments,
} from './canonicalTree.js';

/**
 * Drift guard between the canonical model and the classifier.
 *
 * `canonicalTree.js` is the single source of truth for the folder architecture. The
 * classifier in utils/radarClassify.js predates it and still builds its paths from inline
 * template literals; migrating it is a separate, staged change (AGENTS.md §4 requires
 * equivalence tests BEFORE removing duplicated definitions, and this feature is required to
 * preserve Classify behavior).
 *
 * These tests are that equivalence harness. They do not change the classifier — they fail
 * the build the moment the two representations disagree, so the duplication cannot drift
 * silently while the migration is pending.
 */

/** The classifier stamps today's date into governance paths, so pin it. */
const YEAR = new Date().getFullYear();

describe('roots agree', () => {
  it('uses the same four fixed roots the classifier routes into', () => {
    const roots = Object.values(CANONICAL_ROOTS);
    expect(roots).toEqual(['01_STRATEGY', '02_INVESTMENTS_AND_PROGRAMS', '03_INSTITUTIONAL', '99_ARCHIVE']);

    // Every classifier destination starts with one of them (or asks for more information).
    const samples = [
      'our five-year plan for the organization',
      'approved organization-wide data privacy policy',
      'sourcing notes for a new opportunity',
      'declined opportunity record',
      'organization-wide comms brand campaign',
    ];
    for (const description of samples) {
      const { path } = classifyRadar({ description, objectName: 'Sample Org', theme: 'Education' });
      expect(roots.some((root) => path.startsWith(root))).toBe(true);
    }
  });
});

describe('object containers agree', () => {
  it.each(THEMES)('routes a %s pipeline object into the same container as the creator', (theme) => {
    const created = resolveDestination(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, {
      theme,
      objectName: 'Sample Org',
    });

    const classified = classifyRadar({
      description: 'sourcing notes for a new opportunity',
      objectName: 'Sample Org',
      context: 'pipeline',
      theme,
    });

    expect(classified.path.startsWith(created.parentPath)).toBe(true);
    expect(created.parentPath).toBe(
      joinSegments([CANONICAL_ROOTS.INVESTMENTS_AND_PROGRAMS, SEGMENTS.PIPELINE, theme])
    );
  });

  it('routes a venture initiative into the same container as the creator', () => {
    const created = resolveDestination(STRUCTURE_TYPES.VENTURE_BUILDING_INITIATIVE, {
      theme: 'Democracy',
      objectName: 'Sample Venture',
    });
    const classified = classifyRadar({
      description: 'venture design and structuring materials',
      objectName: 'Sample Venture',
      context: 'venture',
      theme: 'Democracy',
    });
    expect(classified.path.startsWith(created.parentPath)).toBe(true);
  });

  it('routes an in-house program into the same container as the creator', () => {
    const created = resolveDestination(STRUCTURE_TYPES.IN_HOUSE_PROGRAM, {
      theme: 'Education',
      objectName: 'Sample Program',
    });
    const classified = classifyRadar({
      description: 'program operations materials',
      objectName: 'Sample Program',
      context: 'inhouse',
      theme: 'Education',
    });
    expect(classified.path.startsWith(created.parentPath)).toBe(true);
  });
});

describe('object subfolders agree', () => {
  /**
   * Each case: a classifier description that should land in a subfolder the creator also
   * creates. This is the tightest coupling between the two, so it is asserted folder by
   * folder rather than by prefix.
   */
  it.each([
    ['sourcing notes for a new opportunity', '02_Sourcing'],
    ['screening concept note and materials', '03_Screening/01_Concept_Note_and_Materials'],
    ['the formal investment application', '04_Diligence/01_Investment_Due_Diligence/01_Application'],
    // "application review" is deliberately absent: the classifier currently ties it with
    // 01_Application and picks the earlier rule. That is a pre-existing classifier scoring
    // bug, not canonical drift, and is recorded in __evals__/radarCases.js knownDivergences.
    [
      'peer reviewed investment memo',
      '04_Diligence/01_Investment_Due_Diligence/03_Peer_Reviewed_Investment_Memo',
    ],
    ['legal due diligence for the opportunity', '04_Diligence/02_Legal_Due_Diligence'],
  ])('classifier %s lands in a folder the creator builds: %s', (description, expectedSuffix) => {
    const classified = classifyRadar({
      description,
      objectName: 'Sample Org',
      context: 'pipeline',
      theme: 'Education',
    });
    expect(classified.path).toBe(
      `02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Sample_Org/${expectedSuffix}`
    );

    const { items } = expandTemplate(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, {
      objectName: 'Sample_Org',
      theme: 'Education',
      meetingLogYear: String(YEAR),
    });
    expect(items.some((i) => i.relativePath === `Sample_Org/${expectedSuffix}`)).toBe(true);
  });
});

describe('institutional destinations agree', () => {
  it('puts policies in the same place', () => {
    const created = resolveDestination(STRUCTURE_TYPES.POLICY, { objectName: 'Data_Privacy' });
    const classified = classifyRadar({
      description: 'approved organization-wide data privacy policy',
      objectName: 'Data Privacy',
    });

    expect(joinSegments(POLICIES_SEGMENTS)).toBe('03_INSTITUTIONAL/00_POLICIES');
    expect(created.path).toBe('03_INSTITUTIONAL/00_POLICIES/Data_Privacy');
    // The classifier routes into a subfolder of the same policy folder.
    expect(classified.path.startsWith(created.path)).toBe(true);
  });

  it.each([
    ['Board meeting minutes and decisions', 'board'],
    ['Leadership team meeting agenda', 'leadership_team'],
    ['All hands all team meeting deck', 'all_team'],
    ['institutional offsite retreat notes', 'offsites'],
  ])('puts the %s governance package under the same forum folder', (description, forumId) => {
    const forum = GOVERNANCE_FORUMS.find((f) => f.id === forumId);
    const created = resolveDestination(STRUCTURE_TYPES.GOVERNANCE_MEETING, {
      forum: forumId,
      meetingDate: `${YEAR}-06-15`,
    });
    const classified = classifyRadar({ description });

    expect(created.parentPath).toBe(
      `03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/${forum.folder}`
    );
    expect(classified.path.startsWith(`${created.parentPath}/${YEAR}`)).toBe(true);
  });

  it('puts the OKR cycle in the same year folder', () => {
    const created = resolveDestination(STRUCTURE_TYPES.OKR_CYCLE, { okrYear: String(YEAR) });
    const classified = classifyRadar({ description: 'institutional OKRs for this year' });

    expect(joinSegments(OKR_SEGMENTS)).toBe('01_STRATEGY/03_OKRs');
    expect(created.path).toBe(`01_STRATEGY/03_OKRs/${YEAR}`);
    expect(classified.path).toBe(`01_STRATEGY/03_OKRs/${YEAR}/01_Institutional`);
    expect(classified.path.startsWith(created.path)).toBe(true);
  });
});

describe('invariants both sides must honour', () => {
  it('never routes an investment gate into central Governance', () => {
    for (const description of [
      'Concept Review deck for Sample Org',
      'Investment Committee memo for Sample Org',
    ]) {
      const { path } = classifyRadar({ description, objectName: 'Sample Org', theme: 'Education' });
      expect(path).not.toContain(SEGMENTS.GOVERNANCE_AND_DECISIONS);
      expect(path).toContain(`${CANONICAL_ROOTS.INVESTMENTS_AND_PROGRAMS}/${SEGMENTS.PIPELINE}`);
    }
  });

  it('keeps the gates inside the folders the creator builds for them', () => {
    const concept = classifyRadar({
      description: 'Concept Review deck for Sample Org',
      objectName: 'Sample Org',
      theme: 'Education',
    });
    expect(concept.path).toContain('/03_Screening/02_Concept_Review/');

    const ic = classifyRadar({
      description: 'Investment Committee memo for Sample Org',
      objectName: 'Sample Org',
      theme: 'Education',
    });
    expect(ic.path).toContain('/04_Diligence/01_Investment_Due_Diligence/04_Investment_Committee/');
  });

  it('uses the same Master Registry location', () => {
    const { path } = classifyRadar({ description: 'the master registry of all opportunities' });
    expect(path).toBe(
      joinSegments([
        CANONICAL_ROOTS.INVESTMENTS_AND_PROGRAMS,
        SEGMENTS.MASTER_INDEXES,
        SEGMENTS.MASTER_REGISTRY,
      ])
    );
  });
});
