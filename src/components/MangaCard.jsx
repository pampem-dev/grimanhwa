import React from 'react';
import { Star } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import { useTheme } from '../contexts/ThemeContext';

const SkeletonCard = () => (
  <div className="w-full space-y-3">
    <div className="aspect-[3/4.5] relative w-full overflow-hidden rounded-xl bg-white/5 border border-white/5 animate-pulse">
      <div className="absolute top-2 left-2 bg-white/10 rounded-md w-10 h-5" />
    </div>
    <div className="space-y-2 px-1">
      <div className="h-3 bg-white/5 rounded w-full animate-pulse" />
      <div className="h-3 bg-white/5 rounded w-2/3 animate-pulse" />
    </div>
  </div>
);

const MangaCard = ({ title, coverUrl, onClick, isLoading = false, rating }) => {
  const { darkMode } = useTheme();
  if (isLoading) return <SkeletonCard />;

  const handleImageError = (e) => {
    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'%3E%3Crect fill='%230f172a' width='300' height='450'/%3E%3Ctext fill='%23334155' font-family='sans-serif' font-size='14' text-anchor='middle' x='150' y='225'%3ENo Cover Available%3C/text%3E%3C/svg%3E";
  };

  // const extractRating = (title) => {
  //   if (!title) return '8.8';
  //   const match = title.match(/^(\d+\.\d+)/);
  //   return match ? match[1] : '9.2';
  // };

  const cleanTitle = (title) => {
    if (!title) return title;
    return title.replace(/^\d+\.\d+/, '');
  };

  // Get the best available image URL
  const getImageUrl = (coverUrl) => {
    if (!coverUrl) return null;
    
    // If it's already a full URL, return it
    if (coverUrl.startsWith('http')) {
      return coverUrl;
    }
    
    // If it's a relative path, make it absolute (assuming same domain)
    if (coverUrl.startsWith('/')) {
      return API_ENDPOINTS.COVER_URL(coverUrl);
    }
    
    return coverUrl;
  };

  const imageUrl = getImageUrl(coverUrl);

  return (
    <div 
      className="w-full group cursor-pointer transition-all duration-500" 
      onClick={onClick}
    >
      <div className="relative flex flex-col gap-3">
        
        {/* IMAGE CONTAINER */}
        <div className="relative aspect-[3/4.5] w-full overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl transition-all duration-500 group-hover:border-blue-500/50 group-hover:shadow-blue-500/10">
          
          {/* Cover Image */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              loading="lazy"
              onError={handleImageError}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a]">
              <div className="text-center">
                <div className="text-gray-600 text-xs font-bold">NO COVER</div>
              </div>
            </div>
          )}

          {/* Rating Badge - Top Left */}
          {rating && (
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-black/80 backdrop-blur-md border border-white/10 px-2 py-1 rounded-lg">
              <Star size={10} className="text-yellow-400" fill="currentColor" />
              <span className="text-[10px] font-semibold leading-none" style={{ color: darkMode ? '#e5e7eb' : '#ffffff' }}>
                {rating}
              </span>
            </div>
          )}

          {/* Bottom Gradient Overlay (For text readability on hover) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
          
        </div>

        {/* TEXT CONTENT - Cleaner, removed the grey box */}
        <div className="px-1 transition-all duration-300">
          <h3 className={`text-sm font-bold line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors uppercase tracking-tight ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
            {cleanTitle(title)}
          </h3>
        </div>

      </div>
    </div>
  );
};

export default MangaCard;