import { useRef } from 'react';
import { formatSize, formatDate, getFileType } from '../utils/helpers';

function FileRow({ file, onSingleClick, onDoubleClick, first }) {
  const clickTimerRef = useRef(null);

  const handleClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      onDoubleClick?.(file);
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        onSingleClick?.(file);
      }, 230);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 20px',
        // The first row sits directly under the header band, which is its own separator.
        borderTop: first ? 'none' : '1.5px dotted var(--rule)',
        cursor: 'pointer',
        transition: 'background 0.1s',
        userSelect: 'none',
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--hover)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Marker */}
      <span aria-hidden="true" style={{
        width: 20, flexShrink: 0,
        fontFamily: 'var(--mono)', fontSize: 13,
        color: 'var(--text-muted)',
      }}>
        &#9656;
      </span>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize: 12.5,
          fontWeight: 700,
          fontFamily: 'var(--mono)',
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {file.name}
        </span>
        {file.size && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
            {formatSize(file.size)}
          </span>
        )}
      </div>

      {/* Type */}
      <div style={{
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        fontWeight: 700,
        color: 'var(--text-secondary)',
        flexShrink: 0,
        width: 76,
      }}>
        {getFileType(file.mimeType)}
      </div>

      {/* Owner */}
      <div style={{
        fontSize: 12,
        color: 'var(--text-secondary)',
        textAlign: 'right',
        flexShrink: 0,
        width: 132,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {file.lastModifyingUser?.displayName || file.owners?.[0]?.displayName || '—'}
      </div>

      {/* Modified date */}
      <div style={{
        fontSize: 12,
        color: 'var(--text-secondary)',
        textAlign: 'right',
        flexShrink: 0,
        width: 86,
        fontFamily: 'var(--mono)',
      }}>
        {formatDate(file.modifiedTime)}
      </div>
    </div>
  );
}

function ColumnHeader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '11px 20px',
      background: 'var(--accent)',
      position: 'sticky',
      top: 0,
      zIndex: 1,
      fontFamily: 'var(--sans)',
    }}>
      <div style={{ width: 20, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 10, fontWeight: 800, color: 'var(--on-accent)', textTransform: 'uppercase', letterSpacing: 1 }}>
        Name
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--on-accent)', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0, width: 76 }}>
        Type
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--on-accent)', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0, width: 132, textAlign: 'right' }}>
        Owner
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--on-accent)', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0, width: 86, textAlign: 'right' }}>
        Modified
      </div>
    </div>
  );
}

export default function FileList({ results, loading, nextPageToken, loadMore, onSingleClick, onDoubleClick, hasFilters, onClearFilters }) {
  if (loading && results.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{
          width: 28, height: 28, margin: '0 auto 14px',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.65s linear infinite',
        }} />
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Searching your Drive...</div>
      </div>
    );
  }

  if (!loading && results.length === 0) {
    return (
      <div style={{ padding: '64px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{
          width: 54, height: 54,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--surface-raised)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 18,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-disabled)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <h3 style={{ fontFamily: 'var(--sans)', fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>
          Nothing matches yet
        </h3>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8, maxWidth: 440 }}>
          {hasFilters
            ? 'Filters are narrowing this search. Drop one, or widen the date range.'
            : 'Try a different wording, or browse in from an area filter.'}
        </p>
        {hasFilters && (
          <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={onClearFilters}
              style={{
                fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700,
                padding: '11px 24px', border: 'none',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--ink)', color: 'var(--on-ink)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--ink-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--ink)'; }}
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <ColumnHeader />

      {results.map((file, i) => (
        <FileRow
          key={file.id}
          file={file}
          first={i === 0}
          onSingleClick={onSingleClick}
          onDoubleClick={onDoubleClick}
        />
      ))}

      {/* Load more */}
      {nextPageToken && (
        <div style={{ padding: '14px 20px', textAlign: 'center', borderTop: '1.5px dotted var(--rule)' }}>
          <button
            onClick={loadMore}
            disabled={loading}
            style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--sans)',
              padding: '9px 26px',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-pill)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.15s',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = 'var(--text)'; e.currentTarget.style.color = 'var(--text)'; }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {loading ? 'Loading...' : 'Load more results'}
          </button>
        </div>
      )}
    </div>
  );
}
