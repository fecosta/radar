import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeStructure, OUTCOME, FAILURE_STAGE, EXECUTION_WARNING } from './executeStructure.js';
import { resetOperationStore, getOperationResult } from './operationStore.js';
import { planStructureFromRaw } from '../radar/planStructure.js';
import { STRUCTURE_TYPES } from '../radar/structureTemplates.js';
import { REGISTRY_STATUS } from './registryPort.js';
import { AUDIT_STATUS } from './auditPort.js';
import { DriveError, ERROR_CODE } from './driveErrors.js';
import { MIME_FOLDER } from '../radar/canonicalTree.js';
import {
  createFakeDrive,
  createFakeRegistry,
  createFakeAudit,
  CANONICAL_PARENT_PATHS,
} from './__fixtures__/fakeDrive.js';

const PIPELINE_INPUTS = {
  objectName: 'Fundación Luminar',
  theme: 'Education',
  owner: 'A. Ruiz',
  country: 'Mexico',
  strategicFocus: 'Early Childhood',
  meetingLogYear: '2026',
};

const planFor = (type = STRUCTURE_TYPES.PIPELINE_ORGANIZATION, inputs = PIPELINE_INPUTS) =>
  planStructureFromRaw(type, inputs).plan;

let counter = 0;
function run({
  drive,
  registry = createFakeRegistry(),
  audit = createFakeAudit(),
  type = STRUCTURE_TYPES.PIPELINE_ORGANIZATION,
  inputs = PIPELINE_INPUTS,
  hash,
  acknowledged = [],
  operationId,
  // Silent by default: several cases deliberately fail the audit write, and the real
  // console.error would flood the test output. The test that asserts logging passes a spy.
  logger = { error: () => {} },
} = {}) {
  counter += 1;
  return executeStructure({
    drive,
    registry,
    audit,
    structureType: type,
    rawInputs: inputs,
    confirmedPlanHash: hash ?? planFor(type, inputs).hash,
    acknowledged,
    actor: 'admin@velezreyesmas.example',
    operationId: operationId ?? `op-${counter}`,
    logger,
  });
}

beforeEach(() => {
  resetOperationStore();
});

describe('successful creation', () => {
  it('creates the whole structure and records it everywhere', async () => {
    const drive = createFakeDrive();
    const registry = createFakeRegistry();
    const audit = createFakeAudit();

    const result = await run({ drive, registry, audit });

    expect(result.outcome).toBe(OUTCOME.SUCCESS);
    expect(result.created).toHaveLength(17);
    expect(result.existing).toHaveLength(0);
    expect(result.errors).toEqual([]);
    expect(result.registry.status).toBe(REGISTRY_STATUS.CREATED);
    expect(result.audit.status).toBe(AUDIT_STATUS.RECORDED);
    expect(result.rootFolderLink).toBeTruthy();
  });

  it('places the structure at the exact canonical path', async () => {
    const drive = createFakeDrive();
    const result = await run({ drive });
    const root = result.created.find((c) => c.path.endsWith('Fundación Luminar'));
    expect(drive._pathOf(root.id)).toBe(
      '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Fundación Luminar'
    );
  });

  it('creates the Meeting Log as a Google document and everything else as folders', async () => {
    const drive = createFakeDrive();
    await run({ drive });
    expect(drive._calls.createGoogleDoc).toBe(1);
    expect(drive._calls.createFolder).toBe(16);
    const doc = [...drive._items.values()].find((i) => i.name === '2026_Fundación_Luminar_Meeting_Log');
    expect(doc.mimeType).toBe('application/vnd.google-apps.document');
  });

  it('writes the official folder link into the Registry record', async () => {
    const drive = createFakeDrive();
    const registry = createFakeRegistry();
    const result = await run({ drive, registry });
    expect(registry._rows).toHaveLength(1);
    expect(registry._rows[0].Official_Folder_Link).toBe(result.rootFolderLink);
    expect(registry._rows[0].Object_Type).toBe('Pipeline');
  });
});

describe('idempotency', () => {
  it('reuses everything on a rerun and creates nothing new', async () => {
    const drive = createFakeDrive();
    const registry = createFakeRegistry();

    const first = await run({ drive, registry });
    const created = drive._items.size;

    const second = await run({ drive, registry });

    expect(first.outcome).toBe(OUTCOME.SUCCESS);
    expect(second.outcome).toBe(OUTCOME.SUCCESS);
    expect(second.created).toHaveLength(0);
    expect(second.existing).toHaveLength(17);
    expect(drive._items.size).toBe(created);
    expect(registry._rows).toHaveLength(1);
    expect(second.registry.status).toBe(REGISTRY_STATUS.UNCHANGED);
  });

  it('creates only the missing descendants after a partial run', async () => {
    const drive = createFakeDrive();
    drive._failOnCreate('03_Screening', new Error('transient drive failure'));

    const partial = await run({ drive });
    expect(partial.outcome).toBe(OUTCOME.PARTIAL_SUCCESS);

    const retry = await run({ drive });
    expect(retry.outcome).toBe(OUTCOME.SUCCESS);
    expect(retry.existing).toHaveLength(partial.created.length);
    expect(retry.created).toHaveLength(17 - partial.created.length);
  });
});

describe('concurrency', () => {
  it('collapses two simultaneous submissions of the same operation into one run', async () => {
    const drive = createFakeDrive();
    const [a, b] = await Promise.all([
      run({ drive, operationId: 'same-key' }),
      run({ drive, operationId: 'same-key' }),
    ]);

    expect(a).toBe(b);
    expect(drive._calls.createFolder).toBe(16);
    expect(drive._calls.createGoogleDoc).toBe(1);
  });

  it('returns the stored result for a repeated request after completion', async () => {
    const drive = createFakeDrive();
    const first = await run({ drive, operationId: 'stored' });
    const again = await run({ drive, operationId: 'stored' });
    expect(again).toBe(first);
    expect(getOperationResult('stored')).toBe(first);
  });

  it('warns when a duplicate root appears alongside the one it created', async () => {
    const drive = createFakeDrive();
    const plan = planFor();
    const parent = await drive.resolvePath(plan.destination.parentSegments);
    // Simulate another administrator having created the same folder concurrently.
    drive._add(parent.items[parent.items.length - 1].id, 'Fundación Luminar', MIME_FOLDER);
    drive._seedPath(`${plan.destination.parentPath}/placeholder`);

    const result = await executeStructure({
      drive,
      registry: createFakeRegistry(),
      audit: createFakeAudit(),
      structureType: STRUCTURE_TYPES.PIPELINE_ORGANIZATION,
      rawInputs: PIPELINE_INPUTS,
      confirmedPlanHash: plan.hash,
      actor: 'a@b.example',
      operationId: 'dup-check',
    });

    // The pre-existing folder is reused, so this run is a normal idempotent success.
    expect(result.outcome).toBe(OUTCOME.SUCCESS);
    expect(result.existing.some((i) => i.name === 'Fundación Luminar')).toBe(true);
  });
});

describe('stale or tampered confirmation', () => {
  it('refuses to write when the confirmed hash does not match the regenerated plan', async () => {
    const drive = createFakeDrive();
    const result = await run({ drive, hash: 'deadbeefdeadbeef' });

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.failureStage).toBe(FAILURE_STAGE.PLAN_STALE);
    expect(result.errors[0].code).toBe('STALE_PLAN');
    expect(drive._calls.createFolder).toBe(0);
  });

  it('refuses when the inputs changed after the preview', async () => {
    const drive = createFakeDrive();
    const stalePlanHash = planFor(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, PIPELINE_INPUTS).hash;

    const result = await run({
      drive,
      inputs: { ...PIPELINE_INPUTS, objectName: 'A Different Org' },
      hash: stalePlanHash,
    });

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.failureStage).toBe(FAILURE_STAGE.PLAN_STALE);
    expect(drive._items.size).toBe(createFakeDrive()._items.size);
  });

  it('re-validates inputs and refuses invalid ones even with a matching intent', async () => {
    const drive = createFakeDrive();
    const result = await run({
      drive,
      inputs: { ...PIPELINE_INPUTS, objectName: '../../99_ARCHIVE' },
      hash: 'whatever',
    });

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.failureStage).toBe(FAILURE_STAGE.VALIDATION);
    expect(drive._calls.createFolder).toBe(0);
  });

  it('rejects a client-supplied destination override outright', async () => {
    const drive = createFakeDrive();
    const result = await run({
      drive,
      inputs: { ...PIPELINE_INPUTS, destination: '99_ARCHIVE/anything' },
      hash: 'whatever',
    });
    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.failureStage).toBe(FAILURE_STAGE.VALIDATION);
  });
});

describe('drift detected at execution time', () => {
  it('aborts when the canonical parent disappeared after preview', async () => {
    const drive = createFakeDrive({ paths: ['02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE'] });
    const result = await run({ drive });

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.failureStage).toBe(FAILURE_STAGE.REVALIDATION);
    expect(result.errors[0].code).toBe('MISSING_CANONICAL_PARENT');
    expect(drive._calls.createFolder).toBe(0);
  });

  it('aborts when a conflicting item appeared after preview', async () => {
    const drive = createFakeDrive();
    const plan = planFor();
    const parent = await drive.resolvePath(plan.destination.parentSegments);
    drive._add(parent.items[parent.items.length - 1].id, 'Fundación Luminar', 'application/pdf');

    const result = await run({ drive });
    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.errors[0].code).toBe('WRONG_MIME_TYPE');
  });
});

describe('authorization', () => {
  it('refuses an unauthorized user without attempting a write', async () => {
    const drive = createFakeDrive({ canAddChildren: false });
    const result = await run({ drive });

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.errors[0].code).toBe('NOT_AUTHORIZED');
    expect(drive._calls.createFolder).toBe(0);
  });

  it('reports a permission-denied Drive error without leaking internals', async () => {
    const drive = createFakeDrive();
    drive._failOnCreate(
      'Fundación Luminar',
      new DriveError(ERROR_CODE.PERMISSION_DENIED, { status: 403, details: { itemId: 'secret-id' } })
    );

    const result = await run({ drive });
    expect(result.outcome).toBe(OUTCOME.FAILED);
    expect(result.errors[0].code).toBe(ERROR_CODE.PERMISSION_DENIED);
    expect(result.errors[0].message).toMatch(/Content Manager access/);
    expect(result.errors[0].message).not.toContain('secret-id');
  });
});

describe('acknowledgements', () => {
  it('blocks when a required warning was not acknowledged', async () => {
    const drive = createFakeDrive();
    const result = await run({ drive, type: STRUCTURE_TYPES.IN_HOUSE_PROGRAM, acknowledged: [] });

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.failureStage).toBe(FAILURE_STAGE.ACKNOWLEDGEMENT);
    expect(drive._calls.createFolder).toBe(0);
  });

  it('proceeds once the warning is acknowledged, without claiming access was restricted', async () => {
    const drive = createFakeDrive();
    const result = await run({
      drive,
      type: STRUCTURE_TYPES.IN_HOUSE_PROGRAM,
      acknowledged: ['PERMISSIONS_CONFIGURATION_REQUIRED'],
    });

    expect(result.outcome).toBe(OUTCOME.SUCCESS);
    expect(result.created.some((i) => i.name === '05_Participants_and_Beneficiary_Data')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/access (has been|was) restricted/i);
  });
});

describe('partial failure', () => {
  it('stops, keeps what it made, deletes nothing, and never implies a rollback', async () => {
    const drive = createFakeDrive();
    drive._failOnCreate('02_Sourcing', new DriveError(ERROR_CODE.RATE_LIMITED, { status: 429 }));

    const result = await run({ drive });

    expect(result.outcome).toBe(OUTCOME.PARTIAL_SUCCESS);
    expect(result.failureStage).toBe(FAILURE_STAGE.CREATION);
    expect(result.created.length).toBeGreaterThan(0);
    expect(result.created.length).toBeLessThan(17);
    // Everything created is still in Drive.
    for (const item of result.created) expect(drive._items.has(item.id)).toBe(true);
    expect(result.errors[0].path).toContain('02_Sourcing');
  });

  it('reports plain failure when nothing was created', async () => {
    const drive = createFakeDrive();
    drive._failOnCreate('Fundación Luminar', new DriveError(ERROR_CODE.NETWORK));

    const result = await run({ drive });
    expect(result.outcome).toBe(OUTCOME.FAILED);
    expect(result.created).toHaveLength(0);
  });
});

describe('Shared Drive containment', () => {
  it('stops when a created item is reported outside the configured Shared Drive', async () => {
    const drive = createFakeDrive();
    drive._createInWrongDrive('Fundación Luminar', 'someone-elses-drive');

    const result = await run({ drive });

    expect(result.outcome).toBe(OUTCOME.FAILED);
    expect(result.errors[0].code).toBe(ERROR_CODE.CONFIGURATION);
    expect(result.errors[0].message).toMatch(/stopped for safety/);
    expect(result.created).toHaveLength(0);
  });
});

describe('Master Registry outcomes', () => {
  it('reports partial success when the Registry write fails after Drive succeeded', async () => {
    const drive = createFakeDrive();
    const registry = createFakeRegistry({ failOnUpsert: new DriveError(ERROR_CODE.API_ERROR) });

    const result = await run({ drive, registry });

    expect(result.outcome).toBe(OUTCOME.PARTIAL_SUCCESS);
    expect(result.failureStage).toBe(FAILURE_STAGE.REGISTRY);
    expect(result.registry.status).toBe(REGISTRY_STATUS.FAILED);
    // The folders really were created.
    expect(result.created).toHaveLength(17);
    expect(result.warnings.some((w) => w.message.includes('Retry'))).toBe(true);
  });

  it('does not overwrite a conflicting official folder link', async () => {
    const drive = createFakeDrive();
    const plan = planFor();
    // Seed the folder so the preview's Registry check passes, then conflict at write time.
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
    registry._rows[0].Official_Folder_Link = root.webViewLink;

    const result = await run({ drive, registry });
    expect(result.registry.status).toBe(REGISTRY_STATUS.UNCHANGED);
    expect(registry._rows[0].Official_Folder_Link).toBe(root.webViewLink);
  });

  it('warns that the Registry is pending when none is configured', async () => {
    const drive = createFakeDrive();
    const result = await run({ drive, registry: createFakeRegistry({ configured: false }) });

    expect(result.outcome).toBe(OUTCOME.SUCCESS);
    expect(result.registry.status).toBe(REGISTRY_STATUS.PENDING_CONFIGURATION);
    expect(result.warnings.some((w) => w.code === EXECUTION_WARNING.REGISTRY_PENDING)).toBe(true);
  });

  it('skips the Registry entirely for structures that do not have a record', async () => {
    const drive = createFakeDrive();
    const registry = createFakeRegistry();
    const result = await run({
      drive,
      registry,
      type: STRUCTURE_TYPES.OKR_CYCLE,
      inputs: { okrYear: '2026' },
    });

    expect(result.outcome).toBe(OUTCOME.SUCCESS);
    expect(result.registry.status).toBe(REGISTRY_STATUS.NOT_APPLICABLE);
    expect(registry._rows).toHaveLength(0);
  });
});

describe('audit trail', () => {
  it('records exactly one event per attempt, on every outcome', async () => {
    const audit = createFakeAudit();

    await run({ drive: createFakeDrive(), audit });
    await run({ drive: createFakeDrive(), audit, hash: 'stale-hash' });
    await run({ drive: createFakeDrive({ canAddChildren: false }), audit });

    expect(audit._events.map((e) => e.outcome)).toEqual([
      OUTCOME.SUCCESS,
      OUTCOME.BLOCKED,
      OUTCOME.BLOCKED,
    ]);
  });

  it('captures every field the governance playbook requires', async () => {
    const audit = createFakeAudit();
    await run({ drive: createFakeDrive(), audit });

    const event = audit._events[0];
    expect(event.actor).toBe('admin@velezreyesmas.example');
    expect(event.structureType).toBe(STRUCTURE_TYPES.PIPELINE_ORGANIZATION);
    expect(event.destinationPath).toBe(
      '02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Fundación Luminar'
    );
    expect(event.planHash).toMatch(/^[0-9a-f]{16}$/);
    expect(event.operationId).toBeTruthy();
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(event.created).toHaveLength(17);
    expect(event.created[0]).toHaveProperty('id');
    expect(event.registryResult).toBe(REGISTRY_STATUS.CREATED);
  });

  it('never records tokens or secrets, even if an error carries them', async () => {
    const drive = createFakeDrive();
    const audit = createFakeAudit();
    drive._failOnCreate(
      'Fundación Luminar',
      new DriveError(ERROR_CODE.API_ERROR, {
        details: { access_token: 'ya29.SECRET', apiKey: 'AIza-SECRET', stage: 'create_folder' },
      })
    );

    await run({ drive, audit });

    const serialized = JSON.stringify(audit._events[0]);
    expect(serialized).not.toContain('ya29.SECRET');
    expect(serialized).not.toContain('AIza-SECRET');
    expect(serialized).toContain('create_folder');
  });

  it('flags loudly when the audit write itself fails after a successful creation', async () => {
    const audit = createFakeAudit({ failOnRecord: new Error('sheet unavailable') });
    const result = await run({ drive: createFakeDrive(), audit });

    expect(result.outcome).toBe(OUTCOME.SUCCESS);
    expect(result.audit.status).toBe(AUDIT_STATUS.FAILED);
    expect(result.warnings.some((w) => w.code === EXECUTION_WARNING.AUDIT_WRITE_FAILED)).toBe(true);
  });

  /**
   * Regression: these all used to collapse into one opaque "could not be written" sentence
   * with nothing logged, which made a misconfigured audit sheet impossible to diagnose.
   */
  describe('audit failure diagnosability', () => {
    const failWith = (error) =>
      run({ drive: createFakeDrive(), audit: createFakeAudit({ failOnRecord: error }) });

    it.each([
      ['a missing spreadsheet', ERROR_CODE.NOT_FOUND, /could not be found/i],
      ['a bad header row', ERROR_CODE.CONFIGURATION, /header row is missing required/i],
      ['no access', ERROR_CODE.PERMISSION_DENIED, /refused access/i],
      ['an unenabled Sheets API', ERROR_CODE.API_NOT_ENABLED, /Sheets API is not enabled/i],
      ['an insufficient scope', ERROR_CODE.SCOPE_INSUFFICIENT, /missing the Google Sheets permission/i],
      ['an expired session', ERROR_CODE.AUTH_EXPIRED, /session expired/i],
      ['a network failure', ERROR_CODE.NETWORK, /could not be reached/i],
    ])('names the cause for %s', async (_label, code, expected) => {
      const result = await failWith(new DriveError(code));

      expect(result.audit.status).toBe(AUDIT_STATUS.FAILED);
      expect(result.audit.code).toBe(code);
      expect(result.audit.message).toMatch(expected);
      // Whatever the cause, the reader must know the Drive change happened and is unrecorded.
      expect(result.audit.message).toMatch(/DID happen but are not recorded/i);
    });

    it('advises retrying only for genuinely transient causes', async () => {
      for (const code of [ERROR_CODE.RATE_LIMITED, ERROR_CODE.TIMEOUT, ERROR_CODE.NETWORK]) {
        const result = await failWith(new DriveError(code));
        expect(result.audit.message).toMatch(/Retrying is safe/i);
      }
      // Retrying a misconfigured header row or an unenabled API would just loop.
      for (const code of [
        ERROR_CODE.NOT_FOUND,
        ERROR_CODE.CONFIGURATION,
        ERROR_CODE.API_NOT_ENABLED,
        ERROR_CODE.SCOPE_INSUFFICIENT,
      ]) {
        const result = await failWith(new DriveError(code));
        expect(result.audit.message).not.toMatch(/Retrying is safe/i);
      }
    });

    it('keeps the activation link and project number off the screen', async () => {
      // The user chose to keep Google's raw detail in the console only. The on-screen text
      // names the cause and who fixes it; the URL and project number stay in the log.
      const result = await failWith(
        new DriveError(ERROR_CODE.API_NOT_ENABLED, {
          details: {
            apiMessage:
              'Google Sheets API has not been used in project 000000000000 before or it is ' +
              'disabled. Enable it by visiting https://console.developers.google.com/apis/...',
          },
        })
      );

      expect(result.audit.message).toMatch(/Sheets API is not enabled/i);
      expect(result.audit.message).not.toMatch(/https?:\/\//);
      expect(result.audit.message).not.toMatch(/\d{9,}/);
      expect(result.audit.message).toMatch(/browser console/i);
    });

    it('logs the structured error so the console can be inspected', async () => {
      const logger = { error: vi.fn() };
      const drive = createFakeDrive();
      const plan = planFor();

      await executeStructure({
        drive,
        registry: createFakeRegistry(),
        audit: createFakeAudit({
          failOnRecord: new DriveError(ERROR_CODE.CONFIGURATION, {
            details: { stage: 'audit_header', missing: ['Plan_Hash'] },
          }),
        }),
        structureType: STRUCTURE_TYPES.PIPELINE_ORGANIZATION,
        rawInputs: PIPELINE_INPUTS,
        confirmedPlanHash: plan.hash,
        actor: 'admin@example.test',
        operationId: 'audit-log-probe',
        logger,
      });

      expect(logger.error).toHaveBeenCalledTimes(1);
      const [message, context] = logger.error.mock.calls[0];
      expect(message).toMatch(/audit write failed/i);
      expect(context.code).toBe(ERROR_CODE.CONFIGURATION);
      expect(context.operationId).toBe('audit-log-probe');
      expect(context.details.missing).toEqual(['Plan_Hash']);
    });

    it('carries no code or message when the audit succeeded', async () => {
      const result = await run({ drive: createFakeDrive(), audit: createFakeAudit() });
      expect(result.audit).toEqual({ status: AUDIT_STATUS.RECORDED, code: null, message: null });
    });
  });

  it('says plainly that no durable trail exists when audit is unconfigured', async () => {
    const audit = createFakeAudit({ configured: false });
    const result = await run({ drive: createFakeDrive(), audit });

    expect(result.audit.status).toBe(AUDIT_STATUS.NOT_CONFIGURED);
    expect(result.warnings.some((w) => w.code === EXECUTION_WARNING.AUDIT_NOT_DURABLE)).toBe(true);
  });
});

describe('Portfolio operating folders', () => {
  const PORTFOLIO_INPUTS = { objectName: 'Aprendo+', theme: 'Education' };
  const OBJECT_PATH = '02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Aprendo+';
  const TYPE = STRUCTURE_TYPES.PORTFOLIO_OPERATING_FOLDERS;
  const ACK = ['REGISTRY_TRANSITION_REQUIRED'];

  const OPERATING_FOLDERS = [
    '05_Onboarding',
    '06_Investment_Docs',
    '07_Execution',
    '08_Disbursements',
    '09_Reports',
    '10_MEL_Evidence',
    '11_Photos_and_Videos',
    '12_Decisions_and_Transitions',
  ];

  /** An organization folder that arrived by a move, so it carries its Pipeline history. */
  function seedMovedObject(drive) {
    for (const name of ['00_Overview_and_Contacts', '01_Meetings', '02_Sourcing', '03_Screening', '04_Diligence']) {
      drive._seedPath(`${OBJECT_PATH}/${name}`);
    }
  }

  const runPortfolio = (drive, extra = {}) =>
    run({ drive, type: TYPE, inputs: PORTFOLIO_INPUTS, acknowledged: ACK, ...extra });

  /**
   * THE test for this feature.
   *
   * The browser's `canCreate` gate is documented as a courtesy, so the rule that RADAR must
   * never fabricate a Portfolio object folder has to hold in executeStructure — which
   * re-plans from raw inputs and re-previews against live Drive before writing. A caller who
   * submits a perfectly valid, non-stale plan hash while the folder is absent must still get
   * nothing written.
   */
  it('writes nothing when the organization has not been moved into Portfolio', async () => {
    const drive = createFakeDrive();

    const result = await runPortfolio(drive);

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.failureStage).toBe(FAILURE_STAGE.REVALIDATION);
    expect(result.errors[0].code).toBe('OBJECT_FOLDER_NOT_FOUND');
    expect(result.created).toEqual([]);
    // Not one create call reached Drive.
    expect(drive._calls.createFolder).toBe(0);
    expect(drive._calls.createGoogleDoc).toBe(0);
  });

  it('creates only the eight operating folders and leaves the history untouched', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);
    const historyBefore = drive._childrenOf(drive._seedPath(OBJECT_PATH).id).map((c) => `${c.id}:${c.name}`);

    const result = await runPortfolio(drive);

    expect(result.outcome).toBe(OUTCOME.SUCCESS);
    expect(result.created.map((i) => i.name)).toEqual(OPERATING_FOLDERS);
    expect(drive._calls.createFolder).toBe(8);
    // No Meeting Log: 01_Meetings came with the move and already has one.
    expect(drive._calls.createGoogleDoc).toBe(0);

    // Every retained-history folder still has the same id, so none was replaced or rebuilt.
    const after = drive._childrenOf(drive._seedPath(OBJECT_PATH).id).map((c) => `${c.id}:${c.name}`);
    for (const entry of historyBefore) expect(after).toContain(entry);
  });

  it('creates the operating folders inside the existing object folder', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);

    const result = await runPortfolio(drive);

    const objectFolder = drive._seedPath(OBJECT_PATH);
    for (const item of result.created) {
      // Inside the existing folder, not beside it in the theme container.
      expect(drive._items.get(item.id).parentId).toBe(objectFolder.id);
      expect(item.path).toBe(`${OBJECT_PATH}/${item.name}`);
    }
  });

  it('refuses to write until the Master Registry transition is acknowledged', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);

    const result = await runPortfolio(drive, { acknowledged: [] });

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.failureStage).toBe(FAILURE_STAGE.ACKNOWLEDGEMENT);
    expect(drive._calls.createFolder).toBe(0);
  });

  it('writes no Master Registry row', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);
    const registry = createFakeRegistry();

    const result = await runPortfolio(drive, { registry });

    expect(result.registry.status).toBe(REGISTRY_STATUS.NOT_APPLICABLE);
    // The advisory route exists precisely because an upsert would append a duplicate row.
    expect(registry._rows).toHaveLength(0);
  });

  it('restates the Registry transition on the result and in the audit row', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);
    const audit = createFakeAudit();

    const result = await runPortfolio(drive, { audit });

    const advisory = result.warnings.find((w) => w.code === 'REGISTRY_TRANSITION_REQUIRED');
    expect(advisory).toBeDefined();
    expect(advisory.message).toMatch(/Object_Type/);
    // "Not applicable" and "a human must change it" must not read as the same thing.
    expect(result.registry.manualTransitionRequired).toBe(true);
    expect(audit._events[0].warnings).toContain('REGISTRY_TRANSITION_REQUIRED');
  });

  it('links the result at the existing organization folder', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);

    const result = await runPortfolio(drive);

    // The structure creates no root of its own, so the link must fall back to the anchor.
    expect(result.rootFolderLink).toBe(drive._seedPath(OBJECT_PATH).webViewLink);
  });

  it('is idempotent: a second run creates nothing and reuses the eight', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);

    await runPortfolio(drive);
    const second = await runPortfolio(drive);

    expect(second.outcome).toBe(OUTCOME.SUCCESS);
    expect(second.created).toEqual([]);
    expect(second.existing.map((i) => i.name)).toEqual(OPERATING_FOLDERS);
    expect(drive._calls.createFolder).toBe(8);
  });

  /**
   * The window between preview and write is real. If the folder is moved or trashed after the
   * administrator confirms, execution must notice on its re-preview rather than recreate it.
   */
  it('writes nothing if the organization folder disappears after confirmation', async () => {
    const drive = createFakeDrive();
    seedMovedObject(drive);
    const hash = planFor(TYPE, PORTFOLIO_INPUTS).hash;
    const objectFolder = drive._seedPath(OBJECT_PATH);
    drive._items.delete(objectFolder.id);

    const result = await runPortfolio(drive, { hash });

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.errors[0].code).toBe('OBJECT_FOLDER_NOT_FOUND');
    expect(drive._calls.createFolder).toBe(0);
  });
});

describe('Existing Portfolio investment', () => {
  const TYPE = STRUCTURE_TYPES.EXISTING_PORTFOLIO_INVESTMENT;
  const INPUTS = {
    objectName: 'Aprendo+',
    theme: 'Education',
    owner: 'A. Ruiz',
    country: 'Mexico',
    strategicFocus: 'Early Childhood',
    meetingLogYear: '2026',
  };
  const DESTINATION = '02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Aprendo+';

  const runLegacy = (drive, extra = {}) => run({ drive, type: TYPE, inputs: INPUTS, ...extra });

  it('builds the complete object for a grant with no home anywhere', async () => {
    const drive = createFakeDrive();

    const result = await runLegacy(drive);

    expect(result.outcome).toBe(OUTCOME.SUCCESS);
    expect(drive._calls.createFolder).toBe(24);
    expect(drive._calls.createGoogleDoc).toBe(1);
    expect(result.created.map((i) => i.name)).toContain('00_Overview_and_Contacts');
    expect(result.created.map((i) => i.name)).toContain('12_Decisions_and_Transitions');
    expect(result.rootFolderLink).toBeTruthy();
  });

  /**
   * THE write-path proof. The browser gate is a courtesy, so the precondition has to hold in
   * executeStructure, which re-plans from raw inputs and re-previews against live Drive. A
   * caller submitting a valid, non-stale hash while the object lives elsewhere gets nothing.
   */
  it('writes nothing when the object already has a home elsewhere', async () => {
    const drive = createFakeDrive();
    drive._seedPath('02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Aprendo+');

    const result = await runLegacy(drive);

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.failureStage).toBe(FAILURE_STAGE.REVALIDATION);
    expect(result.errors[0].code).toBe('OBJECT_HAS_ANOTHER_HOME');
    expect(drive._calls.createFolder).toBe(0);
    expect(drive._calls.createGoogleDoc).toBe(0);
  });

  it('writes nothing when a home appears between confirmation and the write', async () => {
    const drive = createFakeDrive();
    const hash = planFor(TYPE, INPUTS).hash;
    // Someone else files the organization while the administrator is on the confirm screen.
    drive._seedPath('02_INVESTMENTS_AND_PROGRAMS/03_VENTURE_BUILDING/Education/Aprendo+');

    const result = await runLegacy(drive, { hash });

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(drive._calls.createFolder).toBe(0);
  });

  it('never scaffolds fabricated history into an object that arrived by a move', async () => {
    const drive = createFakeDrive();
    drive._seedPath(`${DESTINATION}/02_Sourcing`);

    const result = await runLegacy(drive);

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(result.errors[0].code).toBe('OBJECT_ALREADY_IN_PORTFOLIO');
    expect(drive._calls.createFolder).toBe(0);
  });

  it('records the object in the Master Registry as Portfolio', async () => {
    const drive = createFakeDrive();
    const registry = createFakeRegistry();

    const result = await runLegacy(drive, { registry });

    expect(result.registry.status).toBe(REGISTRY_STATUS.CREATED);
    expect(registry._rows).toHaveLength(1);
    expect(registry._rows[0].Object_Type).toBe('Portfolio');
    expect(registry._rows[0].Object_Name).toBe('Aprendo+');
    // A human still owns the stage: automation must not infer an investment decision.
    expect(registry._rows[0].Current_Stage_or_Status).toBe('');
  });

  it('appends no second Registry row for an object already recorded under another type', async () => {
    const drive = createFakeDrive();
    const registry = createFakeRegistry({
      rows: [
        {
          Object_Name: 'Aprendo+',
          Theme: 'Education',
          Object_Type: 'Pipeline',
          Official_Folder_Link: 'https://drive.google.com/drive/folders/elsewhere',
        },
      ],
    });

    const result = await runLegacy(drive, { registry });

    expect(result.outcome).toBe(OUTCOME.BLOCKED);
    expect(registry._rows).toHaveLength(1);
    expect(drive._calls.createFolder).toBe(0);
  });
});

describe('BecaTech+ partner or provider', () => {
  const TYPE = STRUCTURE_TYPES.BECA_TECH_PARTNER_OR_PROVIDER;
  const BASE = '02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/BecaTech+/04_Partners_and_Providers';
  const INPUTS = { organizationKind: 'provider', objectName: 'Acme Foundation' };
  const becaDrive = () => createFakeDrive({ paths: [...CANONICAL_PARENT_PATHS, `${BASE}/Partners`, `${BASE}/Providers`] });

  it('creates only the organization and its three folders, audited, with no Registry write', async () => {
    const drive = becaDrive();
    const registry = createFakeRegistry();
    const upsert = vi.spyOn(registry, 'upsert');
    const audit = createFakeAudit();

    const result = await run({ drive, registry, audit, type: TYPE, inputs: INPUTS });

    expect(result.outcome).toBe(OUTCOME.SUCCESS);
    expect(result.created.map((c) => c.path)).toEqual([
      `${BASE}/Providers/Acme Foundation`,
      `${BASE}/Providers/Acme Foundation/Proposal`,
      `${BASE}/Providers/Acme Foundation/Agreement`,
      `${BASE}/Providers/Acme Foundation/Reports`,
    ]);
    expect(drive._calls.createFolder).toBe(4);
    expect(drive._calls.createGoogleDoc).toBe(0);
    expect(result.registry.status).toBe(REGISTRY_STATUS.NOT_APPLICABLE);
    expect(upsert).not.toHaveBeenCalled();
    expect(audit._events[0]).toMatchObject({ structureType: TYPE, destinationPath: `${BASE}/Providers/Acme Foundation` });
  });

  it('is idempotent on a second identical run', async () => {
    const drive = becaDrive();
    await run({ drive, type: TYPE, inputs: INPUTS });
    const second = await run({ drive, type: TYPE, inputs: INPUTS });
    expect(second.outcome).toBe(OUTCOME.SUCCESS);
    expect(second.created).toHaveLength(0);
    expect(second.existing).toHaveLength(4);
  });

  it('never creates a missing Providers folder', async () => {
    const drive = createFakeDrive({ paths: [...CANONICAL_PARENT_PATHS, `${BASE}/Partners`] });
    const result = await run({ drive, type: TYPE, inputs: INPUTS });
    expect(result.outcome).not.toBe(OUTCOME.SUCCESS);
    expect(drive._calls.createFolder).toBe(0);
  });

  it('reports a partial failure precisely and completes on retry', async () => {
    const drive = becaDrive();
    drive._failOnCreate('Agreement', new Error('transient drive failure'));

    const partial = await run({ drive, type: TYPE, inputs: INPUTS });
    expect(partial.outcome).toBe(OUTCOME.PARTIAL_SUCCESS);
    expect(partial.created.map((c) => c.path.split('/').pop())).toEqual(['Acme Foundation', 'Proposal']);

    const retry = await run({ drive, type: TYPE, inputs: INPUTS });
    expect(retry.outcome).toBe(OUTCOME.SUCCESS);
    expect(retry.existing).toHaveLength(2);
    expect(retry.created.map((c) => c.path.split('/').pop())).toEqual(['Agreement', 'Reports']);
  });
});
