import React, { useRef } from 'react';

export default function SearchBar({ query, onChange, loading }) {
  const ref = useRef(null);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'var(--surface)',
      border: '1.5px solid var(--border)',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: 'var(--shadow)',
      transition: 'border-color 0.15s',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>

      <input
        ref={ref}
        value={query}
        onChange={e => onChange(e.target.value)}
        placeholder="Search files, contents, folders..."
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          fontSize: 14,
          fontFamily: "'IBM Plex Mono', monospace",
          color: 'var(--text)',
          outline: 'none',
        }}
      />

      {loading && (
        <div style={{
          width: 18, height: 18,
          border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
      )}

      {query && !loading && (
        <button
          onClick={() => { onChange(''); ref.current?.focus(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', display: 'flex', padding: 2,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}
