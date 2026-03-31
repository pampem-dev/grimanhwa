import React, { useState, useEffect, useMemo } from 'react';
import { Book, Trash2, Star, Clock, Grid, List, Search, ArrowUpDown } from 'lucide-react';

const Library = ({ onMangaSelect, onMangaDetails }) => {
  const [libraryManga, setLibraryManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('title'); // 'title', 'rating', 'dateAdded'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'

  // Load library from localStorage
  useEffect(() => {
    const libraryKey = 'mangaLibrary';
    const savedLibrary = JSON.parse(localStorage.getItem(libraryKey) || '[]');
    setLibraryManga(savedLibrary);
    setLoading(false);
  }, []);

  // Filter and sort manga
  const filteredAndSortedManga = useMemo(() => {
    let filtered = libraryManga;
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(manga => 
        manga.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'dateAdded':
          aValue = new Date(a.dateAdded || 0);
          bValue = new Date(b.dateAdded || 0);
          break;
        default:
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [libraryManga, searchQuery, sortBy, sortOrder]);

  // Remove from library
  const removeFromLibrary = (mangaId) => {
    const libraryKey = 'mangaLibrary';
    const updatedLibrary = libraryManga.filter(manga => manga.id !== mangaId);
    setLibraryManga(updatedLibrary);
    localStorage.setItem(libraryKey, JSON.stringify(updatedLibrary));
  };

  // Helper functions
  const cleanTitle = (title) => {
    if (!title) return title;
    return title.replace(/^\d+\.\d+/, '');
  };

  // const extractRating = (title) => {
  //   if (!title) return '8.8';
  //   const match = title.match(/^(\d+\.\d+)/);
  //   return match ? match[1] : '8.8';
  // };

  // Render grid view
  const renderGridView = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {filteredAndSortedManga.map((manga, index) => {
        return (
          <div 
            key={manga.id}
            className="group cursor-pointer flex flex-col"
            onClick={() => onMangaSelect(manga)}
          >
            <div className="relative aspect-[3/4.5] w-full rounded-xl overflow-hidden mb-3 border border-white/5 transition-all duration-300 group-hover:border-white/20">
              <img
                src={manga.cover_url || manga.cover}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                alt={manga.title}
                onError={(e) => {
                  e.target.src = "https://via.placeholder.com/300x450/374151/9CA3AF?text=No+Cover";
                }}
              />
              {/* <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded flex items-center gap-1 border border-white/10">
                <Star size={10} className="text-yellow-400" fill="currentColor" />
                <span className="text-[10px] font-bold text-white">{extractRating(manga.title)}</span>
              </div> */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromLibrary(manga.id);
                  }}
                  className="p-1.5 bg-red-600/80 backdrop-blur-sm rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Trash2 size={12} className="text-white" />
                </button>
              </div>
            </div>
            <div className="mt-2 text-center">
              <h3 className="text-sm font-bold uppercase tracking-tight truncate text-white group-hover:text-blue-400 transition-colors">
                {cleanTitle(manga.title)}
              </h3>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render list view
  const renderListView = () => (
    <div className="space-y-3">
      {filteredAndSortedManga.map((manga, index) => {
        return (
          <div 
            key={manga.id}
            className="flex items-center gap-4 p-4 bg-gray-900/40 rounded-xl cursor-pointer transition-all border border-gray-800 hover:border-blue-500/50 hover:bg-blue-600/10 group"
            onClick={() => onMangaSelect(manga)}
          >
            <div className="relative shrink-0">
              <img
                src={manga.cover_url || manga.cover}
                className="w-16 h-20 object-cover rounded shadow-lg group-hover:scale-105 transition-transform"
                alt={manga.title}
                onError={(e) => {
                  e.target.src = "https://via.placeholder.com/80x100/374151/9CA3AF?text=No+Cover";
                }}
              />
              {/* <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm rounded px-1 py-0.5 text-[10px] font-bold text-yellow-400">
                {extractRating(manga.title)}
              </div> */}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="font-bold text-white line-clamp-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight text-base">
                {cleanTitle(manga.title)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Added {manga.dateAdded ? new Date(manga.dateAdded).toLocaleDateString() : 'Recently'}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFromLibrary(manga.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-red-600/80 backdrop-blur-sm rounded-lg hover:bg-red-600"
            >
              <Trash2 size={16} className="text-white" />
            </button>
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-3xl font-bold text-white">My Library</h1>
            <div className="text-sm text-gray-400">Loading...</div>
          </div>

          {/* Loading Skeleton Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, index) => (
              <div key={index} className="flex flex-col">
                <div className="relative aspect-[3/4.5] w-full rounded-xl overflow-hidden mb-3 border border-white/5">
                  <div className="w-full h-full bg-gray-800/50 animate-pulse" />
                </div>
                <div className="mt-2 text-center">
                  <div className="h-4 bg-gray-800/50 rounded animate-pulse mb-2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-white">My Library</h1>
          <div className="text-sm text-gray-400">
            {searchQuery ? 
              `${filteredAndSortedManga.length} manga found` : 
              `${libraryManga.length} total`
            }
          </div>
        </div>

        {/* Search and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                placeholder="Search library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/5 focus:border-blue-500/50 focus:bg-white/[0.06] outline-none transition-all text-sm"
              />
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:bg-white/20 transition-colors"
            >
              <option value="title" className="bg-gray-900 text-white">Sort by Title</option>
              <option value="dateAdded" className="bg-gray-900 text-white">Sort by Date Added</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <ArrowUpDown size={16} />
              {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex justify-end mb-6">
          <div className="flex items-center bg-white/[0.03] border border-white/5 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 rounded-md transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-white/10 text-white' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-md transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white/10 text-white' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        {libraryManga.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-500">
            <Book size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">Your library is empty</p>
            <p className="text-sm">Add manga from the Collections page to build your library</p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? renderGridView() : renderListView()}
          </>
        )}
      </div>
    </div>
  );
};

export default Library;
