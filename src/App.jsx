import React from 'react';
import { useAuth } from './hooks/useAuth';
import { useDriveSearch } from './hooks/useDriveSearch';
import LoginScreen from './components/LoginScreen';
import SearchBar from './components/SearchBar';
import Filters from './components/Filters';
import FileList from './components/FileList';

export default function App() {
  const { user, token, loading: authLoading, error: authError, signIn, signOut } = useAuth();
  const search = useDriveSearch(token);

  // Not authenticated
  if (!token) {
    return <LoginScreen onSignIn={signIn} loading={authLoading} error={authError} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 28px 0',
        maxWidth: 960,
        margin: '0 auto',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1 style={{
              fontSize: 22,
              fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace",
              color: 'var(--accent)',
              letterSpacing: -0.5,
            }}>
              Vélezreyes+
            </h1>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
              Drive Search
            </span>
          </div>

          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user?.picture && (
              <img
                src={user.picture}
                alt=""
                style={{ width: 28, height: 28, borderRadius: '50%' }}
              />
            )}
            <span style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              {user?.name}
            </span>
            <button
              onClick={signOut}
              style={{
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "'IBM Plex Mono', monospace",
                background: 'none',
                border: '1.5px solid var(--border)',
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Search bar */}
        <SearchBar
          query={search.query}
          onChange={search.handleQueryChange}
          loading={search.loading}
        />

        {/* Filters */}
        <div style={{ marginTop: 14 }}>
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

      {/* Results */}
      <div style={{
        maxWidth: 960,
        margin: '14px auto 0',
        padding: '0 28px 40px',
      }}>
        <div style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 12,
          boxShadow: 'var(--shadow)',
          padding: '6px 4px',
          maxHeight: 'calc(100vh - 340px)',
          overflowY: 'auto',
        }}>
          <FileList
            results={search.results}
            loading={search.loading}
            nextPageToken={search.nextPageToken}
            loadMore={search.loadMore}
          />
        </div>
      </div>
    </div>
  );
}
