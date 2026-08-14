/**
 * Audit port for structure-creation attempts.
 *
 * Every attempted execution produces exactly one audit event — success, partial success and
 * failure alike. Events are assembled field by field from a known shape rather than by
 * scrubbing an arbitrary object, so file contents, OAuth tokens and participant data cannot
 * leak in by accident.
 */

/** Column order of the audit spreadsheet. Documented in docs/operations/create-structure.md. */
export const AUDIT_COLUMNS = Object.freeze([
  'Timestamp',
  'Actor',
  'Structure_Type',
  'Inputs',
  'Destination_Path',
  'Plan_Hash',
  'Operation_Id',
  'Outcome',
  'Created_Items',
  'Reused_Items',
  'Registry_Result',
  'Warnings',
  'Failure_Stage',
  'Error',
]);

export const AUDIT_STATUS = Object.freeze({
  RECORDED: 'RECORDED',
  /** No audit spreadsheet configured — there is NO durable trail. Never reported as recorded. */
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  /** The audit write itself failed. Surfaced prominently: the Drive change is unrecorded. */
  FAILED: 'FAILED',
});

/** Keys never written to the audit trail, whatever a caller passes in error details. */
const SENSITIVE_KEY = /token|secret|password|credential|authorization|api[-_]?key/i;

function safeDetails(details) {
  if (!details || typeof details !== 'object') return null;
  const out = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEY.test(key)) continue;
    out[key] = typeof value === 'object' ? '[object]' : value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Build the canonical audit event. Called once per execution attempt.
 *
 * `items` carry Drive ids and names only — never contents.
 */
export function buildAuditEvent({
  timestamp,
  actor,
  structureType,
  inputs,
  destinationPath,
  planHash,
  operationId,
  outcome,
  created = [],
  reused = [],
  registryResult,
  warnings = [],
  failureStage = null,
  error = null,
}) {
  return {
    timestamp,
    // An email or subject identifier. Sufficient to attribute the action, nothing more.
    actor: actor || 'unknown',
    structureType,
    inputs,
    destinationPath,
    planHash,
    operationId,
    outcome,
    created: created.map((i) => ({ id: i.id, name: i.name, path: i.path })),
    reused: reused.map((i) => ({ id: i.id, name: i.name, path: i.path })),
    registryResult: registryResult || null,
    warnings: warnings.map((w) => w.code),
    failureStage,
    error: error ? { code: error.code || 'UNKNOWN', details: safeDetails(error.details) } : null,
  };
}

/** Serialize an event into the spreadsheet row order above. */
export function auditEventToRow(event) {
  const list = (items) => items.map((i) => `${i.name} (${i.id})`).join('\n');
  return [
    event.timestamp,
    event.actor,
    event.structureType,
    JSON.stringify(event.inputs),
    event.destinationPath,
    event.planHash,
    event.operationId,
    event.outcome,
    list(event.created),
    list(event.reused),
    event.registryResult || '',
    event.warnings.join(', '),
    event.failureStage || '',
    event.error ? JSON.stringify(event.error) : '',
  ];
}

/**
 * Fallback when no audit spreadsheet is configured.
 *
 * Emits a structured console event so the attempt is at least visible in a browser session,
 * and returns NOT_CONFIGURED so the UI and the operations guide can say plainly that no
 * durable audit trail exists. A console log is not an audit trail and is never reported
 * as one.
 */
export function createUnconfiguredAudit(logger = console) {
  return {
    isConfigured: () => false,
    async record(event) {
      logger.warn('[RADAR audit — NOT DURABLE, no audit spreadsheet configured]', event);
      return { status: AUDIT_STATUS.NOT_CONFIGURED };
    },
  };
}
