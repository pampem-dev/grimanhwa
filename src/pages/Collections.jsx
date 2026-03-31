import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Book, Grid, List, Search, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, ArrowUpDown } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

import MangaCard from '../components/MangaCard';

const Collections = ({ onMangaSelect, onMangaDetails }) => {
  const [allManga, setAllManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // 19 items per page to match AsuraScans (322/17 ≈ 19)
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('title'); // 'title', 'rating', 'latest'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  const [mangaDetails, setMangaDetails] = useState({}); // Store basic manga info
  const [fetchError, setFetchError] = useState(null); // Error state
  const [isRefreshing, setIsRefreshing] = useState(false); // Refresh state

  // Cache for API responses
  const apiCache = useRef(new Map());
  const infoCache = useRef(new Map());

  // Persistent cache functions
  const getPersistentCache = (key) => {
    try {
      const cached = localStorage.getItem(`collectionsCache_${key}`);
      if (cached) {
        const data = JSON.parse(cached);
        // Check if cache is still valid (5 minutes)
        if (Date.now() - data.timestamp < 5 * 60 * 1000) {
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

  // Simple debounce function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
  const cleanTitle = (title) => {
    if (!title) return title;
    return title.replace(/^\d+\.\d+/, '');
  };

  // const extractRating = (title) => {
  // // Rating function disabled - no longer used
  // return '8.8';
// };

  // Pagination logic
  const totalPages = Math.ceil(allManga.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = allManga.slice(indexOfFirstItem, indexOfLastItem);

  // Filter and sort manga (optimized with useMemo)
  const filteredAndSortedManga = useMemo(() => {
    let filtered = allManga;
    
    // Apply search filter (optimized)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(manga => 
        manga.title.toLowerCase().includes(query) ||
        cleanTitle(manga.title).toLowerCase().includes(query)
      );
    }
    
    // Apply sorting (optimized)
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'title':
          aValue = cleanTitle(a.title).toLowerCase();
          bValue = cleanTitle(b.title).toLowerCase();
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        case 'rating':
          // Rating is disabled, always return 0
          return 0;
        case 'latest':
          aValue = a.id || '';
          bValue = b.id || '';
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [allManga, searchQuery, sortBy, sortOrder]);

  // Update pagination when filtered results change
  const filteredTotalPages = Math.ceil(filteredAndSortedManga.length / itemsPerPage);
  const filteredCurrentItems = filteredAndSortedManga.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when search or sort changes (optimized)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, sortOrder]);

  // Debounced search to reduce re-renders
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearchQuery(value);
    }, 300),
    []
  );

  // Lightweight function to get basic manga info (total chapters, status) with caching
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

    try {
      const response = await fetch(API_ENDPOINTS.MANGA(mangaId));
      if (response.ok) {
        const data = await response.json();
        const chapters = data.chapters || [];
        const info = {
          totalChapters: chapters.length,
          status: data.status || 'ongoing'
        };
        
        // Cache in both memory and persistent storage
        infoCache.current.set(mangaId, info);
        setPersistentCache(`info_${mangaId}`, { data: info });
        
        return info;
      }
    } catch (err) {
      console.error(`Failed to fetch info for ${mangaId}:`, err);
    }
    return {
      totalChapters: 0,
      status: 'unknown'
    };
  };

  // Fetch basic info for current page items (batched for performance)
  const fetchBasicInfoForPage = useCallback(async (pageItems) => {
    const itemsToFetch = pageItems.filter(manga => !mangaDetails[manga.id]);
    
    if (itemsToFetch.length === 0) return;
    
    console.log(`Fetching basic info for ${itemsToFetch.length} manga on page ${currentPage}`);
    
    // Fetch in larger batches for better performance
    const batchSize = 6; // Increased from 3 to 6 for fewer API calls
    const batches = [];
    
    for (let i = 0; i < itemsToFetch.length; i += batchSize) {
      batches.push(itemsToFetch.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      const infoPromises = batch.map(async (manga) => {
        const info = await fetchBasicMangaInfo(manga.id);
        return { mangaId: manga.id, info };
      });
      
      try {
        const infoResults = await Promise.all(infoPromises);
        const detailsMap = { ...mangaDetails };
        infoResults.forEach(({ mangaId, info }) => {
          detailsMap[mangaId] = info;
        });
        setMangaDetails(detailsMap);
        
        // Reduced delay between batches for faster loading
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms to 50ms
        }
      } catch (error) {
        console.error('Error fetching info batch:', error);
      }
    }
  }, [mangaDetails, currentPage]);

  // Fetch all manga with persistent caching
  const fetchAllManga = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'allManga';
    
    // Check persistent cache first (unless force refresh)
    if (!forceRefresh) {
      const persistentCache = getPersistentCache(cacheKey);
      if (persistentCache) {
        console.log('Collections: Using persistent cached data');
        setAllManga(persistentCache.allManga);
        
        // Also store in memory cache for this session
        apiCache.current.set(cacheKey, persistentCache);
        
        setLoading(false);
        
        // Load cached manga info
        const cachedInfo = {};
        Object.keys(mangaDetails).forEach(mangaId => {
          const infoCache = getPersistentCache(`info_${mangaId}`);
          if (infoCache) {
            cachedInfo[mangaId] = infoCache.data;
          }
        });
        if (Object.keys(cachedInfo).length > 0) {
          setMangaDetails(cachedInfo);
        }
        
        return;
      }
    }

    try {
      setLoading(true);
      setFetchError(null);
      if (forceRefresh) setIsRefreshing(true);
      
      // Use the new browse-all endpoint to get all manga from all pages
      const apiUrl = API_ENDPOINTS.BROWSE_ALL;
      console.log('Collections: Fetching all manga from browse-all endpoint:', apiUrl);
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Reduced from 15s to 10s for faster response
      
      const response = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const mangaList = data.manga || [];
        
        if (mangaList.length === 0) {
          throw new Error('No manga data received from Collections API');
        }
        
        console.log('Collections - Total manga fetched:', mangaList.length);
        console.log('Collections - Total pages:', data.total_pages);
        console.log('Collections - First few manga:', mangaList.slice(0, 3).map(m => ({ title: m.title, id: m.id })));
        
        setAllManga(mangaList);
        
        // Cache the processed data in both memory and persistent storage
        const cacheData = {
          allManga: mangaList,
          timestamp: Date.now()
        };
        apiCache.current.set(cacheKey, cacheData);
        setPersistentCache(cacheKey, cacheData);
        
        setLoading(false);
      } else {
        console.error('Collections API response not ok:', response.status, response.statusText);
        throw new Error(`Collections API request failed: ${response.status}`);
      }
    } catch (err) {
      console.error("Collections fetch error:", err);
      setFetchError(err.message);
      setLoading(false);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

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
    
    setMangaDetails({});
    // Force refresh
    fetchAllManga(true);
  }, [fetchAllManga]);

  // Initial fetch
  useEffect(() => {
    fetchAllManga();
  }, [fetchAllManga]);

  // Prefetch next page data for faster navigation
  useEffect(() => {
    if (currentPage < totalPages && !loading && allManga.length > 0) {
      const nextPage = currentPage + 1;
      const nextPageStart = (nextPage - 1) * itemsPerPage;
      const nextPageEnd = nextPage * itemsPerPage;
      const nextPageItems = allManga.slice(nextPageStart, nextPageEnd);
      
      if (nextPageItems.length > 0) {
        // Prefetch basic info for next page items (with lower priority)
        setTimeout(() => {
          const itemsToPrefetch = nextPageItems.slice(0, 3); // Prefetch first 3 items
          itemsToPrefetch.forEach(manga => {
            if (!mangaDetails[manga.id]) {
              fetchBasicMangaInfo(manga.id).then(info => {
                if (info) {
                  setMangaDetails(prev => ({ ...prev, [manga.id]: info }));
                }
              });
            }
          });
        }, 2000); // Start prefetching after 2 seconds
      }
    }
  }, [currentPage, totalPages, loading, allManga, mangaDetails]);

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

  // Render grid view
  const renderGridView = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {filteredCurrentItems.map((manga, index) => {
        return (
          <div 
            key={manga.id || index} 
            className="cursor-pointer group"
            onClick={() => onMangaDetails(manga)}
          >
            <div className="relative overflow-hidden rounded-xl">
              <img
                src={manga.cover_url || manga.cover}
                className="w-full aspect-[3/4.5] object-cover group-hover:scale-105 transition-transform duration-300"
                alt={manga.title}
                onError={(e) => {
                  // Fallback to a placeholder if image fails to load
                  e.target.src = "https://via.placeholder.com/300x450/374151/9CA3AF?text=No+Cover";
                }}
              />
              {/* <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded flex items-center gap-1 border border-white/10">
                <Star size={10} className="text-yellow-400" fill="currentColor" />
                <span className="text-[10px] font-bold text-white">{extractRating(manga.title)}</span>
              </div> */}
            </div>
            <div className="mt-2 text-center">
              <h3 className="text-sm font-bold uppercase tracking-tight truncate text-white group-hover:text-blue-400 transition-colors">
                {cleanTitle(manga.title)}
              </h3>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render list view
  const renderListView = () => (
    <div className="space-y-3">
      {filteredCurrentItems.map((manga, index) => {
        return (
          <div 
            key={manga.id || index} 
            className="flex gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group"
            onClick={() => onMangaDetails(manga)}
          >
            <div className="relative shrink-0">
              <img
                src={manga.cover_url || manga.cover}
                className="w-16 h-20 object-cover rounded shadow-lg group-hover:scale-105 transition-transform"
                alt={manga.title}
                onError={(e) => {
                  // Fallback to a placeholder if image fails to load
                  e.target.src = "https://via.placeholder.com/80x100/374151/9CA3AF?text=No+Cover";
                }}
              />
              {/* <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm rounded px-1 py-0.5 text-[10px] font-bold text-yellow-400">
                {extractRating(manga.title)}
              </div> */}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="font-bold text-white line-clamp-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight text-base">
                {cleanTitle(manga.title)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-3xl font-bold text-white">Collections</h1>
            <div className="text-sm text-gray-400">Loading...</div>
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
    <div className="min-h-screen bg-black p-6">
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

        {/* Refresh Button */}
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-3 rounded-full transition-all ${
              isRefreshing 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title="Refresh collections"
          >
            <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-white">Collections</h1>
          <div className="text-sm text-gray-400">
            {searchQuery ? 
              `${filteredAndSortedManga.length} manga found` : 
              `${allManga.length} total`
            }
          </div>
        </div>

        {/* Search and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search manga..."
                value={searchQuery}
                onChange={(e) => debouncedSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white/20 transition-colors"
              />
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:bg-white/20 transition-colors"
            >
              <option value="title" className="bg-gray-900 text-white">Sort by Title</option>
              <option value="rating" className="bg-gray-900 text-white">Sort by Rating</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <ArrowUpDown size={16} />
              {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex justify-end mb-6">
          <div className="flex gap-2 bg-white/10 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white/20 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid size={16} className="inline mr-1" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white/20 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Book size={16} className="inline mr-1" />
              List
            </button>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'grid' ? renderGridView() : renderListView()}

        {/* Pagination Controls */}
        {filteredTotalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === 1
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <ChevronLeft size={16} className="inline mr-1" />
              Prev
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
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/10 text-white hover:bg-white/20'
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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === filteredTotalPages
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Next
              <ChevronRight size={16} className="inline ml-1" />
            </button>
          </div>
        )}
        
        {/* Page Info */}
        {filteredTotalPages > 1 && (
          <div className="text-center mt-4 text-sm text-gray-500">
            Page {currentPage} of {filteredTotalPages} ({filteredAndSortedManga.length} manga{searchQuery && ' found'})
          </div>
        )}
      </div>
    </div>
  );
};

export default Collections;
