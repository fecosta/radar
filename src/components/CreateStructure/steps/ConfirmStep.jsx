import { Callout, CheckboxRow, MonoPath, SectionLabel } from '../ui.jsx';

/**
 * Step 4 — explicit confirmation.
 *
 * The only screen in RADAR that leads to a Drive write. Each warning is acknowledged
 * individually, and the final confirmation restates exactly what will happen and where.
 */
export default function ConfirmStep({
  preview,
  template,
  acknowledged,
  onToggleAcknowledgement,
  confirmed,
  onConfirmedChange,
}) {
  if (!preview) return null;

  const { counts, destination, drive, acknowledgements } = preview;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <SectionLabel>You are about to create</SectionLabel>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          {counts.create} new item{counts.create === 1 ? '' : 's'} in {drive.name}
        </span>
        <MonoPath>{destination.path}</MonoPath>
        {counts.exists > 0 ? (
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
            {counts.exists} existing item{counts.exists === 1 ? '' : 's'} will be reused, not duplicated.
          </span>
        ) : null}
      </div>

      <Callout tone="neutral" title="What RADAR will not do">
        Nothing is deleted, moved or renamed, and no permissions are changed. If part of the
        operation fails, the items already created are left in place and reported — there is no
        automatic rollback.
      </Callout>

      {/* The one structure that writes inside a folder holding irreplaceable history states
          that guarantee on the screen where the decision is actually made. */}
      {template?.confirmNote ? (
        <Callout tone="neutral" title="The existing history">
          {template.confirmNote}
        </Callout>
      ) : null}

      {acknowledgements.length > 0 ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <SectionLabel>Acknowledge before continuing</SectionLabel>
          {acknowledgements.map((ack) => (
            <CheckboxRow
              key={ack.code}
              checked={acknowledged.includes(ack.code)}
              onChange={() => onToggleAcknowledgement(ack.code)}
            >
              {ack.message}
            </CheckboxRow>
          ))}
        </div>
      ) : null}

      <div
        data-on-ink
        style={{ background: 'var(--ink)', borderRadius: 'var(--radius-sm)', padding: 18 }}
      >
        <div style={{
          fontFamily: 'var(--sans)',
          fontSize: 10.5, fontWeight: 800,
          letterSpacing: 1.1, textTransform: 'uppercase',
          color: 'var(--signal)',
          marginBottom: 9,
        }}>
          This writes to Drive
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.65, color: 'var(--on-ink)' }}>
          {counts.create} item{counts.create === 1 ? '' : 's'} will be created in {drive.name}.
          Nothing is deleted, moved, or renamed. Running it twice creates nothing new.
        </p>
        <div style={{ marginTop: 14 }}>
          <CheckboxRow checked={confirmed} onChange={onConfirmedChange} tone="on-ink">
            I confirm creating {counts.create} item{counts.create === 1 ? '' : 's'} in{' '}
            <strong>{destination.path}</strong> on {drive.name}.
          </CheckboxRow>
        </div>
      </div>
    </div>
  );
}
