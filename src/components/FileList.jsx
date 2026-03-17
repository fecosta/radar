import React from 'react';
import { formatSize, formatDate, getFileType, getFileColor } from '../utils/helpers';

function FileIcon({ mimeType, size = 18 }) {
  const color = getFileColor(mimeType);
  const isFolder = mimeType === 'application/vnd.google-apps.folder';

  if (isFolder) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

export default function FileList({ results, loading, nextPageToken, loadMore }) {
  if (loading && results.length === 0) {
    return (
      <div style={{
        padding: 60, textAlign: 'center',
        color: 'var(--text-secondary)',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 13,
      }}>
        <div style={{
          width: 24, height: 24, margin: '0 auto 12px',
          border: '2.5px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
        Searching your Drive...
      </div>
    );
  }

  if (!loading && results.length === 0) {
    return (
      <div style={{
        padding: 60, textAlign: 'center',
        color: 'var(--text-secondary)',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 13,
      }}>
        No files found
      </div>
    );
  }

  return (
    <div>
      {results.map((file) => (
        <a
          key={file.id}
          href={file.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 8,
            textDecoration: 'none',
            color: 'inherit',
            transition: 'background 0.1s',
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {/* Icon */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <FileIcon mimeType={file.mimeType} />
          </div>

          {/* Name + type */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'IBM Plex Mono', monospace",
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {file.name}
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontFamily: "'IBM Plex Mono', monospace",
              marginTop: 1,
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}>
              <span style={{
                padding: '0 5px',
                background: getFileColor(file.mimeType) + '18',
                color: getFileColor(file.mimeType),
                borderRadius: 3,
                fontWeight: 600,
                fontSize: 10,
              }}>
                {getFileType(file.mimeType)}
              </span>
              {file.size && <span>{formatSize(file.size)}</span>}
            </div>
          </div>

          {/* Owner */}
          <div style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            fontFamily: "'IBM Plex Mono', monospace",
            textAlign: 'right',
            flexShrink: 0,
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {file.lastModifyingUser?.displayName ||
             file.owners?.[0]?.displayName || '—'}
          </div>

          {/* Modified date */}
          <div style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            fontFamily: "'IBM Plex Mono', monospace",
            textAlign: 'right',
            flexShrink: 0,
            width: 70,
          }}>
            {formatDate(file.modifiedTime)}
          </div>

          {/* External link icon */}
          <div style={{ flexShrink: 0, color: 'var(--text-secondary)' }}>
            <ExternalLinkIcon />
          </div>
        </a>
      ))}

      {/* Load more */}
      {nextPageToken && (
        <div style={{ padding: '12px 12px 8px', textAlign: 'center' }}>
          <button
            onClick={loadMore}
            disabled={loading}
            style={{
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'IBM Plex Mono', monospace",
              padding: '8px 24px',
              border: '1.5px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.15s',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Loading...' : 'Load more results'}
          </button>
        </div>
      )}
    </div>
  );
}
