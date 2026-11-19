// Cache utility with inactivity timeout
const CACHE_PREFIX = 'manga_cache_';
const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds

// Track last activity time
let lastActivityTime = Date.now();
let tabHiddenTime = null;

// Update activity time on user interaction
const updateActivityTime = () => {
  lastActivityTime = Date.now();
};

// Check if cache is still valid (within inactivity timeout)
const isCacheValid = (cachedTime) => {
  const timeSinceActivity = Date.now() - lastActivityTime;
  return timeSinceActivity < INACTIVITY_TIMEOUT;
};

// Get cached data
export const getCachedData = (key) => {
  try {
    const cached = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (cached) {
      const data = JSON.parse(cached);
      // Check if cache is still valid based on inactivity
      if (isCacheValid(data.timestamp)) {
        return data.data;
      }
      // Clear expired cache
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
    }
  } catch (err) {
  }
  return null;
};

// Set cached data
export const setCachedData = (key, data) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cacheData));
  } catch (err) {
  }
};

// Clear cache for a specific key
export const clearCachedData = (key) => {
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (err) {
  }
};

// Clear all manga cache
export const clearAllMangaCache = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (err) {
  }
};

// Check if user is inactive (for clearing cache)
export const checkInactivity = () => {
  const timeSinceActivity = Date.now() - lastActivityTime;
  return timeSinceActivity >= INACTIVITY_TIMEOUT;
};

// Reset activity time (call on user interaction)
export const resetActivityTime = () => {
  lastActivityTime = Date.now();
};

// Initialize activity listeners
if (typeof window !== 'undefined') {
  // Update activity time on user interactions
  ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
    window.addEventListener(event, updateActivityTime, { passive: true });
  });

  // Clear cache on page unload (when railway.toml deploys, users will reload)
  window.addEventListener('beforeunload', () => {
    clearAllMangaCache();
  });

  // Track tab visibility for automatic cache refresh
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Tab is hidden - record the time
      tabHiddenTime = Date.now();
    } else {
      // Tab is visible again
      if (tabHiddenTime) {
        const hiddenDuration = Date.now() - tabHiddenTime;
        // Clear cache if tab was hidden for more than 5 minutes
        // This ensures fresh data after Railway cron jobs run
        if (hiddenDuration > 5 * 60 * 1000) {
          clearAllMangaCache();
        }
        tabHiddenTime = null;
      }
    }
  });

  // Periodically check for inactivity and clear cache if needed
  setInterval(() => {
    if (checkInactivity()) {
      clearAllMangaCache();
    }
  }, 60000); // Check every minute
}

// Export for manual use
export { INACTIVITY_TIMEOUT };
