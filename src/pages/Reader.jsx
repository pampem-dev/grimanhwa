import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowUp, X } from 'lucide-react';
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

const Reader = ({ chapterId, onExit }) => {
  const [chapters, setChapters] = useState([]); 
  const [loadedIds, setLoadedIds] = useState(new Set());
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [failedIds, setFailedIds] = useState(() => new Set());
  const [showControls, setShowControls] = useState(false); // Start with controls hidden
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  
  const scrollContainerRef = useRef(null);
  const observerTarget = useRef(null);

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
      const response = await fetchWithRetry(API_ENDPOINTS.CHAPTER(id));
      if (!response.ok) throw new Error(`Status: ${response.status}`);

      const data = await response.json();
      if (data.pages?.length > 0) {
        const chapterNum = getChapterNumber(id);
        
        setChapters((prev) => (prev.some((ch) => ch.id === id) ? prev : [...prev, { id, pages: data.pages, chapterNum }]));
        setLoadedIds((prev) => new Set(prev).add(id));
        writeChapterCache(id, { pages: data.pages, chapterNum });

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
        // Handle empty response - treat as end of content
        if (!isPreload) {
          setHasReachedEnd(true);
        }
      }
    } catch (err) {
      console.error("Fetch failed:", err);
      // Check if this is a 404, indicating no more chapters
      if (err.message.includes('Status: 404') && !isPreload) {
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
            setActiveChapterId(entry.target.getAttribute('data-chapter-id'));
          }
        });
      },
      { root: scrollContainerRef.current, threshold: 0, rootMargin: '-10% 0px -80% 0px' }
    );
    const headers = document.querySelectorAll('.chapter-marker');
    headers.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [chapters]);

  const scrollToCurrentChapter = () => {
    if (!activeChapterId) return;
    const element = document.getElementById(`header-${activeChapterId}`);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div 
      ref={scrollContainerRef}
      className="fixed inset-0 bg-[#050505] overflow-y-auto overflow-x-hidden z-[100] scroll-smooth"
    >
      <div className="flex flex-col items-center w-full px-0 md:px-4">
        <div className="w-full max-w-[900px] bg-[#050505] shadow-2xl">
          {chapters.map((chapter) => (
            <div key={`group-${chapter.id}`} className="w-full flex flex-col items-center">
              <div 
                id={`header-${chapter.id}`}
                data-chapter-id={chapter.id}
                className="chapter-marker w-full py-16 md:py-24 text-center select-none"
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
                <LazyImage 
                  key={`page-${chapter.id}-${index}`} 
                  src={url} 
                  className="w-full" 
                  style={{ marginBottom: '-1px' }} 
                  priority={index < 5} // Load first 5 images immediately
                />
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
      
      <div className="fixed bottom-6 right-6 z-[110]">
        {/* Peek button - always visible but tiny */}
        <div className="relative group">
          <button 
            onClick={() => setShowControls(!showControls)}
            className="w-8 h-8 bg-gray-800/20 backdrop-blur-sm rounded-full border border-gray-700/30 flex items-center justify-center opacity-40 hover:opacity-80 transition-all duration-200"
            aria-label="Toggle controls"
          >
            <div className="w-1.5 h-1.5 bg-white/80 rounded-full"></div>
          </button>
          
          {/* Hidden buttons that appear on click and when controls are enabled */}
          {showControls && (
            <div className="absolute bottom-10 right-0 flex flex-col gap-3 opacity-100 transition-opacity duration-300 pointer-events-auto">
              <button 
                onClick={scrollToCurrentChapter}
                className="p-3.5 rounded-2xl bg-gray-900/20 backdrop-blur-md border border-gray-700/20 text-white/60 hover:text-white transition-all shadow-2xl active:scale-90 whitespace-nowrap"
                aria-label="Scroll to current chapter"
              >
                <ArrowUp size={20} />
              </button>
              <button 
                onClick={onExit}
                className="p-3.5 rounded-2xl bg-gray-900/20 backdrop-blur-md border border-gray-700/20 text-white/60 hover:text-red-500 transition-all shadow-2xl active:scale-90"
                aria-label="Exit reader"
              >
                <X size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reader;