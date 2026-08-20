import { describe, it, expect } from 'vitest';
import { planStructure, planStructureFromRaw, planRootItem, PLAN_WARNING } from './planStructure.js';
import { STRUCTURE_TYPES } from './structureTemplates.js';
import { stableHash, canonicalSerialize } from './planHash.js';

const PIPELINE = {
  objectName: 'Fundación Luminar',
  theme: 'Education',
  owner: 'A. Ruiz',
  country: 'Mexico',
  strategicFocus: 'Early Childhood',
  meetingLogYear: 2026,
};

describe('determinism', () => {
  it('produces an identical plan and hash for identical inputs', () => {
    const a = planStructure(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, PIPELINE);
    const b = planStructure(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, PIPELINE);
    expect(a.hash).toBe(b.hash);
    expect(a.items).toEqual(b.items);
  });

  it('is insensitive to input property order', () => {
    const reordered = {
      meetingLogYear: 2026,
      strategicFocus: 'Early Childhood',
      country: 'Mexico',
      owner: 'A. Ruiz',
      theme: 'Education',
      objectName: 'Fundación Luminar',
    };
    expect(planStructure(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, reordered).hash).toBe(
      planStructure(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, PIPELINE).hash
    );
  });

  it.each([
    ['the object name', { objectName: 'Other Org' }],
    ['the theme', { theme: 'Democracy' }],
    ['the meeting log year', { meetingLogYear: 2027 }],
    ['registry metadata', { owner: 'Someone Else' }],
  ])('changes the hash when %s changes', (_label, patch) => {
    const base = planStructure(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, PIPELINE);
    const changed = planStructure(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, { ...PIPELINE, ...patch });
    expect(changed.hash).not.toBe(base.hash);
  });

  it('gives different structure types different hashes for the same name', () => {
    const a = planStructure(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, PIPELINE);
    const b = planStructure(STRUCTURE_TYPES.VENTURE_BUILDING_INITIATIVE, PIPELINE);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('canonical serialization', () => {
  it('sorts object keys at every depth but preserves array order', () => {
    expect(canonicalSerialize({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(canonicalSerialize([3, 1, 2])).toBe('[3,1,2]');
    expect(stableHash([1, 2])).not.toBe(stableHash([2, 1]));
  });

  it('returns a fixed-width hex digest', () => {
    expect(stableHash({ any: 'value' })).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('plan contents', () => {
  it('carries everything needed to preview, execute, report and audit', () => {
    const plan = planStructure(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, PIPELINE);
    expect(plan.planVersion).toBe('radar-v06');
    expect(plan.structureType).toBe(STRUCTURE_TYPES.PIPELINE_ORGANIZATION);
    expect(plan.inputs).toEqual(PIPELINE);
    expect(plan.destination.path).toContain('Fundación Luminar');
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.hash).toBeTruthy();
  });

  it('marks exactly one structure root', () => {
    const plan = planStructure(STRUCTURE_TYPES.GOVERNANCE_MEETING, {
      forum: 'board',
      meetingDate: '2026-08-14',
    });
    expect(plan.items.filter((i) => i.isStructureRoot)).toHaveLength(1);
    expect(planRootItem(plan).name).toBe('2026-08-14_Board');
  });

  it('warns that a restricted folder still needs permissions configured', () => {
    const plan = planStructure(STRUCTURE_TYPES.IN_HOUSE_PROGRAM, PIPELINE);
    const warning = plan.warnings.find((w) => w.code === PLAN_WARNING.PERMISSIONS_CONFIGURATION_REQUIRED);
    expect(warning).toBeDefined();
    expect(warning.items).toEqual(['Fundación Luminar/05_Participants_and_Beneficiary_Data']);
    // It must not claim anything was restricted.
    expect(warning.message).toMatch(/cannot configure its access/);
  });

  it('raises no permission warning for structures without a restricted folder', () => {
    expect(planStructure(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, PIPELINE).warnings).toEqual([]);
    expect(planStructure(STRUCTURE_TYPES.OKR_CYCLE, { okrYear: 2026 }).warnings).toEqual([]);
  });
});

describe('registry plan', () => {
  it.each([
    [STRUCTURE_TYPES.PIPELINE_ORGANIZATION, 'Pipeline'],
    [STRUCTURE_TYPES.VENTURE_BUILDING_INITIATIVE, 'Venture_Building'],
    [STRUCTURE_TYPES.IN_HOUSE_PROGRAM, 'In_House_Program'],
  ])('applies to %s with Object_Type %s', (type, objectType) => {
    const plan = planStructure(type, PIPELINE);
    expect(plan.registry.applicable).toBe(true);
    expect(plan.registry.objectType).toBe(objectType);
    expect(plan.registry.identity).toEqual({
      objectName: 'Fundación Luminar',
      theme: 'Education',
      objectType,
    });
  });

  it('never infers a stage or status — a human decides that', () => {
    const plan = planStructure(STRUCTURE_TYPES.PIPELINE_ORGANIZATION, PIPELINE);
    expect(plan.registry.record.Current_Stage_or_Status).toBe('');
  });

  it.each([
    [STRUCTURE_TYPES.POLICY, { objectName: 'Data Privacy' }],
    [STRUCTURE_TYPES.GOVERNANCE_MEETING, { forum: 'board', meetingDate: '2026-08-14' }],
    [STRUCTURE_TYPES.OKR_CYCLE, { okrYear: 2026 }],
  ])('does not apply to %s', (type, inputs) => {
    expect(planStructure(type, inputs).registry.applicable).toBe(false);
  });
});

describe('planStructureFromRaw', () => {
  it('validates before planning', () => {
    const result = planStructureFromRaw(STRUCTURE_TYPES.POLICY, { objectName: '../escape' });
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('PATH_SEPARATOR');
  });

  it('produces the same hash as planning from already-validated inputs', () => {
    const raw = planStructureFromRaw(STRUCTURE_TYPES.OKR_CYCLE, { okrYear: '2026' });
    const direct = planStructure(STRUCTURE_TYPES.OKR_CYCLE, { okrYear: 2026 });
    expect(raw.plan.hash).toBe(direct.hash);
  });
});
