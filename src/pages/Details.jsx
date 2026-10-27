import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, Book, Clock, Star, Play, Info, List, ChevronRight, ChevronDown } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import { useTheme } from '../contexts/ThemeContext';

const Details = ({ manga: propManga, onBack, onChapterRead }) => {
  const { mangaId } = useParams();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [manga, setManga] = useState(propManga);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mangaDetails, setMangaDetails] = useState(propManga);
  const [readChapters, setReadChapters] = useState(new Set()); // Track read chapters
  const [isInLibrary, setIsInLibrary] = useState(false); // Track if manga is in library
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false); // Track background refresh
  const [activeTab, setActiveTab] = useState('chapters'); // Track active tab
  const [showAlternativeTitles, setShowAlternativeTitles] = useState(false); // Track alternative titles expansion on mobile
  
  // Swipe state
  const [swipeState, setSwipeState] = useState({ chapterId: null, startX: 0, translateX: 0 });

  const DETAILS_CACHE_TTL_MS = 60 * 60 * 1000;

  const getDetailsCacheKey = (mangaId) => `detailsCache_${mangaId}`;

  const readDetailsCache = (mangaId) => {
    if (!mangaId) return null;
    try {
      const raw = localStorage.getItem(getDetailsCacheKey(mangaId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.timestamp !== 'number') return null;
      if (Date.now() - parsed.timestamp > DETAILS_CACHE_TTL_MS) return null;
      if (!Array.isArray(parsed.chapters)) return null;
      return {
        description: parsed.description,
        status: parsed.status,
        chapters: parsed.chapters,
        alternative_titles: parsed.alternative_titles || [],
      };
    } catch {
      return null;
    }
  };

  const writeDetailsCache = (mangaId, payload) => {
    if (!mangaId || !payload?.chapters) return;
    try {
      localStorage.setItem(
        getDetailsCacheKey(mangaId),
        JSON.stringify({
          description: payload.description,
          status: payload.status,
          chapters: payload.chapters,
          alternative_titles: payload.alternative_titles || [],
          timestamp: Date.now(),
        })
      );
    } catch {
      // ignore quota / serialization issues
    }
  };

  // Load read chapters from localStorage on mount
  useEffect(() => {
    if (!manga?.id) return;
    
    // Use a separate key for tracking all read chapters per manga
    const readChaptersKey = `manga_read_chapters_${manga.id}`;
    const readChaptersData = JSON.parse(localStorage.getItem(readChaptersKey) || '[]');
    const readChapterIds = new Set(readChaptersData);
    
    setReadChapters(readChapterIds);
  }, [manga?.id]);

  // Get saved page position for a chapter
  const getSavedPagePosition = (chapterId) => {
    const key = `reader_position_${chapterId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const position = JSON.parse(saved);
        // Only return if less than 7 days old
        if (Date.now() - position.timestamp < 7 * 24 * 60 * 60 * 1000) {
          return position.pageIndex + 1; // Convert to 1-based index for display
        }
      }
    } catch (err) {
    }
    return null;
  };

  // Check if manga is in library
  useEffect(() => {
    if (!manga?.id) return;

    const libraryKey = 'mangaLibrary';
    const library = JSON.parse(localStorage.getItem(libraryKey) || '[]');
    const inLibrary = library.some(item => item.id === manga.id);
    setIsInLibrary(inLibrary);
  }, [manga?.id]);

  // Fetch manga data - optimized to use localStorage cache
  useEffect(() => {
    if (propManga) {
      setManga(propManga);
      setMangaDetails(propManga);
      return;
    }

    // Try to get manga from localStorage cache first
    const cachedMangaKey = `cached_manga_${mangaId}`;
    const cachedManga = localStorage.getItem(cachedMangaKey);

    if (cachedManga) {
      try {
        const parsedManga = JSON.parse(cachedManga);
        // Check if cache is still valid (24 hours)
        const cacheAge = Date.now() - parsedManga.timestamp;
        if (cacheAge < 24 * 60 * 60 * 1000) {
          setManga(parsedManga.data);
          setMangaDetails(parsedManga.data);
          return;
        }
      } catch (err) {
      }
    }

    // Fetch manga from collections if not in cache
    const fetchMangaFromCollections = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.BROWSE_ALL);
        if (response.ok) {
          const data = await response.json();

          // Handle different response formats
          let allManga = [];
          if (Array.isArray(data)) {
            allManga = data;
          } else if (data && Array.isArray(data.manga)) {
            allManga = data.manga;
          } else if (data && Array.isArray(data.results)) {
            allManga = data.results;
          } else {
            return;
          }

          const foundManga = allManga.find(m => m.id === decodeURIComponent(mangaId));

          if (foundManga) {
            setManga(foundManga);
            setMangaDetails(foundManga);
            // Cache the found manga for future use
            localStorage.setItem(cachedMangaKey, JSON.stringify({
              data: foundManga,
              timestamp: Date.now()
            }));
          } else {
          }
        }
      } catch (error) {
      }
    };

    if (mangaId) {
      fetchMangaFromCollections();
    }
  }, [propManga, mangaId]);

  // Handle back navigation
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  // Toggle library status
  const toggleLibrary = () => {
    const libraryKey = 'mangaLibrary';
    const library = JSON.parse(localStorage.getItem(libraryKey) || '[]');
    
    if (isInLibrary) {
      // Remove from library
      const updatedLibrary = library.filter(item => item.id !== manga.id);
      localStorage.setItem(libraryKey, JSON.stringify(updatedLibrary));
      setIsInLibrary(false);
    } else {
      // Add to library
      const libraryItem = {
        id: manga.id,
        title: manga.title,
        cover_url: manga.cover_url,
        cover: manga.cover,
        dateAdded: new Date().toISOString()
      };
      const updatedLibrary = [...library, libraryItem];
      localStorage.setItem(libraryKey, JSON.stringify(updatedLibrary));
      setIsInLibrary(true);
    }
  };

  // Handle chapter click - mark as read and navigate
  const handleChapterClick = (chapter) => {
    // Add to read chapters (local state)
    setReadChapters(prev => new Set([...prev, chapter.id]));
    
    // Save to read chapters tracking (separate from history)
    const readChaptersKey = `manga_read_chapters_${manga.id}`;
    try {
      const existingReadChapters = JSON.parse(localStorage.getItem(readChaptersKey) || '[]');
      if (!existingReadChapters.includes(chapter.id)) {
        existingReadChapters.push(chapter.id);
        localStorage.setItem(readChaptersKey, JSON.stringify(existingReadChapters));
      }
    } catch (err) { 
    }
    
    // Also save to history for the "last read" functionality
    
    // Also save to history for the "last read" functionality
    const HISTORY_KEY = 'manga_reader_history_v1';
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const list = raw ? JSON.parse(raw) : [];

      const nextItem = {
        mangaId: manga.id,
        title: manga.title,
        coverUrl: manga.cover_url,
        manga: manga,
        lastChapterId: chapter?.id || chapter, 
        lastChapterLabel: chapter?.chapter_num ? `Chapter ${chapter.chapter_num}` : 'Last read',
        lastReadAt: Date.now(),
      };

      const existingIdx = list.findIndex((x) => x?.mangaId === manga.id);
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...nextItem };
      } else {
        list.push(nextItem);
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (err) { 
    }
    
    // Call the original onChapterRead function
    onChapterRead(chapter);
  };

  // Toggle read status
  const toggleChapterReadStatus = (chapterId) => {
    setReadChapters(prev => {
      const newSet = new Set(prev);
      const readChaptersKey = `manga_read_chapters_${manga.id}`;
      
      try {
        const existingReadChapters = JSON.parse(localStorage.getItem(readChaptersKey) || '[]');
        
        if (newSet.has(chapterId)) {
          // Remove from read chapters
          newSet.delete(chapterId);
          const updatedChapters = existingReadChapters.filter(id => id !== chapterId);
          localStorage.setItem(readChaptersKey, JSON.stringify(updatedChapters));
        } else {
          // Add to read chapters
          newSet.add(chapterId);
          if (!existingReadChapters.includes(chapterId)) {
            existingReadChapters.push(chapterId);
            localStorage.setItem(readChaptersKey, JSON.stringify(existingReadChapters));
          }
        }
      } catch (err) {
      }
      
      return newSet;
    });
  };

  // Swipe handlers (only right swipe)
  const handleTouchStart = (e, chapterId) => {
    const touch = e.touches[0];
    setSwipeState({
      chapterId,
      startX: touch.clientX,
      translateX: 0
    });
  };

  const handleTouchMove = (e, chapterId) => {
    if (swipeState.chapterId !== chapterId) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeState.startX;
    
    // Only allow right swipe (positive deltaX)
    if (deltaX > 0) {
      setSwipeState(prev => ({
        ...prev,
        translateX: Math.min(deltaX, 100)
      }));
    }
  };

  const handleTouchEnd = (e, chapterId) => {
    if (swipeState.chapterId !== chapterId) return;
    
    const threshold = 60;
    
    if (swipeState.translateX > threshold) {
      toggleChapterReadStatus(chapterId);
    }
    
    // Reset swipe state
    setSwipeState({ chapterId: null, startX: 0, translateX: 0 });
  };

  // --- Logic remains unchanged ---
  const getChapterDisplayTitle = (chapter) => {
    // Primary: Use the number field from backend if available
    if (chapter?.number) {
      return `Chapter ${chapter.number}`;
    }
    
    // Secondary: Extract from URL since titles are malformed with time text
    const urlMatch = chapter?.id?.match(/chapter\/(\d+)/);
    if (urlMatch?.[1]) {
      return `Chapter ${urlMatch[1]}`;
    }
    
    // Tertiary: Try title extraction with strict patterns
    const title = chapter?.title || '';
    
    // Look for "Chapter X" followed by non-digit
    const chapterMatch = title.match(/chapter\s*(\d{1,3})(?!\d)/i);
    if (chapterMatch?.[1]) {
      return `Chapter ${chapterMatch[1]}`;
    }
    
    // Look for "Ch. X" followed by non-digit  
    const chMatch = title.match(/ch\.?\s*(\d{1,3})(?!\d)/i);
    if (chMatch?.[1]) {
      return `Chapter ${chMatch[1]}`;
    }
    
    return 'Chapter 1';
  };

  const getChapterDisplayDate = (chapter) => {
    
    if (chapter?.created_at) {
      try {
        const chapterDate = new Date(chapter.created_at);
        const now = new Date();
        
        // Validate the date is reasonable (not in future, not too old)
        if (isNaN(chapterDate.getTime())) {
          throw new Error('Invalid date');
        }
        
        // Check if date is more than 1 day in future (likely invalid data)
        const diffTime = chapterDate.getTime() - now.getTime();
        if (diffTime > 24 * 60 * 60 * 1000) {
          throw new Error('Future date');
        }
        
        // Calculate time difference
        const absDiffTime = Math.abs(now - chapterDate);
        const diffDays = Math.floor(absDiffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(absDiffTime / (1000 * 60 * 60));
        const diffMinutes = Math.floor(absDiffTime / (1000 * 60));
        
        if (diffMinutes < 1) {
          return 'Just now';
        } else if (diffMinutes < 60) {
          return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
          return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffDays === 1) {
          return 'Yesterday';
        } else if (diffDays < 7) {
          return `${diffDays} days ago`;
        } else if (diffDays < 30) {
          const weeks = Math.floor(diffDays / 7);
          return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        } else if (diffDays < 365) {
          const months = Math.floor(diffDays / 30);
          return `${months} month${months > 1 ? 's' : ''} ago`;
        } else {
          const years = Math.floor(diffDays / 365);
          return `${years} year${years > 1 ? 's' : ''} ago`;
        }
      } catch (error) {
        // If date parsing fails, fall back to title extraction
      }
    }
    
    // Fallback: try to extract date from title
    // Some sites concatenate chapter number + relative time, e.g. "Chapter783 days ago"
    // In those cases we must strip the chapter prefix first, otherwise we'll parse "783 days ago".
    const rawTitle = chapter?.title || '';
    const n = extractChapterNumber(chapter);
    const chapterNumStr = n ? String(n).replace(/\.0$/, '') : '';

    let title = rawTitle;
    if (chapterNumStr) {
      const escaped = chapterNumStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      title = title.replace(new RegExp(`^\\s*(?:chapter|ch\\.?)\\s*${escaped}`, 'i'), '');
    }
    // Generic cleanup if chapter number isn't available or prefix is malformed
    title = title.replace(/^\s*(?:chapter|ch\.?)[\s\-:]*\d+(?:\.\d+)?/i, '');
    title = title.trim();
    
    // First, check if title already contains relative time expressions
    const relativeTimePatterns = [
      /(\d+)\s+minute[s]?\s+ago/i,
      /(\d+)\s+hour[s]?\s+ago/i,
      /(\d+)\s+day[s]?\s+ago/i,
      /(\d+)\s+week[s]?\s+ago/i,
      /(\d+)\s+month[s]?\s+ago/i,
      /(\d+)\s+year[s]?\s+ago/i,
      /just now/i,
      /yesterday/i,
      /today/i,
      /last week/i,
      /last month/i,
      /last year/i
    ];
    
    for (const pattern of relativeTimePatterns) {
      const match = title.match(pattern);
      if (match) {
        // Return the matched expression, properly capitalized
        let result = match[0].toLowerCase();
        return result.charAt(0).toUpperCase() + result.slice(1);
      }
    }
    
    // If no relative time found, try specific date patterns
    const datePatterns = [
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s*\d{1,2}\s*,?\s*\d{4}/i,
      /\d{1,2}\/\d{1,2}\/\d{4}/,
      /\d{4}-\d{2}-\d{2}/,
      /\d{1,2}-\d{1,2}-\d{4}/
    ];
    
    let match = null;
    for (const pattern of datePatterns) {
      match = title.match(pattern);
      if (match) {
        break;
      }
    }
    
    if (!match) {
      return 'Recently';
    }
    
    try {
      const extractedDate = new Date(match[0]);
      const now = new Date();
      const diffTime = Math.abs(now - extractedDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      
      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''} ago`;
      } else {
        const years = Math.floor(diffDays / 365);
        return `${years} year${years > 1 ? 's' : ''} ago`;
      }
    } catch (error) {
      return 'Recently';
    }
  };

  const cleanTitle = (title) => {
    if (!title) return title;
    // Remove rating pattern at the beginning (e.g., "2239.9")
    let cleaned = title.replace(/^\d+\.\d+/, '');
    // Remove "Chapter" and following numbers when concatenated without space
    cleaned = cleaned.replace(/Chapter\d+(\.\d+)?/gi, '');
    // Remove "Ch." and following numbers when concatenated without space
    cleaned = cleaned.replace(/Ch\.?\d+(\.\d+)?/gi, '');
    // Remove extra whitespace
    cleaned = cleaned.trim();
    return cleaned;
  };

  const extractRatingFromTitle = (title) => {
    if (!title) return null;
    const match = title.match(/^(\d+\.\d+)/);
    return match ? match[1] : null;
  };

  const extractChapterNumber = (ch) => {
    // Primary: Use the number field from backend (most reliable)
    if (ch.number) {
      const n = parseFloat(ch.number);
      return Number.isFinite(n) ? n : 0;
    }
    
    // Secondary: Extract from URL since titles are malformed
    const urlMatch = ch.id?.match(/chapter\/(\d+)/);
    if (urlMatch?.[1]) {
      const n = parseFloat(urlMatch[1]);
      return Number.isFinite(n) ? n : 0;
    }
    
    // Tertiary: Try chapter_num field
    if (ch.chapter_num) {
      const n = parseFloat(ch.chapter_num);
      return Number.isFinite(n) ? n : 0;
    }
    
    // Last resort: Try title parsing
    const match = ch.title?.match(/chapter\s*(\d+(\.\d+)?)/i);
    if (match?.[1]) {
      const n = parseFloat(match[1]);
      return Number.isFinite(n) ? n : 0;
    }
    
    return 0;
  };

  const sortChapters = (chs) => {
    const list = Array.isArray(chs) ? [...chs] : [];
    list.sort((a, b) => {
      const bn = extractChapterNumber(b);
      const an = extractChapterNumber(a);

      if (bn !== an) return bn - an;

      const bt = b?.created_at ? new Date(b.created_at).getTime() : 0;
      const at = a?.created_at ? new Date(a.created_at).getTime() : 0;
      if (bt !== at) return bt - at;

      return String(b?.id || '').localeCompare(String(a?.id || ''));
    });
    return list;
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!manga?.id) return;

    // OPTIMIZATION: Use existing manga data first, no immediate API call
    if (manga.chapters && manga.chapters.length > 0) {
      setChapters(manga.chapters);
      setLoading(false);

      // Cache the existing data
      writeDetailsCache(manga.id, {
        description: manga.description || '',
        status: manga.status || '',
        chapters: manga.chapters
      });
      return;
    }

    // Only check cache if no existing data
    const cached = readDetailsCache(manga.id);
    if (cached) {
      setMangaDetails((prev) => ({
        ...prev,
        description: cached.description || prev.description,
        status: cached.status || prev.status,
        alternative_titles: cached.alternative_titles || prev.alternative_titles || [],
      }));
      const cachedChapters = Array.isArray(cached) ? cached : cached.chapters || [];
      setChapters(cachedChapters);
      setLoading(false);
      return;
    }

    fetchChapters();
  }, [manga]);

  const fetchChapters = async (forceRefresh = false) => {
    const cached = readDetailsCache(manga.id);
    if (cached && !forceRefresh) {
      setMangaDetails((prev) => ({
        ...prev,
        description: cached.description || prev.description,
        status: cached.status || prev.status,
        alternative_titles: cached.alternative_titles || prev.alternative_titles || [],
      }));
      // Handle both old format (array) and new format (object)
      const cachedChapters = Array.isArray(cached) ? cached : cached.chapters || [];
      setChapters(sortChapters(cachedChapters));
      setLoading(false);
      return;
    }

    // Show cached data immediately while fetching fresh data in background
    if (cached && forceRefresh) {
      const cachedChapters = Array.isArray(cached) ? cached : cached.chapters || [];
      setChapters(sortChapters(cachedChapters));
      setMangaDetails((prev) => ({
        ...prev,
        description: cached.description || prev.description,
        status: cached.status || prev.status,
        alternative_titles: cached.alternative_titles || prev.alternative_titles || [],
      }));
      setLoading(false); // Don't show loading state
      setIsBackgroundRefreshing(true); // Show subtle refresh indicator
    }

    // OPTIMIZATION: Check if we already have chapters from Home page navigation
    if (manga.chapters && manga.chapters.length > 0 && !forceRefresh) {
      const sorted = sortChapters(manga.chapters);
      setChapters(sorted);
      setLoading(false);

      // Cache the existing data for future use
      writeDetailsCache(manga.id, {
        description: manga.description || '',
        status: manga.status || '',
        chapters: sorted
      });
      return;
    }

    // Only show loading if we have no data at all
    if (!cached && (!manga.chapters || manga.chapters.length === 0)) {
      setLoading(true);
    }

    try {
      // Add timeout to prevent hanging - reduced to 5 seconds for faster feedback
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 5000)
      );

      const response = await Promise.race([
        fetch(`${API_ENDPOINTS.MANGA(manga.id)}${forceRefresh ? '?refresh=true' : ''}`),
        timeoutPromise
      ]);
      if (response.ok) {
        let chaptersData = await response.json();

        // Handle both old format (array) and new format (object)
        let chapters = [];
        let description = '';
        let status = '';
        let alternative_titles = [];

        if (Array.isArray(chaptersData)) {
          // Old format: just chapters array
          chapters = chaptersData;
        } else if (chaptersData.chapters && Array.isArray(chaptersData.chapters)) {
          // New format: object with chapters array directly
          chapters = chaptersData.chapters;
          description = chaptersData.description || '';
          status = chaptersData.status || '';
          alternative_titles = chaptersData.alternative_titles || [];
        } else if (chaptersData.chapters && chaptersData.chapters.chapters) {
          // Nested format: {chapters: {chapters: [...], description: '', status: ''}}
          chapters = chaptersData.chapters.chapters;
          description = chaptersData.chapters.description || '';
          status = chaptersData.chapters.status || '';
          alternative_titles = chaptersData.chapters.alternative_titles || [];
        } else {
          chapters = [];
        }

        setMangaDetails(prev => ({
          ...prev,
          description: description || prev.description,
          status: status || prev.status,
          alternative_titles: alternative_titles || prev.alternative_titles || [],
        }));

        // Ensure chapters is always an array
        if (!Array.isArray(chapters)) {
          chapters = [];
        }

        const seen = new Set();
        const uniqueChapters = chapters.filter(ch => {
          const key = ch.id || ch.url;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const sorted = sortChapters(uniqueChapters);
        setChapters(sorted);

        writeDetailsCache(manga.id, {
          description: description,
          status: status,
          chapters: sorted,
          alternative_titles: alternative_titles,
        });
      }
    } catch (err) {

      // FALLBACK: Try to use any cached data even if expired
      const fallbackCache = readDetailsCache(manga.id, true); // Ignore TTL
      if (fallbackCache) {
        const fallbackChapters = Array.isArray(fallbackCache) ? fallbackCache : fallbackCache.chapters || [];
        if (fallbackChapters.length > 0) {
          setChapters(sortChapters(fallbackChapters));
          setMangaDetails(prev => ({
            ...prev,
            description: fallbackCache.description || prev.description,
            status: fallbackCache.status || prev.status,
            alternative_titles: fallbackCache.alternative_titles || prev.alternative_titles || [],
          }));
        }
      }
      if (!chapters.length) {
        // If no cache at all, show empty state instead of infinite loading
        setChapters([]);
        setMangaDetails(prev => ({
          ...prev,
          description: prev.description || 'No description available',
          status: 'Unknown'
        }));
      }
    } finally {
      setLoading(false);
      setIsBackgroundRefreshing(false);
    }
  };

  if (loading || !manga) {
    return (
      <div className={`min-h-screen p-6 sm:p-10 pb-24 lg:pb-10 ${darkMode ? 'bg-[#050505] text-white' : 'bg-[#FAFAF8] text-stone-900'}`}>
        <div className="max-w-[1600px] mx-auto">
          {/* Back Navigation */}
          <button
            onClick={handleBack}
            className={`flex items-center space-x-2 mb-8 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-stone-500 hover:text-stone-900'} transition-colors duration-200`}
          >
            <ChevronLeft size={20} />
            <span className="font-medium">Back</span>
          </button>

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
            {/* Left: Manga Info Skeleton */}
            <div className="w-full lg:w-[320px] flex-shrink-0">
              <div className="space-y-6">
                {/* Cover Skeleton */}
                <div className={`relative w-full aspect-[3/4.5] rounded-xl overflow-hidden border ${darkMode ? 'border-white/5' : 'border-stone-200'}`}>
                  <div className={`w-full h-full animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`} />
                </div>

                {/* Buttons Skeleton */}
                <div className="grid grid-cols-1 gap-3">
                  <div className={`w-full py-4 rounded-xl animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                  <div className={`w-full py-3.5 rounded-xl animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                </div>

                {/* Info Grid Skeleton */}
                <div className={`grid grid-cols-2 gap-4 p-4 rounded-xl border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-stone-100 border-stone-200'}`}>
                  <div className="text-center">
                    <div className={`h-3 rounded animate-pulse mb-1 ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                    <div className={`h-6 rounded animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                  </div>
                  <div className="text-center">
                    <div className={`h-3 rounded animate-pulse mb-1 ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                    <div className={`h-6 rounded animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Content Skeleton */}
            <div className="flex-1 min-w-0">
              {/* Title Skeleton */}
              <div className="mb-8">
                <div className={`h-12 rounded animate-pulse mb-4 ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
              </div>

              {/* Synopsis Skeleton */}
              <div className="space-y-10">
                <section>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className={`w-5 h-5 rounded animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                    <div className={`h-5 rounded animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                  </div>
                  <div className="space-y-3">
                    <div className={`h-4 rounded animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                    <div className={`h-4 rounded animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                    <div className={`h-4 rounded animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                  </div>
                </section>

                {/* Chapters List Skeleton */}
                <section>
                  <div className={`flex items-center justify-between mb-6 border-b pb-4 ${darkMode ? 'border-white/10' : 'border-stone-200'}`}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-5 h-5 rounded animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                      <div className={`h-6 rounded animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                    </div>
                    <div className={`w-20 h-6 rounded-lg animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className={`flex items-center justify-between p-4 rounded-xl border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-stone-100 border-stone-200'}`}>
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-lg animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                          <div>
                            <div className={`h-4 rounded w-32 animate-pulse mb-2 ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                            <div className={`h-3 rounded w-20 animate-pulse ${darkMode ? 'bg-gray-800/50' : 'bg-stone-200'}`}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const status = mangaDetails.status?.toLowerCase() || 'ongoing';
  const statusStyles = status === 'completed'
    ? darkMode
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-emerald-50 text-emerald-600 border-emerald-200"
    : darkMode
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : "bg-blue-50 text-blue-600 border-blue-200";

  return (
    <div className={`min-h-screen p-6 sm:p-10 pb-24 lg:pb-10 ${darkMode ? 'bg-[#050505] text-white' : 'bg-[#FAFAF8] text-stone-900'}`}>
      <div className="max-w-[1600px] mx-auto">
        {/* Back Navigation */}
        <button
          onClick={handleBack}
          className={`flex items-center space-x-2 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-stone-500 hover:text-stone-900'} transition-colors mb-8 group`}
        >
          <ChevronLeft size={20} />
          <span className="font-medium">Back</span>
        </button>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
          {/* Left: Manga Info */}
          <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col">
            <div className="space-y-6">
              <div className="relative group">
                <div className={`relative w-full aspect-[3/4.5] rounded-xl overflow-hidden border ${darkMode ? 'border-white/5' : 'border-stone-200'}`}>
                  <img
                    src={mangaDetails.cover_url}
                    alt={mangaDetails.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = "https://via.placeholder.com/300x450/374151/9CA3AF?text=No+Cover";
                    }}
                  />
                </div>
              </div>

              {/* Title - only visible on mobile */}
              <header className="lg:hidden mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <h1 className={`text-3xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-stone-900'}`}>
                    {cleanTitle(mangaDetails.title)}
                  </h1>
                  {isBackgroundRefreshing && (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                {/* Status Badge */}
                <span className={`inline-block mb-4 text-xs px-2.5 py-1 rounded-md border font-bold uppercase tracking-tight ${statusStyles}`}>
                  {status}
                </span>
                {/* Quick Info Grid - Mobile */}
                <div className={`grid grid-cols-2 gap-4 p-4 rounded-2xl border mb-4 ${darkMode ? 'bg-white/[0.03] border-white/5' : 'bg-stone-100 border-stone-200'}`}>
                  <div className="text-center">
                    <Star size={20} className={`mx-auto mb-2 ${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`} fill="currentColor" />
                    <p className={`text-lg font-bold mb-1 ${darkMode ? 'text-white' : 'text-stone-900'}`}>
                      {manga.rating || mangaDetails.rating || extractRatingFromTitle(mangaDetails.title) || 'N/A'}
                    </p>
                    <p className={`text-[10px] uppercase font-bold tracking-widest ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>Rating</p>
                  </div>
                  <div className="text-center">
                    <Book size={20} className={`mx-auto mb-2 ${darkMode ? 'text-green-400' : 'text-green-500'}`} />
                    <p className={`text-lg font-bold mb-1 ${darkMode ? 'text-white' : 'text-stone-900'}`}>{chapters.length}</p>
                    <p className={`text-[10px] uppercase font-bold tracking-widest ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>Chapters</p>
                  </div>
                </div>
                {/* Alternative Titles */}
                {mangaDetails.alternative_titles && mangaDetails.alternative_titles.length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => setShowAlternativeTitles(!showAlternativeTitles)}
                      className="flex items-center justify-between w-full mb-2"
                    >
                      <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-500'} font-bold uppercase tracking-widest`}>Also Known As</p>
                      <ChevronDown
                        size={20}
                        className={`transition-transform duration-300 ${darkMode ? 'text-gray-400' : 'text-stone-500'} ${showAlternativeTitles ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <div className={`transition-all duration-300 ${showAlternativeTitles ? 'max-h-[500px] opacity-100' : 'max-h-12 overflow-hidden opacity-80'}`}>
                      <div className="flex flex-wrap gap-2">
                        {mangaDetails.alternative_titles.map((title, index) => (
                          <span
                            key={index}
                            className={`text-xs px-3 py-1 ${darkMode ? 'bg-white/5 text-gray-400 border-white/10' : 'bg-stone-100 text-stone-600 border-stone-200'} rounded-full border`}
                          >
                            {title}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </header>

              <div className="hidden lg:block">
                <button
                  onClick={() => chapters.length > 0 && onChapterRead(chapters[chapters.length - 1])}
                  disabled={chapters.length === 0}
                  className={`flex items-center justify-center space-x-2 w-full py-3 mb-2 font-semibold rounded-2xl border transition-all active:scale-[0.98] ${
                    darkMode
                      ? 'bg-white/10 hover:bg-white/15 text-white border-white/10'
                      : 'bg-stone-200 hover:bg-stone-300 text-stone-900 border-stone-300'
                  }`}
                >
                  <Play size={18} fill="currentColor" />
                  <span>Start Reading</span>
                </button>
                <button
                  onClick={toggleLibrary}
                  className={`flex items-center justify-center space-x-2 w-full py-3 font-semibold rounded-2xl border transition-all active:scale-[0.98] ${
                    isInLibrary
                      ? darkMode
                        ? 'bg-white/5 hover:bg-white/10 text-yellow-400 border-yellow-400/30'
                        : 'bg-yellow-50 hover:bg-yellow-100 text-yellow-600 border-yellow-200'
                      : darkMode
                        ? 'bg-white/[0.03] hover:bg-white/[0.06] text-white border-white/5'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-900 border-stone-200'
                  }`}
                >
                  <Star size={18} fill={isInLibrary ? 'currentColor' : 'none'} />
                  <span>{isInLibrary ? 'Remove from Library' : 'Add to Library'}</span>
                </button>
              </div>

              {/* Quick Info Grid - Desktop Only */}
              <div className={`hidden lg:grid grid-cols-2 gap-4 p-4 rounded-2xl border ${darkMode ? 'bg-white/[0.03] border-white/5' : 'bg-stone-100 border-stone-200'}`}>
                <div className="text-center">
                  <Star size={20} className={`mx-auto mb-2 ${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`} fill="currentColor" />
                  <p className={`text-lg font-bold mb-1 ${darkMode ? 'text-white' : 'text-stone-900'}`}>
                    {manga.rating || mangaDetails.rating || extractRatingFromTitle(mangaDetails.title) || 'N/A'}
                  </p>
                  <p className={`text-[10px] uppercase font-bold tracking-widest ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>Rating</p>
                </div>
                <div className="text-center">
                  <Book size={20} className={`mx-auto mb-2 ${darkMode ? 'text-green-400' : 'text-green-500'}`} />
                  <p className={`text-lg font-bold mb-1 ${darkMode ? 'text-white' : 'text-stone-900'}`}>{chapters.length}</p>
                  <p className={`text-[10px] uppercase font-bold tracking-widest ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>Chapters</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Main Content */}
          <div className="flex-1 min-w-0">
            {/* Title - only visible on desktop */}
            <header className="mb-8 hidden lg:block">
              <div className="flex items-center gap-3 mb-4">
                <h1 className={`text-3xl md:text-4xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-stone-900'}`}>
                  {cleanTitle(mangaDetails.title)}
                </h1>
                {isBackgroundRefreshing && (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              {/* Status Badge */}
              <span className={`inline-block mb-4 text-xs px-2.5 py-1 rounded-md border font-bold uppercase tracking-tight ${statusStyles}`}>
                {status}
              </span>
              {/* Alternative Titles */}
              {mangaDetails.alternative_titles && mangaDetails.alternative_titles.length > 0 && (
                <div>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-500'} font-bold uppercase tracking-widest mb-2`}>Also Known As</p>
                  <div className="flex flex-wrap gap-2">
                    {mangaDetails.alternative_titles.map((title, index) => (
                      <span
                        key={index}
                        className={`text-xs px-3 py-1 ${darkMode ? 'bg-white/5 text-gray-400 border-white/10' : 'bg-stone-100 text-stone-600 border-stone-200'} rounded-full border`}
                      >
                        {title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </header>

            {/* Tab Selector - Desktop Only */}
            <div className="mb-8 hidden lg:block">
              <div className={`inline-flex p-1 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-stone-100'}`}>
                <button
                  onClick={() => setActiveTab('chapters')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === 'chapters'
                      ? darkMode
                        ? 'bg-white/10 text-white shadow-lg'
                        : 'bg-white text-stone-900 shadow-md'
                      : darkMode
                      ? 'text-gray-400 hover:text-white'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <span>Chapters</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    activeTab === 'chapters'
                      ? darkMode
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-blue-100 text-blue-600'
                      : darkMode
                      ? 'bg-white/10'
                      : 'bg-stone-200'
                  }`}>
                    {chapters.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('synopsis')}
                  className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === 'synopsis'
                      ? darkMode
                        ? 'bg-white/10 text-white shadow-lg'
                        : 'bg-white text-stone-900 shadow-md'
                      : darkMode
                      ? 'text-gray-400 hover:text-white'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  Synopsis
                </button>
              </div>
            </div>

            {/* Mobile Tab Selector */}
            <div className="mb-8 lg:hidden">
              <div className={`inline-flex p-1 rounded-xl w-full ${darkMode ? 'bg-white/5' : 'bg-stone-100'}`}>
                <button
                  onClick={() => setActiveTab('chapters')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === 'chapters'
                      ? darkMode
                        ? 'bg-white/10 text-white shadow-lg'
                        : 'bg-white text-stone-900 shadow-md'
                      : darkMode
                        ? 'text-gray-400 hover:text-white'
                        : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <span>Chapters</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    activeTab === 'chapters'
                      ? darkMode
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-blue-100 text-blue-600'
                      : darkMode
                        ? 'bg-white/10'
                        : 'bg-stone-200'
                  }`}>
                    {chapters.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('synopsis')}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === 'synopsis'
                      ? darkMode
                        ? 'bg-white/10 text-white shadow-lg'
                        : 'bg-white text-stone-900 shadow-md'
                      : darkMode
                        ? 'text-gray-400 hover:text-white'
                        : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  Synopsis
                </button>
              </div>
            </div>

            {/* Content Sections */}
            <div className="space-y-10">
              {/* Synopsis Section */}
              {activeTab === 'synopsis' && (
              <section className="relative">
                <p className={`${darkMode ? 'text-gray-400' : 'text-stone-600'} leading-relaxed text-lg whitespace-pre-wrap`}>
                  {mangaDetails.description || 'The description for this series is currently unavailable.'}
                </p>
              </section>
              )}

              {/* Chapters List */}
              {activeTab === 'chapters' && (
              <section>
                <div className="space-y-2">
                  {chapters.length > 0 ? (
                    <>
                      {/* Show all chapters */}
                      {chapters.map((chapter) => {
                        const isRead = readChapters.has(chapter.id);
                            
                        return (
                          <div
                            key={chapter.id}
                            className={`relative border rounded-2xl overflow-hidden group backdrop-blur-sm ${
                              darkMode ? 'bg-white/[0.03] border-white/5' : 'bg-stone-100 border-stone-200'
                            } ${isRead ? 'opacity-60' : ''}`}
                          >
                            {/* Swipe indicator - appears only when swiping, stays stationary */}
                            <div className={`absolute right-4 top-1/2 -translate-y-1/2 transition-opacity duration-200 ease-in-out pointer-events-none z-10 ${
                              swipeState.chapterId === chapter.id && swipeState.translateX > 30 ? 'opacity-100' : 'opacity-0'
                            }`}>
                              <ChevronRight size={24} className={darkMode ? 'text-white' : 'text-stone-900'} />
                            </div>

                            <div
                              onTouchStart={(e) => handleTouchStart(e, chapter.id)}
                              onTouchMove={(e) => handleTouchMove(e, chapter.id)}
                              onTouchEnd={(e) => handleTouchEnd(e, chapter.id)}
                              style={{
                                transform: swipeState.chapterId === chapter.id ? `translateX(${swipeState.translateX}px)` : 'translateX(0)',
                                transition: swipeState.chapterId === chapter.id ? 'none' : 'transform 0.3s ease-out'
                              }}
                            >
                            <button
                              onClick={() => handleChapterClick(chapter)}
                              className="w-full bg-transparent border-0 p-4 text-left cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4 flex-1">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-1">
                                      <h3 className={`font-bold text-base transition-colors truncate ${
                                        isRead
                                          ? darkMode ? 'text-green-400 group-hover:text-green-300' : 'text-green-600 group-hover:text-green-500'
                                          : darkMode ? 'text-white group-hover:text-white/80' : 'text-stone-900 group-hover:text-stone-700'
                                      }`}>
                                        {getChapterDisplayTitle(chapter)}
                                      </h3>
                                    </div>
                                    <div className="flex items-center space-x-3 text-xs">
                                      <div className={`flex items-center space-x-1 ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>
                                        <Clock size={11} />
                                        <span className="font-medium">
                                          {getChapterDisplayDate(chapter)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className={`py-16 text-center rounded-2xl border backdrop-blur-sm ${darkMode ? 'bg-white/[0.03] border-white/5' : 'bg-stone-100 border-stone-200'}`}>
                      <Book size={48} className={`mx-auto mb-4 opacity-30 ${darkMode ? 'text-gray-600' : 'text-stone-400'}`} />
                      <p className={`font-medium tracking-wide mb-2 ${darkMode ? 'text-gray-400' : 'text-stone-600'}`}>No chapters available</p>
                      <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>Chapters will appear here once they're indexed</p>
                    </div>
                  )}
                </div>
              </section>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Floating Action Bar */}
        <div className={`lg:hidden fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t p-4 z-50 ${darkMode ? 'bg-[#050505]/95 border-white/10' : 'bg-[#FAFAF8]/95 border-stone-200'}`}>
          <div className="flex gap-3">
            <button
              onClick={() => chapters.length > 0 && onChapterRead(chapters[chapters.length - 1])}
              disabled={chapters.length === 0}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 font-semibold rounded-2xl border transition-all active:scale-[0.98] ${
                darkMode
                  ? 'bg-white/10 hover:bg-white/15 text-white border-white/10'
                  : 'bg-stone-200 hover:bg-stone-300 text-stone-900 border-stone-300'
              }`}
            >
              <Play size={18} fill="currentColor" />
              <span>Start Reading</span>
            </button>
            <button
              onClick={toggleLibrary}
              className={`flex items-center justify-center space-x-2 px-6 py-3 font-semibold rounded-2xl border transition-all active:scale-[0.98] ${
                isInLibrary
                  ? darkMode
                    ? 'bg-white/5 hover:bg-white/10 text-yellow-400 border-yellow-400/30'
                    : 'bg-yellow-50 hover:bg-yellow-100 text-yellow-600 border-yellow-200'
                  : darkMode
                    ? 'bg-white/[0.03] hover:bg-white/[0.06] text-white border-white/5'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-900 border-stone-200'
              }`}
            >
              <Star size={18} fill={isInLibrary ? 'currentColor' : 'none'} />
              <span className="hidden sm:inline">{isInLibrary ? 'Remove' : 'Add'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Details;