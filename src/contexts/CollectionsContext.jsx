import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../config/api';

const CollectionsContext = createContext();

export const useCollections = () => {
  const context = useContext(CollectionsContext);
  if (!context) {
    throw new Error('useCollections must be used within a CollectionsProvider');
  }
  return context;
};

export const CollectionsProvider = ({ children }) => {
  const [allManga, setAllManga] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [mangaDetails, setMangaDetails] = useState({});
  const apiCache = useRef(new Map());

  const cacheKey = 'allManga';
  const maxPages = 20;
  const itemsPerPage = 20;

  // Get persistent cache from localStorage
  const getPersistentCache = (key) => {
    try {
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  // Set persistent cache to localStorage
  const setPersistentCache = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
    }
  };

  // Sort function
  const sortManga = (mangaList, sortBy) => {
    const sorted = [...mangaList];
    switch (sortBy) {
      case 'title-asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'chapters-desc':
        sorted.sort((a, b) => (b.chapter_count || 0) - (a.chapter_count || 0));
        break;
      case 'chapters-asc':
        sorted.sort((a, b) => (a.chapter_count || 0) - (b.chapter_count || 0));
        break;
      case 'newest':
        sorted.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
        break;
      default:
        break;
    }
    return sorted;
  };

  // Function to load remaining pages in background
  const loadMorePagesRef = useRef(null);

  loadMorePagesRef.current = async (startPage, endPage, existingData, cacheKey) => {
    let mangaData = [...existingData];

    for (let page = startPage; page <= endPage; page++) {
      try {
        const pageUrl = `${API_URL}api/kaynscan/browse/?page=${page}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15s for backend scraping

        const response = await fetch(pageUrl, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        let pageManga = [];

        if (Array.isArray(data)) {
          pageManga = data;
        } else if (data && Array.isArray(data.manga)) {
          pageManga = data.manga;
        } else if (data && Array.isArray(data.results)) {
          pageManga = data.results;
        }

        if (pageManga.length > 0) {
          mangaData = [...mangaData, ...pageManga];
          setAllManga([...mangaData]);

          // Update cache with new data
          const cacheData = {
            allManga: mangaData,
            timestamp: Date.now(),
          };
          apiCache.current.set(cacheKey, cacheData);
          setPersistentCache(cacheKey, cacheData);
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        if (error.name === 'AbortError') {
        } else {
        }
      }
    }

    setBackgroundLoading(false);
  };

  // Fetch all manga from database (instant)
  const fetchAllManga = useCallback(async (forceRefresh = false) => {
    if (loading && !forceRefresh) return;

    setLoading(true);

    try {
      // Check cache first
      const cached = apiCache.current.get(cacheKey) || getPersistentCache(cacheKey);
      if (cached && !forceRefresh) {
        setAllManga(cached.allManga);
        setLoading(false);
        return;
      }

      // Show cached data while fetching fresh data
      if (cached && forceRefresh) {
        setAllManga(cached.allManga);
      }

      // Use database endpoint for instant results
      const dbUrl = `${API_URL}api/manga-db/`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(dbUrl, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        let allMangaData = [];

        if (Array.isArray(data)) {
          allMangaData = data;
        } else if (data && Array.isArray(data.manga)) {
          allMangaData = data.manga;
        } else if (data && Array.isArray(data.results)) {
          allMangaData = data.results;
        }

        setAllManga(allMangaData);
        setLoading(false);

        // Update cache
        const cacheData = {
          allManga: allMangaData,
          timestamp: Date.now(),
        };
        apiCache.current.set(cacheKey, cacheData);
        setPersistentCache(cacheKey, cacheData);
      } else {
        throw new Error('Failed to fetch from database');
      }
    } catch (error) {
      console.error('Error fetching manga from database:', error);
      setLoading(false);
    }
  }, [loading, cacheKey]);

  // Load manga details for current page - with latest_only optimization
  useEffect(() => {
    if (!allManga.length) return;

    const loadMangaDetails = async () => {
      const detailsMap = {};
      const batchSize = 10;

      for (let i = 0; i < Math.min(allManga.length, 100); i += batchSize) {
        const batch = allManga.slice(i, i + batchSize);
        const promises = batch.map(async (manga) => {
          try {
            const infoKey = `info_${manga.id}`;
            const cachedInfo = localStorage.getItem(infoKey);
            if (cachedInfo) {
              return { mangaId: manga.id, info: JSON.parse(cachedInfo) };
            }

            // Use the dedicated latest chapter endpoint for faster loading
            const response = await fetch(`${API_URL}api/kaynscan/latest-chapter/?id=${encodeURIComponent(manga.id)}`);
            if (response.ok) {
              const info = await response.json();
              localStorage.setItem(infoKey, JSON.stringify(info));
              return { mangaId: manga.id, info };
            }
          } catch (error) {
          }
          return { mangaId: manga.id, info: null };
        });

        const results = await Promise.all(promises);
        results.forEach(({ mangaId, info }) => {
          if (info) {
            detailsMap[mangaId] = info;
          }
        });
      }

      setMangaDetails(detailsMap);
    };

    loadMangaDetails();
  }, [allManga]);

  // Fetch all manga on mount (runs even when not on Collections page)
  useEffect(() => {
    fetchAllManga();
  }, []);

  const value = {
    allManga,
    loading,
    backgroundLoading,
    mangaDetails,
    fetchAllManga,
    sortManga,
  };

  return (
    <CollectionsContext.Provider value={value}>
      {children}
    </CollectionsContext.Provider>
  );
};
