import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Book, Grid, List, Search, ChevronDown } from 'lucide-react';

const Library = ({ onMangaSelect, onMangaDetails }) => {
  const [libraryManga, setLibraryManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => {
    // Load view mode from localStorage
    try {
      const saved = localStorage.getItem('libraryViewMode');
      return saved || 'grid';
    } catch {
      return 'grid';
    }
  }); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'title-asc', 'title-desc'
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('libraryViewMode', viewMode);
    } catch (err) {
      console.error('Failed to save view mode:', err);
    }
  }, [viewMode]);

  // Sort options
  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'title-asc', label: 'Sort A to Z' },
    { value: 'title-desc', label: 'Sort Z to A' }
  ];

  const getCurrentOption = () => sortOptions.find(option => option.value === sortBy);

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
        case 'newest':
          aValue = new Date(a.dateAdded || 0);
          bValue = new Date(b.dateAdded || 0);
          return bValue - aValue; // Newest first
        case 'oldest':
          aValue = new Date(a.dateAdded || 0);
          bValue = new Date(b.dateAdded || 0);
          return aValue - bValue; // Oldest first
        case 'title-asc':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          return aValue.localeCompare(bValue); // A to Z
        case 'title-desc':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          return bValue.localeCompare(aValue); // Z to A
        default:
          aValue = new Date(a.dateAdded || 0);
          bValue = new Date(b.dateAdded || 0);
          return bValue - aValue; // Default to newest
      }
    });
    
    return sorted;
  }, [libraryManga, searchQuery, sortBy]);

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
  const renderGridView = () => {
    // Show "No results" message when search returns empty
    if (searchQuery && filteredAndSortedManga.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <div className="text-6xl mb-4">¯\_(°_o)_/¯</div>
          <p className="text-xl font-medium mb-2">No results found</p>
          <p className="text-sm">Try searching for something else</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredAndSortedManga.map((manga, index) => {
          return (
            <div
              key={manga.id}
              className="group cursor-pointer flex flex-col"
              onClick={() => onMangaDetails(manga)}
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
              </div>
              {/* Title styling matching your screenshot: All caps, bold, truncated */}
              <div className="px-1">
                <h3 className="text-[11px] font-bold uppercase tracking-tight text-white leading-tight line-clamp-2 text-center group-hover:text-indigo-400 transition-colors">
                  {manga.title}
                </h3>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render list view
  const renderListView = () => {
    // Show "No results" message when search returns empty
    if (searchQuery && filteredAndSortedManga.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <div className="text-6xl mb-4">¯\_(°_o)_/¯</div>
          <p className="text-xl font-medium mb-2">No results found</p>
          <p className="text-sm">Try searching for something else</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredAndSortedManga.map((manga, index) => {
          return (
            <div
              key={manga.id}
              className="flex gap-3 p-3 hover:bg-white/5 rounded-lg transition-colors cursor-pointer group"
              onClick={() => onMangaDetails(manga)}
            >
              <div className="relative shrink-0">
                <img
                  src={manga.cover_url || manga.cover}
                  className="w-14 h-20 object-cover rounded shadow-md group-hover:scale-105 transition-transform bg-gray-800"
                  alt={manga.title}
                  onError={(e) => {
                    e.target.src = "https://via.placeholder.com/80x100/374151/9CA3AF?text=No+Cover";
                  }}
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight text-sm">
                  {cleanTitle(manga.title)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-3xl font-bold text-white">Library</h1>
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
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Library</h1>
          <div className="text-sm text-gray-400">
            {searchQuery ? 
              `${filteredAndSortedManga.length} found` : 
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
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/5 focus:border-blue-500/50 focus:bg-white/[0.06] outline-none transition-all text-sm"
              />
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex gap-2 items-center">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.03] border border-white/5 rounded-2xl text-white hover:bg-white/[0.06] transition-all text-sm focus:border-blue-500/50 outline-none"
              >
                <span>{getCurrentOption()?.label}</span>
                <ChevronDown 
                  size={16} 
                  className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-[#050505] border border-white/5 rounded-2xl shadow-lg z-50">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        setDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                        sortBy === option.value
                          ? 'bg-blue-500/20 text-white border-l-2 border-blue-500'
                          : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* View Mode Toggle - Right Side */}
            <div className="flex items-center bg-white/[0.03] border border-white/5 rounded-lg p-1 ml-auto">
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
        </div>

        
        {/* Content */}
        {libraryManga.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-500">
            <Book size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">Your library is empty</p>
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
