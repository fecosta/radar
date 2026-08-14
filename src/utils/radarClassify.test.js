import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { classifyRadar } from './radarClassify.js';
import { evalCases, knownDivergences } from './__evals__/radarCases.js';

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
});
afterAll(() => { vi.useRealTimers(); });

describe('RADAR classifier — spec-derived routing', () => {
  it.each(evalCases)('routes: $description', (c) => {
    const r = classifyRadar({ description: c.description, objectName: c.objectName, context: c.context, theme: c.theme });
    expect(r.path).toBe(c.expectedPath);
    if (c.expectConfidence) expect(r.confidence).toBe(c.expectConfidence);
  });
});

// Documented gaps between current behavior and the spec. These are EXPECTED to fail
// until the classifier is fixed; `it.fails` turns green while they still diverge and
// turns red once fixed (signal to promote the case into evalCases above).
describe('RADAR classifier — known spec divergences', () => {
  it.fails.each(knownDivergences)('should (per spec) route: $description', (c) => {
    const r = classifyRadar({ description: c.description, objectName: c.objectName, context: c.context, theme: c.theme });
    expect(r.path).toBe(c.specExpectedPath);
  });

  // Review item (spec ambiguity, not asserted): a "contract template" currently lands in
  // 03_INSTITUTIONAL/06_TEMPLATES, and when the words "investment/agreement" appear it can
  // even land in Portfolio/06_Investment_Docs. The dedicated
  // 03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Legal/Contract_Templates rule is UNREACHABLE:
  // the generic Templates rule (fixed score 14) always outscores it (8). Decide the
  // canonical home; if Legal/Contract_Templates, the generic Templates rule needs a guard.
  it.todo('decide canonical home for contract templates (Legal/Contract_Templates rule is dead code)');
});
