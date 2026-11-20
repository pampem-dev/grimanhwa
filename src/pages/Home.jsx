import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { Clock, TrendingUp, Crown, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import MangaCard from '../components/MangaCard';
import HeroCarousel from '../components/HeroCarousel';
import { useTheme } from '../contexts/ThemeContext';
import { setItemAsync, getItem } from '../utils/storage';
import { getCachedData, setCachedData, clearAllMangaCache, resetActivityTime } from '../utils/cache';

const Home = ({ onMangaSelect, onMangaDetails }) => {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
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

  const resetAutoPlay = () => {
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 100);
  };

  const getMangaList = (data) => {
    if (Array.isArray(data)) return data; 
    return data.manga || data.trending || data.results || [];
  };


  // Optimized chapter fetching
  const fetchLatestChapter = async (mangaId) => {
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

        // Handle new format: { chapters: [...] }
        if (data.chapters && Array.isArray(data.chapters)) {
          return data.chapters.map(ch => ({
            number: ch.number,
            title: ch.title,
            url: ch.url,
            chapter_id: ch.chapter_id
          }));
        }

        // Handle old format for backward compatibility
        if (data.number && data.title) {
          return [{
            number: data.number,
            title: data.title,
            url: data.url,
            chapter_id: data.chapter_id
          }];
        }

        // Handle latest_chapter format (for backward compatibility)
        if (data.latest_chapter) {
          return [{
            number: extractChapterNumber(data.latest_chapter),
            title: data.latest_chapter.title || `Chapter ${extractChapterNumber(data.latest_chapter)}`,
            url: data.latest_chapter.url,
            chapter_id: data.latest_chapter.chapter_id || data.latest_chapter.id
          }];
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
          // Sort by chapter number descending and take top 2
          const sortedChapters = chapters
            .map(chapter => ({
              number: extractChapterNumber(chapter),
              title: chapter.title || `Chapter ${extractChapterNumber(chapter)}`,
              url: chapter.url || chapter.id,
              chapter_id: chapter.chapter_id || chapter.id
            }))
            .sort((a, b) => parseInt(b.number) - parseInt(a.number))
            .slice(0, 2);

          return sortedChapters;
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

  // Optimized fetchAllManga with error handling and caching
  const fetchAllManga = useCallback(async () => {
    try {
      setFetchError(null);
      setIsRefreshing(true);
      resetActivityTime();

      // Check cache first
      const cachedData = getCachedData('home_all_manga');
      if (cachedData && !isRefreshing) {
        const allManga = getMangaList(cachedData);

        if (allManga.length > 0) {
          // Filter out chapter-specific entries (keep only main manga entries)
          const mangaOnly = allManga.filter(item => {
            const title = item.title || '';
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
            return ratingB - ratingA;
          });
          const topRated = sortedByRating.slice(0, 10);

          let featured, trending, recent;
          if (totalManga >= 25) {
            featured = uniqueManga.slice(0, 15);
            trending = uniqueManga.slice(15, 25);
            recent = uniqueManga.slice(25, 35);
          } else {
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

          setLoadingTrending(false);
          setLoadingRecent(false);
          setLoadingPopular(false);
          setLoadingTopRated(false);
          setIsRefreshing(false);
          return;
        }
      }

      // Always use backend API from environment
      const apiUrl = API_ENDPOINTS.SEARCH('a');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

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

        // Cache the raw data
        setCachedData('home_all_manga', data);

        const allManga = getMangaList(data);

        if (allManga.length === 0) {
          throw new Error('No manga data received from API');
        }

        // Filter out chapter-specific entries (keep only main manga entries)
        const mangaOnly = allManga.filter(item => {
          const title = item.title || '';
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
          return ratingB - ratingA;
        });
        const topRated = sortedByRating.slice(0, 10);

        let featured, trending, recent;
        if (totalManga >= 25) {
          featured = uniqueManga.slice(0, 15);
          trending = uniqueManga.slice(15, 25);
          recent = uniqueManga.slice(25, 35);
        } else {
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

        setLoadingTrending(false);
        setLoadingRecent(false);
        setLoadingPopular(false);
        setLoadingTopRated(false);
      } else {
        throw new Error(`API request failed: ${response.status}`);
      }
    } catch (err) {
      setFetchError(err.message);
      setLoadingTrending(false);
      setLoadingRecent(false);
      setLoadingPopular(false);
      setLoadingTopRated(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Refresh function
  const handleRefresh = useCallback(() => {
    setLatestChapters({});
    clearAllMangaCache();
    fetchAllManga();
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
              const mangaChapters = latestChapters[manga.id]; // Array of 2 chapters
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
                    {/* Rating badge - same style as HeroCarousel */}
                    {manga.rating && (
                      <div className="absolute top-1 left-1 z-10 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-white/10">
                        <Star size={8} className="text-yellow-400" fill="currentColor" />
                        <span className="text-[9px] font-semibold leading-none text-white">{manga.rating}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className={`font-bold line-clamp-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {manga.title}
                    </p>
                    {mangaChapters && mangaChapters.length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {mangaChapters.map((chapter, idx) => (
                          <p
                            key={idx}
                            className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} hover:text-blue-400 cursor-pointer transition-colors`}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Navigate to reader with chapter_id
                              const chapterId = chapter.chapter_id || chapter.url;
                              if (chapterId) {
                                navigate(`/reader/${encodeURIComponent(chapterId)}`);
                              }
                            }}
                          >
                            Chapter {chapter.number}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Loading...
                      </p>
                    )}
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
                    {manga.title}
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