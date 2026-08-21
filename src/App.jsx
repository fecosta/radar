import React, { useRef, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { ACCESS_STATUS, isAuthorized } from './hooks/useRadarAccess';
import { useDriveSearch } from './hooks/useDriveSearch';
import { listSubfolders } from './utils/driveApi';
import { formatDate, formatSize, getFileType } from './utils/helpers';
import LoginScreen from './components/LoginScreen';
import AccessGate from './components/AccessGate';
import SearchBar from './components/SearchBar';
import Filters from './components/Filters';
import FileList from './components/FileList';
import Classify from './components/Classify';
import CreateStructure from './components/CreateStructure/CreateStructure';
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
        background: 'var(--ink)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--on-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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

/* ─── Navbar helpers ──────────────────────────────────────── */

/** The initial letters of RADAR are picked out of the expansion. */
const Initial = ({ children }) => (
  <span style={{ color: 'var(--on-ink)', fontWeight: 800 }}>{children}</span>
);

/**
 * Up to two initials for the avatar. The brand shows initials rather than the Google
 * profile photo, so nothing is fetched from a third-party image host to render the navbar.
 */
function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/* ─── Mode tabs ───────────────────────────────────────────── */

const MODES = [
  { key: 'search', label: 'Search' },
  { key: 'classify', label: 'Classify' },
  { key: 'create', label: 'Create structure' },
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
        gap: 4,
        padding: 4,
        background: 'var(--surface-raised)',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--radius-pill)',
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
              padding: '9px 22px',
              fontSize: 12.5, fontWeight: 700,
              fontFamily: 'var(--sans)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-inert)'; }}
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

function DetailRow({ label, value, mono }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-start', gap: 12,
      padding: '11px 0',
      borderBottom: '1.5px dotted var(--rule)',
    }}>
      <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.9, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontFamily: mono ? 'var(--mono)' : 'var(--body)', fontSize: 12, fontWeight: mono ? 400 : 500, color: 'var(--text)', textAlign: 'right', wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  );
}

function DetailPanel({ item, onClose }) {
  const isFolder = item.mimeType === 'application/vnd.google-apps.folder';

  return (
    <div style={{
      width: 296,
      flexShrink: 0,
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      animation: 'fadeSlideIn 0.2s ease',
    }}>
      {/* Panel header — the brand's green band */}
      <div style={{
        padding: '14px 18px',
        background: 'var(--success)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 800, color: 'var(--ink-hover)', textTransform: 'uppercase', letterSpacing: 1.1 }}>
          {isFolder ? 'Folder' : 'File'} info
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--ink-hover)', padding: 2, borderRadius: 4,
            display: 'flex', lineHeight: 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Type + name */}
      <div style={{ padding: '18px', borderBottom: '1.5px dotted var(--rule)' }}>
        <span style={{
          display: 'inline-block',
          fontFamily: 'var(--sans)',
          fontSize: 10, fontWeight: 800,
          letterSpacing: 0.9, textTransform: 'uppercase',
          color: 'var(--on-accent)',
          background: 'var(--accent)',
          borderRadius: 'var(--radius-pill)',
          padding: '4px 11px',
          marginBottom: 12,
        }}>
          {getFileType(item.mimeType)}
        </span>

        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
          {item.name}
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: '4px 18px' }}>
        {item.size && <DetailRow label="Size" value={formatSize(item.size)} mono />}
        <DetailRow label="Modified" value={formatDate(item.modifiedTime)} mono />
        {item.createdTime && <DetailRow label="Created" value={formatDate(item.createdTime)} mono />}
        {item.lastModifyingUser?.displayName && (
          <DetailRow label="Last by" value={item.lastModifyingUser.displayName} />
        )}
        {item.owners?.[0]?.displayName && (
          <DetailRow label="Owner" value={item.owners[0].displayName} />
        )}
      </div>

      {/* CTA */}
      {item.webViewLink && (
        <div style={{ padding: '16px 18px 20px' }}>
          <a
            href={item.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 16px',
              background: 'var(--ink)',
              color: 'var(--on-ink)',
              borderRadius: 'var(--radius-pill)',
              textDecoration: 'none',
              fontFamily: 'var(--sans)',
              fontSize: 12.5,
              fontWeight: 700,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--ink)'}
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
  const {
    user, token, loading: authLoading, error: authError,
    accessStatus, retryAccessCheck, signIn, signOut,
  } = useAuth();

  /**
   * The Drive token is withheld until authorization completes. Passing `token` unconditionally
   * would have this hook fetch folders and owners the instant Google issued a token — before
   * the domain and Drive checks resolve, and for accounts RADAR is about to refuse. Google
   * would still enforce its own permissions, but RADAR should not be asking on their behalf.
   */
  const authorized = isAuthorized(accessStatus);
  const search = useDriveSearch(authorized ? token : null);

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

  /* ── Access gate ──────────────────────────────────────────
     The single point where RADAR decides whether to render itself. Every state other than
     `authorized` returns before the application tree below, so protected content cannot
     appear while a check is pending or after one has failed. Hiding navigation would not be
     enough — nothing protected is mounted at all. */

  if (accessStatus === ACCESS_STATUS.INITIALIZING) {
    return <AuthSplash />;
  }

  if (accessStatus === ACCESS_STATUS.SIGNED_OUT) {
    return <LoginScreen onSignIn={signIn} loading={authLoading} error={authError} />;
  }

  if (!authorized) {
    return (
      <AccessGate
        status={accessStatus}
        email={user?.email}
        onRetry={retryAccessCheck}
        onSignOut={signOut}
      />
    );
  }

  const displayItems = currentBrowseItems ?? search.results;
  const displayLoading = browseLoading || (currentBrowseItems === null && search.loading);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--body)' }}>

      {/* ── Navbar ── */}
      <nav data-on-ink style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--ink)',
        padding: '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      }}>
        {/* Brand — the wordmark, with the acronym spelled out beneath it */}
        <div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 24, fontWeight: 800, letterSpacing: 2.5, color: 'var(--on-ink)', lineHeight: 1 }}>RADAR</div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 600, letterSpacing: 1.3, textTransform: 'uppercase', color: 'var(--on-ink-muted)', marginTop: 6 }}>
            <Initial>R</Initial>epository for <Initial>A</Initial>ssets, <Initial>D</Initial>ecisions,{' '}
            <Initial>A</Initial>nalysis, and <Initial>R</Initial>esearch
          </div>
        </div>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700, color: 'var(--on-ink)', lineHeight: 1.3 }}>{user?.name}</div>
            {user?.email && (
              <div style={{ fontSize: 11, color: 'var(--on-ink-muted)' }}>{user.email}</div>
            )}
          </div>
          <div
            aria-hidden="true"
            style={{
              width: 38, height: 38, flexShrink: 0,
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {initialsOf(user?.name)}
          </div>
          <button
            onClick={signOut}
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 11, fontWeight: 700,
              letterSpacing: 0.8, textTransform: 'uppercase',
              background: 'transparent',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-pill)',
              padding: '8px 16px',
              cursor: 'pointer',
              color: 'var(--on-ink)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--on-ink)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ink-border)'; }}
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
            padding: '20px 24px',
            marginBottom: 18,
          }}>
            <SearchBar query={search.query} onChange={search.handleQueryChange} loading={search.loading} />
            <div style={{ marginTop: 18, borderTop: '1.5px dotted var(--border)', paddingTop: 16 }}>
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
              gap: 9, marginBottom: 12, flexWrap: 'wrap',
            }}>
              <button
                onClick={handleBack}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '7px 14px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--sans)',
                  fontSize: 11.5, fontWeight: 700,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text)'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
                Back
              </button>

              {browseStack.map((entry, i) => {
                const last = i === browseStack.length - 1;
                return (
                  <React.Fragment key={entry.folder.id}>
                    {i > 0 && <span style={{ color: 'var(--text-disabled)', fontSize: 12 }}>/</span>}
                    <span style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 12.5,
                      fontWeight: last ? 700 : 400,
                      color: last ? 'var(--text)' : 'var(--text-muted)',
                    }}>
                      {entry.folder.name}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Results area */}
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            {/* File list card */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                maxHeight: 'calc(100vh - 340px)',
                overflowY: 'auto',
              }}>
                <FileList
                  results={displayItems}
                  loading={displayLoading}
                  nextPageToken={currentBrowseItems ? null : search.nextPageToken}
                  loadMore={currentBrowseItems ? undefined : search.loadMore}
                  onSingleClick={handleSingleClick}
                  onDoubleClick={handleDoubleClick}
                  hasFilters={search.hasFilters}
                  onClearFilters={search.clearFilters}
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

        {/* ── Create structure mode ── */}
        {/* Unmounted while inactive: this is the only write-capable workflow, so it should not
            hold an elevated token or a half-finished plan in a tab nobody is looking at. */}
        <div
          role="tabpanel"
          id="panel-create"
          aria-labelledby="tab-create"
          tabIndex={0}
          style={{ display: mode === 'create' ? 'block' : 'none' }}
        >
          <ErrorBoundary label="the Create structure tab">
            {mode === 'create' && <CreateStructure user={user} />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
