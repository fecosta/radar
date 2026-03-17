import React from 'react';

function Chip({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: 0.3,
        border: `1.5px solid ${active ? (color || 'var(--accent)') : 'var(--border)'}`,
        borderRadius: 20,
        background: active ? (color || 'var(--accent)') + '18' : 'transparent',
        color: active ? (color || 'var(--accent)') : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {active && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
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

const AREA_COLORS = {
  '01_STRATEGY': '#0F766E',
  '02_INVESTMENT_PIPELINE': '#B45309',
  '03_PORTFOLIO': '#1D4ED8',
  '04_VENTURE_BUILDING': '#6D28D9',
  '05_ECOSYSTEM_ARCHITECTURE': '#047857',
  '06_RESEARCH': '#BE185D',
  '07_CO-INVESTORS': '#9333EA',
  '08_TRANSVERSAL_AREAS': '#475569',
  '09_GOVERNANCE_AND_DECISIONS': '#DC2626',
  '10_KNOWLEDGE_BASE': '#0369A1',
  '11_TEMPLATES': '#65A30D',
  '12_ARCHIVE': '#78716C',
};

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Area / Folder filter */}
      {topFolders.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          <Label text="Area" />
          {topFolders.map(f => (
            <Chip
              key={f.id}
              label={f.name.replace(/^\d+_/, '').replace(/_/g, ' ')}
              active={filterFolder?.id === f.id}
              color={AREA_COLORS[f.name]}
              onClick={() => setFilterFolder(filterFolder?.id === f.id ? null : f)}
            />
          ))}
        </div>
      )}

      {/* Type filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
        <Label text="Type" />
        {FILE_TYPES.map(t => (
          <Chip
            key={t.key}
            label={t.label}
            active={filterType === t.key}
            onClick={() => setFilterType(filterType === t.key ? null : t.key)}
          />
        ))}
      </div>

      {/* Owner filter */}
      {owners.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          <Label text="Owner" />
          {owners.slice(0, 8).map(o => (
            <Chip
              key={o.email}
              label={o.name.split(' ')[0]}
              active={filterOwner === o.email}
              onClick={() => setFilterOwner(filterOwner === o.email ? null : o.email)}
            />
          ))}
        </div>
      )}

      {/* Date + sort row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Label text="Modified" />
        <DateInput value={filterDateAfter} onChange={setFilterDateAfter} placeholder="After" />
        <DateInput value={filterDateBefore} onChange={setFilterDateBefore} placeholder="Before" />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Label text="Sort" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              fontSize: 11,
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 600,
              padding: '4px 8px',
              border: '1.5px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>
            {totalShown} result{totalShown !== 1 ? 's' : ''}
          </span>
          <button
            onClick={clearFilters}
            style={{
              fontSize: 11, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace",
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)',
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function Label({ text }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)',
      letterSpacing: 1, textTransform: 'uppercase',
      fontFamily: "'IBM Plex Mono', monospace",
      marginRight: 4, flexShrink: 0,
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
        fontSize: 11,
        fontFamily: "'IBM Plex Mono', monospace",
        padding: '4px 8px',
        border: '1.5px solid var(--border)',
        borderRadius: 6,
        background: 'var(--surface)',
        color: value ? 'var(--text)' : 'var(--text-secondary)',
        outline: 'none',
        cursor: 'pointer',
      }}
    />
  );
}
