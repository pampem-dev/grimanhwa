import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Book, Clock, Star, 
  Play, Info, List, Lock
} from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

const Details = ({ manga, onBack, onChapterRead }) => {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true); // Default expanded for better UX
  const [mangaDetails, setMangaDetails] = useState(manga);
  const [readChapters, setReadChapters] = useState(new Set()); // Track read chapters
  const [isInLibrary, setIsInLibrary] = useState(false); // Track if manga is in library

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
          timestamp: Date.now(),
        })
      );
    } catch {
      // ignore quota / serialization issues
    }
  };

  // Load read chapters from localStorage on mount
  useEffect(() => {
    const historyKey = 'mangaHistory';
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const readChapterIds = new Set();
    
    history.forEach(item => {
      if (item.mangaId === manga.id && item.chapterId) {
        readChapterIds.add(item.chapterId);
      }
    });
    
    setReadChapters(readChapterIds);
  }, [manga.id]);

  // Check if manga is in library
  useEffect(() => {
    const libraryKey = 'mangaLibrary';
    const library = JSON.parse(localStorage.getItem(libraryKey) || '[]');
    const inLibrary = library.some(item => item.id === manga.id);
    setIsInLibrary(inLibrary);
  }, [manga.id]);

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
    // Add to read chapters
    setReadChapters(prev => new Set([...prev, chapter.id]));
    
    // Call the original onChapterRead function
    onChapterRead(chapter);
  };

  // Toggle read status
  const toggleChapterReadStatus = (chapterId) => {
    setReadChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  };

  // --- Logic remains unchanged ---
  const getChapterDisplayTitle = (chapter) => {
    if (chapter?.chapter_num) {
      const num = String(chapter.chapter_num);
      if (num.length > 3) return `Chapter ${num.slice(0, 3)}`;
      return `Chapter ${num}`;
    }
    const title = chapter?.title || '';
    const match = title.match(/chapter\s*(\d+)/i);
    if (match?.[1]) {
      let num = match[1];
      if (num.length > 3) num = num.slice(0, 3);
      return `Chapter ${num}`;
    }
    const numberMatch = title.match(/(\d+)/);
    if (numberMatch?.[1]) return `Chapter ${numberMatch[1]}`;
    return 'Chapter 1';
  };

  const getChapterDisplayDate = (chapter) => {
    
    if (chapter?.created_at) {
      const chapterDate = new Date(chapter.created_at);
      const now = new Date();
      const diffTime = Math.abs(now - chapterDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffTime / (1000 * 60));
      
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
    }
    
    // Fallback: try to extract date from title
    const title = chapter?.title || '';
    
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
    return title.replace(/^\d+\.\d+/, '');
  };

  const extractChapterNumber = (ch) => {
    let num = ch.chapter_num;
    if (!num) {
      const match = ch.title?.match(/chapter\s*(\d+(\.\d+)?)/i);
      num = match?.[1];
    }
    if (!num) return 0;
    num = String(num);
    if (num.length > 3) num = num.slice(0, 3);
    return parseFloat(num);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!manga?.id) return;

    // Fast path: hydrate from cache for instant UI
    const cached = readDetailsCache(manga.id);
    if (cached) {
      setMangaDetails((prev) => ({
        ...prev,
        description: cached.description || prev.description,
        status: cached.status || prev.status,
      }));
      setChapters(cached.chapters);
      setLoading(false);
      return;
    }

    fetchChapters();
  }, [manga]);

  const fetchChapters = async (forceRefresh = false) => {
    setLoading(true);
    try {
      if (!forceRefresh) {
        const cached = readDetailsCache(manga.id);
        if (cached) {
          setMangaDetails((prev) => ({
            ...prev,
            description: cached.description || prev.description,
            status: cached.status || prev.status,
          }));
          setChapters(cached.chapters);
          setLoading(false);
          return;
        }
      }

      // OPTIMIZATION: Check if we already have chapters from Home page navigation
      if (manga.chapters && manga.chapters.length > 0 && !forceRefresh) {
        console.log('Using existing chapters data from navigation');
        setChapters(manga.chapters);
        setLoading(false);
        
        // Cache the existing data for future use
        writeDetailsCache(manga.id, {
          description: manga.description,
          status: manga.status,
          chapters: manga.chapters
        });
        return;
      }

      const response = await fetch(API_ENDPOINTS.MANGA(manga.id));
      if (response.ok) {
        let chaptersData = await response.json();
        setMangaDetails(prev => ({
          ...prev,
          description: chaptersData.description || prev.description,
          status: chaptersData.status || prev.status,
        }));
        const seen = new Set();
        const uniqueChapters = chaptersData.chapters.filter(ch => {
          const key = ch.id || ch.url;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        uniqueChapters.sort((a, b) => extractChapterNumber(b) - extractChapterNumber(a));
        setChapters(uniqueChapters);

        writeDetailsCache(manga.id, {
          description: chaptersData.description,
          status: chaptersData.status,
          chapters: uniqueChapters,
        });
      }
    } catch (err) {
      console.error("Chapters fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-6 sm:p-10">
        <div className="max-w-[1600px] mx-auto">
          {/* Back Navigation */}
          <button className="flex items-center space-x-2 text-gray-400 mb-8">
            <div className="p-2 rounded-lg bg-white/5">
            </div>
            <span className="font-medium">Back</span>
          </button>

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
            {/* Left: Manga Info Skeleton */}
            <div className="w-full lg:w-[320px] flex-shrink-0">
              <div className="space-y-6">
                {/* Cover Skeleton */}
                <div className="relative w-full aspect-[3/4.5] rounded-xl overflow-hidden border border-white/5">
                  <div className="w-full h-full bg-gray-800/50 animate-pulse" />
                </div>
                
                {/* Buttons Skeleton */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="w-full py-4 bg-gray-800/50 rounded-xl animate-pulse"></div>
                  <div className="w-full py-3.5 bg-gray-800/50 rounded-xl animate-pulse"></div>
                </div>

                {/* Info Grid Skeleton */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-center">
                    <div className="h-3 bg-gray-800/50 rounded animate-pulse mb-1"></div>
                    <div className="h-6 bg-gray-800/50 rounded animate-pulse"></div>
                  </div>
                  <div className="text-center">
                    <div className="h-3 bg-gray-800/50 rounded animate-pulse mb-1"></div>
                    <div className="h-6 bg-gray-800/50 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Content Skeleton */}
            <div className="flex-1 min-w-0">
              {/* Title Skeleton */}
              <div className="mb-8">
                <div className="h-12 bg-gray-800/50 rounded animate-pulse mb-4"></div>
              </div>

              {/* Synopsis Skeleton */}
              <div className="space-y-10">
                <section>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-5 h-5 bg-gray-800/50 rounded animate-pulse"></div>
                    <div className="h-5 bg-gray-800/50 rounded animate-pulse"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-800/50 rounded animate-pulse"></div>
                    <div className="h-4 bg-gray-800/50 rounded animate-pulse"></div>
                    <div className="h-4 bg-gray-800/50 rounded animate-pulse"></div>
                  </div>
                </section>

                {/* Chapters List Skeleton */}
                <section>
                  <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 bg-gray-800/50 rounded animate-pulse"></div>
                      <div className="h-6 bg-gray-800/50 rounded animate-pulse"></div>
                    </div>
                    <div className="w-20 h-6 bg-gray-800/50 rounded-lg animate-pulse"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-gray-800/50 rounded-lg animate-pulse"></div>
                          <div>
                            <div className="h-4 bg-gray-800/50 rounded w-32 animate-pulse mb-2"></div>
                            <div className="h-3 bg-gray-800/50 rounded w-20 animate-pulse"></div>
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
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
    : "bg-blue-500/10 text-blue-400 border-blue-500/20";

  return (
    <div className="min-h-screen bg-black text-white p-6 sm:p-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Back Navigation */}
        <button 
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-8 group"
        >
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10">
          </div>
          <span className="font-medium">Back</span>
        </button>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
          {/* Left: Manga Info */}
          <div className="w-full lg:w-[320px] flex-shrink-0">
            <div className="space-y-6">
              <div className="relative group">
                <div className="relative w-full aspect-[3/4.5] rounded-xl overflow-hidden border border-white/5">
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
              
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => chapters.length > 0 && onChapterRead(chapters[chapters.length - 1])}
                  disabled={chapters.length === 0}
                  className="flex items-center justify-center space-x-3 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg"
                >
                  <Play size={18} fill="currentColor" />
                  <span>Start Reading</span>
                </button>
                <button 
                  onClick={toggleLibrary}
                  className={`flex items-center justify-center space-x-2 w-full py-3.5 font-semibold rounded-xl border transition-all active:scale-[0.98] shadow-lg ${
                    isInLibrary 
                      ? 'bg-red-600 hover:bg-red-500 text-white border-red-700' 
                      : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                  }`}
                >
                  <Star size={18} fill={isInLibrary ? 'currentColor' : 'none'} />
                  <span>{isInLibrary ? 'Remove from Library' : 'Add to Library'}</span>
                </button>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-center">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Status</p>
                  <span className={`text-xs px-2.5 py-1 rounded-md border font-bold uppercase tracking-tight ${statusStyles}`}>
                    {status}
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Chapters</p>
                  <span className="text-white font-bold">{chapters.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Main Content */}
          <div className="flex-1 min-w-0">
            <header className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
                {cleanTitle(mangaDetails.title)}
              </h1>
            </header>

            {/* Content Sections */}
            <div className="space-y-10">
              {/* Synopsis Section */}
              <section className="relative">
                <div className="flex items-center space-x-2 mb-4 text-blue-400">
                  <Info size={18} />
                  <h2 className="text-sm font-black uppercase tracking-[0.2em]">Summary</h2>
                </div>
                <div className={`relative transition-all duration-500 ${!isDescriptionExpanded ? 'max-h-24 overflow-hidden' : 'max-h-[1000px]'}`}>
                  <p className="text-gray-400 leading-relaxed text-lg whitespace-pre-wrap">
                    {mangaDetails.description || 'The description for this series is currently unavailable.'}
                  </p>
                  {!isDescriptionExpanded && <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>}
                </div>
                <button 
                   onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                   className="mt-4 text-blue-500 hover:text-blue-400 text-sm font-bold uppercase tracking-tighter"
                >
                  {isDescriptionExpanded ? 'Show Less' : 'Read Full Description'}
                </button>
              </section>

              {/* Chapters List */}
              <section>
                <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                  <div className="flex items-center space-x-2">
                    <List size={20} className="text-blue-400" />
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider">Chapter List</h2>
                  </div>
                  <div className="flex items-center text-xs font-bold text-gray-500 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                    LATEST FIRST
                  </div>
                </div>

                <div className="space-y-2">
                  {chapters.length > 0 ? (
                    chapters.map((chapter) => {
                      const isRead = readChapters.has(chapter.id);
                      const isLocked = chapter.is_locked || false;
                          
                          return (
                        <button
                          key={chapter.id}
                          onClick={() => !isLocked && handleChapterClick(chapter)}
                          disabled={isLocked}
                          className={`w-full bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl p-4 text-left hover:from-blue-900/30 hover:to-blue-800/30 hover:border-blue-600/50 transition-all duration-300 group backdrop-blur-sm relative overflow-hidden ${
                            isRead ? 'opacity-60' : ''
                          } ${
                            isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                          }`}
                        >
                          {/* Lock overlay for locked chapters */}
                          {isLocked && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center">
                              <div className="flex flex-col items-center space-y-2">
                                <Lock size={24} className="text-yellow-400" />
                                <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Premium</span>
                                <span className="text-xs text-gray-300">Join to unlock</span>
                              </div>
                            </div>
                          )}
                          
                          <div className={`flex items-center justify-between ${isLocked ? 'blur-sm' : ''}`}>
                            <div className="flex items-center space-x-4 flex-1">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h3 className={`font-bold text-base transition-colors truncate ${
                                    isRead
                                      ? 'text-green-400 group-hover:text-green-300'
                                      : isLocked
                                      ? 'text-gray-400'
                                      : 'text-white group-hover:text-blue-300'
                                  }`}>
                                    {getChapterDisplayTitle(chapter)}
                                  </h3>
                                  {isRead && (
                                    <span className="flex-shrink-0 text-xs bg-gradient-to-r from-green-600/20 to-green-500/20 text-green-400 px-2 py-1 rounded-full font-medium border border-green-600/30">
                                      ✓ READ
                                    </span>
                                  )}
                                  {isLocked && (
                                    <span className="flex-shrink-0 text-xs bg-gradient-to-r from-yellow-600/20 to-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full font-medium border border-yellow-600/30 flex items-center space-x-1">
                                      <Lock size={10} />
                                      <span>LOCKED</span>
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-3 text-xs">
                                  <div className={`flex items-center space-x-1 ${isLocked ? 'text-gray-500' : 'text-gray-500'}`}>
                                    <Clock size={11} />
                                    <span className="font-medium">
                                      {getChapterDisplayDate(chapter)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                isRead 
                                  ? 'bg-green-500 shadow-lg shadow-green-500/50' 
                                  : isLocked
                                  ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50'
                                  : 'bg-gray-600 group-hover:bg-blue-500 group-hover:shadow-lg group-hover:shadow-blue-500/50'
                              }`}>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="py-16 text-center bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-3xl border-2 border-dashed border-gray-700 backdrop-blur-sm">
                      <Book size={48} className="mx-auto text-gray-600 mb-4 opacity-30" />
                      <p className="text-gray-400 font-medium tracking-wide mb-2">No chapters available</p>
                      <p className="text-gray-500 text-sm">Chapters will appear here once they're indexed</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Details;