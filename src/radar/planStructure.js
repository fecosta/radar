/**
 * The deterministic planner: validated inputs in, a complete structure plan out.
 *
 * This never touches Google Drive. Preview compares the plan against live Drive state;
 * execution regenerates the plan from inputs and refuses to write anything if the
 * regenerated hash differs from the one the administrator confirmed. That separation is
 * what makes every business rule testable without credentials.
 */

import { REGISTRY_OBJECT_TYPES, joinSegments } from './canonicalTree.js';
import {
  STRUCTURE_TYPES,
  expandTemplate,
  getTemplate,
  FORBIDDEN_DESTINATION_SEGMENTS,
} from './structureTemplates.js';
import { validateStructureInput } from './structureInputs.js';
import { stableHash } from './planHash.js';

export const PLAN_VERSION = 'radar-v05';

/** Warning codes a plan can carry before any Drive state is known. */
export const PLAN_WARNING = Object.freeze({
  PERMISSIONS_CONFIGURATION_REQUIRED: 'PERMISSIONS_CONFIGURATION_REQUIRED',
});

/**
 * Which Registry Object_Type a structure produces. Only the three investment/program object
 * types get a Registry record; policies, governance meetings and OKR cycles are not
 * Registry objects.
 */
function registryPlanFor(type, inputs, officialFolderPath) {
  const template = getTemplate(type);
  if (!template.registry.applicable) {
    return { applicable: false };
  }

  return {
    applicable: true,
    objectType: template.registry.objectType,
    /**
     * The identity a Registry row is matched on. Deliberately does NOT include status or
     * stage: a human sets those, and re-running creation must find the same row rather
     * than inserting a duplicate.
     */
    identity: {
      objectName: inputs.objectName,
      theme: inputs.theme,
      objectType: template.registry.objectType,
    },
    /**
     * Proposed field values. Current_Stage_or_Status is intentionally left blank — the
     * specification is explicit that a human determines type and status and that automation
     * must never infer an investment decision.
     */
    record: {
      Object_Name: inputs.objectName,
      Theme: inputs.theme,
      Strategic_Focus: inputs.strategicFocus || '',
      Object_Type: template.registry.objectType,
      Current_Stage_or_Status: '',
      Country_or_Geography: inputs.country || '',
      Owner: inputs.owner || '',
      Official_Folder_Path: officialFolderPath,
    },
  };
}

/**
 * Build a plan from ALREADY VALIDATED inputs.
 *
 * Prefer {@link planStructureFromRaw} at trust boundaries; this variant exists so execution
 * can re-plan from inputs it has just re-validated without validating twice.
 */
export function planStructure(type, validatedInputs) {
  const { destination, items } = expandTemplate(type, validatedInputs);

  // Defence in depth: the templates cannot produce these destinations, but a future edit
  // could. Portfolio is reachable only by moving an approved Pipeline folder, and the
  // archive only by a decline/closure transition — neither of which exists yet.
  const forbidden = FORBIDDEN_DESTINATION_SEGMENTS.find((prefix) => destination.path.startsWith(prefix));
  if (forbidden) {
    throw new Error(
      `Refusing to plan a structure under ${forbidden}: that location is only reachable through a lifecycle move.`
    );
  }

  const warnings = [];
  const sensitiveItems = items.filter((item) => item.sensitive?.restricted);
  if (sensitiveItems.length > 0) {
    warnings.push({
      code: PLAN_WARNING.PERMISSIONS_CONFIGURATION_REQUIRED,
      items: sensitiveItems.map((item) => item.relativePath),
      message:
        'This structure contains a restricted folder. RADAR creates it but cannot configure its access — ' +
        'permissions must be applied by hand before any participant or beneficiary data is stored.',
    });
  }

  const registry = registryPlanFor(type, validatedInputs, destination.path);

  const plan = {
    planVersion: PLAN_VERSION,
    structureType: type,
    inputs: validatedInputs,
    destination,
    items,
    warnings,
    registry,
  };

  // The hash covers everything that determines what gets written. It is computed last and
  // is not itself part of the hashed payload.
  return { ...plan, hash: stableHash(plan) };
}

/**
 * Validate raw input and plan in one step — the entry point for anything crossing a trust
 * boundary (the wizard, and execution's pre-write revalidation).
 *
 * @returns {{ ok: true, plan: object } | { ok: false, errors: Array }}
 */
export function planStructureFromRaw(type, rawInputs) {
  const validation = validateStructureInput(type, rawInputs);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  return { ok: true, plan: planStructure(type, validation.value) };
}

/** Convenience for display: the canonical path of the structure root. */
export function planRootPath(plan) {
  return joinSegments(plan.destination.segments);
}

/** The single item that is the structure root (the folder the result links to). */
export function planRootItem(plan) {
  return plan.items.find((item) => item.isStructureRoot) || null;
}

export { STRUCTURE_TYPES, REGISTRY_OBJECT_TYPES };
