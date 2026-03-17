import { useState, useEffect, useCallback, useRef } from 'react';
import { searchFiles, listTopFolders, listOwners } from '../utils/driveApi';
import { debounce } from '../utils/helpers';

const SHARED_DRIVE_ID = import.meta.env.VITE_SHARED_DRIVE_ID;

export function useDriveSearch(token) {
  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [totalShown, setTotalShown] = useState(0);

  // Filters
  const [filterFolder, setFilterFolder] = useState(null);   // { id, name }
  const [filterType, setFilterType] = useState(null);        // 'document' | 'spreadsheet' | 'folder' | etc.
  const [filterOwner, setFilterOwner] = useState(null);      // email string
  const [filterDateAfter, setFilterDateAfter] = useState('');
  const [filterDateBefore, setFilterDateBefore] = useState('');
  const [sortBy, setSortBy] = useState('modifiedTime desc');

  // Metadata loaded from Drive
  const [topFolders, setTopFolders] = useState([]);
  const [owners, setOwners] = useState([]);
  const [metaLoading, setMetaLoading] = useState(false);

  const searchIdRef = useRef(0);

  // Load folder list and owners on mount
  useEffect(() => {
    if (!token) return;
    setMetaLoading(true);

    Promise.all([
      listTopFolders(token, SHARED_DRIVE_ID),
      listOwners(token, SHARED_DRIVE_ID),
    ])
      .then(([folders, ownersList]) => {
        setTopFolders(folders);
        setOwners(ownersList);
      })
      .catch(console.error)
      .finally(() => setMetaLoading(false));
  }, [token]);

  // Core search function
  const executeSearch = useCallback(async (opts = {}) => {
    if (!token) return;

    const id = ++searchIdRef.current;
    const isLoadMore = !!opts.pageToken;

    if (!isLoadMore) {
      setLoading(true);
      setResults([]);
      setNextPageToken(null);
      setTotalShown(0);
    }

    try {
      const result = await searchFiles(token, {
        sharedDriveId: SHARED_DRIVE_ID,
        query: opts.query ?? query,
        folderId: opts.folderId ?? filterFolder?.id,
        mimeType: opts.mimeType ?? filterType,
        owner: opts.owner ?? filterOwner,
        modifiedAfter: opts.modifiedAfter ?? filterDateAfter || undefined,
        modifiedBefore: opts.modifiedBefore ?? filterDateBefore || undefined,
        orderBy: opts.sortBy ?? sortBy,
        pageToken: opts.pageToken,
        pageSize: 50,
      });

      // Only apply if this is still the latest search
      if (id === searchIdRef.current) {
        if (isLoadMore) {
          setResults(prev => [...prev, ...result.files]);
          setTotalShown(prev => prev + result.files.length);
        } else {
          setResults(result.files);
          setTotalShown(result.files.length);
        }
        setNextPageToken(result.nextPageToken);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      if (id === searchIdRef.current) {
        setLoading(false);
      }
    }
  }, [token, query, filterFolder, filterType, filterOwner, filterDateAfter, filterDateBefore, sortBy]);

  // Debounced search for query typing
  const debouncedSearch = useCallback(
    debounce((q) => {
      executeSearch({ query: q });
    }, 400),
    [executeSearch]
  );

  // Trigger search when query changes
  const handleQueryChange = useCallback((newQuery) => {
    setQuery(newQuery);
    debouncedSearch(newQuery);
  }, [debouncedSearch]);

  // Trigger search when filters change
  useEffect(() => {
    if (token) {
      executeSearch();
    }
  }, [filterFolder, filterType, filterOwner, filterDateAfter, filterDateBefore, sortBy]);

  // Load initial results
  useEffect(() => {
    if (token) {
      executeSearch();
    }
  }, [token]);

  // Load more
  const loadMore = useCallback(() => {
    if (nextPageToken) {
      executeSearch({ pageToken: nextPageToken });
    }
  }, [nextPageToken, executeSearch]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setQuery('');
    setFilterFolder(null);
    setFilterType(null);
    setFilterOwner(null);
    setFilterDateAfter('');
    setFilterDateBefore('');
    setSortBy('modifiedTime desc');
  }, []);

  const hasFilters = query || filterFolder || filterType || filterOwner || filterDateAfter || filterDateBefore;

  return {
    // Search
    query, handleQueryChange,
    results, loading, nextPageToken, totalShown, loadMore,
    // Filters
    filterFolder, setFilterFolder,
    filterType, setFilterType,
    filterOwner, setFilterOwner,
    filterDateAfter, setFilterDateAfter,
    filterDateBefore, setFilterDateBefore,
    sortBy, setSortBy,
    // Meta
    topFolders, owners, metaLoading,
    // Utilities
    hasFilters, clearFilters, executeSearch,
  };
}
