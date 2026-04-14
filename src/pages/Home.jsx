import React, { useState, useEffect, useCallback, useRef } from 'react';

import { Clock, TrendingUp, Crown, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import MangaCard from '../components/MangaCard';
import HeroCarousel from '../components/HeroCarousel';
import { useTheme } from '../contexts/ThemeContext';

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
      const cached = localStorage.getItem(`mangaCache_${key}`);
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
      localStorage.setItem(`mangaCache_${key}`, JSON.stringify(cacheData));
    } catch (err) {
      console.warn('Failed to write persistent cache:', err);
    }
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
    return title.replace(/^\d+\.\d+/, '');
  };

  // Optimized chapter fetching with persistent caching
  const fetchLatestChapter = async (mangaId) => {
    // Check memory cache first
    if (chapterCache.current.has(mangaId)) {
      return chapterCache.current.get(mangaId);
    }

    // Check persistent cache
    const persistentCache = getPersistentCache(`chapter_${mangaId}`);
    if (persistentCache) {
      // Also store in memory cache for this session
      chapterCache.current.set(mangaId, persistentCache.data);
      return persistentCache.data;
    }

    try {
      const response = await fetch(API_ENDPOINTS.MANGA(mangaId));
      if (response.ok) {
        const data = await response.json();

        // Handle both old format (array) and new format (object)
        let chapters = [];
        if (Array.isArray(data)) {
          chapters = data;
        } else if (data.chapters && Array.isArray(data.chapters)) {
          chapters = data.chapters;
        } else if (data.chapters && data.chapters.chapters) {
          chapters = data.chapters.chapters;
        }

        if (chapters.length > 0) {
          const latestChapter = chapters[0]; // Assuming chapters are sorted by latest first
          const chapterInfo = {
            number: extractChapterNumber(latestChapter),
            title: latestChapter.title || `Chapter ${extractChapterNumber(latestChapter)}`
          };

          // Cache in both memory and persistent storage
          chapterCache.current.set(mangaId, chapterInfo);
          setPersistentCache(`chapter_${mangaId}`, { data: chapterInfo });

          return chapterInfo;
        }
      }
    } catch (err) {
      console.error(`Failed to fetch latest chapter for ${mangaId}:`, err);
    }
    return null;
  };

  const extractChapterNumber = (chapter) => {
    if (!chapter) return '1';
    if (chapter.number) return chapter.number;
    if (chapter.chapter_num) return chapter.chapter_num;
    
    // Extract from URL (same as Details page)
    const urlMatch = chapter?.id?.match(/chapter\/(\d+)/);
    if (urlMatch?.[1]) {
      return urlMatch[1];
    }
    
    // Extract from title
    const title = chapter.title || '';
    
    // Look for "Chapter X" followed by non-digit
    const chapterMatch = title.match(/chapter\s*(\d{1,3})(?!\d)/i);
    if (chapterMatch?.[1]) {
      return chapterMatch[1];
    }
    
    // Look for "Ch. X" followed by non-digit  
    const chMatch = title.match(/ch\.?\s*(\d{1,3})(?!\d)/i);
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

  // Fetch chapters for current page items
  const fetchChaptersForPage = useCallback(async (pageItems) => {
    const itemsToFetch = pageItems.filter(manga => !latestChapters[manga.id]);
    
    if (itemsToFetch.length === 0) return; 
    
    const chapterPromises = itemsToFetch.map(async (manga) => {
      const chapterInfo = await fetchLatestChapter(manga.id);
      return { mangaId: manga.id, chapterInfo };
    });
    
    try {
      const chapterResults = await Promise.all(chapterPromises);
      
      // Functional update avoids the dependency loop
      setLatestChapters(prevMap => {
        const newMap = { ...prevMap };
        chapterResults.forEach(({ mangaId, chapterInfo }) => {
          if (chapterInfo) {
            newMap[mangaId] = chapterInfo;
          }
        });
        return newMap;
      });
    } catch (error) {
      console.error('Error fetching chapters:', error);
    }
  }, [fetchLatestChapter]); // Only depend on fetchLatestChapter

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

  // Fetch chapters when page changes (but only for new items) - DISABLED TO STOP LOOP
  useEffect(() => {
    if (currentItems.length > 0 && !loadingRecent) {
      fetchChaptersForPage(currentItems);
    }
  }, [currentPage, currentItems.length, loadingRecent]); // Removed fetchChaptersForPage and currentItems from deps

  // Fetch chapters in batches for better performance
  const fetchChaptersBatch = useCallback(async (mangaList) => {
    const batchSize = 5;
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
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error('Error fetching chapter batch:', error);
      }
    }
  }, [fetchLatestChapter]);

  // Optimized fetchAllManga with persistent caching and error handling
  const fetchAllManga = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'allManga_v2'; // Updated cache key to invalidate old cache
    
    // Check persistent cache first (unless force refresh)
    if (!forceRefresh) {
      const persistentCache = getPersistentCache(cacheKey);
      if (persistentCache) {
        console.log('Using cached data');
        const { allManga, featured, trending, recent, topRated } = persistentCache;
        setAllMangaList(allManga);
        setFeaturedManga(featured);
        setTrendingManga(trending);
        setRecentManga(recent);
        // If topRated is in cache, use it. Otherwise, sort by rating
        if (topRated) {
          setTopRatedManga(topRated);
        } else {
          // Sort by rating and take top 10
          const sortedByRating = [...allManga].sort((a, b) => {
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
        
        return;
      }
    }

    try {
      // console.log('Starting fresh manga fetch...');
      setFetchError(null);
      if (forceRefresh) setIsRefreshing(true);
      
      // Always use backend API from environment
      const apiUrl = API_ENDPOINTS.SEARCH('a');
      // console.log('Using API URL:', apiUrl);
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for web scraping
      
      const response = await fetch(apiUrl, { 
        signal: controller.signal,
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      clearTimeout(timeoutId);
      
      // console.log('Fetch response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        // console.log('API response data:', data);
        const allManga = getMangaList(data);
        
        if (allManga.length === 0) {
          throw new Error('No manga data received from API');
        }
        
        // Store all manga for pagination
        setAllMangaList(allManga);
        
        // Create non-overlapping slices for each section with fallbacks
        const totalManga = allManga.length;
        // console.log('Total manga available:', totalManga);

        // Sort all manga by rating (highest first) for topRated section
        const sortedByRating = [...allManga].sort((a, b) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          return ratingB - ratingA; // Descending order
        });
        const topRated = sortedByRating.slice(0, 10); // Top 10 highest rated
        // console.log('Top 10 rated manga:', topRated.map(m => ({ title: m.title, rating: m.rating })));

        // If we have enough manga, use non-overlapping slices
        let featured, trending, recent;
        if (totalManga >= 25) {
          featured = allManga.slice(0, 15);
          trending = allManga.slice(15, 25);
          recent = allManga.slice(25, 35);
        } else {
          // If limited manga, ensure trending gets 10 items
          const trendingSize = Math.min(10, totalManga);
          const remaining = totalManga - trendingSize;
          const featuredSize = Math.floor(remaining / 2);
          const recentSize = remaining - featuredSize;
          
          // console.log('Using adjusted slices - trending:', trendingSize, 'featured:', featuredSize, 'recent:', recentSize);

          featured = allManga.slice(0, featuredSize);
          trending = allManga.slice(featuredSize, featuredSize + trendingSize);
          recent = allManga.slice(featuredSize + trendingSize);
        }

        setFeaturedManga(featured);
        setTrendingManga(trending);
        setRecentManga(recent);
        setTopRatedManga(topRated);
        
        // Cache the processed data in both memory and persistent storage
        const cacheData = {
          allManga,
          featured,
          trending,
          recent,
          topRated, // Store the sorted top 10
          timestamp: Date.now()
        };
        apiCache.current.set(cacheKey, cacheData);
        setPersistentCache(cacheKey, cacheData);
        
        setLoadingTrending(false);
        setLoadingRecent(false);
        setLoadingPopular(false);
        setLoadingTopRated(false);
      } else {
        console.error('API response not ok:', response.status, response.statusText);
        throw new Error(`API request failed: ${response.status}`);
      }
    } catch (err) {
      console.error("Home fetch error:", err);
      setFetchError(err.message);
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
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('mangaCache_')) {
        localStorage.removeItem(key);
      }
    });
    
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
                title={manga.title}
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
                    {/* <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm rounded px-1 py-0.5 text-[10px] font-bold text-yellow-400">
                      {extractRating(manga.title)}
                    </div> */}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className={`font-bold line-clamp-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {cleanTitle(manga.title)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1 font-bold uppercase tracking-widest">
                      {latestChapter ? `Chapter ${latestChapter.number}` : 'Loading...'}
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
        <Star className="text-yellow-500" size={18} fill="currentColor" />
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
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-bold line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    {manga.title}
                  </h3>
                  {manga.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star size={10} className="text-yellow-400" fill="currentColor" />
                      <span className="text-xs text-gray-400">{manga.rating}</span>
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