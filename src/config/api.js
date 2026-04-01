// Central API configuration
const API_BASE_URL = 'http://10.7.6.206:8000/';

//ADD THIS PAG PROD NA
//  process.env.REACT_APP_API_URL ||


// Export base URL and helper functions
export const API_URL = API_BASE_URL;

// Helper to construct API endpoints
export const createApiUrl = (endpoint) => {
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}${cleanEndpoint}`;
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
