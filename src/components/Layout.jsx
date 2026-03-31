import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Book, Heart, User, Settings, Loader2, X } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import Footer from './Footer';

const SearchResultSkeleton = () => (
  <div className="flex items-center space-x-3 p-3">
    <div className="w-12 h-16 rounded-lg bg-white/5 animate-pulse shrink-0" />
    <div className="flex-1 flex flex-col gap-2">
      <div className="h-3 bg-white/5 rounded animate-pulse w-3/4" />
      <div className="h-3 bg-white/5 rounded animate-pulse w-1/2" />
    </div>
  </div>
);

const Layout = ({ children, currentPage, setCurrentPage, onMangaSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const searchTimeoutRef = useRef(null);

  const performSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setShowSearchResults(true);

    try {
      // Always use backend API from environment
      const baseUrl = API_ENDPOINTS.SEARCH('');
      
      const searchPromises = [
        fetch(API_ENDPOINTS.SEARCH(query)),
        fetch(API_ENDPOINTS.SEARCH(query.charAt(0))),
        fetch(API_ENDPOINTS.SEARCH('a'))
      ];

      const results = await Promise.allSettled(searchPromises);
      const allManga = [];
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.ok) {
          try {
            const jsonData = await result.value.json();
            const mangaList = getMangaList(jsonData);
            allManga.push(...mangaList);
          } catch (jsonError) {
            console.warn('Failed to parse JSON response:', jsonError);
          }
        }
      }

      const filteredManga = allManga.filter(item => {
        const cleanedItemTitle = cleanTitle(item.title);
        const searchLower = query.toLowerCase();
        return cleanedItemTitle.toLowerCase().includes(searchLower);
      });

      const seenTitles = new Set();
      const uniqueManga = filteredManga.filter(item => {
        const cleanedItemTitle = cleanTitle(item.title);
        if (seenTitles.has(cleanedItemTitle)) {
          return false;
        }
        seenTitles.add(cleanedItemTitle);
        return true;
      });
      
      console.log('Search results:', uniqueManga.slice(0, 5).map(m => ({
        title: m.title,
        cover: m.cover_url || m.cover,
        hasCover: !!(m.cover_url || m.cover)
      })));
      
      setSearchResults(uniqueManga.slice(0, 5));
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const getMangaList = (data) => {
    if (Array.isArray(data)) return data;
    return data.manga || data.trending || data.results || [];
  };

  const cleanTitle = (title) => {
    if (!title) return title;
    return title.replace(/^\d+\.\d+\s*|Chapter\d+(\.\d+)?/gi, '').trim();
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 500); 
  };
useEffect(() => {
    let ticking = false;

    const updateHeader = () => {
      const currentScrollY = window.scrollY;
      const scrollDifference = currentScrollY - lastScrollY;

      // 1. IGNORE tiny movements (Less than 10px)
      if (Math.abs(scrollDifference) < 10) {
        ticking = false;
        return;
      }

      // 2. HIDE logic: Scrolling down AND past a safe zone (150px)
      if (scrollDifference > 0 && currentScrollY > 150) {
        setIsScrolled(true);
      } 
      // 3. SHOW logic: Scrolling up significantly
      else if (scrollDifference < -20) {
        setIsScrolled(false);
      }

      setLastScrollY(currentScrollY);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [lastScrollY]);

  // --- PAGE RESET LOGIC ---
  useEffect(() => {
    // This triggers every time currentPage changes
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // Use 'instant' to prevent the user from seeing the scroll animation
    });
    
    // Also reset the header visibility so it's showing on the new page
    setIsScrolled(false);
  }, [currentPage]);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="flex flex-col min-h-0">
        {(currentPage === 'home' || currentPage === 'history' || currentPage === 'collections' || currentPage === 'library' || currentPage === 'more') && (
          <header className={`sticky top-0 bg-[#050505]/60 backdrop-blur-xl z-[300] transition-all duration-300 ${isScrolled ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className={`max-w-[1600px] mx-auto px-4 sm:px-10 ${isScrolled ? 'py-2' : 'py-4'}`}>
              {/* MOBILE: Updated UI */}
              <div className="sm:hidden flex flex-col gap-4">
                <div className="flex justify-center">
                  <img 
                    src="/grimanhwa.png" 
                    alt="Grimanhwa" 
                    className="h-10 w-auto"
                  />
                </div>
                <div className="flex items-center justify-around bg-white/[0.03] rounded-2xl p-1 border border-white/5">
                  <MobileNavItem icon={<Home size={20} />} active={currentPage === 'home'} onClick={() => setCurrentPage('home')} />
                  <MobileNavItem icon={<Book size={20} />} active={currentPage === 'collections'} onClick={() => setCurrentPage('collections')} />
                  <MobileNavItem icon={<Star size={20} />} active={currentPage === 'library'} onClick={() => setCurrentPage('library')} />
                  <MobileNavItem icon={<History size={20} />} active={currentPage === 'history'} onClick={() => setCurrentPage('history')} />
                  <MobileNavItem icon={<Settings size={20} />} active={currentPage === 'more'} onClick={() => setCurrentPage('more')} />
                </div>
              </div>
              {/* DESKTOP: Updated UI */}
              <div className="hidden sm:flex items-center justify-between w-full gap-8">
                <div className="flex items-center gap-6">
                  <img 
                    src="/grimanhwa.png" 
                    alt="Grimanhwa" 
                    className="h-10 w-auto"
                  />
                  <div className="flex items-center bg-white/[0.03] border border-white/5 p-1 rounded-2xl">
                    <DesktopNavItem icon={<Home size={18} />} label="Home" active={currentPage === 'home'} onClick={() => setCurrentPage('home')} />
                    <DesktopNavItem icon={<Book size={18} />} label="Collections" active={currentPage === 'collections'} onClick={() => setCurrentPage('collections')} />
                    <DesktopNavItem icon={<Star size={18} />} label="Library" active={currentPage === 'library'} onClick={() => setCurrentPage('library')} />
                    <DesktopNavItem icon={<History size={18} />} label="History" active={currentPage === 'history'} onClick={() => setCurrentPage('history')} />
                    <DesktopNavItem icon={<Settings size={18} />} label="Settings" active={currentPage === 'more'} onClick={() => setCurrentPage('more')} />
                  </div>
                </div>
              </div>
            </div>
          </header>

        )}
        <main className="flex-1"> 
          {children}
        </main>
        {(currentPage === 'home' || currentPage === 'history' || currentPage === 'collections' || currentPage === 'library' || currentPage === 'more') && <Footer />}
      </div>
    </div>
  );
};

const DesktopNavItem = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2 px-6 py-2 rounded-xl transition-all duration-300 font-bold text-xs uppercase tracking-widest ${
      active 
        ? 'bg-white/10 text-white shadow-inner' 
        : 'text-gray-500 hover:text-gray-300'
    }`}
  >
    <span className={active ? 'text-indigo-500' : ''}>{icon}</span>
    <span>{label}</span>
  </button>
);

const MobileNavItem = ({ icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex justify-center py-3 rounded-xl transition-all ${
      active ? 'text-indigo-400 bg-white/5' : 'text-gray-600'
    }`}
  >
    {icon}
  </button>
);

export default Layout;