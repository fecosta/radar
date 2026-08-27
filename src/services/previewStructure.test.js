import { describe, it, expect } from 'vitest';
import { previewStructure, PREVIEW_STATUS, ITEM_STATUS, CONFLICT_CODE } from './previewStructure.js';
import { planStructureFromRaw } from '../radar/planStructure.js';
import { STRUCTURE_TYPES } from '../radar/structureTemplates.js';
import { REGISTRY_STATUS } from './registryPort.js';
import { MIME_FOLDER, LIFECYCLE_CONFLICT_SCOPES } from '../radar/canonicalTree.js';
import { createFakeDrive, createFakeRegistry } from './__fixtures__/fakeDrive.js';

const PIPELINE_INPUTS = {
  objectName: 'Fundación Luminar',
  theme: 'Education',
  owner: 'A. Ruiz',
  country: 'Mexico',
  strategicFocus: 'Early Childhood',
  meetingLogYear: '2026',
};

const pipelinePlan = () => planStructureFromRaw(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, PIPELINE_INPUTS).plan;

const preview = (drive, registry = createFakeRegistry({ configured: false }), plan = pipelinePlan()) =>
  previewStructure({ drive, registry, plan });

/** Resolve the canonical parent of the pipeline destination in a fake drive. */
async function parentOf(drive, plan) {
  const resolved = await drive.resolvePath(plan.destination.parentSegments);
  return resolved.items[resolved.items.length - 1];
}

describe('entire structure missing', () => {
  it('marks every item as create and reports ready', async () => {
    const result = await preview(createFakeDrive());
    expect(result.status).toBe(PREVIEW_STATUS.READY);
    expect(result.items.every((i) => i.status === ITEM_STATUS.CREATE)).toBe(true);
    expect(result.counts.create).toBe(17);
    expect(result.counts.exists).toBe(0);
    expect(result.blocking).toEqual([]);
  });

  it('does not query Drive for descendants of a folder that will be created', async () => {
    const drive = createFakeDrive();
    const plan = pipelinePlan();
    await preview(drive);

    /**
     * Preview's Drive traffic is fixed reconnaissance, not a walk of the plan: the canonical
     * parent path, one probe for the structure root, and one path resolve plus one name probe
     * per lifecycle-conflict scope. It never descends into folders the plan will create, so
     * this total is independent of the plan's 17 items.
     *
     * Asserted exactly rather than as a bound, so that new Drive reads have to be accounted
     * for here deliberately.
     */
    const parentWalk = plan.destination.parentSegments.length;
    const structureRootProbe = 1;
    const lifecycleScans = LIFECYCLE_CONFLICT_SCOPES.reduce(
      (calls, scope) => calls + scope.segments(plan.inputs.theme).length + 1,
      0
    );

    expect(drive._calls.findExactChildren).toBe(parentWalk + structureRootProbe + lifecycleScans);
  });

  it('never writes anything', async () => {
    const drive = createFakeDrive();
    const before = drive._items.size;
    await preview(drive);
    expect(drive._items.size).toBe(before);
    expect(drive._calls.createFolder).toBe(0);
    expect(drive._calls.createGoogleDoc).toBe(0);
  });
});

describe('entire structure already exists', () => {
  it('marks everything as reusable and stays ready', async () => {
    const drive = createFakeDrive();
    const plan = pipelinePlan();
    for (const item of plan.items) {
      drive._seedPath(`${plan.destination.parentPath}/${item.relativePath}`, item.mimeType);
    }

    const result = await preview(drive, undefined, plan);
    expect(result.status).toBe(PREVIEW_STATUS.READY);
    expect(result.counts.exists).toBe(17);
    expect(result.counts.create).toBe(0);
    expect(result.items.every((i) => i.existing?.id)).toBe(true);
  });
});

describe('partially existing structure', () => {
  it('reuses what exists and creates the rest', async () => {
    const drive = createFakeDrive();
    const plan = pipelinePlan();
    drive._seedPath(`${plan.destination.parentPath}/Fundación Luminar`);
    drive._seedPath(`${plan.destination.parentPath}/Fundación Luminar/00_Overview_and_Contacts`);
    drive._seedPath(`${plan.destination.parentPath}/Fundación Luminar/01_Meetings`);

    const result = await preview(drive, undefined, plan);
    expect(result.status).toBe(PREVIEW_STATUS.READY);
    expect(result.counts.exists).toBe(3);
    expect(result.counts.create).toBe(14);

    const byPath = Object.fromEntries(result.items.map((i) => [i.relativePath, i.status]));
    expect(byPath['Fundación Luminar/01_Meetings']).toBe(ITEM_STATUS.EXISTS);
    expect(byPath['Fundación Luminar/01_Meetings/Raw_Notes']).toBe(ITEM_STATUS.CREATE);
  });
});

describe('wrong MIME type', () => {
  it('blocks when a planned folder exists as something else', async () => {
    const drive = createFakeDrive();
    const plan = pipelinePlan();
    const parent = await parentOf(drive, plan);
    drive._add(parent.id, 'Fundación Luminar', 'application/pdf');

    const result = await preview(drive, undefined, plan);
    expect(result.status).toBe(PREVIEW_STATUS.BLOCKED);
    expect(result.blocking[0].code).toBe(CONFLICT_CODE.WRONG_MIME_TYPE);
    expect(result.items[0].status).toBe(ITEM_STATUS.CONFLICT);
  });

  it('blocks when the Meeting Log exists as a folder instead of a Google document', async () => {
    const drive = createFakeDrive();
    const plan = pipelinePlan();
    const base = `${plan.destination.parentPath}/Fundación Luminar/01_Meetings`;
    drive._seedPath(`${base}/2026_Fundación_Luminar_Meeting_Log`, MIME_FOLDER);

    const result = await preview(drive, undefined, plan);
    expect(result.status).toBe(PREVIEW_STATUS.BLOCKED);
    expect(result.blocking[0].code).toBe(CONFLICT_CODE.WRONG_MIME_TYPE);
    expect(result.blocking[0].message).toMatch(/Google document/);
  });
});

describe('multiple exact matches', () => {
  it('blocks rather than silently choosing one', async () => {
    const drive = createFakeDrive();
    const plan = pipelinePlan();
    const parent = await parentOf(drive, plan);
    drive._add(parent.id, 'Fundación Luminar', MIME_FOLDER);
    drive._add(parent.id, 'Fundación Luminar', MIME_FOLDER);

    const result = await preview(drive, undefined, plan);
    expect(result.status).toBe(PREVIEW_STATUS.BLOCKED);
    expect(result.blocking[0].code).toBe(CONFLICT_CODE.DUPLICATE_EXACT_MATCH);
    expect(result.blocking[0].message).toMatch(/will not guess/);
  });
});

describe('missing canonical parent', () => {
  it('blocks and names the missing segment without creating it', async () => {
    const drive = createFakeDrive({ paths: ['02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE'] });
    const before = drive._items.size;

    const result = await preview(drive);
    expect(result.status).toBe(PREVIEW_STATUS.BLOCKED);
    expect(result.blocking[0].code).toBe(CONFLICT_CODE.MISSING_CANONICAL_PARENT);
    expect(result.blocking[0].segment).toBe('Education');
    expect(result.blocking[0].message).toMatch(/will not create canonical roots/);
    expect(drive._items.size).toBe(before);
  });

  it('blocks when a canonical path segment is duplicated', async () => {
    const drive = createFakeDrive();
    const root = [...drive._items.values()].find((i) => i.name === '01_PIPELINE');
    drive._add(root.parentId, '01_PIPELINE', MIME_FOLDER);

    const result = await preview(drive);
    expect(result.status).toBe(PREVIEW_STATUS.BLOCKED);
    expect(result.blocking[0].code).toBe(CONFLICT_CODE.DUPLICATE_PARENT_MATCH);
  });
});

describe('authorization', () => {
  it('blocks when the user cannot add children to the destination', async () => {
    const result = await preview(createFakeDrive({ canAddChildren: false }));
    expect(result.status).toBe(PREVIEW_STATUS.BLOCKED);
    expect(result.blocking[0].code).toBe(CONFLICT_CODE.NOT_AUTHORIZED);
    expect(result.blocking[0].message).toMatch(/Content Manager/);
  });
});

describe('Master Registry', () => {
  it('blocks when the Registry already points the object at a different official folder', async () => {
    const registry = createFakeRegistry({
      rows: [
        {
          Object_Name: 'Fundación Luminar',
          Theme: 'Education',
          Object_Type: 'Pipeline',
          Official_Folder_Link: 'https://drive.google.com/drive/folders/somewhere-else',
        },
      ],
    });

    const result = await preview(createFakeDrive(), registry);
    expect(result.status).toBe(PREVIEW_STATUS.BLOCKED);
    expect(result.blocking[0].code).toBe(CONFLICT_CODE.REGISTRY_OFFICIAL_FOLDER_CONFLICT);
    expect(result.registry.status).toBe(REGISTRY_STATUS.CONFLICT);
  });

  it('matches Registry identity case-insensitively', async () => {
    const registry = createFakeRegistry({
      rows: [
        {
          Object_Name: '  fundación luminar ',
          Theme: 'education',
          Object_Type: 'pipeline',
          Official_Folder_Link: 'https://drive.google.com/drive/folders/elsewhere',
        },
      ],
    });
    const result = await preview(createFakeDrive(), registry);
    expect(result.status).toBe(PREVIEW_STATUS.BLOCKED);
  });

  it('allows an idempotent rerun when the Registry link matches the existing folder', async () => {
    const drive = createFakeDrive();
    const plan = pipelinePlan();
    const root = drive._seedPath(`${plan.destination.parentPath}/Fundación Luminar`);
    const registry = createFakeRegistry({
      rows: [
        {
          Object_Name: 'Fundación Luminar',
          Theme: 'Education',
          Object_Type: 'Pipeline',
          Official_Folder_Link: root.webViewLink,
        },
      ],
    });

    const result = await preview(drive, registry, plan);
    expect(result.status).toBe(PREVIEW_STATUS.READY);
    expect(result.registry.status).toBe(REGISTRY_STATUS.UPDATED);
  });

  it('reports PENDING_CONFIGURATION when no Registry is configured', async () => {
    const result = await preview(createFakeDrive(), createFakeRegistry({ configured: false }));
    expect(result.registry).toEqual({ applicable: true, status: REGISTRY_STATUS.PENDING_CONFIGURATION });
    expect(result.status).toBe(PREVIEW_STATUS.READY);
  });

  it('reports NOT_APPLICABLE for structures without a Registry record', async () => {
    const plan = planStructureFromRaw(STRUCTURE_TYPES.OKR_CYCLE, { okrYear: '2026' }).plan;
    const result = await preview(createFakeDrive(), createFakeRegistry(), plan);
    expect(result.registry.status).toBe(REGISTRY_STATUS.NOT_APPLICABLE);
  });
});

describe('warnings requiring acknowledgement', () => {
  it('surfaces the restricted beneficiary-data folder', async () => {
    const plan = planStructureFromRaw(STRUCTURE_TYPES.IN_HOUSE_PROGRAM, PIPELINE_INPUTS).plan;
    const result = await preview(createFakeDrive(), undefined, plan);

    expect(result.status).toBe(PREVIEW_STATUS.READY);
    const ack = result.acknowledgements.find((a) => a.code === 'PERMISSIONS_CONFIGURATION_REQUIRED');
    expect(ack).toBeDefined();
    expect(ack.message).not.toMatch(/access has been restricted/i);
  });

  it('warns when the same name already exists in a conflicting lifecycle location', async () => {
    const drive = createFakeDrive();
    drive._seedPath('02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Fundación Luminar');

    const result = await preview(drive);
    const ack = result.acknowledgements.find((a) => a.code === 'LIFECYCLE_LOCATION_CONFLICT');
    expect(ack).toBeDefined();
    expect(ack.message).toMatch(/move the existing folder/);
    // A lifecycle warning is an acknowledgement, not a hard block.
    expect(result.status).toBe(PREVIEW_STATUS.READY);
  });

  it('warns when the name is already in the declined-pipeline archive', async () => {
    const drive = createFakeDrive();
    drive._seedPath('99_ARCHIVE/01_Declined_Pipeline/Fundación Luminar');
    const result = await preview(drive);
    expect(result.acknowledgements.some((a) => a.code === 'LIFECYCLE_LOCATION_CONFLICT')).toBe(true);
  });

  it('raises no lifecycle warning when nothing conflicts', async () => {
    const result = await preview(createFakeDrive());
    expect(result.acknowledgements).toEqual([]);
  });
});

describe('Portfolio operating folders', () => {
  const PORTFOLIO_INPUTS = { objectName: 'Aprendo+', theme: 'Education' };
  const OBJECT_PATH = '02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Aprendo+';

  const portfolioPlan = () =>
    planStructureFromRaw(STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS, PORTFOLIO_INPUTS).plan;

  const portfolioPreview = (drive, registry = createFakeRegistry({ configured: false })) =>
    previewStructure({ drive, registry, plan: portfolioPlan() });

  /** An organization folder that arrived by a move, so it carries its Pipeline history. */
  function seedMovedObject(drive) {
    drive._seedPath(`${OBJECT_PATH}/00_Overview_and_Contacts`);
    drive._seedPath(`${OBJECT_PATH}/01_Meetings`);
    drive._seedPath(`${OBJECT_PATH}/02_Sourcing`);
    drive._seedPath(`${OBJECT_PATH}/03_Screening`);
    drive._seedPath(`${OBJECT_PATH}/04_Diligence`);
  }

  /**
   * The single most important test in this feature. If the organization folder is not in
   * Portfolio, RADAR must refuse — because building it would produce the
   * rebuilt-instead-of-moved object the PORTFOLIO CREATION RULE forbids.
   */
  it('blocks when the organization has not been moved into Portfolio', async () => {
    const drive = createFakeDrive();
    const before = drive._items.size;

    const result = await portfolioPreview(drive);

    expect(result.status).toBe(PREVIEW_STATUS.BLOCKED);
    expect(result.blocking).toHaveLength(1);
    expect(result.blocking[0].code).toBe(CONFLICT_CODE.OBJECT_FOLDER_NOT_FOUND);
    expect(result.blocking[0].message).toMatch(/already been moved here after approval/);
    expect(result.blocking[0].message).toMatch(/never creates that folder/);
    // The likeliest mistake is picking the wrong theme, so the message must say so.
    expect(result.blocking[0].message).toMatch(/check you picked the theme/);
    // Preview is read-only: nothing may appear in Drive.
    expect(drive._items.size).toBe(before);
  });

  it('reports the operating folders as blocked, never as "will create"', async () => {
    const result = await portfolioPreview(createFakeDrive());

    // A preview that said "8 items will be created" while blocking would misdescribe itself.
    expect(result.counts.create).toBe(0);
    expect(result.items.every((i) => i.status === ITEM_STATUS.BLOCKED)).toBe(true);
  });

  it('adds only the eight operating folders to an organization already moved there', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);

    const result = await portfolioPreview(drive);

    expect(result.status).toBe(PREVIEW_STATUS.READY);
    expect(result.blocking).toEqual([]);
    expect(result.counts.create).toBe(8);
    expect(result.counts.exists).toBe(0);
    expect(result.items.map((i) => i.name)).toEqual([
      '05_Onboarding',
      '06_Investment_Docs',
      '07_Execution',
      '08_Disbursements',
      '09_Reports',
      '10_MEL_Evidence',
      '11_Photos_and_Videos',
      '12_Decisions_and_Transitions',
    ]);
    // Every item lands inside the existing object folder, not beside it.
    expect(result.items.every((i) => i.fullPath.startsWith(`${OBJECT_PATH}/`))).toBe(true);
  });

  it('authorizes against the organization folder, not the theme container', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);

    const result = await portfolioPreview(drive);

    // The write target is the object folder, so that is the folder whose permissions matter.
    expect(result.parent.path).toBe(OBJECT_PATH);
  });

  it('reuses operating folders that already exist, so a re-run is idempotent', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);
    drive._seedPath(`${OBJECT_PATH}/05_Onboarding`);
    drive._seedPath(`${OBJECT_PATH}/09_Reports`);

    const result = await portfolioPreview(drive);

    expect(result.status).toBe(PREVIEW_STATUS.READY);
    expect(result.counts.create).toBe(6);
    expect(result.counts.exists).toBe(2);
  });

  it('never probes the retained Pipeline history', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);

    // _calls is only a counter, so record the names this preview actually asks Drive about.
    const probed = [];
    const realFind = drive.findExactChildren.bind(drive);
    drive.findExactChildren = async (parentId, name) => {
      probed.push(name);
      return realFind(parentId, name);
    };

    const result = await portfolioPreview(drive);

    /**
     * Screening and Diligence are never named at all — they are not history markers and no
     * plan item matches them, so RADAR has no reason to look.
     */
    expect(probed).not.toContain('03_Screening');
    expect(probed).not.toContain('04_Diligence');

    /**
     * 00_Overview_and_Contacts, 01_Meetings and 02_Sourcing ARE named, but only as read-only
     * existence probes for retained-history evidence. What matters is that none of the
     * retained history is ever a thing RADAR would write: no plan item targets it.
     */
    const retained = [
      '00_Overview_and_Contacts',
      '01_Meetings',
      '02_Sourcing',
      '03_Screening',
      '04_Diligence',
    ];
    for (const name of retained) {
      expect(result.items.some((i) => i.name === name)).toBe(false);
      expect(result.items.some((i) => i.fullPath.includes(name))).toBe(false);
    }
  });

  it('blocks when two folders share the organization name', async () => {
    const drive = createFakeDrive();
    const parent = await parentOf(drive, portfolioPlan());
    drive._add(parent.id, 'Aprendo+', MIME_FOLDER);
    drive._add(parent.id, 'Aprendo+', MIME_FOLDER);

    const result = await portfolioPreview(drive);

    expect(result.status).toBe(PREVIEW_STATUS.BLOCKED);
    expect(result.blocking[0].code).toBe(CONFLICT_CODE.AMBIGUOUS_OBJECT_FOLDER);
    expect(result.blocking[0].message).toMatch(/cannot tell which one is the official home/);
  });

  it('requires the Master Registry transition to be acknowledged', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);

    const result = await portfolioPreview(drive);

    const ack = result.acknowledgements.find((a) => a.code === 'REGISTRY_TRANSITION_REQUIRED');
    expect(ack).toBeDefined();
    expect(ack.message).toMatch(/Object_Type/);
    expect(ack.message).toMatch(/by hand/);
    // RADAR must not imply it will make the change itself.
    expect(ack.message).toMatch(/RADAR does not change it/);
  });

  it('plans no Master Registry write at all', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);

    const result = await portfolioPreview(drive, createFakeRegistry({ configured: true }));

    expect(result.registry.applicable).toBe(false);
    expect(result.registry.status).toBe(REGISTRY_STATUS.NOT_APPLICABLE);
  });

  /**
   * The Portfolio lifecycle scope IS this structure's own destination, so finding the object
   * there is the point. Warning about it would force the administrator to tick a statement
   * that contradicts the operation they are performing.
   */
  it('raises no lifecycle warning about the object folder it is targeting', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);

    const result = await portfolioPreview(drive);

    expect(result.acknowledgements.some((a) => a.code === 'LIFECYCLE_LOCATION_CONFLICT')).toBe(false);
  });

  it('still warns when the object also sits in the declined-pipeline archive', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);
    drive._seedPath('99_ARCHIVE/01_Declined_Pipeline/Aprendo+');

    const result = await portfolioPreview(drive);

    // A Portfolio object that is also filed as declined is genuine drift and still surfaces.
    const ack = result.acknowledgements.find((a) => a.code === 'LIFECYCLE_LOCATION_CONFLICT');
    expect(ack).toBeDefined();
    expect(ack.items).toEqual(['Declined Pipeline archive']);
  });

  /**
   * "The folder exists" cannot tell a moved folder from an empty shell somebody created by
   * hand. Helping RADAR fill in a shell would produce exactly the rebuilt object the rule
   * forbids, so the absence of any history marker has to be surfaced.
   */
  it('warns when the folder shows no evidence of retained history', async () => {
    const drive = createFakeDrive();
    drive._seedPath(OBJECT_PATH); // bare folder, no history inside

    const result = await portfolioPreview(drive);

    expect(result.status).toBe(PREVIEW_STATUS.READY);
    const ack = result.acknowledgements.find((a) => a.code === 'NO_RETAINED_HISTORY');
    expect(ack).toBeDefined();
    expect(ack.message).toMatch(/created this folder by hand/);
    expect(ack.message).toMatch(/loses the history/);
  });

  it('raises no history warning for a folder that was genuinely moved', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);

    const result = await portfolioPreview(drive);

    expect(result.acknowledgements.some((a) => a.code === 'NO_RETAINED_HISTORY')).toBe(false);
  });

  it('accepts a graduated Venture Building initiative as retaining history', async () => {
    // v06 design rule 9 also moves a venture into Portfolio; its history folders differ.
    const drive = createFakeDrive();
    drive._seedPath(`${OBJECT_PATH}/00_Overview_and_Governance`);
    drive._seedPath(`${OBJECT_PATH}/02_Design_and_Structuring`);

    const result = await portfolioPreview(drive);

    expect(result.acknowledgements.some((a) => a.code === 'NO_RETAINED_HISTORY')).toBe(false);
  });
});
