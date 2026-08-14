import { describe, it, expect } from 'vitest';
import { previewStructure, PREVIEW_STATUS, ITEM_STATUS, CONFLICT_CODE } from './previewStructure.js';
import { planStructureFromRaw } from '../radar/planStructure.js';
import { STRUCTURE_TYPES } from '../radar/structureTemplates.js';
import { REGISTRY_STATUS } from './registryPort.js';
import { MIME_FOLDER } from '../radar/canonicalTree.js';
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
    await preview(drive);
    // 15 canonical-parent walks + 1 root probe + 2 lifecycle scans is far fewer than 17 items.
    expect(drive._calls.findExactChildren).toBeLessThan(17);
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
