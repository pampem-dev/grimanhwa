import React, { useState, useEffect, useCallback, useRef } from 'react';

import { Clock, TrendingUp, Crown, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import MangaCard from '../components/MangaCard';
import HeroCarousel from '../components/HeroCarousel';
import { useTheme } from '../contexts/ThemeContext';
import { setItemAsync, getItem } from '../utils/storage';

const Home = ({ onMangaSelect, onMangaDetails }) => {
  const { darkMode } = useTheme();
  const [featuredManga, setFeaturedManga] = useState([]);
  const [trendingManga, setTrendingManga] = useState([]);
  const [recentManga, setRecentManga] = useState([]);
  const [topRatedManga, setTopRatedManga] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [loadingTopRated, setLoadingTopRated] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [latestChapters, setLatestChapters] = useState({}); // Store latest chapter info
  const [allMangaList, setAllMangaList] = useState([]); // Store all manga for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // 10 items per page for 2-column layout
  const [fetchError, setFetchError] = useState(null); // Error state
  const [isRefreshing, setIsRefreshing] = useState(false); // Refresh state

  // Cache for API responses
  const apiCache = useRef(new Map());
  const chapterCache = useRef(new Map());

  // Persistent cache functions
  const getPersistentCache = (key) => {
    try {
      const cached = getItem(`mangaCache_${key}`);
      if (cached) {
        // Check if cache is still valid (30 minutes)
        if (Date.now() - cached.timestamp < 30 * 60 * 1000) {
          return cached;
        }
      }
    } catch (err) {
    }
    return null;
  };

  const setPersistentCache = (key, data) => {
    const cacheData = {
      ...data,
      timestamp: Date.now()
    };
    setItemAsync(`mangaCache_${key}`, cacheData);
  };

  const resetAutoPlay = () => {
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 100);
  };

  const getMangaList = (data) => {
    if (Array.isArray(data)) return data; 
    return data.manga || data.trending || data.results || [];
  };

  const cleanTitle = (title) => {
    if (!title) return title;
    const original = title;
    // Remove common prefixes (Editor'sPick, Featured, Recommended, etc.)
    let cleaned = title.replace(/^(Editor'?s?Pick|Featured|Recommended|TopPick|StaffPick)/gi, '');
    // Remove rating prefix (e.g., "9.4" or "8.9") at the start (with or without space)
    cleaned = cleaned.replace(/^\d+\.\d+/, '');
    // Also remove rating at the very end of title
    cleaned = cleaned.replace(/\d+\.\d+$/, '');
    // Remove chapter numbers at start (CHAPTER90, Chapter 90, etc.)
    cleaned = cleaned.replace(/^chapter\s*\d+/gi, '');
    // Remove chapter numbers anywhere in the title
    cleaned = cleaned.replace(/chapter\s*\d+/gi, '');
    // Remove standalone numbers that look like chapter numbers
    cleaned = cleaned.replace(/^\d+\s+/, '');
    // Remove chapter number pattern like "chapter3359" attached to title
    cleaned = cleaned.replace(/chapter\d+/gi, '');
    // Remove standalone "chapter" word at the end
    cleaned = cleaned.replace(/chapter$/gi, '');
    // Remove decimal ratings at the end (like ".3" or ".9")
    cleaned = cleaned.replace(/\.\d+$/, '');
    // Remove common time patterns that might be part of the title
    cleaned = cleaned.replace(/\d+\s*(hours?|days?|weeks?|months?)\s+ago/gi, '');
    // Remove trailing hyphens and numbers
    cleaned = cleaned.replace(/-\s*\d+$/, '');
    // Remove leading dots/numbers that might be leftover
    cleaned = cleaned.replace(/^\.?\d+/, '');
    // Remove description-like text that might follow the title
    // Look for patterns like "A must-read recommendation..." or "Top rated series..."
    cleaned = cleaned.replace(/\s*(A|An|The)\s+(must-read|recommended|highly\s+rated|top\s+rated|staff\s+pick|editor'?s?\s+choice).*/gi, '');
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  };



  // Optimized chapter fetching with persistent caching
  const fetchLatestChapter = async (mangaId) => {
    // Check memory cache first
    if (chapterCache.current.has(mangaId)) {
      return chapterCache.current.get(mangaId);
    }

    // Check persistent cache
    const persistentCache = getItem(`mangaCache_chapter_${mangaId}`);
    if (persistentCache && Date.now() - persistentCache.timestamp < 30 * 60 * 1000) {
      // Also store in memory cache for this session
      chapterCache.current.set(mangaId, persistentCache.data);
      return persistentCache.data;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      // Use the dedicated latest chapter endpoint for much faster loading
      const response = await fetch(API_ENDPOINTS.LATEST_CHAPTER(mangaId), {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();

        // Handle new latest_chapter format
        if (data.latest_chapter) {
          const chapterInfo = {
            number: extractChapterNumber(data.latest_chapter),
            title: data.latest_chapter.title || `Chapter ${extractChapterNumber(data.latest_chapter)}`
          };

          // Cache in both memory and persistent storage
          chapterCache.current.set(mangaId, chapterInfo);
          setItemAsync(`mangaCache_chapter_${mangaId}`, { data: chapterInfo, timestamp: Date.now() });

          return chapterInfo;
        }

        // Fallback to old format (array) for backward compatibility
        let chapters = [];
        if (Array.isArray(data)) {
          chapters = data;
        } else if (data.chapters && Array.isArray(data.chapters)) {
          chapters = data.chapters;
        } else if (data.chapters && data.chapters.chapters) {
          chapters = data.chapters.chapters;
        }

        if (chapters.length > 0) {
          // Find the chapter with the highest number (the latest chapter)
          let latestChapter = chapters[0];
          let maxChapterNum = 0;

          chapters.forEach(chapter => {
            const chapterNum = parseInt(extractChapterNumber(chapter)) || 0;
            if (chapterNum > maxChapterNum) {
              maxChapterNum = chapterNum;
              latestChapter = chapter;
            }
          });

          const chapterInfo = {
            number: extractChapterNumber(latestChapter),
            title: latestChapter.title || `Chapter ${extractChapterNumber(latestChapter)}`
          };

          // Cache in both memory and persistent storage
          chapterCache.current.set(mangaId, chapterInfo);
          setItemAsync(`mangaCache_chapter_${mangaId}`, { data: chapterInfo, timestamp: Date.now() });

          return chapterInfo;
        }
      }
    } catch (err) {
    }
    return null;
  };

  const extractChapterNumber = (chapter) => {
    if (!chapter) return '1';
    if (chapter.number) return chapter.number;
    if (chapter.chapter_num) return chapter.chapter_num;

    // Extract from URL (same as Details page)
    const urlMatch = chapter?.id?.match(/chapter\/(\d+)/) || chapter?.url?.match(/chapter\/(\d+)/);
    if (urlMatch?.[1]) {
      return urlMatch[1];
    }

    // Extract from title
    const title = chapter.title || '';

    // Look for "Chapter X" followed by non-digit
    const chapterMatch = title.match(/chapter\s*(\d{1,4})(?!\d)/i);
    if (chapterMatch?.[1]) {
      return chapterMatch[1];
    }

    // Look for "Ch. X" followed by non-digit
    const chMatch = title.match(/ch\.?\s*(\d{1,4})(?!\d)/i);
    if (chMatch?.[1]) {
      return chMatch[1];
    }

    // Fallback to any number
    const numberMatch = title.match(/(\d+)/);
    return numberMatch?.[1] || '1';
  };

  // const extractRating = (title) => {
  //   if (!title) return '8.8';
  //   const match = title.match(/^(\d+\.\d+)/);
  //   return match ? match[1] : '8.8';
  // };

  // Pagination logic
  const totalPages = Math.ceil(allMangaList.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = allMangaList.slice(indexOfFirstItem, indexOfLastItem);

  // Fetch chapters for current page items (optimized with batching)
  const fetchChaptersForPage = useCallback(async (pageItems) => {
    const itemsToFetch = pageItems.filter(manga => !latestChapters[manga.id]);

    if (itemsToFetch.length === 0) return;

    const batchSize = 3; // Fetch 3 at a time to avoid overwhelming the API
    const batches = [];

    for (let i = 0; i < itemsToFetch.length; i += batchSize) {
      batches.push(itemsToFetch.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const chapterPromises = batch.map(async (manga) => {
        const chapterInfo = await fetchLatestChapter(manga.id);
        return { mangaId: manga.id, chapterInfo };
      });

      try {
        const chapterResults = await Promise.all(chapterPromises);

        setLatestChapters(prevMap => {
          const newMap = { ...prevMap };
          chapterResults.forEach(({ mangaId, chapterInfo }) => {
            if (chapterInfo) {
              newMap[mangaId] = chapterInfo;
            }
          });
          return newMap;
        });

        // Small delay between batches
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
      }
    }
  }, [fetchLatestChapter]);

  // Debounced page change to prevent rapid requests
  const debouncedPageChange = useCallback((pageNumber) => {
    setCurrentPage(pageNumber);
    // Scroll to Latest Updates section with offset for mobile header
    const latestSection = document.getElementById('latest-updates-section');
    if (latestSection) {
      const headerHeight = window.innerWidth < 640 ? 220 : 80; // Increased mobile offset for full header
      const elementPosition = latestSection.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - headerHeight;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }, []);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      debouncedPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      debouncedPageChange(currentPage + 1);
    }
  };

  // Fetch chapters in batches for better performance
  const fetchChaptersBatch = useCallback(async (mangaList) => {
    const batchSize = 3; // Reduced from 5 to 3 for faster initial load
    const batches = [];

    for (let i = 0; i < mangaList.length; i += batchSize) {
      batches.push(mangaList.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const chapterPromises = batch.map(async (manga) => {
        const chapterInfo = await fetchLatestChapter(manga.id);
        return { mangaId: manga.id, chapterInfo };
      });

      try {
        const chapterResults = await Promise.all(chapterPromises);

        // Use functional update with stable reference to prevent infinite loops
        setLatestChapters(prevMap => {
          // Check if any of these chapters are already loaded to prevent duplicates
          const hasNewChapters = chapterResults.some(({ mangaId }) => !prevMap[mangaId]);
          if (!hasNewChapters) return prevMap;

          const newMap = { ...prevMap };
          chapterResults.forEach(({ mangaId, chapterInfo }) => {
            if (chapterInfo) {
              newMap[mangaId] = chapterInfo;
            }
          });
          return newMap;
        });

        // Small delay between batches to prevent overwhelming API
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 200ms to 100ms
        }
      } catch (error) {
      }
    }
  }, [fetchLatestChapter]);

  // Fetch chapters when page changes (but only for new items) - with latest_only optimization
  useEffect(() => {
    if (currentItems.length > 0 && !loadingRecent) {
      fetchChaptersForPage(currentItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, currentItems.length, loadingRecent]);

  // Fetch chapters for initial page when data loads - with latest_only optimization
  useEffect(() => {
    if (currentItems.length > 0 && !loadingRecent && Object.keys(latestChapters).length === 0) {
      fetchChaptersForPage(currentItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItems.length, loadingRecent]);

  // Optimized fetchAllManga with persistent caching and error handling
  const fetchAllManga = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'allManga_v2'; // Updated cache key to invalidate old cache
    
    // Always show cached data immediately if available (even during refresh)
    const persistentCache = getPersistentCache(cacheKey);
    if (persistentCache) {
      const { allManga, featured, trending, recent, topRated } = persistentCache;

      // Filter out chapter-specific entries from cached data
      const mangaOnly = allManga.filter(item => {
        const title = item.title || '';
        return !title.match(/^chapter\s*\d+/i) &&
               !title.match(/\d+\s*(hours?|days?|weeks?|months?)\s+ago/i) &&
               !title.match(/last\s+(hour|day|week|month)/i);
      });

      // Remove duplicates from cached data (by ID only)
      const seenIds = new Set();
      const uniqueAllManga = mangaOnly.filter(item => {
        if (item.id && seenIds.has(item.id)) {
          return false;
        }
        if (item.id) {
          seenIds.add(item.id);
        }
        return true;
      });

      setAllMangaList(uniqueAllManga);
      setFeaturedManga(featured);
      setTrendingManga(trending);
      setRecentManga(recent);
      // If topRated is in cache, use it. Otherwise, sort by rating
      if (topRated) {
        setTopRatedManga(topRated);
      } else {
        // Sort by rating and take top 10
        const sortedByRating = [...uniqueAllManga].sort((a, b) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          return ratingB - ratingA;
        });
        setTopRatedManga(sortedByRating.slice(0, 10));
      }
      
      // Also store in memory cache for this session
      apiCache.current.set(cacheKey, persistentCache);
      
      setLoadingTrending(false);
      setLoadingRecent(false);
      setLoadingPopular(false);
      setLoadingTopRated(false);
      
      // Load cached chapters
      const cachedChapters = {};
      Object.keys(latestChapters).forEach(mangaId => {
        const chapterCache = getPersistentCache(`chapter_${mangaId}`);
        if (chapterCache) {
          cachedChapters[mangaId] = chapterCache.data;
        }
      });
      if (Object.keys(cachedChapters).length > 0) {
        setLatestChapters(cachedChapters);
      }
      
      // If not force refresh, return early (showing cached data)
      if (!forceRefresh) return;
    }

    // Fetch fresh data in background (only if force refresh or no cache)
    try {
      setFetchError(null);
      if (forceRefresh) setIsRefreshing(true);
      
      // Always use backend API from environment
      const apiUrl = API_ENDPOINTS.SEARCH('a');
      
      // Reduced timeout to fail faster and show cached data
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(apiUrl, { 
        signal: controller.signal,
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const allManga = getMangaList(data);

        if (allManga.length === 0) {
          throw new Error('No manga data received from API');
        }

        // Filter out chapter-specific entries (keep only main manga entries)
        const mangaOnly = allManga.filter(item => {
          const title = item.title || '';
          // Skip entries that look like chapter updates
          return !title.match(/^chapter\s*\d+/i) &&
                 !title.match(/\d+\s*(hours?|days?|weeks?|months?)\s+ago/i) &&
                 !title.match(/last\s+(hour|day|week|month)/i);
        });

        // Remove duplicates based on ID only
        const seenIds = new Set();
        const uniqueManga = mangaOnly.filter(item => {
          if (item.id && seenIds.has(item.id)) {
            return false;
          }
          if (item.id) {
            seenIds.add(item.id);
          }
          return true;
        });


        // Store all manga for pagination
        setAllMangaList(uniqueManga);

        // Create non-overlapping slices for each section with fallbacks
        const totalManga = uniqueManga.length;

        // Sort all manga by rating (highest first) for topRated section
        const sortedByRating = [...uniqueManga].sort((a, b) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          return ratingB - ratingA; // Descending order
        });
        const topRated = sortedByRating.slice(0, 10); // Top 10 highest rated

        // If we have enough manga, use non-overlapping slices
        let featured, trending, recent;
        if (totalManga >= 25) {
          featured = uniqueManga.slice(0, 15);
          trending = uniqueManga.slice(15, 25);
          recent = uniqueManga.slice(25, 35);
        } else {
          // If limited manga, ensure trending gets 10 items
          const trendingSize = Math.min(10, totalManga);
          const remaining = totalManga - trendingSize;
          const featuredSize = Math.floor(remaining / 2);
          const recentSize = remaining - featuredSize;

          featured = uniqueManga.slice(0, featuredSize);
          trending = uniqueManga.slice(featuredSize, featuredSize + trendingSize);
          recent = uniqueManga.slice(featuredSize + trendingSize);
        }

        setFeaturedManga(featured);
        setTrendingManga(trending);
        setRecentManga(recent);
        setTopRatedManga(topRated);
        
        // Cache the processed data in both memory and persistent storage
        const cacheData = {
          allManga: uniqueManga,
          featured,
          trending,
          recent,
          topRated,
          timestamp: Date.now()
        };
        apiCache.current.set(cacheKey, cacheData);
        setPersistentCache(cacheKey, cacheData);
        
        setLoadingTrending(false);
        setLoadingRecent(false);
        setLoadingPopular(false);
        setLoadingTopRated(false);
      } else {
        throw new Error(`API request failed: ${response.status}`);
      }
    } catch (err) {
      // If we have cached data, don't show error - just use cached
      if (!persistentCache) {
        setFetchError(err.message);
      }
      setLoadingTrending(false);
      setLoadingRecent(false);
      setLoadingPopular(false);
      setLoadingTopRated(false);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Refresh function
  const handleRefresh = useCallback(() => {
    // Clear all caches (both memory and persistent)
    apiCache.current.clear();
    chapterCache.current.clear();

    // Clear persistent cache keys
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('mangaCache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (err) {
    }

    setLatestChapters({});
    // Force refresh
    fetchAllManga(true);
  }, [fetchAllManga]);

  useEffect(() => {
    fetchAllManga();
  }, [fetchAllManga]);

  useEffect(() => {
    if (featuredManga.length === 0 || !isAutoPlaying) return;
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % featuredManga.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [featuredManga, isAutoPlaying]);

  const handleMangaClick = (manga) => {
    if (onMangaDetails) {
      onMangaDetails(manga);
    } else if (onMangaSelect) {
      onMangaSelect(manga.id);
    }
  };

  const renderTrending = () => (
    <div>
      <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        <TrendingUp className="text-blue-500" size={20} />
        Trending Today
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {loadingTrending
          ? Array.from({ length: 5 }).map((_, i) => <MangaCard key={i} isLoading />)
          : trendingManga.slice(0, 10).map((manga) => (
              <MangaCard
                key={manga.id}
                title={cleanTitle(manga.title)}
                coverUrl={manga.cover_url || manga.cover}
                rating={manga.rating}
                onClick={() => handleMangaClick(manga)}
              />
            ))
        }
      </div>
    </div>
  );

  const renderLatest = () => (
    <div id="latest-updates-section">
      <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        <Clock className="text-blue-500" size={20} />
        Latest Updates
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loadingRecent
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-3">
                <div className="w-16 h-20 rounded bg-gray-700 animate-pulse shrink-0" />
                <div className="flex-1 flex flex-col gap-2 justify-center">
                  <div className="h-3 bg-gray-700 animate-pulse rounded w-3/4" />
                  <div className="h-2 bg-gray-700 animate-pulse rounded w-1/2" />
                </div>
              </div>
            ))
          : currentItems.map((manga, index) => {
              const latestChapter = latestChapters[manga.id];
              return (
                <div
                  key={manga.id || index}
                  className="flex gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors cursor-pointer group"
                  onClick={() => onMangaDetails(manga)}
                >
                  <div className="relative shrink-0">
                    <img
                      src={manga.cover_url || manga.cover}
                      className="w-16 h-20 object-cover rounded shadow-lg group-hover:scale-105 transition-transform"
                      alt={manga.title}
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className={`font-bold line-clamp-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {cleanTitle(manga.title)}
                    </p>
                    <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {latestChapter ? `Chapter ${latestChapter.number}` : 'Chapter'}
                    </p>
                  </div>
                </div>
              );
            })
        }
      </div>
      
      {/* Pagination Controls */}
      {!loadingRecent && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className={`p-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center ${
              currentPage === 1
                ? 'bg-white/[0.02] text-gray-600 cursor-not-allowed border border-white/5'
                : `${darkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'} border border-white/10 hover:border-white/20`
            }`}
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => debouncedPageChange(pageNum)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white'
                      : `${darkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className={`p-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center ${
              currentPage === totalPages
                ? 'bg-white/[0.02] text-gray-600 cursor-not-allowed border border-white/5'
                : `${darkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'} border border-white/10 hover:border-white/20`
            }`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      
      {/* Page Info */}
      {!loadingRecent && totalPages > 1 && (
        <div className="text-center mt-4 text-sm text-gray-500">
          Page {currentPage} of {totalPages}
        </div>
      )}
    </div>
  );

  const renderTopRated = () => (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
      <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        <Star className={darkMode ? 'text-yellow-400' : 'text-yellow-500'} size={18} fill="currentColor" />
        Popular
      </h2>
      <div className="space-y-3">
        {loadingTopRated
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-2">
                <div className="w-12 h-16 rounded bg-gray-700 animate-pulse shrink-0" />
                <div className="flex-1 flex flex-col gap-2 justify-center">
                  <div className="h-3 bg-gray-700 animate-pulse rounded w-3/4" />
                  <div className="h-2 bg-gray-700 animate-pulse rounded w-1/2" />
                </div>
              </div>
            ))
          : topRatedManga.slice(0, 10).map((manga, index) => (
              <div
                key={manga.id}
                onClick={() => handleMangaClick(manga)}
                className="flex gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
              >
                <div className="relative shrink-0">
                  <img
                    src={manga.cover_url || manga.cover}
                    alt={manga.title}
                    className="w-12 h-16 object-cover rounded"
                    loading="lazy"
                  />
                  <div className="absolute top-0 left-0 bg-black/70 text-white text-[10px] font-bold px-1 rounded-br">
                    #{index + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0" style={{ color: darkMode ? '#e5e7eb' : '#1f2937' }}>
                  <h3 className={`text-sm font-bold line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    {cleanTitle(manga.title)}
                  </h3>
                  {manga.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star size={10} className={darkMode ? 'text-yellow-400' : 'text-yellow-500'} fill="currentColor" />
                      <span className="text-xs" style={{ color: darkMode ? '#9ca3af !important' : '#374151 !important' }}>{manga.rating}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#050505] text-white' : 'bg-white text-gray-900'}`}>
      {/* Error Handling */}
      {fetchError && (
        <div className="bg-red-600/10 border border-red-600/20 text-red-400 p-4 m-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">Error loading</p>
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

      
    {/* 🚀 HERO SECTION: CLEAN BLACK BACKGROUND */}
    <section className="w-full bg-[#050505]"> 
      
      {/* Ensure carousel doesn't have its own top-margin or conflicting background */}
      <HeroCarousel 
        manga={topRatedManga} 
        onMangaClick={handleMangaClick}
        isLoading={loadingTopRated}
      />
    </section>

      {/* 📦 CENTERED CONTENT (Standard width) */}
      <main className="max-w-[1600px] mx-auto px-6 md:px-12 lg:px-20 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* LEFT SIDE (Trending & Latest) */}
          <div className="lg:col-span-8 space-y-16">
            {renderTrending()}
            {renderLatest()}
          </div>

          {/* RIGHT SIDE (Popular Sidebar) */}
          <aside className="lg:col-span-4">
            <div className="sticky top-24">
              {renderTopRated()}
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
};

export default Home;