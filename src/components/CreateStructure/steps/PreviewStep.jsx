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
      <div role="status" aria-live="polite" style={{ display: 'grid', gap: 8 }}>
        <SectionLabel>Destination in {drive.name}</SectionLabel>
        <div style={{
          background: 'var(--surface-raised)',
          borderRadius: 'var(--radius-xs)',
          padding: '11px 14px',
        }}>
          <MonoPath>{destination.path}</MonoPath>
          {/*
            When the structure adds to a folder that already exists, the administrator is about
            to write inside a live organization folder identified only by a name they typed.
            A path is readable; a link is verifiable. This is the check against adding the
            operating folders to the wrong organization.
          */}
          {destination.requireExistingSegments?.length && preview.parent?.webViewLink ? (
            <a
              href={preview.parent.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginTop: 6, display: 'inline-block' }}
            >
              Open this folder in Drive to confirm it is the right organization
            </a>
          ) : null}
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <SectionLabel>Planned structure</SectionLabel>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)' }}>
              <span aria-hidden="true" style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>=</span> Already exists
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--text)' }}>
              <span aria-hidden="true" style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--accent)' }}>+</span> Will create
            </span>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <StructureTree items={items} />
        </div>
      </div>
    </div>
  );
}
