import { Callout, CheckboxRow, MonoPath, SectionLabel } from '../ui.jsx';

/**
 * Step 4 — explicit confirmation.
 *
 * The only screen in RADAR that leads to a Drive write. Each warning is acknowledged
 * individually, and the final confirmation restates exactly what will happen and where.
 */
export default function ConfirmStep({
  preview,
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
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          {counts.create} new item{counts.create === 1 ? '' : 's'} in {drive.name}
        </span>
        <MonoPath>{destination.path}</MonoPath>
        {counts.exists > 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {counts.exists} existing item{counts.exists === 1 ? '' : 's'} will be reused, not duplicated.
          </span>
        ) : null}
      </div>

      <Callout tone="neutral" title="What RADAR will not do">
        Nothing is deleted, moved or renamed, and no permissions are changed. If part of the
        operation fails, the items already created are left in place and reported — there is no
        automatic rollback.
      </Callout>

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

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <CheckboxRow checked={confirmed} onChange={onConfirmedChange}>
          I confirm creating {counts.create} item{counts.create === 1 ? '' : 's'} in{' '}
          <strong>{destination.path}</strong> on {drive.name}.
        </CheckboxRow>
      </div>
    </div>
  );
}
