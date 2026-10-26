import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Loader2, ArrowUp, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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
      { threshold: 0.01, rootMargin: '500px' } // Reduced from 2000px for better performance
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
          loading={priority ? "eager" : "lazy"} // Use native lazy loading for non-priority images
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
  const [showNavBars, setShowNavBars] = useState(false); // Show/hide nav bars on tap
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [currentPage, setCurrentPage] = useState({ chapterId: null, pageIndex: 0 });
  const [visiblePage, setVisiblePage] = useState({ chapterId: null, pageIndex: 0 }); // Real-time visible page
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [showChapterDropdown, setShowChapterDropdown] = useState(false); // Chapter dropdown visibility
  const [allChapters, setAllChapters] = useState([]); // All available chapters for dropdown

  const scrollContainerRef = useRef(null);
  const observerTarget = useRef(null);
  const abortControllerRef = useRef(null);
  const previousChapterIdRef = useRef(null);
  const hasStartedFetchRef = useRef(false);
  const dropdownRef = useRef(null);

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
        return null;
      }
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > CHAPTER_CACHE_TTL_MS) {
        return null;
      }
      return { pages: parsed.pages, chapterNum: parsed.chapterNum };
    } catch (err) {
      return null;
    }
  };

  const writeChapterCache = (id, payload) => {
    if (!id || !payload?.pages) return;
    try {
      localStorage.setItem(
        getChapterCacheKey(id),
        JSON.stringify({ pages: payload.pages, chapterNum: payload.chapterNum, timestamp: Date.now() })
      );
    } catch (err) {
    }
  };

  const getChapterNumber = (id) => {
    const match = id.match(/chapter\/(\d+)/i);
    return match ? parseInt(match[1]) : 1;
  };

  // Fetch all chapters for the manga (for dropdown)
  const fetchAllChapters = useCallback(async () => {
    if (!mangaId || allChapters.length > 0) return; // Already fetched

    try {
      const response = await fetchWithRetry(API_ENDPOINTS.MANGA(mangaId));
      const data = await response.json();

      if (data.chapters && Array.isArray(data.chapters)) {
        // Sort chapters by number (descending for dropdown)
        const sortedChapters = data.chapters
          .map(ch => ({
            id: ch.id,
            number: ch.number || getChapterNumber(ch.id),
            title: ch.title || `Chapter ${ch.number || getChapterNumber(ch.id)}`
          }))
          .sort((a, b) => b.number - a.number); // Descending order

        setAllChapters(sortedChapters);
      }
    } catch (err) {
    }
  }, [mangaId, allChapters.length]);

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
    }
    return 0;
  }, []);

  // Scroll to specific page
  const scrollToPage = useCallback((chapterId, pageIndex, smooth = true) => {
    const pageElement = document.getElementById(`page-${chapterId}-${pageIndex}`);
    if (pageElement) {
      if (smooth) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // Instant jump - set scroll position directly
        const container = scrollContainerRef.current;
        if (container) {
          // Temporarily disable smooth scrolling for instant jump
          container.style.scrollBehavior = 'auto';
          const rect = pageElement.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const scrollTop = container.scrollTop + rect.top - containerRect.top;
          container.scrollTop = scrollTop;
          // Re-enable smooth scrolling after jump
          setTimeout(() => {
            container.style.scrollBehavior = '';
          }, 0);
        }
      }
      savePagePosition(chapterId, pageIndex);
    }
  }, [savePagePosition]);

  // OPTIMIZED: fetchChapter with better error handling and performance
  const fetchChapter = useCallback(async (id, isPreload = false, insertAtStart = false) => {
    if (!id || loadedIds.has(id) || failedIds.has(id) || hasReachedEnd) {
      return;
    }

    const cached = readChapterCache(id);
    const MIN_PAGES_THRESHOLD = 5;
    if (cached?.pages?.length >= MIN_PAGES_THRESHOLD) {
      const chapterNum = cached.chapterNum || getChapterNumber(id);
      setChapters((prev) => {
        if (prev.some((ch) => ch.id === id)) return prev;
        const newChapter = { id, pages: cached.pages, chapterNum };
        if (insertAtStart) {
          // Insert at the beginning for previous chapters
          return [newChapter, ...prev];
        }
        return [...prev, newChapter];
      });
      setLoadedIds((prev) => new Set(prev).add(id));

      // Pre-fetch next chapter even when loading from cache
      if (!isPreload) {
        const nextChapterNum = chapterNum + 1;
        const nextId = id.replace(/chapter\/\d+/i, `chapter/${nextChapterNum}`);
        if (!loadedIds.has(nextId)) {
          fetchChapter(nextId, true, false);
        }
      }

      return;
    } else if (cached) {
      // Cached but has insufficient pages - mark as failed and reached end
      setHasReachedEnd(true);
      setFailedIds((prev) => new Set(prev).add(id));
      // Remove from cache
      const cacheKey = getChapterCacheKey(id);
      localStorage.removeItem(cacheKey);
      return;
    }

    // Only show the spinner if we aren't preloading in the background
    if (!isPreload) setIsLoadingNext(true);

    try {
      const apiUrl = API_ENDPOINTS.CHAPTER(id);

      const response = await fetchWithRetry(apiUrl, { 
        signal: abortControllerRef.current?.signal,
        noRetry: true // Disable retries to avoid duplicate fetches on connection errors
      });
      
      if (!response.ok) throw new Error(`Status: ${response.status}`);

      const data = await response.json();

      // Filter out false positives - real chapters should have at least 5 pages
      const MIN_PAGES_THRESHOLD = 5;
      if (data.pages?.length >= MIN_PAGES_THRESHOLD) {
        const chapterNum = getChapterNumber(id);

        // Progressive loading: first 5 pages immediately, then the rest
        const firstPages = data.pages.slice(0, 5);
        const remainingPages = data.pages.slice(5);

        // Check if chapter already exists to prevent duplicates
        const chapterExists = chapters.some(ch => ch.id === id);

        if (!chapterExists) {
          // Load first 5 pages immediately for fast display
          setChapters((prev) => {
            // Double-check within the functional update to prevent race conditions
            if (prev.some(ch => ch.id === id)) {
              return prev; // Don't add if already exists
            }
            const newChapter = { id, pages: firstPages, chapterNum };
            if (insertAtStart) {
              // Insert at the beginning for previous chapters
              return [newChapter, ...prev];
            }
            return [...prev, newChapter];
          });
          setLoadedIds((prev) => new Set(prev).add(id));
          writeChapterCache(id, { pages: data.pages, chapterNum });
        }

        // Load remaining pages after a short delay (non-blocking)
        if (remainingPages.length > 0) {
          setTimeout(() => {
            // Check if request should be cancelled (chapter changed)
            if (abortControllerRef.current?.signal.aborted) {
              return;
            }

            setChapters((prev) => prev.map(ch =>
              ch.id === id
                ? { ...ch, pages: data.pages }
                : ch
            ));
            writeChapterCache(id, { pages: data.pages, chapterNum });
          }, 200); // Reduced to 200ms for faster progressive loading
        }

        // Reset hasReachedEnd when we successfully load a chapter
        if (!isPreload) {
          setHasReachedEnd(false);
        }

        // --- DYNAMIC PRE-FETCH LOGIC ---
        // Pre-fetch 1 chapter ahead for seamless reading
        // Triggers for every chapter to always keep 1 ahead ready
        if (!isPreload) {
          // Pre-fetch next 1 chapter with delay to not block current rendering
          setTimeout(() => {
            const nextChapterNum = chapterNum + 1;
            const nextId = id.replace(/chapter\/\d+/i, `chapter/${nextChapterNum}`);

            if (!loadedIds.has(nextId)) {
              fetchChapter(nextId, true, false);
            }
          }, 1000); // 1 second delay to prioritize current chapter
        } else {
          // If we're preloading and got here, it means the chapter exists
          // Clear hasReachedEnd if we successfully loaded a chapter during preload
          setHasReachedEnd(false);
        }
      } else {
        // Handle empty response - mark as end and failed
        setHasReachedEnd(true);
        setFailedIds((prev) => new Set(prev).add(id));
        // Don't cache empty chapters so they won't be tried again from cache
        const cacheKey = getChapterCacheKey(id);
        localStorage.removeItem(cacheKey);
      }
    } catch (err) {
      // Don't log error if it's just an abort (normal during navigation/strict mode)
      if (err.name === 'AbortError' || err.message.includes('aborted')) {
        return;
      }

      // Check if this is a 404, indicating no more chapters
      if (err.message.includes('Status: 404')) {
        setHasReachedEnd(true);
        // Mark as failed so we don't try to fetch it again
        setFailedIds((prev) => new Set(prev).add(id));
      }
      // Don't immediately mark as failed for other errors - allow retries
      if (!isPreload && !err.message.includes('Status: 404')) {
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

  // Fetch all chapters for dropdown
  useEffect(() => {
    fetchAllChapters();
  }, [fetchAllChapters]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showChapterDropdown && !event.target.closest('.chapter-dropdown-container')) {
        setShowChapterDropdown(false);
      }
    };

    if (showChapterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showChapterDropdown]);

  // Scroll dropdown to show current chapter at bottom
  useEffect(() => {
    if (showChapterDropdown && dropdownRef.current) {
      const currentChapterId = visiblePage.chapterId || activeChapterId;
      const currentChapterElement = dropdownRef.current.querySelector(`[data-chapter-item="${currentChapterId}"]`);
      
      if (currentChapterElement) {
        // Scroll so the current chapter is at the bottom of the visible area
        const container = dropdownRef.current;
        const elementTop = currentChapterElement.offsetTop;
        const containerHeight = container.clientHeight;
        const elementHeight = currentChapterElement.clientHeight;
        
        container.scrollTop = elementTop - containerHeight + elementHeight + 8; // +8 for padding
      }
    }
  }, [showChapterDropdown, visiblePage.chapterId, activeChapterId]);

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
              
              // Check if we're going backwards (to a previous chapter)
              const currentChapter = chapters.find(ch => ch.id === currentChapterId);
              const previousChapter = chapters.find(ch => ch.id === chapterId);
              
              if (currentChapter && previousChapter) {
                const currentNum = getChapterNumber(currentChapter.id);
                const previousNum = getChapterNumber(previousChapter.id);
                
                // Mark chapter as read when transitioning (both forward and backward)
                if (currentNum !== previousNum && mangaId) {
                  try {
                    const readChaptersKey = `manga_read_chapters_${mangaId}`;
                    const readChaptersData = JSON.parse(localStorage.getItem(readChaptersKey) || '[]');
                    
                    if (!readChaptersData.includes(currentChapter.id)) {
                      readChaptersData.push(currentChapter.id);
                      localStorage.setItem(readChaptersKey, JSON.stringify(readChaptersData));
                    }
                  } catch (err) {
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
          if (entry.isIntersecting && !isDraggingSlider) {
            const pageId = entry.target.getAttribute('data-page-id');
            if (pageId) {
              // Extract chapter ID and page index correctly
              // Format: chapterId-pageIndex
              const lastDashIndex = pageId.lastIndexOf('-');
              if (lastDashIndex !== -1) {
                const chapterId = pageId.substring(0, lastDashIndex);
                const pageIndex = parseInt(pageId.substring(lastDashIndex + 1));


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
                    }
                  }
                } catch (err) {
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
  }, [chapters, savePagePosition, scrollContainerRef, isDraggingSlider]);

  // Add scroll listener as backup for immediate position updates (with throttling)
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking || isDraggingSlider) return;
      ticking = true;

      requestAnimationFrame(() => {
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

        ticking = false;
      });
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll, { passive: true });
      };
    }
  }, [chapters, scrollContainerRef, isDraggingSlider]);

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
      // Navigate to the manhwa details page instead of going back in history
      if (mangaId) {
        navigate(`/manga/${encodeURIComponent(mangaId)}`);
      } else {
        // Extract mangaId from chapterId if not available
        const extractedMangaId = chapterId.replace(/\/chapter\/\d+$/i, '');
        navigate(`/manga/${encodeURIComponent(extractedMangaId)}`);
      }
    }
  };

  // Handle screen tap to toggle nav bars
  const handleScreenTap = (e) => {
    // Don't toggle if clicking on buttons or interactive elements
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) {
      return;
    }
    setShowNavBars(!showNavBars);
  };

  // Handle page slider change (during drag)
  const handlePageSliderChange = (e) => {
    const pageIndex = parseInt(e.target.value);
    const activeChapter = chapters.find(ch => ch.id === (visiblePage.chapterId || activeChapterId));
    if (activeChapter) {
      // Update visible page immediately during drag for UI feedback
      setVisiblePage({ chapterId: activeChapter.id, pageIndex });
      // Jump to page instantly during drag (like Mihon does)
      scrollToPage(activeChapter.id, pageIndex, false);
    }
  };

  // Handle slider drag start
  const handleSliderPointerDown = () => {
    setIsDraggingSlider(true);
  };

  // Handle slider drag end
  const handleSliderPointerUp = () => {
    setIsDraggingSlider(false);
  };

  // Navigate to previous chapter
  const handlePrevChapter = () => {
    const currentChapter = chapters.find(ch => ch.id === (visiblePage.chapterId || activeChapterId));
    if (currentChapter) {
      const currentIndex = chapters.findIndex(ch => ch.id === currentChapter.id);
      if (currentIndex > 0) {
        const prevChapter = chapters[currentIndex - 1];
        handleNavigate(prevChapter.id);
      } else {
        // We're on the first loaded chapter, try to fetch the previous one
        const chapterNum = getChapterNumber(currentChapter.id);
        const prevChapterNum = chapterNum - 1;
        if (prevChapterNum > 0) {
          const prevId = currentChapter.id.replace(/chapter\/\d+/i, `chapter/${prevChapterNum}`);
          // Fetch the previous chapter and insert at start
          fetchChapter(prevId, false, true);
          // Navigate to it after a short delay to allow it to load
          setTimeout(() => {
            handleNavigate(prevId);
          }, 500);
        }
      }
    }
  };

  // Check if current chapter is the last loaded chapter
  const isLastChapter = () => {
    const currentChapter = chapters.find(ch => ch.id === (visiblePage.chapterId || activeChapterId));
    if (!currentChapter) return false;

    const currentIndex = chapters.findIndex(ch => ch.id === currentChapter.id);
    const isLastInArray = currentIndex === chapters.length - 1;

    // Disable if it's the last chapter in the array
    return isLastInArray;
  };

  // Navigate to next chapter
  const handleNextChapter = () => {
    const currentChapter = chapters.find(ch => ch.id === (visiblePage.chapterId || activeChapterId));
    if (currentChapter) {
      const currentIndex = chapters.findIndex(ch => ch.id === currentChapter.id);
      // Only navigate if there's a next chapter
      if (currentIndex < chapters.length - 1) {
        const nextChapter = chapters[currentIndex + 1];
        handleNavigate(nextChapter.id);
      }
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
      className="fixed inset-0 bg-[#050505] overflow-y-auto overflow-x-hidden z-[100]"
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
          <div className="flex flex-col items-center w-full px-0 md:px-4" onClick={handleScreenTap}>
            <div className="w-full max-w-[900px] bg-[#050505] shadow-2xl">
              {chapters.map((chapter) => (
                <div key={`group-${chapter.id}`} className="w-full flex flex-col items-center">
                  <div
                    id={`header-${chapter.id}`}
                    data-chapter-id={chapter.id}
                    className="chapter-marker w-full py-16 md:py-24 text-center select-none transition-opacity duration-300 opacity-100"
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

          {/* Top Navigation Bar */}
          <div className={`fixed top-0 left-0 right-0 z-[110] bg-black/80 backdrop-blur-md border-b border-gray-800/50 transition-all duration-300 ${showNavBars ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={handleExit}
                className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 text-white transition-colors"
                aria-label="Exit reader"
              >
                <X size={20} />
              </button>
              <div className="relative chapter-dropdown-container">
                <button
                  onClick={() => setShowChapterDropdown(!showChapterDropdown)}
                  className="flex items-center gap-2 text-sm font-bold text-white hover:text-blue-400 transition-colors"
                >
                  {(() => {
                    const displayChapterId = visiblePage.chapterId || activeChapterId;
                    const activeChapter = chapters.find(ch => ch.id === displayChapterId);
                    if (!activeChapter) return 'Loading...';
                    const chapterNum = getChapterNumber(activeChapter.id);
                    return `Chapter ${chapterNum}`;
                  })()}
                  <ChevronDown size={16} className={`transition-transform ${showChapterDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Chapter Dropdown */}
                {showChapterDropdown && (
                  <div ref={dropdownRef} className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-36 max-h-60 overflow-y-auto bg-[#0a0a0a] border border-gray-800/50 rounded-xl shadow-2xl z-[120] backdrop-blur-xl custom-scrollbar">
                    <div className="p-1">
                      {allChapters.length > 0 ? (
                        allChapters.map((ch) => (
                          <button
                            key={ch.id}
                            data-chapter-item={ch.id}
                            onClick={() => {
                              handleNavigate(ch.id);
                              setShowChapterDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                              ch.id === (visiblePage.chapterId || activeChapterId)
                                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                                : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                            }`}
                          >
                            Chapter {ch.number}
                          </button>
                        ))
                      ) : (
                        <div className="text-center text-gray-600 text-sm py-8">
                          Loading chapters...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="w-10" /> {/* Spacer for centering */}
            </div>
          </div>

          <style>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #374151;
              border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #4b5563;
            }
          `}</style>

          {/* Bottom Navigation Bar */}
          <div className={`fixed bottom-0 left-0 right-0 z-[110] bg-black/80 backdrop-blur-md border-t border-gray-800/50 transition-all duration-300 ${showNavBars ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}>
            <div className="flex items-center justify-center gap-4 px-4 py-4">
              <button
                onClick={handlePrevChapter}
                className="p-3 rounded-full bg-gray-800/50 hover:bg-gray-700/50 text-white transition-colors"
                aria-label="Previous chapter"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex-1 max-w-md flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-300 w-12 text-right">
                  {(() => {
                    const displayPageIndex = visiblePage.pageIndex !== null ? visiblePage.pageIndex : (currentPage.pageIndex || 0);
                    return displayPageIndex + 1;
                  })()}
                </span>
                <input
                  type="range"
                  min="0"
                  max={(() => {
                    const activeChapter = chapters.find(ch => ch.id === (visiblePage.chapterId || activeChapterId));
                    return (activeChapter?.pages.length || 1) - 1;
                  })()}
                  value={visiblePage.pageIndex || 0}
                  onChange={handlePageSliderChange}
                  onPointerDown={handleSliderPointerDown}
                  onPointerUp={handleSliderPointerUp}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer slider"
                  style={{
                    '--value': `${((visiblePage.pageIndex || 0) / Math.max(1, (chapters.find(ch => ch.id === (visiblePage.chapterId || activeChapterId))?.pages.length || 1) - 1)) * 100}%`
                  }}
                  aria-label="Page slider"
                />
                <span className="text-sm font-semibold text-gray-300 w-12">
                  {(() => {
                    const activeChapter = chapters.find(ch => ch.id === (visiblePage.chapterId || activeChapterId));
                    return activeChapter?.pages.length || 1;
                  })()}
                </span>
                <style>{`
                  .slider {
                    -webkit-appearance: none;
                    appearance: none;
                    background: #1f2937;
                    border-radius: 8px;
                    height: 6px;
                  }
                  .slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: 2px solid #1f2937;
                    box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
                    transition: transform 0.15s ease;
                  }
                  .slider::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                  }
                  .slider::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: 2px solid #1f2937;
                    box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
                    transition: transform 0.15s ease;
                  }
                  .slider::-moz-range-thumb:hover {
                    transform: scale(1.2);
                  }
                  .slider::-webkit-slider-runnable-track {
                    background: linear-gradient(to right, #3b82f6 0%, #3b82f6 var(--value, 0%), #1f2937 var(--value, 0%), #1f2937 100%);
                    border-radius: 8px;
                  }
                  .slider::-moz-range-track {
                    background: #1f2937;
                    border-radius: 8px;
                  }
                `}</style>
              </div>
              <button
                onClick={handleNextChapter}
                disabled={isLastChapter()}
                className={`p-3 rounded-full transition-colors ${isLastChapter() ? 'bg-gray-800/30 text-gray-600 cursor-not-allowed' : 'bg-gray-800/50 hover:bg-gray-700/50 text-white'}`}
                aria-label="Next chapter"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reader;
