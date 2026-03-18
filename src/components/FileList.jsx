import { useRef } from 'react';
import { formatSize, formatDate, getFileType, getFileColor } from '../utils/helpers';

function FileIcon({ mimeType, size = 16 }) {
  const color = getFileColor(mimeType);
  const isFolder = mimeType === 'application/vnd.google-apps.folder';

  if (isFolder) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color + '22'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color + '14'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}

function TypeBadge({ mimeType }) {
  const color = getFileColor(mimeType);
  const label = getFileType(mimeType);
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      background: color + '15',
      color,
      borderRadius: 20,
      fontWeight: 700,
      fontSize: 10,
      fontFamily: 'var(--sans)',
      letterSpacing: 0.3,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function FileRow({ file, onSingleClick, onDoubleClick }) {
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
        gap: 12,
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
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
      {/* Icon */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', width: 22 }}>
        <FileIcon mimeType={file.mimeType} />
      </div>

      {/* Name + badge */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'var(--mono)',
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {file.name}
        </span>
        <TypeBadge mimeType={file.mimeType} />
        {file.size && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
            {formatSize(file.size)}
          </span>
        )}
      </div>

      {/* Owner */}
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        textAlign: 'right',
        flexShrink: 0,
        width: 140,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {file.lastModifyingUser?.displayName || file.owners?.[0]?.displayName || '—'}
      </div>

      {/* Modified date */}
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-muted)',
        textAlign: 'right',
        flexShrink: 0,
        width: 80,
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
      gap: 12,
      padding: '9px 20px',
      background: 'var(--surface-raised)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 1,
    }}>
      <div style={{ width: 22, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.9 }}>
        Name
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.9, flexShrink: 0, width: 140, textAlign: 'right' }}>
        Owner
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.9, flexShrink: 0, width: 80, textAlign: 'right' }}>
        Modified
      </div>
    </div>
  );
}

export default function FileList({ results, loading, nextPageToken, loadMore, onSingleClick, onDoubleClick }) {
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
        <div style={{ fontSize: 13, fontWeight: 600 }}>Searching your Drive...</div>
      </div>
    );
  }

  if (!loading && results.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 14px', display: 'block' }}>
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>No files found</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Try adjusting your search or filters</div>
      </div>
    );
  }

  return (
    <div>
      <ColumnHeader />

      {results.map((file) => (
        <FileRow
          key={file.id}
          file={file}
          onSingleClick={onSingleClick}
          onDoubleClick={onDoubleClick}
        />
      ))}

      {/* Load more */}
      {nextPageToken && (
        <div style={{ padding: '14px 20px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={loadMore}
            disabled={loading}
            style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--sans)',
              padding: '8px 28px',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.15s',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {loading ? 'Loading...' : 'Load more results'}
          </button>
        </div>
      )}
    </div>
  );
}
