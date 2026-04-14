import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { List, Grid, Search, ChevronLeft, ChevronRight, ArrowUpDown, ChevronDown, Star } from 'lucide-react';
import { API_ENDPOINTS, API_URL } from '../config/api';
import { useCollections } from '../contexts/CollectionsContext';

// Virtual scroll component for large lists
const VirtualScroll = ({ items, itemHeight, containerHeight, renderItem }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  const visibleItems = items.slice(visibleStart, visibleEnd);
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleStart * itemHeight;
  
  return (
    <div
      ref={containerRef}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.target.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => 
            renderItem(item, visibleStart + index)
          )}
        </div>
      </div>
    </div>
  );
};


// Helper function
const cleanTitle = (title) => {
  if (!title) return title;
  return title.replace(/^\d+\.\d+/, '');
};

// Separate components for better performance
const MangaCard = React.memo(({ manga, onClick, imageObserver, toggleLibrary, isInLibrary }) => {
  const imgRef = useRef(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img && imageObserver) {
      imageObserver.observe(img);
    }

    return () => {
      if (img && imageObserver) {
        imageObserver.unobserve(img);
      }
    };
  }, [imageObserver]);

  const handleLibraryToggle = (e) => {
    e.stopPropagation(); // Prevent card click
    toggleLibrary(manga);
  };

  return (
    <div className="cursor-pointer group" onClick={onClick}>
      <div className="relative overflow-hidden rounded-xl">
        <img
          ref={imgRef}
          data-src={manga.cover_url || manga.cover}
          className="w-full aspect-[3/4.5] object-cover group-hover:scale-105 transition-transform duration-300 bg-gray-800"
          alt={manga.title}
          onError={(e) => {
            e.target.src = "https://via.placeholder.com/300x450/374151/9CA3AF?text=No+Cover";
          }}
        />
        {/* Library star button */}
        <button
          onClick={handleLibraryToggle}
          className="absolute top-2 right-2 p-2 rounded-full bg-black/30 hover:bg-black/50 active:scale-90 transition-all duration-200 backdrop-blur-sm group/btn"
          title={isInLibrary(manga.id) ? "Remove from Library" : "Add to Library"}
        >
          <Star
            size={18}
            fill={isInLibrary(manga.id) ? 'currentColor' : 'none'}
            className={`transition-colors ${
              isInLibrary(manga.id)
                ? 'text-yellow-400'
                : 'text-white/80 group-hover/btn:text-white'
            }`}
          />
        </button>
      </div>
      <div className="mt-2 text-center">
        <h3 className="text-sm font-bold uppercase tracking-tight truncate text-white group-hover:text-blue-400 transition-colors">
          {manga._cleanTitle || cleanTitle(manga.title)}
        </h3>
      </div>
    </div>
  );
});

const MangaListItem = React.memo(({ manga, onClick, imageObserver, toggleLibrary, isInLibrary, mangaDetails }) => {
  const imgRef = useRef(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img && imageObserver) {
      imageObserver.observe(img);
    }

    return () => {
      if (img && imageObserver) {
        imageObserver.unobserve(img);
      }
    };
  }, [imageObserver]);

  const handleLibraryToggle = (e) => {
    e.stopPropagation(); // Prevent card click
    toggleLibrary(manga);
  };

  return (
    <div className="flex gap-3 p-3 hover:bg-white/5 rounded-lg transition-colors cursor-pointer group" onClick={onClick}>
      <div className="relative shrink-0">
        <img
          ref={imgRef}
          data-src={manga.cover_url || manga.cover}
          className="w-14 h-20 object-cover rounded shadow-md group-hover:scale-105 transition-transform bg-gray-800"
          alt={manga.title}
          onError={(e) => {
            e.target.src = "https://via.placeholder.com/80x100/374151/9CA3AF?text=No+Cover";
          }}
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight text-sm">
          {manga._cleanTitle || cleanTitle(manga.title)}
        </p>
      </div>
      {/* Library star button */}
      <button
        onClick={handleLibraryToggle}
        className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all duration-200 group/btn"
        title={isInLibrary(manga.id) ? "Remove from Library" : "Add to Library"}
      >
        <Star
          size={16}
          fill={isInLibrary(manga.id) ? 'currentColor' : 'none'}
          className={`transition-colors ${
            isInLibrary(manga.id)
              ? 'text-yellow-400 group-hover/btn:text-yellow-300'
              : 'text-gray-400 group-hover/btn:text-yellow-400'
          }`}
        />
      </button>
    </div>
  );
});

// Skeleton loading components
const MangaCardSkeleton = () => (
  <div className="animate-pulse">
    <div className="relative overflow-hidden rounded-xl">
      <div className="w-full aspect-[3/4.5] bg-gray-700 rounded-xl"></div>
    </div>
    <div className="mt-2">
      <div className="h-4 bg-gray-700 rounded"></div>
    </div>
  </div>
);

const MangaListItemSkeleton = () => (
  <div className="animate-pulse">
    <div className="flex gap-3 p-3">
      <div className="w-14 h-20 bg-gray-700 rounded shrink-0"></div>
      <div className="flex-1 flex flex-col gap-2 justify-center">
        <div className="h-3 bg-gray-700 rounded w-3/4"></div>
        <div className="h-2 bg-gray-700 rounded w-1/2"></div>
      </div>
    </div>
  </div>
);

const Collections = ({ onMangaSelect, onMangaDetails }) => {
  const { allManga, loading, backgroundLoading: contextBackgroundLoading, mangaDetails, fetchAllManga, sortManga } = useCollections();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [viewMode, setViewMode] = useState(() => {
    // Load view mode from localStorage
    try {
      const saved = localStorage.getItem('collectionViewMode');
      return saved || 'grid';
    } catch {
      return 'grid';
    }
  }); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('---'); // '---', 'title-asc', 'title-desc'
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [estimatedTotalPages, setEstimatedTotalPages] = useState(17); // Start with actual estimate
  const [fetchError, setFetchError] = useState(null); // Error state
  const [isRefreshing, setIsRefreshing] = useState(false); // Refresh state
  const [library, setLibrary] = useState([]); // Track library manga

  // Cache for API responses (still needed for manga info)
  const apiCache = useRef(new Map());
  const infoCache = useRef(new Map());
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('collectionViewMode', viewMode);
    } catch (err) {
      console.error('Failed to save view mode:', err);
    }
  }, [viewMode]);

  // Load library from localStorage on mount
  useEffect(() => {
    const libraryKey = 'mangaLibrary';
    const savedLibrary = JSON.parse(localStorage.getItem(libraryKey) || '[]');
    setLibrary(savedLibrary);
  }, []);

  // Sort options
  const sortOptions = [
    { value: '---', label: 'No Sort' },
    { value: 'title-asc', label: 'Sort A to Z' },
    { value: 'title-desc', label: 'Sort Z to A' }
  ];

  const getCurrentOption = () => sortOptions.find(option => option.value === sortBy);

  // Toggle library status for a manga
  const toggleLibrary = (manga) => {
    const libraryKey = 'mangaLibrary';
    const currentLibrary = JSON.parse(localStorage.getItem(libraryKey) || '[]');
    const inLibrary = currentLibrary.some(item => item.id === manga.id);

    if (inLibrary) {
      // Remove from library
      const updatedLibrary = currentLibrary.filter(item => item.id !== manga.id);
      localStorage.setItem(libraryKey, JSON.stringify(updatedLibrary));
      setLibrary(updatedLibrary);
    } else {
      // Add to library
      const libraryItem = {
        id: manga.id,
        title: manga.title,
        cover_url: manga.cover_url,
        cover: manga.cover,
        dateAdded: new Date().toISOString()
      };
      const updatedLibrary = [...currentLibrary, libraryItem];
      localStorage.setItem(libraryKey, JSON.stringify(updatedLibrary));
      setLibrary(updatedLibrary);
    }
  };

  // Check if manga is in library
  const isInLibrary = (mangaId) => {
    return library.some(item => item.id === mangaId);
  };
  
  // Intersection Observer for lazy loading images
  const imageObserverRef = useRef(null);
  
  // Setup intersection observer for lazy loading
  useEffect(() => {
    imageObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.dataset.src;
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              imageObserverRef.current.unobserve(img);
            }
          }
        });
      },
      { rootMargin: '50px' }
    );
    
    return () => {
      if (imageObserverRef.current) {
        imageObserverRef.current.disconnect();
      }
    };
  }, []);

  // Persistent cache functions
  const getPersistentCache = (key) => {
    try {
      const cached = localStorage.getItem(`collectionsCache_${key}`);
      if (cached) {
        const data = JSON.parse(cached);
        // Check if cache is still valid (1 hour)
        if (Date.now() - data.timestamp < 60 * 60 * 1000) {
          return data;
        }
      }
    } catch (err) {
      console.warn('Failed to read persistent cache:', err);
    }
    return null;
  };

  const setPersistentCache = (key, data) => {
    try {
      const cacheData = {
        ...data,
        timestamp: Date.now()
      };
      localStorage.setItem(`collectionsCache_${key}`, JSON.stringify(cacheData));
    } catch (err) {
      console.warn('Failed to write persistent cache:', err);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(allManga.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = allManga.slice(indexOfFirstItem, indexOfLastItem);

  // Filter and sort manga (optimized with useMemo)
  const filteredAndSortedManga = useMemo(() => {
    // Early return if no data
    if (allManga.length === 0) return [];
        
    // Use Web Worker for heavy filtering if available
    if (window.Worker && allManga.length > 1000) {
      // For very large datasets, consider using Web Workers
      console.log('Large dataset detected, consider using Web Workers for filtering');
    }
    
    let filtered = allManga;
    
    // Apply search filter (optimized with pre-computed lowercase titles)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(manga => {
        const title = manga.title || '';
        const cleanTitleValue = manga._cleanTitle || (manga._cleanTitle = cleanTitle(title));
        const lowerTitle = manga._lowerTitle || (manga._lowerTitle = title.toLowerCase());
        const lowerCleanTitle = manga._lowerCleanTitle || (manga._lowerCleanTitle = cleanTitleValue.toLowerCase());

        return lowerTitle.includes(query) || lowerCleanTitle.includes(query);
      });
    }

    // Apply sorting (optimized)
    const sorted = sortBy === '---' ? [...filtered] : [...filtered].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'title-asc':
          aValue = a._cleanTitle || (a._cleanTitle = cleanTitle(a.title));
          bValue = b._cleanTitle || (b._cleanTitle = cleanTitle(b.title));
          aValue = a._lowerCleanTitle || (a._lowerCleanTitle = aValue.toLowerCase());
          bValue = b._lowerCleanTitle || (b._lowerCleanTitle = bValue.toLowerCase());
          return aValue.localeCompare(bValue);
        case 'title-desc':
          aValue = a._cleanTitle || (a._cleanTitle = cleanTitle(a.title));
          bValue = b._cleanTitle || (b._cleanTitle = cleanTitle(b.title));
          aValue = a._lowerCleanTitle || (a._lowerCleanTitle = aValue.toLowerCase());
          bValue = b._lowerCleanTitle || (b._lowerCleanTitle = bValue.toLowerCase());
          return bValue.localeCompare(aValue);
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [allManga, searchQuery, sortBy]);

  // Update pagination when filtered results change
  const actualTotalPages = Math.ceil(filteredAndSortedManga.length / itemsPerPage);
  // Use estimated pages during initial loading or background loading
  const filteredTotalPages = (loading || contextBackgroundLoading) ? estimatedTotalPages : Math.max(actualTotalPages, estimatedTotalPages);
  const filteredCurrentItems = filteredAndSortedManga.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when search or sort changes (optimized)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  // Remove debounce for faster typing - DISABLED
  // const debouncedSearch = useCallback(
  //   debounce((value) => {
  //     setSearchQuery(value);
  //   }, 300),
  //   []
  // );

  // Lightweight function to get basic manga info (total chapters, status) with caching
  // NOTE: This is now handled by CollectionsContext, keeping for prefetch only
  const fetchBasicMangaInfo = async (mangaId) => {
    // Check memory cache first
    if (infoCache.current.has(mangaId)) {
      return infoCache.current.get(mangaId);
    }

    // Check persistent cache
    const persistentCache = getPersistentCache(`info_${mangaId}`);
    if (persistentCache) {
      // Also store in memory cache for this session
      infoCache.current.set(mangaId, persistentCache.data);
      return persistentCache.data;
    }

    // Fetch from API
    try {
      const response = await fetch(`${API_URL}api/kaynscan/manga/?id=${encodeURIComponent(mangaId)}`);
      if (response.ok) {
        const info = await response.json();

        // Cache in both memory and persistent storage
        infoCache.current.set(mangaId, info);
        setPersistentCache(`info_${mangaId}`, { data: info });

        return info;
      }
    } catch (error) {
      console.error(`Failed to fetch basic info for ${mangaId}:`, error);
    }

    return null;
  };

  // Fetch basic info for current page items (batched for performance)
  const fetchBasicInfoForPage = useCallback(async (pageItems) => {
    const itemsToFetch = pageItems.filter(manga => !mangaDetails[manga.id]);
    
    if (itemsToFetch.length === 0) return;
    
    
    // Fetch in larger batches for better performance
    const batchSize = 10; // Increased batch size
    const batches = [];
    
    for (let i = 0; i < itemsToFetch.length; i += batchSize) {
      batches.push(itemsToFetch.slice(i, i + batchSize));
    }
    
    // Use Promise.allSettled for better error handling
    const batchPromises = batches.map(async (batch, batchIndex) => {
      const infoPromises = batch.map(async (manga) => {
        try {
          const info = await fetchBasicMangaInfo(manga.id);
          return { mangaId: manga.id, info, success: true };
        } catch (error) {
          console.error(`Failed to fetch info for ${manga.id}:`, error);
          return { mangaId: manga.id, info: null, success: false };
        }
      });
      
      const results = await Promise.allSettled(infoPromises);
      return results.map(result => 
        result.status === 'fulfilled' ? result.value : { success: false }
      );
    });
    
    // Process batches concurrently with controlled concurrency
    const concurrencyLimit = 3;
    for (let i = 0; i < batchPromises.length; i += concurrencyLimit) {
      const currentBatch = batchPromises.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(currentBatch);
      
      // Update state with successful results
      const detailsMap = { ...mangaDetails };
      batchResults.flat().forEach(({ mangaId, info, success }) => {
        if (success && info) {
          detailsMap[mangaId] = info;
        }
      });
      // NOTE: Not setting mangaDetails locally anymore, context handles it
      // setMangaDetails(detailsMap);
    }
  }, [mangaDetails, currentPage]);

  // Refresh function
  const handleRefresh = useCallback(() => {
    // Clear all caches (both memory and persistent)
    apiCache.current.clear();
    infoCache.current.clear();

    // Clear persistent cache keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('collectionsCache_')) {
        localStorage.removeItem(key);
      }
    });

    // Force refresh using context
    fetchAllManga(true);
  }, [fetchAllManga]);

  // Optimized prefetch next page data
  useEffect(() => {
    if (currentPage < filteredTotalPages && !loading && allManga.length > 0) {
      const nextPage = currentPage + 1;
      const nextPageStart = (nextPage - 1) * itemsPerPage;
      const nextPageEnd = nextPage * itemsPerPage;
      const nextPageItems = filteredAndSortedManga.slice(nextPageStart, nextPageEnd);
      
      if (nextPageItems.length > 0) {
        // Use requestIdleCallback for non-blocking prefetch
        const prefetchData = () => {
          const itemsToPrefetch = nextPageItems.slice(0, 5); // Prefetch more items
          const prefetchPromises = itemsToPrefetch
            .filter(manga => !mangaDetails[manga.id])
            .map(manga => 
              fetchBasicMangaInfo(manga.id).then(info => ({ mangaId: manga.id, info }))
                .catch(() => ({ mangaId: manga.id, info: null }))
            );
          
          if (prefetchPromises.length > 0) {
            Promise.allSettled(prefetchPromises).then(results => {
              const detailsMap = { ...mangaDetails };
              results.forEach(result => {
                if (result.status === 'fulfilled' && result.value.info) {
                  detailsMap[result.value.mangaId] = result.value.info;
                }
              });
              // NOTE: Not setting mangaDetails locally anymore, context handles it
              // setMangaDetails(detailsMap);
            });
          }
        };
        
        if (window.requestIdleCallback) {
          window.requestIdleCallback(prefetchData, { timeout: 2000 });
        } else {
          setTimeout(prefetchData, 100); // Fallback
        }
      }
    }
  }, [currentPage, filteredTotalPages, loading, filteredAndSortedManga, mangaDetails, itemsPerPage]);

  // Pagination controls
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  // Optimized grid view with lazy loading and skeleton
  const renderGridView = () => {
    const items = filteredCurrentItems;
    const maxPageItems = itemsPerPage;
    const isPageLoading = contextBackgroundLoading && currentPage > Math.floor(allManga.length / itemsPerPage);
    
    // Show "No results" message when search returns empty
    if (searchQuery && filteredAndSortedManga.length === 0 && !loading) {
      return (
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <div className="text-6xl mb-4">¯\_(°_o)_/¯</div>
          <p className="text-xl font-medium mb-2">No results found</p>
          <p className="text-sm">Try searching for something else</p>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((manga, index) => (
          <MangaCard
            key={manga.id || index}
            manga={manga}
            onClick={() => onMangaDetails(manga)}
            imageObserver={imageObserverRef.current}
            toggleLibrary={toggleLibrary}
            isInLibrary={isInLibrary}
          />
        ))}
        {/* Show skeleton loading if page is still loading */}
        {isPageLoading && Array.from({ length: maxPageItems - items.length }).map((_, index) => (
          <MangaCardSkeleton key={`skeleton-${index}`} />
        ))}
      </div>
    );
  };

  // Optimized list view with lazy loading and skeleton
  const renderListView = () => {
    const items = filteredCurrentItems;
    const maxPageItems = itemsPerPage;
    const isPageLoading = contextBackgroundLoading && currentPage > Math.floor(allManga.length / itemsPerPage);
    
    // Show "No results" message when search returns empty
    if (searchQuery && filteredAndSortedManga.length === 0 && !loading) {
      return (
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <div className="text-6xl mb-4">¯\_(°_o)_/¯</div>
          <p className="text-xl font-medium mb-2">No results found</p>
          <p className="text-sm">Try searching for something else</p>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((manga, index) => (
          <MangaListItem
            key={manga.id || index}
            manga={manga}
            onClick={() => onMangaDetails(manga)}
            imageObserver={imageObserverRef.current}
            toggleLibrary={toggleLibrary}
            isInLibrary={isInLibrary}
            mangaDetails={mangaDetails}
          />
        ))}
        {/* Show skeleton loading if page is still loading */}
        {isPageLoading && Array.from({ length: maxPageItems - items.length }).map((_, index) => (
          <MangaListItemSkeleton key={`skeleton-list-${index}`} />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-3xl font-bold text-white">Collections</h1>
          </div>

          {/* Loading Skeleton Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 20 }).map((_, index) => (
              <div key={index} className="flex flex-col">
                <div className="relative aspect-[3/4.5] w-full rounded-xl overflow-hidden mb-3 border border-white/5">
                  <div className="w-full h-full bg-gray-800/50 animate-pulse" />
                </div>
                <div className="mt-2 text-center">
                  <div className="h-4 bg-gray-800/50 rounded animate-pulse mb-2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Error Handling */}
        {fetchError && (
          <div className="bg-red-600/10 border border-red-600/20 text-red-400 p-4 mb-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">Error loading collections</p>
                <p className="text-sm">{fetchError}</p>
              </div>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Collections</h1>
          <div className="text-sm text-gray-400">
            {searchQuery ? 
              `${filteredAndSortedManga.length} found` : 
              contextBackgroundLoading ? `~323 total (${allManga.length} loaded)` : `${allManga.length} total`
            }
          </div>
        </div>

        {/* Search and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/5 focus:border-blue-500/50 focus:bg-white/[0.06] outline-none transition-all text-sm"
              />
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex gap-2 items-center">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.03] border border-white/5 rounded-2xl text-white hover:bg-white/[0.06] transition-all text-sm focus:border-blue-500/50 outline-none"
              >
                <span>{getCurrentOption()?.label}</span>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-[#050505] border border-white/5 rounded-2xl shadow-lg z-50">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        setDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                        sortBy === option.value
                          ? 'bg-blue-500/20 text-white border-l-2 border-blue-500'
                          : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* View Mode Toggle - Right Side */}
            <div className="flex items-center bg-white/[0.03] border border-white/5 rounded-lg p-1 ml-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        
        {/* Content */}
        {viewMode === 'grid' ? renderGridView() : renderListView()}

        {/* Pagination Controls */}
        {filteredTotalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-8">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className={`p-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center ${
                currentPage === 1
                  ? 'bg-white/[0.02] text-gray-600 cursor-not-allowed border border-white/5'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/10 hover:border-white/20'
              }`}
            >
              <ChevronLeft size={16} />
            </button>
            
            {/* Page Numbers */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, filteredTotalPages) }, (_, i) => {
                let pageNum;
                if (filteredTotalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= filteredTotalPages - 2) {
                  pageNum = filteredTotalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all duration-200 ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={handleNextPage}
              disabled={currentPage === filteredTotalPages}
              className={`p-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center ${
                currentPage === filteredTotalPages
                  ? 'bg-white/[0.02] text-gray-600 cursor-not-allowed border border-white/5'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/10 hover:border-white/20'
              }`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        
        {/* Page Info */}
        {filteredTotalPages > 1 && (
          <div className="text-center mt-4 text-sm text-gray-500">
            Page {currentPage} of {filteredTotalPages}
          </div>
        )}
      </div>
    </div>
  );
};

export default Collections;
