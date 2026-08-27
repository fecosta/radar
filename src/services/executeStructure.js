/**
 * Execution: the only place in RADAR that writes to Google Drive.
 *
 * Order of operations, and why:
 *   1. Re-validate raw inputs and REGENERATE the plan. The browser never submits a folder
 *      tree that gets executed — a tampered or stale tree simply has nowhere to enter.
 *   2. Compare the regenerated hash with the one the administrator confirmed. A mismatch
 *      means the inputs changed after preview, so nothing is written.
 *   3. Re-run the preview against live Drive, because Drive may have changed since preview.
 *   4. Create only the missing items, parents first, verifying each landed in the
 *      configured Shared Drive.
 *   5. Upsert the Master Registry.
 *   6. Record one audit event — on every path, including failure.
 *
 * Nothing is ever deleted. There is no transactional cleanup in this architecture, so a
 * partial failure is reported precisely as a partial failure and retry is made safe by
 * idempotency instead. The result never claims a rollback occurred.
 */

import { ITEM_KIND } from '../radar/canonicalTree.js';
import { planStructureFromRaw } from '../radar/planStructure.js';
import { previewStructure, PREVIEW_STATUS, ITEM_STATUS } from './previewStructure.js';
import { REGISTRY_STATUS } from './registryPort.js';
import { AUDIT_STATUS, buildAuditEvent } from './auditPort.js';
import { DriveError, ERROR_CODE } from './driveErrors.js';
import { runExclusive } from './operationStore.js';

export const OUTCOME = Object.freeze({
  SUCCESS: 'success',
  PARTIAL_SUCCESS: 'partial_success',
  BLOCKED: 'blocked',
  FAILED: 'failed',
});

export const FAILURE_STAGE = Object.freeze({
  VALIDATION: 'validation',
  PLAN_STALE: 'plan_stale',
  ACKNOWLEDGEMENT: 'acknowledgement',
  REVALIDATION: 'revalidation',
  CREATION: 'creation',
  REGISTRY: 'registry',
  AUDIT: 'audit',
});

export const EXECUTION_WARNING = Object.freeze({
  DUPLICATE_CREATED: 'DUPLICATE_CREATED',
  AUDIT_NOT_DURABLE: 'AUDIT_NOT_DURABLE',
  AUDIT_WRITE_FAILED: 'AUDIT_WRITE_FAILED',
  REGISTRY_PENDING: 'REGISTRY_PENDING',
  REGISTRY_CONFLICT: 'REGISTRY_CONFLICT',
});

/**
 * @param {object} options
 * @param {object} options.drive           Drive client
 * @param {object} options.registry        Registry port
 * @param {object} options.audit           Audit port
 * @param {string} options.structureType
 * @param {object} options.rawInputs       unvalidated wizard input
 * @param {string} options.confirmedPlanHash  hash of the plan the user confirmed
 * @param {string[]} [options.acknowledged]   acknowledgement codes the user ticked
 * @param {string} options.actor           authenticated user identifier for the audit trail
 * @param {string} options.operationId     idempotency key
 * @param {object} [options.logger]        injectable for tests; defaults to console
 */
export function executeStructure(options) {
  // One run per idempotency key: a repeated submission joins the in-flight promise.
  return runExclusive(options.operationId, () => runExecution(options));
}

async function runExecution({
  drive,
  registry,
  audit,
  structureType,
  rawInputs,
  confirmedPlanHash,
  acknowledged = [],
  actor,
  operationId,
  now = () => new Date(),
  logger = console,
}) {
  const created = [];
  const reused = [];
  const warnings = [];
  const errors = [];

  let plan = null;
  let outcome = OUTCOME.FAILED;
  let failureStage = null;
  let registryResult = REGISTRY_STATUS.NOT_APPLICABLE;
  let rootLink = null;

  const finish = async () => {
    const event = buildAuditEvent({
      timestamp: now().toISOString(),
      actor,
      structureType,
      inputs: plan ? plan.inputs : { unvalidated: true },
      destinationPath: plan ? plan.destination.path : null,
      planHash: plan ? plan.hash : confirmedPlanHash,
      operationId,
      outcome,
      created,
      reused,
      registryResult,
      warnings,
      failureStage,
      error: errors[0] || null,
    });

    let auditStatus;
    let auditError = null;
    try {
      auditStatus = (await audit.record(event)).status;
    } catch (error) {
      auditStatus = AUDIT_STATUS.FAILED;
      auditError = toErrorRecord(error);
      // The Drive change happened and is now unrecorded, so the cause has to be findable.
      // Swallowing it here is what made this failure impossible to diagnose from the UI.
      logger.error('[RADAR] audit write failed', {
        code: auditError.code,
        operationId,
        destinationPath: plan?.destination.path ?? null,
        details: auditError.details ?? null,
      });
      warnings.push({
        code: EXECUTION_WARNING.AUDIT_WRITE_FAILED,
        message: auditFailureMessage(auditError.code),
      });
    }
    if (auditStatus === AUDIT_STATUS.NOT_CONFIGURED) {
      warnings.push({
        code: EXECUTION_WARNING.AUDIT_NOT_DURABLE,
        message:
          'No audit spreadsheet is configured, so this operation was not recorded in a durable audit trail.',
      });
    }

    return {
      outcome,
      operationId,
      failureStage,
      structureType,
      destinationPath: plan?.destination.path ?? null,
      planHash: plan?.hash ?? null,
      rootFolderLink: rootLink,
      created,
      existing: reused,
      warnings,
      errors,
      registry: {
        status: registryResult,
        // Distinguishes "no Registry record applies" from "a record applies and a human must
        // change it", which the result screen would otherwise report as the same thing.
        manualTransitionRequired: Boolean(plan?.registry?.manualTransition),
      },
      audit: {
        status: auditStatus,
        code: auditError?.code ?? null,
        message: auditError ? auditFailureMessage(auditError.code) : null,
      },
    };
  };

  /* 1. Re-validate and regenerate the plan from inputs alone. */
  const planned = planStructureFromRaw(structureType, rawInputs);
  if (!planned.ok) {
    outcome = OUTCOME.BLOCKED;
    failureStage = FAILURE_STAGE.VALIDATION;
    errors.push({ code: 'INVALID_INPUT', message: 'The inputs are no longer valid.', details: { fields: planned.errors.map((e) => e.field) } });
    return finish();
  }
  plan = planned.plan;

  /* 2. Staleness / integrity check against what was confirmed. */
  if (plan.hash !== confirmedPlanHash) {
    outcome = OUTCOME.BLOCKED;
    failureStage = FAILURE_STAGE.PLAN_STALE;
    errors.push({
      code: 'STALE_PLAN',
      message: 'The details changed after the preview. Review the preview again before creating.',
    });
    return finish();
  }

  /* 3. Revalidate against live Drive. */
  let preview;
  try {
    preview = await previewStructure({ drive, registry, plan });
  } catch (error) {
    outcome = OUTCOME.FAILED;
    failureStage = FAILURE_STAGE.REVALIDATION;
    errors.push(toErrorRecord(error));
    return finish();
  }

  if (preview.status === PREVIEW_STATUS.BLOCKED) {
    outcome = OUTCOME.BLOCKED;
    failureStage = FAILURE_STAGE.REVALIDATION;
    for (const b of preview.blocking) errors.push({ code: b.code, message: b.message });
    return finish();
  }

  /* 4. Every acknowledgement the preview raised must have been ticked. */
  const missingAck = preview.acknowledgements.filter((a) => !acknowledged.includes(a.code));
  if (missingAck.length > 0) {
    outcome = OUTCOME.BLOCKED;
    failureStage = FAILURE_STAGE.ACKNOWLEDGEMENT;
    errors.push({
      code: 'ACKNOWLEDGEMENT_REQUIRED',
      message: 'Confirm the warnings before creating this structure.',
      details: { codes: missingAck.map((a) => a.code) },
    });
    return finish();
  }

  /* 4b. Restate the plan's advisories in the result.
         These describe work RADAR cannot do and the administrator still must — so they belong
         on the screen the administrator ends on, not only on the one they have already left.
         Placed after the acknowledgement gate so a run blocked for a missing tick does not
         restate them as though something happened, and before the creation loop so a partial
         failure still carries them. Also lands in the audit row's Warnings column. */
  for (const w of plan.warnings) warnings.push({ code: w.code, message: w.message });

  /* 5. Create the missing items, parents before children. */
  const parentIds = new Map(); // item key -> Drive id
  const rootKey = plan.items.find((i) => i.isStructureRoot)?.key ?? null;

  /**
   * A structure that creates no root of its own (Portfolio operating folders) has no root
   * item to take the link from, so the result links the existing folder the items were added
   * to. Without this the result screen would silently lose its "Open folder in Drive" button.
   */
  if (!rootKey) rootLink = preview.parent.webViewLink ?? null;

  for (const item of preview.items) {
    const parentId = item.parentKey ? parentIds.get(item.parentKey) : preview.parent.id;

    if (item.status === ITEM_STATUS.EXISTS) {
      parentIds.set(item.key, item.existing.id);
      reused.push({ id: item.existing.id, name: item.name, path: item.fullPath, kind: item.kind, webViewLink: item.existing.webViewLink });
      if (item.key === rootKey) rootLink = item.existing.webViewLink;
      continue;
    }

    try {
      const madeItem =
        item.kind === ITEM_KIND.GOOGLE_DOC
          ? await drive.createGoogleDoc(parentId, item.name)
          : await drive.createFolder(parentId, item.name);

      parentIds.set(item.key, madeItem.id);
      created.push({ id: madeItem.id, name: item.name, path: item.fullPath, kind: item.kind, webViewLink: madeItem.webViewLink });
      if (item.key === rootKey) rootLink = madeItem.webViewLink;
    } catch (error) {
      // Stop immediately. Nothing already created is deleted: there is no proven
      // transactional cleanup here, and a retry will reuse what exists.
      failureStage = FAILURE_STAGE.CREATION;
      errors.push({ ...toErrorRecord(error), path: item.fullPath });
      outcome = created.length > 0 ? OUTCOME.PARTIAL_SUCCESS : OUTCOME.FAILED;
      return finish();
    }
  }

  /* 5b. Did a concurrent run create a second root while we worked? */
  if (rootKey) {
    const rootItem = preview.items.find((i) => i.key === rootKey);
    try {
      const siblings = await drive.findExactChildren(preview.parent.id, rootItem.name);
      if (siblings.length > 1) {
        warnings.push({
          code: EXECUTION_WARNING.DUPLICATE_CREATED,
          message:
            `More than one "${rootItem.name}" now exists in ${plan.destination.parentPath}. Another ` +
            'run probably created one at the same time — de-duplicate them in Drive.',
        });
      }
    } catch {
      // A failed post-check must not turn a successful creation into a failure.
    }
  }

  outcome = OUTCOME.SUCCESS;

  /* 6. Registry upsert. Drive succeeded, so a Registry failure is partial success. */
  if (plan.registry.applicable) {
    try {
      const result = await registry.upsert({
        identity: plan.registry.identity,
        record: plan.registry.record,
        officialFolderLink: rootLink || '',
      });
      registryResult = result.status;

      if (result.status === REGISTRY_STATUS.CONFLICT) {
        outcome = OUTCOME.PARTIAL_SUCCESS;
        warnings.push({
          code: EXECUTION_WARNING.REGISTRY_CONFLICT,
          message:
            'The Master Registry already records a different official folder for this object, so it ' +
            'was left unchanged. Resolve the Registry record by hand.',
        });
      } else if (result.status === REGISTRY_STATUS.PENDING_CONFIGURATION) {
        warnings.push({
          code: EXECUTION_WARNING.REGISTRY_PENDING,
          message:
            'No Master Registry is configured, so no Registry record was created. Configure it and ' +
            'retry to complete the record — retrying is safe.',
        });
      }
    } catch (error) {
      registryResult = REGISTRY_STATUS.FAILED;
      outcome = OUTCOME.PARTIAL_SUCCESS;
      failureStage = FAILURE_STAGE.REGISTRY;
      errors.push(toErrorRecord(error));
      warnings.push({
        code: EXECUTION_WARNING.REGISTRY_CONFLICT,
        message:
          'The folders were created but the Master Registry could not be updated. Retry to complete ' +
          'the Registry record — retrying is safe and will not duplicate folders.',
      });
    }
  }

  return finish();
}

/**
 * Why the audit write failed, and what to do about it.
 *
 * The cause determines the advice, so these are not interchangeable: telling someone to retry
 * a misconfigured header row would send them round the same loop forever. Only genuinely
 * transient failures say retrying helps.
 *
 * Every message states plainly that the Drive change DID happen and is unrecorded — that is
 * the part the RADAR owner needs to know regardless of cause.
 */
export function auditFailureMessage(code) {
  const preamble =
    'The Drive changes above DID happen but are not recorded in the audit log. ';

  switch (code) {
    case ERROR_CODE.NOT_FOUND:
      return (
        preamble +
        'The configured audit spreadsheet could not be found — check VITE_RADAR_AUDIT_SHEET_ID ' +
        'and that the spreadsheet still exists.'
      );
    case ERROR_CODE.CONFIGURATION:
      return (
        preamble +
        'The audit spreadsheet is set up incorrectly — its header row is missing required ' +
        'columns. Fix the header row, then re-run to record this operation.'
      );
    case ERROR_CODE.API_NOT_ENABLED:
      return (
        preamble +
        'The Google Sheets API is not enabled for this Google Cloud project, so RADAR cannot ' +
        'write to any spreadsheet. Ask the RADAR owner to enable it — the browser console has ' +
        'the exact project and activation link.'
      );
    case ERROR_CODE.SCOPE_INSUFFICIENT:
      return (
        preamble +
        'Your Google sign-in is missing the Google Sheets permission. Sign out, sign back in, ' +
        'and accept the permission request when Create structure asks for it.'
      );
    case ERROR_CODE.PERMISSION_DENIED:
      return (
        preamble +
        'Google refused access to the audit spreadsheet. Check that you can edit it — the ' +
        'spreadsheet may belong to someone else or not be shared with you.'
      );
    case ERROR_CODE.AUTH_EXPIRED:
      return preamble + 'Your Google session expired before the audit entry was written. Sign in again.';
    case ERROR_CODE.RATE_LIMITED:
    case ERROR_CODE.TIMEOUT:
    case ERROR_CODE.NETWORK:
      return preamble + 'Google could not be reached. Retrying is safe and will record the operation.';
    default:
      return preamble + 'Tell the RADAR owner. The browser console has the full error.';
  }
}

/** Normalize any thrown value into the audit/result error shape, without leaking internals. */
function toErrorRecord(error) {
  if (error instanceof DriveError) {
    return { code: error.code, message: error.userMessage, details: error.details };
  }
  return {
    code: ERROR_CODE.API_ERROR,
    message: 'An unexpected error stopped the operation.',
    details: { cause: String(error?.message || error) },
  };
}
