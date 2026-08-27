import { Button, Callout, MonoPath, SectionLabel } from '../ui.jsx';
import { OUTCOME } from '../../../services/executeStructure.js';
import { PLAN_WARNING } from '../../../radar/planStructure.js';
import { REGISTRY_STATUS } from '../../../services/registryPort.js';
import { AUDIT_STATUS } from '../../../services/auditPort.js';

/**
 * Step 5 — what actually happened.
 *
 * Reports success, partial success and failure precisely. A partial success says which items
 * exist and which do not; it never implies that anything was rolled back, because nothing is.
 */

const OUTCOME_META = {
  [OUTCOME.SUCCESS]: { tone: 'success', title: 'Structure created' },
  [OUTCOME.PARTIAL_SUCCESS]: { tone: 'danger', title: 'Partly completed' },
  [OUTCOME.BLOCKED]: { tone: 'danger', title: 'Nothing was created' },
  [OUTCOME.FAILED]: { tone: 'danger', title: 'Creation failed' },
};

const REGISTRY_MESSAGE = {
  [REGISTRY_STATUS.CREATED]: 'A Master Registry record was created.',
  [REGISTRY_STATUS.UPDATED]: 'The Master Registry record was updated with the official folder link.',
  [REGISTRY_STATUS.UNCHANGED]: 'The Master Registry already recorded this object; nothing changed.',
  [REGISTRY_STATUS.CONFLICT]:
    'The Master Registry was left unchanged: it already points this object at a different official folder.',
  [REGISTRY_STATUS.PENDING_CONFIGURATION]:
    'No Master Registry is configured, so no Registry record was written. This is still pending.',
  [REGISTRY_STATUS.FAILED]: 'The Master Registry could not be updated. Retrying is safe.',
  [REGISTRY_STATUS.NOT_APPLICABLE]: 'This structure type does not have a Master Registry record.',
};

/**
 * Advisories: things that are still TRUE and still need a human, as opposed to things that
 * went wrong. They are rendered apart from the warnings, because presenting a required
 * follow-up on a successful run in the red "Warnings" block misreports what happened.
 */
const ADVISORY_CODES = new Set([
  PLAN_WARNING.PERMISSIONS_CONFIGURATION_REQUIRED,
  PLAN_WARNING.REGISTRY_TRANSITION_REQUIRED,
]);

function ItemList({ label, items }) {
  if (items.length === 0) return null;
  return (
    <details>
      <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
        {label} ({items.length})
      </summary>
      <ul style={{ listStyle: 'none', marginTop: 8, display: 'grid', gap: 4 }}>
        {items.map((item) => (
          <li key={item.id} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>
            {item.path}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function ResultStep({ result, onRetry, onStartOver }) {
  if (!result) return null;

  const meta = OUTCOME_META[result.outcome] || OUTCOME_META[OUTCOME.FAILED];
  const isPartial = result.outcome === OUTCOME.PARTIAL_SUCCESS;
  const nothingCreated = result.created.length === 0;
  const generalWarnings = result.warnings.filter(
    (w) => !w.code.startsWith('AUDIT_') && !ADVISORY_CODES.has(w.code)
  );
  const advisories = result.warnings.filter((w) => ADVISORY_CODES.has(w.code));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div role="status" aria-live="polite">
        <Callout tone={meta.tone} title={meta.title}>
          {result.outcome === OUTCOME.SUCCESS
            ? `${result.created.length} item${result.created.length === 1 ? '' : 's'} created` +
              (result.existing.length > 0 ? `, ${result.existing.length} reused.` : '.')
            : isPartial
              ? `${result.created.length} item${result.created.length === 1 ? '' : 's'} were created before the ` +
                'operation stopped. They were left in place — nothing was deleted or rolled back. ' +
                'Retrying is safe: existing items are reused and only the missing ones are created.'
              : nothingCreated
                ? 'Nothing was written to the Shared Drive.'
                : 'The operation did not complete.'}
        </Callout>
      </div>

      {result.destinationPath ? (
        <div style={{ display: 'grid', gap: 4 }}>
          <SectionLabel>Destination</SectionLabel>
          <MonoPath>{result.destinationPath}</MonoPath>
        </div>
      ) : null}

      {result.rootFolderLink ? (
        <a
          href={result.rootFolderLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            alignSelf: 'flex-start',
            padding: '9px 18px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Open folder in Drive
        </a>
      ) : null}

      {result.errors.length > 0 ? (
        <Callout tone="danger" title="Errors" role="alert">
          <ul style={{ listStyle: 'disc', paddingLeft: 18, display: 'grid', gap: 6 }}>
            {result.errors.map((e, i) => (
              <li key={`${e.code}-${i}`}>
                {e.message}
                {e.path ? (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginTop: 2 }}>{e.path}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {/* Audit warnings have their own section below; repeating them here would say the
          same sentence twice on one screen. */}
      {generalWarnings.length > 0 ? (
        <Callout tone="danger" title="Warnings">
          <ul style={{ listStyle: 'disc', paddingLeft: 18, display: 'grid', gap: 6 }}>
            {generalWarnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <div style={{ display: 'grid', gap: 8 }}>
        <ItemList label="Created" items={result.created} />
        <ItemList label="Reused (already existed)" items={result.existing} />
      </div>

      {/* Work RADAR deliberately did not do, restated where the administrator ends up. */}
      {advisories.length > 0 ? (
        <Callout tone="info" title="Still to do by hand">
          <ul style={{ listStyle: 'disc', paddingLeft: 18, display: 'grid', gap: 6 }}>
            {advisories.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {result.registry?.status ? (
        <Callout
          tone={
            result.registry.status === REGISTRY_STATUS.CONFLICT ||
            result.registry.status === REGISTRY_STATUS.FAILED ||
            result.registry.status === REGISTRY_STATUS.PENDING_CONFIGURATION
              ? 'danger'
              : 'neutral'
          }
          title="Master Registry"
        >
          {result.registry.manualTransitionRequired
            ? 'RADAR wrote nothing to the Master Registry. This object already has a record from ' +
              'its previous stage — see "Still to do by hand" above for the change it needs.'
            : REGISTRY_MESSAGE[result.registry.status] || 'Registry status unknown.'}
        </Callout>
      ) : null}

      {result.audit?.status && result.audit.status !== AUDIT_STATUS.RECORDED ? (
        <Callout tone="danger" title="Audit trail">
          {result.audit.status === AUDIT_STATUS.NOT_CONFIGURED
            ? 'No audit spreadsheet is configured, so this operation was not recorded in a durable audit trail.'
            : // The cause-specific message from executeStructure, so the reader knows what to
              // fix rather than only that something broke.
              result.audit.message ||
              'The audit entry could not be written. Tell the RADAR owner.'}
        </Callout>
      ) : null}

      <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        {result.outcome !== OUTCOME.SUCCESS ? (
          <Button variant="primary" onClick={onRetry}>
            Retry safely
          </Button>
        ) : null}
        <Button onClick={onStartOver}>Create another structure</Button>
      </div>
    </div>
  );
}
