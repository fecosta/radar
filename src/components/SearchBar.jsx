import { useRef, useState } from 'react';

export default function SearchBar({ query, onChange, loading }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'var(--surface)',
      border: `2px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 10,
      padding: '10px 16px',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      boxShadow: focused ? '0 0 0 4px rgba(6, 72, 179, 0.10)' : 'none',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={focused ? 'var(--accent)' : 'var(--text-muted)'}
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, transition: 'stroke 0.15s' }}
      >
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>

      <input
        ref={ref}
        value={query}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search files, contents, folders..."
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'var(--sans)',
          color: 'var(--text)',
          outline: 'none',
        }}
      />

      {loading && (
        <div style={{
          width: 18, height: 18, flexShrink: 0,
          border: '2.5px solid var(--border)',
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
            color: 'var(--text-muted)', display: 'flex', padding: 2,
            borderRadius: 4, flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}
