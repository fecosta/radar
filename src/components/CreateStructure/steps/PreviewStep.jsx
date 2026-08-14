import StructureTree from '../StructureTree.jsx';
import { Callout, MonoPath, SectionLabel } from '../ui.jsx';
import { PREVIEW_STATUS } from '../../../services/previewStructure.js';
import { REGISTRY_STATUS } from '../../../services/registryPort.js';

/**
 * Step 3 — validation and preview against LIVE Drive state.
 *
 * The preview is read-only: nothing on this screen has written anything. Execution re-runs
 * the same comparison immediately before creating, because Drive can change in between.
 */

const REGISTRY_MESSAGE = {
  [REGISTRY_STATUS.CREATED]: 'A new Master Registry record will be created.',
  [REGISTRY_STATUS.UPDATED]: 'The existing Master Registry record will be updated with the folder link.',
  [REGISTRY_STATUS.UNCHANGED]: 'The Master Registry already records this object.',
  [REGISTRY_STATUS.CONFLICT]: 'The Master Registry already points this object at a different official folder.',
  [REGISTRY_STATUS.PENDING_CONFIGURATION]:
    'No Master Registry is configured, so no Registry record will be written. The folders are still created.',
  [REGISTRY_STATUS.NOT_APPLICABLE]: 'This structure type does not have a Master Registry record.',
};

export default function PreviewStep({ preview, loading, error }) {
  if (loading) {
    return (
      <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          aria-hidden="true"
          style={{
            width: 18,
            height: 18,
            border: '2.5px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 0.65s linear infinite',
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Checking the Shared Drive…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <Callout tone="danger" title="Preview failed" role="alert">
        {error}
      </Callout>
    );
  }

  if (!preview) return null;

  const { counts, blocking, acknowledgements, registry, destination, drive, items } = preview;
  const isBlocked = preview.status === PREVIEW_STATUS.BLOCKED;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Announced as one sentence so a screen reader gets the outcome without walking the tree. */}
      <div role="status" aria-live="polite" style={{ display: 'grid', gap: 4 }}>
        <SectionLabel>Destination in {drive.name}</SectionLabel>
        <MonoPath>{destination.path}</MonoPath>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
          {isBlocked
            ? `Preview blocked: ${blocking.length} conflict${blocking.length === 1 ? '' : 's'} must be resolved first.`
            : `${counts.create} item${counts.create === 1 ? '' : 's'} will be created, ` +
              `${counts.exists} already exist${counts.exists === 1 ? 's' : ''} and will be reused.`}
        </span>
      </div>

      {blocking.length > 0 ? (
        <Callout tone="danger" title="Blocking conflicts" role="alert">
          <ul style={{ listStyle: 'disc', paddingLeft: 18, display: 'grid', gap: 8 }}>
            {blocking.map((b) => (
              <li key={`${b.code}-${b.path || b.segment || ''}`}>
                <strong style={{ color: 'var(--text)' }}>{b.code.replace(/_/g, ' ').toLowerCase()}</strong>
                {' — '}
                {b.message}
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {acknowledgements.map((ack) => (
        <Callout key={ack.code} tone="danger" title="Warning — needs acknowledgement">
          {ack.message}
          {ack.items?.length ? (
            <div style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 11 }}>{ack.items.join(', ')}</div>
          ) : null}
        </Callout>
      ))}

      {registry.applicable ? (
        <Callout
          tone={registry.status === REGISTRY_STATUS.CONFLICT ? 'danger' : 'neutral'}
          title="Master Registry"
        >
          {REGISTRY_MESSAGE[registry.status] || 'Registry status unknown.'}
        </Callout>
      ) : null}

      <div>
        <SectionLabel>Planned structure</SectionLabel>
        <div style={{ marginTop: 8 }}>
          <StructureTree items={items} />
        </div>
      </div>
    </div>
  );
}
