function Chip({ label, active, onClick, tone = 'accent' }) {
  const fill = tone === 'ink' ? 'var(--ink)' : 'var(--accent)';
  const onFill = tone === 'ink' ? 'var(--on-ink)' : 'var(--on-accent)';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 14px',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'var(--sans)',
        border: `1.5px solid ${active ? fill : 'var(--border)'}`,
        borderRadius: 'var(--radius-pill)',
        background: active ? fill : 'transparent',
        color: active ? onFill : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--text)'; e.currentTarget.style.color = 'var(--text)'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
    >
      {label}
      {active && (
        <span aria-hidden="true" style={{ fontWeight: 800 }}>&times;</span>
      )}
    </button>
  );
}

const FILE_TYPES = [
  { key: 'document', label: 'Docs' },
  { key: 'spreadsheet', label: 'Sheets' },
  { key: 'presentation', label: 'Slides' },
  { key: 'application/pdf', label: 'PDF' },
  { key: 'folder', label: 'Folders' },
  { key: 'image', label: 'Images' },
];

export default function Filters({
  topFolders, owners,
  filterFolder, setFilterFolder,
  filterType, setFilterType,
  filterOwner, setFilterOwner,
  filterDateAfter, setFilterDateAfter,
  filterDateBefore, setFilterDateBefore,
  sortBy, setSortBy,
  hasFilters, clearFilters,
  totalShown,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Area / Folder filter */}
      {topFolders.length > 0 && (
        <FilterRow label="Area">
          {topFolders.map(f => (
            <Chip
              key={f.id}
              label={f.name.replace(/^\d+_/, '').replace(/_/g, ' ')}
              active={filterFolder?.id === f.id}
              onClick={() => setFilterFolder(filterFolder?.id === f.id ? null : f)}
            />
          ))}
        </FilterRow>
      )}

      {/* Type filter */}
      <FilterRow label="Type">
        {FILE_TYPES.map(t => (
          <Chip
            key={t.key}
            tone="ink"
            label={t.label}
            active={filterType === t.key}
            onClick={() => setFilterType(filterType === t.key ? null : t.key)}
          />
        ))}
      </FilterRow>

      {/* Owner filter */}
      {owners.length > 0 && (
        <FilterRow label="Owner">
          {owners.slice(0, 8).map(o => (
            <Chip
              key={o.email}
              label={o.name.split(' ')[0]}
              active={filterOwner === o.email}
              onClick={() => setFilterOwner(filterOwner === o.email ? null : o.email)}
            />
          ))}
        </FilterRow>
      )}

      {/* Date + sort row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <FilterLabel text="Modified" />
        <DateInput value={filterDateAfter} onChange={setFilterDateAfter} placeholder="After" />
        <DateInput value={filterDateBefore} onChange={setFilterDateBefore} placeholder="Before" />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FilterLabel text="Sort" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              fontSize: 12,
              fontFamily: 'var(--sans)',
              fontWeight: 700,
              padding: '6px 12px',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--surface-raised)',
              color: 'var(--text)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="modifiedTime desc">Newest first</option>
            <option value="modifiedTime asc">Oldest first</option>
            <option value="name asc">Name A→Z</option>
            <option value="name desc">Name Z→A</option>
          </select>
        </div>
      </div>

      {/* Results count + clear */}
      {hasFilters && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1.5px dotted var(--border)' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <strong style={{ fontFamily: 'var(--sans)', fontWeight: 800, color: 'var(--text)' }}>{totalShown}</strong>
            {' '}result{totalShown !== 1 ? 's' : ''}
          </span>
          <button
            onClick={clearFilters}
            style={{
              fontSize: 12, fontWeight: 700,
              fontFamily: 'var(--sans)',
              background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--link)',
              padding: '2px 4px', borderRadius: 4,
            }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <FilterLabel text={label} />
      {children}
    </div>
  );
}

function FilterLabel({ text }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 800,
      color: 'var(--text-muted)',
      letterSpacing: 1, textTransform: 'uppercase',
      fontFamily: 'var(--sans)',
      flexShrink: 0, minWidth: 56,
    }}>
      {text}
    </span>
  );
}

function DateInput({ value, onChange, placeholder }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontSize: 12,
        fontFamily: 'var(--mono)',
        fontWeight: 400,
        padding: '6px 12px',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--radius-xs)',
        background: 'var(--surface-raised)',
        color: value ? 'var(--text-secondary)' : 'var(--text-disabled)',
        outline: 'none',
        cursor: 'pointer',
      }}
    />
  );
}
