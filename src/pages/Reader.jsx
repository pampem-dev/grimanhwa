import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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

  // Use URL chapter ID if not provided via props
  const chapterId = propChapterId || urlChapterId;

  const CHAPTER_CACHE_TTL_MS = 60 * 60 * 1000;
  const getChapterCacheKey = (id) => `readerCache_chapter_${id}`;

  const readChapterCache = (id) => {
    if (!id) return null;
    try {
      const raw = localStorage.getItem(getChapterCacheKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > CHAPTER_CACHE_TTL_MS) return null;
      return { pages: parsed.pages, chapterNum: parsed.chapterNum };
    } catch { return null; }
  };

  const writeChapterCache = (id, payload) => {
    if (!id || !payload?.pages) return;
    try {
      localStorage.setItem(
        getChapterCacheKey(id),
        JSON.stringify({ pages: payload.pages, chapterNum: payload.chapterNum, timestamp: Date.now() })
      );
    } catch { /* Quota exceeded */ }
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
    if (!id || loadedIds.has(id) || failedIds.has(id)) return;

    const cached = readChapterCache(id);
    if (cached?.pages?.length) {
      setChapters((prev) => (prev.some((ch) => ch.id === id) ? prev : [...prev, { id, ...cached }]));
      setLoadedIds((prev) => new Set(prev).add(id));
      return;
    }

    // Only show the spinner if we aren't preloading in the background
    if (!isPreload) setIsLoadingNext(true);

    try {
      const apiUrl = API_ENDPOINTS.CHAPTER(id);
      console.log('🔍 Fetching chapter:', apiUrl);
      
      const response = await fetchWithRetry(apiUrl);
      console.log('🔍 Response status:', response.status);
      
      if (!response.ok) throw new Error(`Status: ${response.status}`);

      const data = await response.json();
      console.log('🔍 Chapter data received:', { 
        pages: data.pages?.length, 
        firstPageUrl: data.pages?.[0] 
      });
      
      if (data.pages?.length > 0) {
        const chapterNum = getChapterNumber(id);
        
        setChapters((prev) => (prev.some((ch) => ch.id === id) ? prev : [...prev, { id, pages: data.pages, chapterNum }]));
        setLoadedIds((prev) => new Set(prev).add(id));
        writeChapterCache(id, { pages: data.pages, chapterNum });
        
        // Reset hasReachedEnd when we successfully load a chapter
        if (!isPreload) {
          setHasReachedEnd(false);
        }

        // --- AGGRESSIVE PRE-FETCH LOGIC ---
        // Pre-fetch multiple chapters ahead for seamless reading
        if (!isPreload && chapters.length < 5) {
          // Pre-fetch next 2 chapters
          for (let i = 1; i <= 2; i++) {
            const nextId = id.replace(/chapter\/\d+/i, `chapter/${chapterNum + i}`);
            setTimeout(() => {
              fetchChapter(nextId, true);
            }, i * 1000); // Stagger pre-fetches
          }
        }
      } else {
        // Handle empty response - only mark as end if this is a prefetch attempt
        if (isPreload) {
          setHasReachedEnd(true);
        }
      }
    } catch (err) {
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

  useEffect(() => { 
    if (chapterId && chapters.length === 0) fetchChapter(chapterId); 
  }, [chapterId, fetchChapter, chapters.length]);

  // ULTRA-OPTIMIZED: Aggressive observer for seamless loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isLoadingNext && chapters.length > 0 && !hasReachedEnd) {
          const last = chapters[chapters.length - 1];
          
          // Pre-fetch multiple chapters ahead
          for (let i = 1; i <= 3; i++) {
            const nextId = last.id.replace(/chapter\/\d+/i, `chapter/${last.chapterNum + i}`);
            if (!loadedIds.has(nextId) && chapters.length < 6) {
              fetchChapter(nextId, i > 1); // Only show spinner for immediate next chapter
            }
          }
        }
      },
      { threshold: 0.1, rootMargin: '3000px' } // Ultra-early trigger
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [chapters, isLoadingNext, fetchChapter, loadedIds, hasReachedEnd]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const currentChapterId = entry.target.getAttribute('data-chapter-id');
            setActiveChapterId(currentChapterId);
            
            // Always update URL to reflect current chapter (forward or backward)
            if (currentChapterId && currentChapterId !== chapterId) {
              console.log('🔄 Updating URL to current chapter:', currentChapterId);
              
              // Check if we're going backwards (to a previous chapter)
              const currentChapter = chapters.find(ch => ch.id === currentChapterId);
              const previousChapter = chapters.find(ch => ch.id === chapterId);
              
              if (currentChapter && previousChapter) {
                const currentNum = getChapterNumber(currentChapter.id);
                const previousNum = getChapterNumber(previousChapter.id);
                
                // If going to a previous chapter, scroll to its last page
                if (currentNum < previousNum) {
                  console.log('🔄 Going backwards - scrolling to last page of chapter:', currentNum);
                  const lastPageIndex = currentChapter.pages.length - 1;
                  setTimeout(() => {
                    scrollToPage(currentChapter.id, lastPageIndex);
                  }, 100);
                }
              }
              
              navigate(`/reader/${encodeURIComponent(currentChapterId)}`, { replace: true });
            }
          }
        });
      },
      { root: scrollContainerRef.current, threshold: 0, rootMargin: '-10% 0px -80% 0px' }
    );
    const headers = document.querySelectorAll('.chapter-marker');
    headers.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [chapters, activeChapterId, chapterId, navigate, scrollToPage]);

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
                
                console.log('📍 Page tracking:', { pageId, chapterId, pageIndex });
                
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
    console.log('📍 Found pages to track:', pages.length);
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
                console.log('🏁 Chapter end reached:', { chapterId: chapter.id, lastPage: lastPageIndex + 1 });
                savePagePosition(chapter.id, lastPageIndex);
                setVisiblePage({ chapterId: chapter.id, pageIndex: lastPageIndex });
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
              console.log('🎯 Scroll backup - updating visible page:', { chapterId, pageIndex });
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

  // Clear saved position when opening chapter to ensure Details shows current position
  useEffect(() => {
    if (chapterId) {
      const key = `reader_position_${chapterId}`;
      localStorage.removeItem(key); // Clear saved position
      console.log('🗑️ Cleared saved position for chapter:', chapterId);
    }
  }, [chapterId]);

  const scrollToCurrentChapter = () => {
    if (!activeChapterId) return;
    const element = document.getElementById(`header-${activeChapterId}`);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Handle exit navigation
  const handleExit = () => {
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
    
    console.log('🔍 Position debug:', { 
      visiblePage, 
      activeChapterId, 
      currentPage, 
      displayChapterId, 
      displayPageIndex 
    });
    
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
                    {showInfo ? <EyeOff size={20} /> : <Eye size={20} />}
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
