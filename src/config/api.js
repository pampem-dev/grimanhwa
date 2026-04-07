// Central API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL;

//url for prod
//  process.env.REACT_APP_API_URL ||
// url for debug
// 'http://127.0.0.1:8000/' or eto 'http://10.7.6.205:8000/'

// Export base URL and helper functions
export const API_URL = API_BASE_URL;

// Helper to construct API endpoints
export const createApiUrl = (endpoint) => {
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}${cleanEndpoint}`;
};

// Enhanced fetch with retry logic and error handling
export const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for production
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...options.headers
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Specific API endpoints
export const API_ENDPOINTS = {
  // Manga endpoints
  MANGA: (id) => createApiUrl(`api/kaynscan/manga/?id=${encodeURIComponent(id)}`),
  CHAPTER: (id) => createApiUrl(`api/kaynscan/chapter/${encodeURIComponent(id)}/`),
  SEARCH: (query) => createApiUrl(`api/kaynscan/search/?q=${encodeURIComponent(query)}`),
  BROWSE_ALL: createApiUrl('api/kaynscan/browse-all/'),
  
  // Cover image helper
  COVER_URL: (path) => {
    if (path.startsWith('/')) {
      return `${API_BASE_URL}${path.slice(1)}`;
    }
    return path;
  }
};

export default API_URL;
