import React, { useRef, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useDriveSearch } from './hooks/useDriveSearch';
import { listSubfolders } from './utils/driveApi';
import { formatDate, formatSize, getFileType, getFileColor } from './utils/helpers';
import LoginScreen from './components/LoginScreen';
import SearchBar from './components/SearchBar';
import Filters from './components/Filters';
import FileList from './components/FileList';
import Classify from './components/Classify';
import ErrorBoundary from './components/ErrorBoundary';

const SHARED_DRIVE_ID = import.meta.env.VITE_SHARED_DRIVE_ID;

/* ─── Auth splash ─────────────────────────────────────────── */

/* Shown while GIS loads and the silent token request resolves, so a reload with a live
   Google session never flashes the sign-in card. */
function AuthSplash() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 22,
    }}>
      <div style={{
        width: 38, height: 38,
        background: 'linear-gradient(135deg, #0648B3 0%, #1A80E8 100%)',
        borderRadius: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(6, 72, 179, 0.3)',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <div style={{
        width: 28, height: 28,
        border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.65s linear infinite',
      }} />
    </div>
  );
}

/* ─── Mode tabs ───────────────────────────────────────────── */

const MODES = [
  { key: 'search', label: 'Search' },
  { key: 'classify', label: 'Classify' },
];

function ModeTabs({ mode, onChange }) {
  const tabRefs = useRef([]);

  /* Roving tabindex: the tablist is a single tab stop and the arrows move within it,
     so Tab doesn't have to walk past every tab to reach the panel. */
  const handleKeyDown = (e) => {
    const current = MODES.findIndex(m => m.key === mode);
    let next;
    if (e.key === 'ArrowRight') next = (current + 1) % MODES.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + MODES.length) % MODES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = MODES.length - 1;
    else return;

    e.preventDefault();
    onChange(MODES[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="View"
      onKeyDown={handleKeyDown}
      style={{
        display: 'inline-flex',
        gap: 3,
        padding: 3,
        background: 'var(--surface)',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: 20,
      }}>
      {MODES.map((m, i) => {
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            ref={el => { tabRefs.current[i] = el; }}
            role="tab"
            id={`tab-${m.key}`}
            aria-selected={active}
            aria-controls={`panel-${m.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(m.key)}
            style={{
              padding: '6px 18px',
              fontSize: 12, fontWeight: 700,
              fontFamily: 'var(--sans)',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--hover)'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Detail panel ────────────────────────────────────────── */

function DetailRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-start', gap: 12,
      padding: '9px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', textAlign: 'right', wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  );
}

function DetailPanel({ item, onClose }) {
  const color = getFileColor(item.mimeType);
  const isFolder = item.mimeType === 'application/vnd.google-apps.folder';

  return (
    <div style={{
      width: 272,
      flexShrink: 0,
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-elevated)',
      overflow: 'hidden',
      animation: 'fadeSlideIn 0.2s ease',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 18px',
        background: 'var(--surface-raised)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.9 }}>
          {isFolder ? 'Folder' : 'File'} Info
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 2, borderRadius: 4,
            display: 'flex', lineHeight: 1,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Icon + name */}
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          width: 44, height: 44,
          background: color + '18',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 12,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={color + '22'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isFolder
              ? <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              : <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>
            }
          </svg>
        </div>

        <span style={{ display: 'inline-block', padding: '2px 8px', background: color + '15', color, borderRadius: 20, fontWeight: 700, fontSize: 10, marginBottom: 8 }}>
          {getFileType(item.mimeType)}
        </span>

        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)', lineHeight: 1.45, wordBreak: 'break-word' }}>
          {item.name}
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: '0 18px' }}>
        {item.size && <DetailRow label="Size" value={formatSize(item.size)} />}
        <DetailRow label="Modified" value={formatDate(item.modifiedTime)} />
        {item.createdTime && <DetailRow label="Created" value={formatDate(item.createdTime)} />}
        {item.lastModifyingUser?.displayName && (
          <DetailRow label="Last by" value={item.lastModifyingUser.displayName} />
        )}
        {item.owners?.[0]?.displayName && (
          <DetailRow label="Owner" value={item.owners[0].displayName} />
        )}
      </div>

      {/* CTA */}
      {item.webViewLink && (
        <div style={{ padding: '16px 18px' }}>
          <a
            href={item.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '10px 16px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 700,
              transition: 'background 0.15s, box-shadow 0.15s',
              boxShadow: '0 4px 12px rgba(6, 72, 179, 0.3)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
          >
            Open in Drive
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

/* ─── App ─────────────────────────────────────────────────── */

export default function App() {
  const { user, token, initializing: authInitializing, loading: authLoading, error: authError, signIn, signOut } = useAuth();
  const search = useDriveSearch(token);

  const [mode, setMode] = useState('search');
  const [selectedItem, setSelectedItem] = useState(null);
  const [browseStack, setBrowseStack] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  const currentBrowseItems = browseStack.length > 0
    ? browseStack[browseStack.length - 1].items
    : null;

  const handleSingleClick = async (item) => {
    const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
    if (isFolder) {
      setBrowseLoading(true);
      setSelectedItem(null);
      try {
        const subfolders = await listSubfolders(token, item.id, SHARED_DRIVE_ID);
        if (subfolders.length > 0) {
          setBrowseStack(prev => [...prev, { folder: item, items: subfolders }]);
        } else {
          setSelectedItem(item);
        }
      } catch (err) {
        console.error('Folder browse error:', err);
      } finally {
        setBrowseLoading(false);
      }
    } else {
      setSelectedItem(item);
    }
  };

  const handleDoubleClick = (item) => {
    if (item.webViewLink) window.open(item.webViewLink, '_blank', 'noopener,noreferrer');
  };

  const handleBack = () => {
    setBrowseStack(prev => prev.slice(0, -1));
    setSelectedItem(null);
  };

  if (authInitializing) {
    return <AuthSplash />;
  }

  if (!token) {
    return <LoginScreen onSignIn={signIn} loading={authLoading} error={authError} />;
  }

  const displayItems = currentBrowseItems ?? search.results;
  const displayLoading = browseLoading || (currentBrowseItems === null && search.loading);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--sans)' }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-navbar)',
        padding: '0 32px',
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.4, lineHeight: 1.2 }}>RADAR</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.2 }}>
              <h4>Repository for Assets, Decisions, Analysis, and Research</h4>
            </div>
          </div>
        </div>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user?.picture && (
            <img src={user.picture} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border)' }} />
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{user?.name}</div>
            {user?.email && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.email}</div>
            )}
          </div>
          <button
            onClick={signOut}
            style={{
              fontSize: 12, fontWeight: 700,
              fontFamily: 'var(--sans)',
              background: 'none',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 14px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px 60px' }}>

        <ModeTabs mode={mode} onChange={setMode} />

        {/* ── Search mode ── */}
        {/* Kept mounted while classifying so query, filters and browse position survive.
            Visibility stays on `display` rather than `hidden`, which an inline
            display:block would override. */}
        <div
          role="tabpanel"
          id="panel-search"
          aria-labelledby="tab-search"
          tabIndex={0}
          style={{ display: mode === 'search' ? 'block' : 'none' }}
        >
          {/* Boundary sits inside the toggle so a crash in a hidden tab stays hidden. */}
          <ErrorBoundary label="the Search tab">

          {/* Search + filters card */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            padding: '20px 24px',
            marginBottom: 20,
          }}>
            <SearchBar query={search.query} onChange={search.handleQueryChange} loading={search.loading} />
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <Filters
                topFolders={search.topFolders}
                owners={search.owners}
                filterFolder={search.filterFolder}
                setFilterFolder={search.setFilterFolder}
                filterType={search.filterType}
                setFilterType={search.setFilterType}
                filterOwner={search.filterOwner}
                setFilterOwner={search.setFilterOwner}
                filterDateAfter={search.filterDateAfter}
                setFilterDateAfter={search.setFilterDateAfter}
                filterDateBefore={search.filterDateBefore}
                setFilterDateBefore={search.setFilterDateBefore}
                sortBy={search.sortBy}
                setSortBy={search.setSortBy}
                hasFilters={search.hasFilters}
                clearFilters={search.clearFilters}
                totalShown={search.totalShown}
              />
            </div>
          </div>

          {/* Folder breadcrumb */}
          {browseStack.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: 8, marginBottom: 12,
            }}>
              <button
                onClick={handleBack}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '5px 12px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 700,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
                Back
              </button>

              <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>·</span>

              {browseStack.map((entry, i) => (
                <React.Fragment key={entry.folder.id}>
                  {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/</span>}
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: i === browseStack.length - 1 ? 'var(--text)' : 'var(--text-secondary)',
                  }}>
                    {entry.folder.name}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Results area */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* File list card */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow)',
                overflow: 'hidden',
                maxHeight: 'calc(100vh - 320px)',
                overflowY: 'auto',
              }}>
                <FileList
                  results={displayItems}
                  loading={displayLoading}
                  nextPageToken={currentBrowseItems ? null : search.nextPageToken}
                  loadMore={currentBrowseItems ? undefined : search.loadMore}
                  onSingleClick={handleSingleClick}
                  onDoubleClick={handleDoubleClick}
                />
              </div>
            </div>

            {/* Detail panel */}
            {selectedItem && (
              <DetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
            )}
          </div>

          </ErrorBoundary>
        </div>

        {/* ── Classify mode ── */}
        <div
          role="tabpanel"
          id="panel-classify"
          aria-labelledby="tab-classify"
          tabIndex={0}
          style={{ display: mode === 'classify' ? 'block' : 'none' }}
        >
          <ErrorBoundary label="the Classify tab">
            <Classify />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
