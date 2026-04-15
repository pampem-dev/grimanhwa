import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Trash2, BookOpen, X } from 'lucide-react';

const HISTORY_KEY = 'manga_reader_history_v1';

const History = ({ onOpenManga }) => {
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [pressTimer, setPressTimer] = useState(null);

  // Function to get the latest read chapter for a manga
  const getLatestReadChapter = useCallback((mangaId) => {
    try {
      const readChaptersKey = `manga_read_chapters_${mangaId}`;
      const readChaptersData = JSON.parse(localStorage.getItem(readChaptersKey) || '[]');
      
      if (readChaptersData.length === 0) return null;
      
      // Extract chapter numbers from chapter IDs and find the highest
      const chapterNumbers = readChaptersData
        .map(chapterId => {
          const match = chapterId.match(/chapter\/(\d+)/i);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(num => num > 0);
      
      if (chapterNumbers.length === 0) return null;
      
      const latestChapterNum = Math.max(...chapterNumbers);
      return `Chapter ${latestChapterNum}`;
    } catch (err) {
      console.error('Failed to get latest read chapter:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setItems([]);
    }
  }, []);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
  }, [items]);

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear your reading history?")) {
      localStorage.removeItem(HISTORY_KEY);
      setItems([]);
      setSelectedItems(new Set());
      setIsSelectionMode(false);
    }
  };

  const handleItemPress = (item, event) => {
    event.preventDefault();
    
    if (isSelectionMode) {
      // In selection mode, just toggle selection immediately
      toggleItemSelection(item.mangaId);
      return;
    }

    // Start long press timer for normal mode
    const timer = setTimeout(() => {
      setIsSelectionMode(true);
      setSelectedItems(new Set([item.mangaId]));
    }, 500); // 500ms for long press

    setPressTimer(timer);
  };

  const handleItemRelease = (item, event) => {
    // Clear the press timer
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }

    // If not in selection mode and it was a short press, navigate to manga
    if (!isSelectionMode && event.type === 'click') {
      onOpenManga?.(item.manga);
    }
  };

  const toggleItemSelection = (mangaId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mangaId)) {
        newSet.delete(mangaId);
      } else {
        newSet.add(mangaId);
      }
      
      // Exit selection mode if no items selected
      if (newSet.size === 0) {
        setIsSelectionMode(false);
      }
      
      return newSet;
    });
  };

  const removeSelectedItems = () => {
    if (selectedItems.size === 0) return;
    
    const message = selectedItems.size === 1 
      ? "Are you sure you want to remove this item from history?"
      : `Are you sure you want to remove ${selectedItems.size} items from history?`;
    
    if (window.confirm(message)) {
      const updatedItems = items.filter(item => !selectedItems.has(item.mangaId));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedItems));
      setItems(updatedItems);
      setSelectedItems(new Set());
      setIsSelectionMode(false);
    }
  };

  const exitSelectionMode = () => {
    setSelectedItems(new Set());
    setIsSelectionMode(false);
  };

  const cleanTitle = (title) => {
    if (!title) return title;
    // Cleans numbering and extra "Chapter" text from titles to keep it clean
    return title.replace(/^\d+\.\d+\s*|Chapter\d+(\.\d+)?/gi, '').trim();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header matching your Collections screenshot */}
        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            {isSelectionMode ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight">{selectedItems.size}</span>
                <span className="text-lg sm:text-xl text-gray-400">selected</span>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold tracking-tight">History</h1>
                <span className="text-xs text-gray-500 mt-2">{items.length} total</span>
              </>
            )}
          </div>

          {isSelectionMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={exitSelectionMode}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all text-sm"
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
              {selectedItems.size > 0 && (
                <button
                  onClick={removeSelectedItems}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/20 text-red-400 hover:bg-red-600/30 hover:text-red-300 transition-all text-sm"
                >
                  <Trash2 size={16} />
                  <span>Remove{selectedItems.size > 1 ? ` (${selectedItems.size})` : ''}</span>
                </button>
              )}
            </div>
          ) : (
            items.length > 0 && (
              <button
                onClick={clearHistory}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all text-sm"
              >
                <Trash2 size={16} />
                <span>Clear All</span>
              </button>
            )
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-500">
            <BookOpen size={48} className="mb-4 opacity-20" />
            <p className="uppercase tracking-widest text-xs font-bold">No reading history found</p>
          </div>
        ) : (
          /* Grid matching your Collections screenshot exactly */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
            {sortedItems.map((it) => {
              const displayTitle = cleanTitle(it.title);
              const latestChapter = getLatestReadChapter(it.mangaId);
              const isSelected = selectedItems.has(it.mangaId);
              
              return (
                <div 
                  key={it.mangaId} 
                  className={`cursor-pointer group flex flex-col relative ${
                    isSelectionMode ? 'pointer-events-auto' : ''
                  }`}
                  onMouseDown={(e) => handleItemPress(it, e)}
                  onMouseUp={(e) => handleItemRelease(it, e)}
                  onTouchStart={(e) => handleItemPress(it, e)}
                  onTouchEnd={(e) => handleItemRelease(it, e)}
                  onClick={(e) => {
                    // Only navigate if not in selection mode and no long press timer
                    if (!isSelectionMode && !pressTimer) {
                      onOpenManga?.(it.manga);
                    }
                  }}
                >
                  {/* Selection overlay */}
                  {isSelectionMode && (
                    <div className={`absolute inset-0 rounded-xl border-2 transition-all z-10 ${
                      isSelected 
                        ? 'border-white/20 bg-white/[0.03]' 
                        : 'border-transparent'
                    }`}>
                      {/* Subtle selection indicator - just a corner highlight */}
                      {isSelected && (
                        <div className="absolute top-0 right-0 w-8 h-8">
                          <div className="absolute top-1 right-1 w-1 h-1 bg-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Card Container */}
                  <div className={`relative aspect-[3/4.5] w-full rounded-xl overflow-hidden mb-3 border transition-all duration-300 ${
                    isSelectionMode 
                      ? isSelected 
                        ? 'border-white/30 group-hover:border-white/40' 
                        : 'border-white/5 group-hover:border-white/10'
                      : 'border-white/5 group-hover:border-white/20'
                  }`}>
                    <img
                      src={it.coverUrl}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      alt={displayTitle}
                      onError={(e) => {
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect fill='%23111' width='200' height='300'/%3E%3C/svg%3E";
                      }}
                    />
                    
                    {/* Chapter Overlay - Show latest read chapter */}
                    {latestChapter && (
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black to-transparent">
                         <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">
                           {latestChapter}
                         </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Title styling matching your screenshot: All caps, bold, truncated */}
                  <div className="px-1">
                    <h3 className={`text-[11px] font-bold uppercase tracking-tight leading-tight line-clamp-2 text-center transition-colors ${
                      isSelectionMode 
                        ? isSelected 
                          ? 'text-white' 
                          : 'text-white/50'
                        : 'text-white group-hover:text-indigo-400'
                    }`}>
                      {displayTitle}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;