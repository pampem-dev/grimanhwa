import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Loader2, ArrowUp, X, Eye, EyeOff } from 'lucide-react';
import { API_ENDPOINTS, fetchWithRetry } from '../config/api';

const LazyImage = ({ src, alt, className, style, priority = false }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.01, rootMargin: '2000px' } // Much larger margin for ultra-early loading
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [priority]);

  return (
    <div ref={imgRef} className="relative w-full flex justify-center bg-[#050505] overflow-hidden">
      {isInView && !error && (
        <img
          src={src}
          alt={alt}
          className={`${className} w-full md:max-w-[850px] lg:max-w-[900px] h-auto object-contain block mx-auto transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={style}
          onLoad={() => setIsLoaded(true)}
          onError={() => setError(true)}
          loading="eager" // Load immediately when in view
          decoding="async"
        />
      )}
      {(!isLoaded || !isInView) && !error && (
        <div className="bg-gray-900/40 animate-pulse w-full max-w-[900px]" style={{ ...style, minHeight: '400px' }} />
      )}
    </div>
  );
};

const Reader = ({ chapterId: propChapterId, onNavigate, onExit }) => {
  const { chapterId: urlChapterId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [chapters, setChapters] = useState([]);
  const [loadedIds, setLoadedIds] = useState(new Set());
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [failedIds, setFailedIds] = useState(() => new Set());
  const [showControls, setShowControls] = useState(false); // Start with controls hidden
  const [showInfo, setShowInfo] = useState(true); // Show chapter/page info by default
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [currentPage, setCurrentPage] = useState({ chapterId: null, pageIndex: 0 });
  const [visiblePage, setVisiblePage] = useState({ chapterId: null, pageIndex: 0 }); // Real-time visible page

  const scrollContainerRef = useRef(null);
  const observerTarget = useRef(null);
  const abortControllerRef = useRef(null);
  const previousChapterIdRef = useRef(null);
  const hasStartedFetchRef = useRef(false);

  // Use URL chapter ID if not provided via props
  const chapterId = propChapterId || urlChapterId;
  let mangaId = searchParams.get('manga') || '';

  // If mangaId is not provided, extract it from chapter ID
  if (!mangaId && chapterId) {
    // Extract manga ID from chapter ID (remove /chapter/{number} from the end)
    mangaId = chapterId.replace(/\/chapter\/\d+$/i, '');
  }

  const CHAPTER_CACHE_TTL_MS = 60 * 60 * 1000;
  const getChapterCacheKey = (id) => `readerCache_chapter_${id}`;

  const readChapterCache = (id) => {
    if (!id) return null;
    try {
      const raw = localStorage.getItem(getChapterCacheKey(id));
      if (!raw) {
        console.log('🔍 No cache found for:', id);
        return null;
      }
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > CHAPTER_CACHE_TTL_MS) {
        console.log('🔍 Cache expired for:', id);
        return null;
      }
      console.log('🔍 Cache valid for:', id, 'pages:', parsed.pages?.length);
      return { pages: parsed.pages, chapterNum: parsed.chapterNum };
    } catch (err) {
      console.error('🔍 Cache read error:', err);
      return null;
    }
  };

  const writeChapterCache = (id, payload) => {
    if (!id || !payload?.pages) return;
    try {
      console.log('🔍 Writing cache for:', id, 'pages:', payload.pages.length);
      localStorage.setItem(
        getChapterCacheKey(id),
        JSON.stringify({ pages: payload.pages, chapterNum: payload.chapterNum, timestamp: Date.now() })
      );
    } catch (err) {
      console.error('🔍 Cache write error:', err);
    }
  };

  const getChapterNumber = (id) => {
    const match = id.match(/chapter\/(\d+)/i);
    return match ? parseInt(match[1]) : 1;
  };

  // Save current page position
  const savePagePosition = useCallback((chapterId, pageIndex) => {
    const key = `reader_position_${chapterId}`;
    localStorage.setItem(key, JSON.stringify({
      pageIndex,
      timestamp: Date.now()
    }));
    setCurrentPage({ chapterId, pageIndex });
  }, []);

  // Load saved page position
  const loadPagePosition = useCallback((chapterId) => {
    const key = `reader_position_${chapterId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const position = JSON.parse(saved);
        // Only restore if less than 7 days old
        if (Date.now() - position.timestamp < 7 * 24 * 60 * 60 * 1000) {
          return position.pageIndex;
        }
      }
    } catch (err) {
      console.error('Failed to load page position:', err);
    }
    return 0;
  }, []);

  // Scroll to specific page
  const scrollToPage = useCallback((chapterId, pageIndex) => {
    const pageElement = document.getElementById(`page-${chapterId}-${pageIndex}`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      savePagePosition(chapterId, pageIndex);
    }
  }, [savePagePosition]);

  // OPTIMIZED: fetchChapter with better error handling and performance
  const fetchChapter = useCallback(async (id, isPreload = false) => {
    console.log(`Fetching chapter ${id} with preload: ${isPreload}`);
    if (!id || loadedIds.has(id) || failedIds.has(id)) {
      console.log(`Skipped fetch for ${id} - already loaded/failed`);
      return;
    }

    const cached = readChapterCache(id);
    if (cached?.pages?.length) {
      const chapterNum = cached.chapterNum || getChapterNumber(id);
      setChapters((prev) => {
        const newChapters = prev.some((ch) => ch.id === id) ? prev : [...prev, { id, pages: cached.pages, chapterNum }];
        return newChapters;
      });
      setLoadedIds((prev) => new Set(prev).add(id));

      // Pre-fetch next chapter even when loading from cache
      if (!isPreload) {
        const nextChapterNum = chapterNum + 1;
        const nextId = id.replace(/chapter\/\d+/i, `chapter/${nextChapterNum}`);
        if (!loadedIds.has(nextId)) {
          console.log(`Pre-fetching next chapter from cache load: ${nextChapterNum}`);
          fetchChapter(nextId, true);
        }
      }

      return;
    }

    // Only show the spinner if we aren't preloading in the background
    if (!isPreload) setIsLoadingNext(true);

    try {
      const apiUrl = API_ENDPOINTS.CHAPTER(id);
      console.log('🔍 Fetching chapter:', apiUrl);

      const response = await fetchWithRetry(apiUrl, { signal: abortControllerRef.current?.signal });
      console.log('🔍 Response status:', response.status);
      
      if (!response.ok) throw new Error(`Status: ${response.status}`);

      const data = await response.json();
      // console.log('🔍 Chapter data received:', { 
      //   pages: data.pages?.length, 
      //   firstPageUrl: data.pages?.[0] 
      // });
      
      if (data.pages?.length > 0) {
        const chapterNum = getChapterNumber(id);
        
        // Progressive loading: first 6 pages immediately, then the rest
        const firstPages = data.pages.slice(0, 6);
        const remainingPages = data.pages.slice(6);
        
        // Check if chapter already exists to prevent duplicates
        const chapterExists = chapters.some(ch => ch.id === id);
        
        if (!chapterExists) {
          // Load first 6 pages immediately for fast display
          setChapters((prev) => {
            // Double-check within the functional update to prevent race conditions
            if (prev.some(ch => ch.id === id)) {
              return prev; // Don't add if already exists
            }
            return [...prev, { id, pages: firstPages, chapterNum }];
          });
          setLoadedIds((prev) => new Set(prev).add(id));
          writeChapterCache(id, { pages: data.pages, chapterNum });
        }
        
        // Load remaining pages after a short delay (non-blocking)
        if (remainingPages.length > 0) {
          setTimeout(() => {
            // Check if request should be cancelled (chapter changed)
            if (abortControllerRef.current?.signal.aborted) {
              console.log('🔍 Remaining pages load cancelled due to chapter change');
              return;
            }

            setChapters((prev) => prev.map(ch =>
              ch.id === id
                ? { ...ch, pages: data.pages }
                : ch
            ));
            writeChapterCache(id, { pages: data.pages, chapterNum });
          }, 300); // 300ms delay to not block UI
        }
        
        // Reset hasReachedEnd when we successfully load a chapter
        if (!isPreload) {
          setHasReachedEnd(false);
        }

        // --- DYNAMIC PRE-FETCH LOGIC ---
        // Pre-fetch 1 chapter ahead for seamless reading
        // Triggers for every chapter to always keep 1 ahead ready
        if (!isPreload) {
          // Pre-fetch next 1 chapter
          const nextChapterNum = chapterNum + 1;
          const nextId = id.replace(/chapter\/\d+/i, `chapter/${nextChapterNum}`);

          if (!loadedIds.has(nextId)) {
            console.log(`Pre-fetching next chapter: ${nextChapterNum}`);
            fetchChapter(nextId, true);
          }
        }
      } else {
        // Handle empty response - only mark as end if this is a prefetch attempt
        if (isPreload) {
          setHasReachedEnd(true);
        }
      }
    } catch (err) {
      // Don't log error if it's just an abort (normal during navigation/strict mode)
      if (err.name === 'AbortError' || err.message.includes('aborted')) {
        console.log('🔍 Request aborted (normal during navigation)');
        return;
      }

      console.error("Fetch failed:", err);
      // Check if this is a 404, indicating no more chapters - only mark as end for prefetch attempts
      if (err.message.includes('Status: 404') && isPreload) {
        setHasReachedEnd(true);
      }
      // Don't immediately mark as failed - allow retries
      if (!isPreload) {
        setFailedIds((prev) => new Set(prev).add(id));
      }
    } finally {
      if (!isPreload) setIsLoadingNext(false);
    }
  }, [loadedIds, failedIds, readChapterCache, writeChapterCache, chapters.length]);

  // Reset state when chapterId changes to prevent loading wrong chapter
  useEffect(() => {
    if (chapterId) {
      // Only abort and reset if chapterId actually changed (not on mount)
      if (previousChapterIdRef.current && previousChapterIdRef.current !== chapterId) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        hasStartedFetchRef.current = false;

        // Create new AbortController for this chapter
        abortControllerRef.current = new AbortController();
        previousChapterIdRef.current = chapterId;

        setChapters([]);
        setLoadedIds(new Set());
        setFailedIds(new Set());
        setActiveChapterId(null);
        setHasReachedEnd(false);
        setIsLoadingNext(false);
      } else if (!previousChapterIdRef.current) {
        // First mount - set the ref but don't reset state
        previousChapterIdRef.current = chapterId;
        abortControllerRef.current = new AbortController();
      }
    }

    // Don't abort on cleanup - allow requests to complete
    return () => {};
  }, [chapterId]);

  useEffect(() => {
    if (chapterId && chapters.length === 0 && !hasStartedFetchRef.current) {
      hasStartedFetchRef.current = true;
      fetchChapter(chapterId);
    }
  }, [chapterId, chapters.length]);

  // Log chapters state changes for debugging
  useEffect(() => {
  }, [chapters]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const currentChapterId = entry.target.getAttribute('data-chapter-id');
            setActiveChapterId(currentChapterId);
            
            // Always update URL to reflect current chapter (forward or backward)
            if (currentChapterId && currentChapterId !== chapterId) {
              // console.log('Updating URL to current chapter:', currentChapterId);
              
              // Check if we're going backwards (to a previous chapter)
              const currentChapter = chapters.find(ch => ch.id === currentChapterId);
              const previousChapter = chapters.find(ch => ch.id === chapterId);
              
              if (currentChapter && previousChapter) {
                const currentNum = getChapterNumber(currentChapter.id);
                const previousNum = getChapterNumber(previousChapter.id);
                
                // Only scroll to last page if going backwards AND the previous chapter was the URL chapter
                // This prevents scrolling to end when reaching end of chapter naturally
                if (currentNum < previousNum && previousChapter.id === chapterId) {
                  // console.log('Going backwards - scrolling to last page of chapter:', currentNum);
                  const lastPageIndex = currentChapter.pages.length - 1;
                  setTimeout(() => {
                    scrollToPage(currentChapter.id, lastPageIndex);
                  }, 100);
                }
                // If going to a next chapter, mark the current chapter as read
                else if (currentNum > previousNum && mangaId) {
                  try {
                    const readChaptersKey = `manga_read_chapters_${mangaId}`;
                    const readChaptersData = JSON.parse(localStorage.getItem(readChaptersKey) || '[]');
                    
                    if (!readChaptersData.includes(currentChapter.id)) {
                      readChaptersData.push(currentChapter.id);
                      localStorage.setItem(readChaptersKey, JSON.stringify(readChaptersData));
                      // console.log('Chapter marked as read:', currentChapter.id);
                    }
                  } catch (err) {
                    console.error('Failed to mark chapter as read:', err);
                  }
                }
              }
              
              navigate(`/reader/${encodeURIComponent(currentChapterId)}?manga=${encodeURIComponent(mangaId || '')}`, { replace: true });
            }
          }
        });
      },
      { root: scrollContainerRef.current, threshold: 0, rootMargin: '-10% 0px -80% 0px' }
    );
    const headers = document.querySelectorAll('.chapter-marker');
    headers.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [chapters, activeChapterId, chapterId, navigate, scrollToPage, mangaId]);

  // Track current page position
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageId = entry.target.getAttribute('data-page-id');
            if (pageId) {
              // Extract chapter ID and page index correctly
              // Format: chapterId-pageIndex
              const lastDashIndex = pageId.lastIndexOf('-');
              if (lastDashIndex !== -1) {
                const chapterId = pageId.substring(0, lastDashIndex);
                const pageIndex = parseInt(pageId.substring(lastDashIndex + 1));
                
                // console.log('Page tracking:', { pageId, chapterId, pageIndex });
                
                if (!isNaN(pageIndex)) {
                  savePagePosition(chapterId, pageIndex);
                  // Update active chapter immediately when page changes
                  setActiveChapterId(chapterId);
                  // Update visible page in real-time
                  setVisiblePage({ chapterId, pageIndex });
                }
              }
            }
          }
        });
      },
      { root: scrollContainerRef.current, threshold: 0.8, rootMargin: '-40% 0px -40% 0px' } // Higher threshold, more centered detection
    );

    const pages = document.querySelectorAll('[data-page-id]');
    // console.log('Found pages to track:', pages.length);
    pages.forEach((page) => observer.observe(page));
    
    // Also observe the last page of each chapter for end detection
    chapters.forEach(chapter => {
      const lastPageIndex = chapter.pages.length - 1;
      const lastPageElement = document.getElementById(`page-${chapter.id}-${lastPageIndex}`);
      if (lastPageElement) {
        const endObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                // console.log('Chapter end reached:', { chapterId: chapter.id, lastPage: lastPageIndex + 1 });
                savePagePosition(chapter.id, lastPageIndex);
                setVisiblePage({ chapterId: chapter.id, pageIndex: lastPageIndex });

                // Mark chapter as read in localStorage
                try {
                  if (mangaId) {
                    const readChaptersKey = `manga_read_chapters_${mangaId}`;
                    const readChaptersData = JSON.parse(localStorage.getItem(readChaptersKey) || '[]');
                    
                    if (!readChaptersData.includes(chapter.id)) {
                      readChaptersData.push(chapter.id);
                      localStorage.setItem(readChaptersKey, JSON.stringify(readChaptersData));
                      // console.log('Chapter marked as read:', chapter.id, 'for manga:', mangaId);
                    }
                  }
                } catch (err) {
                  console.error('Failed to mark chapter as read:', err);
                }
              }
            });
          },
          { root: scrollContainerRef.current, threshold: 0.5 }
        );
        endObserver.observe(lastPageElement);
      }
    });
    
    return () => {
      observer.disconnect();
      // Clean up end observers
      chapters.forEach(chapter => {
        const lastPageIndex = chapter.pages.length - 1;
        const lastPageElement = document.getElementById(`page-${chapter.id}-${lastPageIndex}`);
        if (lastPageElement) {
          const endObserver = new IntersectionObserver(() => {}, {});
          endObserver.disconnect();
        }
      });
    };
  }, [chapters, savePagePosition, scrollContainerRef]);

  // Add scroll listener as backup for immediate position updates
  useEffect(() => {
    const handleScroll = () => {
      // Find which page is currently most visible
      const pages = document.querySelectorAll('[data-page-id]');
      let bestPage = null;
      let maxIntersection = 0;
      
      pages.forEach((page) => {
        const rect = page.getBoundingClientRect();
        const containerRect = scrollContainerRef.current?.getBoundingClientRect();
        
        if (containerRect) {
          const visibleHeight = Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top);
          const intersectionRatio = visibleHeight / rect.height;
          
          if (intersectionRatio > maxIntersection) {
            maxIntersection = intersectionRatio;
            bestPage = page;
          }
        }
      });
      
      if (bestPage) {
        const pageId = bestPage.getAttribute('data-page-id');
        if (pageId) {
          const lastDashIndex = pageId.lastIndexOf('-');
          if (lastDashIndex !== -1) {
            const chapterId = pageId.substring(0, lastDashIndex);
            const pageIndex = parseInt(pageId.substring(lastDashIndex + 1));
            
            if (!isNaN(pageIndex)) {
              setVisiblePage({ chapterId, pageIndex });
              setActiveChapterId(chapterId);
            }
          }
        }
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll, { passive: true });
      };
    }
  }, [chapters, scrollContainerRef]);

  const scrollToCurrentChapter = () => {
    if (!activeChapterId) return;
    const element = document.getElementById(`header-${activeChapterId}`);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Handle exit navigation
  const handleExit = () => {
    // Clear saved position when exiting reader
    if (chapterId) {
      const key = `reader_position_${chapterId}`;
      localStorage.removeItem(key);
    }
    if (onExit) {
      onExit();
    } else {
      navigate(-1);
    }
  };

  // Handle chapter navigation
  const handleNavigate = (nextChapterId) => {
    if (onNavigate) {
      onNavigate(nextChapterId);
    } else {
      navigate(`/reader/${encodeURIComponent(nextChapterId)}`);
    }
  };

  // Get current position display
  const getCurrentPosition = () => {
    // Use visible page for real-time display, fallback to saved page
    const displayChapterId = visiblePage.chapterId || activeChapterId;
    const displayPageIndex = visiblePage.pageIndex !== null ? visiblePage.pageIndex : (currentPage.pageIndex || 0);
    
    // console.log('Position debug:', { 
    //   visiblePage, 
    //   activeChapterId, 
    //   currentPage, 
    //   displayChapterId, 
    //   displayPageIndex 
    // });
    
    if (!displayChapterId) return 'Loading...';
    
    const activeChapter = chapters.find(ch => ch.id === displayChapterId);
    if (!activeChapter) return 'Loading...';
    
    const chapterNum = getChapterNumber(activeChapter.id);
    const currentPageNum = displayPageIndex + 1; // Convert to 1-based
    const totalPages = activeChapter.pages.length;
    
    return `Chapter ${chapterNum} • Page ${currentPageNum}/${totalPages}`;
  };

  return (
    <div 
      ref={scrollContainerRef}
      className="fixed inset-0 bg-[#050505] overflow-y-auto overflow-x-hidden z-[100] scroll-smooth"
    >
      {!chapterId ? (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 size={32} className="animate-spin text-indigo-500" />
            <p className="text-sm text-gray-400">Loading chapter...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center w-full px-0 md:px-4">
            <div className="w-full max-w-[900px] bg-[#050505] shadow-2xl">
              {chapters.map((chapter) => (
                <div key={`group-${chapter.id}`} className="w-full flex flex-col items-center">
                  <div
                    id={`header-${chapter.id}`}
                    data-chapter-id={chapter.id}
                    className={`chapter-marker w-full py-16 md:py-24 text-center select-none transition-opacity duration-300 ${showInfo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  >
                    <div className="inline-flex items-center space-x-4">
                      <div className="h-px w-6 md:w-12 bg-gray-800" />
                      <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.5em] text-gray-400">
                        Chapter {chapter.chapterNum}
                      </span>
                      <div className="h-px w-6 md:w-12 bg-gray-800" />
                    </div>
                  </div>

                  {chapter.pages.map((url, index) => (
                    <div 
                      key={`page-${chapter.id}-${index}`}
                      id={`page-${chapter.id}-${index}`}
                      data-page-id={`${chapter.id}-${index}`}
                    >
                      <LazyImage 
                        src={url} 
                        className="w-full" 
                        style={{ marginBottom: '-1px' }} 
                        priority={index < 5} // Load first 5 images immediately
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div ref={observerTarget} className="w-full py-32 flex flex-col items-center justify-center">
              {isLoadingNext && (
                <div className="flex flex-col items-center space-y-4">
                  <Loader2 size={28} className="animate-spin text-indigo-500" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-gray-600">Loading Chapter</p>
                </div>
              )}
              {hasReachedEnd && !isLoadingNext && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-px bg-gray-800" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-500">No Next Chapter</p>
                  <div className="w-16 h-px bg-gray-800" />
                </div>
              )}
            </div>
          </div>

          <div className="fixed bottom-6 right-6 z-[110] flex items-center gap-3">
            {/* Position indicator - hideable */}
            <div className={`bg-gray-900/50 backdrop-blur-md border border-gray-700/30 rounded-lg px-3 py-1.5 text-[11px] font-medium text-gray-200 whitespace-nowrap transition-opacity duration-300 ${showInfo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              {getCurrentPosition()}
            </div>

            {/* Peek button - always visible but tiny */}
            <div className="relative group">
              <button 
                onClick={() => setShowControls(!showControls)}
                className="w-8 h-8 bg-gray-800/40 backdrop-blur-sm rounded-full border border-gray-700/40 flex items-center justify-center opacity-60 hover:opacity-100 transition-all duration-200"
                aria-label="Toggle controls"
              >
                <div className="w-1.5 h-1.5 bg-white/80 rounded-full"></div>
              </button>
              
              {/* Hidden buttons that appear on click and when controls are enabled */}
              {showControls && (
                <div className="absolute bottom-10 right-0 flex flex-col gap-3 opacity-100 transition-opacity duration-300 pointer-events-auto">
                  <button
                    onClick={() => setShowInfo(!showInfo)}
                    className="p-3.5 rounded-2xl bg-gray-900/20 backdrop-blur-md border border-gray-700/20 text-white/60 hover:text-white transition-all shadow-2xl active:scale-90 whitespace-nowrap"
                    aria-label="Toggle info"
                  >
                    {showInfo ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                  <button
                    onClick={scrollToCurrentChapter}
                    className="p-3.5 rounded-2xl bg-gray-900/20 backdrop-blur-md border border-gray-700/20 text-white/60 hover:text-white transition-all shadow-2xl active:scale-90 whitespace-nowrap"
                    aria-label="Scroll to current chapter"
                  >
                    <ArrowUp size={20} />
                  </button>
                  <button
                    onClick={handleExit}
                    className="p-3.5 rounded-2xl bg-gray-900/20 backdrop-blur-md border border-gray-700/20 text-white/60 hover:text-red-500 transition-all shadow-2xl active:scale-90"
                    aria-label="Exit reader"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reader;
