import { describe, it, expect } from 'vitest';
import { classifyRadar } from '../utils/radarClassify.js';
import { resolveDestination, expandTemplate, STRUCTURE_TYPES } from './structureTemplates.js';
import {
  CANONICAL_ROOTS,
  SEGMENTS,
  THEMES,
  CROSS_THEMATIC,
  OBJECT_AREAS,
  themesForArea,
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

  /**
    * Parametrized over the area's own theme list, so In-house Programs is covered for
    * Cross_Thematic as well — the one themed container outside Exploration that v06 defines
    * it in.
    */
  it.each(themesForArea(OBJECT_AREAS.IN_HOUSE_PROGRAMS))(
    'routes a %s in-house program into the same container as the creator',
    (theme) => {
      const created = resolveDestination(STRUCTURE_TYPES.IN_HOUSE_PROGRAM, {
        theme,
        objectName: 'Sample Program',
      });
      const classified = classifyRadar({
        description: 'program operations materials',
        objectName: 'Sample Program',
        context: 'inhouse',
        theme,
      });
      expect(classified.path.startsWith(created.parentPath)).toBe(true);
      expect(created.parentPath).toBe(
        joinSegments([CANONICAL_ROOTS.INVESTMENTS_AND_PROGRAMS, SEGMENTS.IN_HOUSE_PROGRAMS, theme])
      );
    }
  );

  /**
   * v06 design rule 2. Selecting Cross_Thematic must not leak it into a container the
   * canonical tree keeps to Education and Democracy — the creator rejects such an input
   * outright, so the classifier must not suggest a path the creator could never build.
   */
  it.each([
    ['pipeline', SEGMENTS.PIPELINE, 'sourcing notes for a new opportunity'],
    ['portfolio', SEGMENTS.PORTFOLIO, 'disbursement request for the investment'],
    ['venture', SEGMENTS.VENTURE_BUILDING, 'venture design and structuring materials'],
  ])('never puts Cross_Thematic inside %s', (context, segment, description) => {
    const { path } = classifyRadar({
      description,
      objectName: 'Sample Org',
      context,
      theme: CROSS_THEMATIC,
    });
    const container = joinSegments([CANONICAL_ROOTS.INVESTMENTS_AND_PROGRAMS, segment]);
    expect(path.startsWith(container)).toBe(true);
    expect(path).not.toContain(CROSS_THEMATIC);
    // The theme is reported as unresolved rather than silently replaced with a core theme.
    expect(path).toContain(`[${THEMES.join('|')}]`);
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

/**
 * The Portfolio subtree existed in two independent representations that could never be
 * compared: the classifier routed files into 05-12 (radarClassify.js) while the creator
 * refused to build them at all. Now that the additive structure exists, the two can finally be
 * held to each other — which is exactly what this harness is for.
 */
describe('Portfolio operating folders agree with the classifier', () => {
  const OPERATING_FOLDERS = [
    ['05_Onboarding', 'onboarding kickoff materials'],
    ['06_Investment_Docs', 'signed investment agreement'],
    ['07_Execution', 'execution plan and workplan'],
    ['08_Disbursements', 'disbursement request for the investment'],
    ['09_Reports', 'quarterly progress report from the grantee'],
    ['10_MEL_Evidence', 'evaluation report and MEL evidence'],
    ['11_Photos_and_Videos', 'photos from the site visit'],
    ['12_Decisions_and_Transitions', 'renewal decision record'],
  ];

  /**
   * A KNOWN, pre-existing divergence, recorded here so it is tracked rather than rediscovered.
   *
   * The classifier slugs object names for its suggested paths (`slug(object)`,
   * radarClassify.js:153) while the creator uses the administrator's text verbatim
   * (structureInputs.js naming policy). So Classify tells a user to file under
   * `.../Sample_Org/...` while the folder the creator built is `.../Sample Org/...`.
   *
   * This affects all five object types, not only Portfolio, and predates the additive
   * Portfolio structure — which is why every equivalence test above compares containers
   * rather than full object paths. Fixing it means changing Classify's output and belongs in
   * its own change; see docs/operations/create-structure.md, known limitations.
   */
  it('still differs from the creator on how an object name with spaces is rendered', () => {
    const created = resolveDestination(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS, {
      theme: 'Education',
      objectName: 'Sample Org',
    });
    const { path } = classifyRadar({
      description: 'disbursement request for the investment',
      objectName: 'Sample Org',
      context: 'portfolio',
      theme: 'Education',
    });

    expect(created.path).toContain('Sample Org');
    expect(path).toContain('Sample_Org');
  });

  it.each(THEMES)('routes a %s Portfolio object into the same container as the creator', (theme) => {
    const created = resolveDestination(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS, {
      theme,
      objectName: 'Sample Org',
    });
    expect(created.parentPath).toBe(
      joinSegments([
        CANONICAL_ROOTS.INVESTMENTS_AND_PROGRAMS,
        SEGMENTS.PORTFOLIO,
        theme,
        'Sample Org',
      ])
    );
  });

  it('builds every operating folder the classifier routes files into', () => {
    /**
     * A single-token name on purpose. The classifier slugs object names (radarClassify.js:153)
     * while the creator keeps them verbatim, so a name containing a space would fail on that
     * pre-existing divergence and mask the drift this test exists to catch — whether the two
     * agree on the eight FOLDER names. The divergence itself is asserted separately below.
     */
    const { items } = expandTemplate(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS, {
      theme: 'Education',
      objectName: 'SampleOrg',
    });
    const built = items.map((i) => i.name);

    for (const [folder, description] of OPERATING_FOLDERS) {
      const { path } = classifyRadar({
        description,
        objectName: 'SampleOrg',
        context: 'portfolio',
        theme: 'Education',
      });
      // The classifier's destination is a folder the creator actually produces.
      expect(path).toBe(
        joinSegments([
          CANONICAL_ROOTS.INVESTMENTS_AND_PROGRAMS,
          SEGMENTS.PORTFOLIO,
          'Education',
          'SampleOrg',
          folder,
        ])
      );
      expect(built).toContain(folder);
    }
  });

  /**
   * The deliberate asymmetry, asserted so nobody "fixes" it: the classifier can still route
   * into 00-04 because the move preserved them, but the creator must never plan them.
   */
  it('does not build the retained history the classifier can still route into', () => {
    const { items } = expandTemplate(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS, {
      theme: 'Education',
      objectName: 'SampleOrg',
    });
    const built = items.map((i) => i.name);

    const { path } = classifyRadar({
      description: 'overview and key contacts for the organization',
      objectName: 'SampleOrg',
      context: 'portfolio',
      theme: 'Education',
    });
    expect(path).toContain('00_Overview_and_Contacts');
    expect(built).not.toContain('00_Overview_and_Contacts');
  });
});

/**
 * The additive structure deliberately does NOT build 00-04 (the move preserved them); the
 * from-scratch structure MUST, because for a legacy object nothing preserved anything. Both
 * asymmetries are asserted so neither is "fixed" into the other.
 */
describe('the from-scratch Portfolio structure builds what the additive one omits', () => {
  const INPUTS = { theme: 'Education', objectName: 'SampleOrg', meetingLogYear: 2026 };

  it('builds the retained-history folders the additive structure leaves alone', () => {
    const legacy = expandTemplate(STRUCTURE_TYPES.EXISTING_PORTFOLIO_INVESTMENT, INPUTS)
      .items.map((i) => i.name);
    const additive = expandTemplate(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS, INPUTS)
      .items.map((i) => i.name);

    for (const name of ['00_Overview_and_Contacts', '01_Meetings', '02_Sourcing', '03_Screening', '04_Diligence']) {
      expect(legacy).toContain(name);
      expect(additive).not.toContain(name);
    }
  });

  it('builds the same operating folders as the additive structure, from one definition', () => {
    const legacy = expandTemplate(STRUCTURE_TYPES.EXISTING_PORTFOLIO_INVESTMENT, INPUTS)
      .items.map((i) => i.name);
    const additive = expandTemplate(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS, INPUTS)
      .items.map((i) => i.name);

    // Shared constant, so the two cannot drift apart.
    for (const name of additive) expect(legacy).toContain(name);
  });

  it('builds the same history folders a Pipeline object gets, from one definition', () => {
    const legacy = expandTemplate(STRUCTURE_TYPES.EXISTING_PORTFOLIO_INVESTMENT, INPUTS)
      .items.map((i) => i.relativePath.replace(/^SampleOrg\/?/, ''));
    const pipeline = expandTemplate(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, {
      ...INPUTS,
      owner: 'A',
      country: 'MX',
      strategicFocus: 'ECE',
    }).items.map((i) => i.relativePath.replace(/^SampleOrg\/?/, ''));

    // Every path a Pipeline object has, a legacy Portfolio object has too.
    for (const path of pipeline.filter(Boolean)) expect(legacy).toContain(path);
  });
});
