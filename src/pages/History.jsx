import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Trash2, BookOpen } from 'lucide-react';

const HISTORY_KEY = 'manga_reader_history_v1';

const History = ({ onOpenManga }) => {
  const [items, setItems] = useState([]);

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
    }
  };

  const cleanTitle = (title) => {
    if (!title) return title;
    // Cleans numbering and extra "Chapter" text from titles to keep it clean
    return title.replace(/^\d+\.\d+\s*|Chapter\d+(\.\d+)?/gi, '').trim();
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 sm:p-10">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header matching your Collections screenshot */}
        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">History</h1>
            <span className="text-xs text-gray-500 mt-2">{items.length} total</span>
          </div>

          {items.length > 0 && (
            <button
              onClick={clearHistory}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all text-sm"
            >
              <Trash2 size={16} />
              <span>Clear All</span>
            </button>
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
              return (
                <div 
                  key={it.mangaId} 
                  className="cursor-pointer group flex flex-col"
                  onClick={() => onOpenManga?.(it.manga)}
                >
                  {/* Card Container */}
                  <div className="relative aspect-[3/4.5] w-full rounded-xl overflow-hidden mb-3 border border-white/5 transition-all duration-300 group-hover:border-white/20">
                    <img
                      src={it.coverUrl}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      alt={displayTitle}
                      onError={(e) => {
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect fill='%23111' width='200' height='300'/%3E%3C/svg%3E";
                      }}
                    />
                    
                    {/* Chapter Overlay (Optional, matches the "last read" info) */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                       <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">
                         {it.lastChapterLabel || 'Continue'}
                       </p>
                    </div>
                  </div>
                  
                  {/* Title styling matching your screenshot: All caps, bold, truncated */}
                  <div className="px-1">
                    <h3 className="text-[11px] font-bold uppercase tracking-tight text-white leading-tight line-clamp-2 text-center group-hover:text-indigo-400 transition-colors">
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