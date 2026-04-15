import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const HeroCarousel = ({ manga, onMangaClick, isLoading = false }) => {
  const { darkMode } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const scrollRef = useRef(null);
  const containerRef = useRef(null);

  const scrollToIndex = (index) => {
    const { current } = scrollRef;
    if (current && current.children[index]) {
      const child = current.children[index];
      const scrollPosition = child.offsetLeft - (current.offsetWidth - child.offsetWidth) / 2;
      current.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }
  };

  const scroll = (direction) => {
    const newIndex = direction === 'left' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(manga.length - 1, currentIndex + 1);
    setCurrentIndex(newIndex);
    scrollToIndex(newIndex);
  };

  const handleItemClick = (item, index) => {
    setCurrentIndex(index);
    onMangaClick(item);
  };

  // Drag handlers
  const handleDragStart = (clientX) => {
    setIsDragging(true);
    setDragStartX(clientX);
    setDragOffset(0);
  };

  const handleDragMove = (clientX) => {
    if (!isDragging) return;
    
    const deltaX = clientX - dragStartX;
    setDragOffset(deltaX);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    
    const dragThreshold = 50; // Minimum drag distance to trigger navigation
    
    if (Math.abs(dragOffset) > dragThreshold) {
      if (dragOffset > 0 && currentIndex > 0) {
        // Dragged right - go to previous
        setCurrentIndex(currentIndex - 1);
        scrollToIndex(currentIndex - 1);
      } else if (dragOffset < 0 && currentIndex < manga.length - 1) {
        // Dragged left - go to next
        setCurrentIndex(currentIndex + 1);
        scrollToIndex(currentIndex + 1);
      }
    }
    
    setIsDragging(false);
    setDragOffset(0);
  };

  // Mouse events
  const handleMouseDown = (e) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  };

  const handleMouseMove = (e) => {
    handleDragMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  // Touch events
  const handleTouchStart = (e) => {
    handleDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Add global mouse event listeners
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDragging) {
        handleMouseMove(e);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStartX]);

  if (isLoading) {
    return (
      <div className={`relative w-full ${darkMode ? 'bg-[#050505]' : 'bg-[#FAFAF8]'} overflow-hidden group/carousel`}>
        {/* Loading Skeleton - Single centered item */}
        <div 
          ref={scrollRef}
          className="relative flex justify-center items-center px-10 md:px-20 h-[500px] md:h-[600px]"
        >
          <div className="flex-shrink-0 w-[300px] md:w-[400px] transition-all duration-500 ease-out">
            <div className={`rounded-xl overflow-hidden ${darkMode ? 'bg-gray-800/50 border-white/10' : 'bg-stone-100 border-stone-200'} border`}>
              <div className={`w-full aspect-[3/4.5] ${darkMode ? 'bg-gray-700/50' : 'bg-stone-200'} animate-pulse`} />
            </div>
          </div>
        </div>
        
        {/* Navigation Skeletons */}
        <button className={`absolute left-0 top-0 bottom-0 w-20 ${darkMode ? 'bg-gradient-to-r from-[#050505]' : 'bg-gradient-to-r from-[#FAFAF8]'} to-transparent flex items-center justify-start pl-4 opacity-50`}>
          <div className={`w-8 h-8 ${darkMode ? 'bg-gray-700/50' : 'bg-stone-300'} rounded-full animate-pulse`} />
        </button>
        <button className={`absolute right-0 top-0 bottom-0 w-20 ${darkMode ? 'bg-gradient-to-l from-[#050505]' : 'bg-gradient-to-l from-[#FAFAF8]'} to-transparent flex items-center justify-end pr-4 opacity-50`}>
          <div className={`w-8 h-8 ${darkMode ? 'bg-gray-700/50' : 'bg-stone-300'} rounded-full animate-pulse`} />
        </button>
      </div>
    );
  }

  if (!manga || manga.length === 0) return null;

  return (
    <div 
      ref={containerRef}
      className={`relative w-full ${darkMode ? 'bg-[#050505]' : 'bg-[#FAFAF8]'} overflow-hidden group/carousel select-none`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ 
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'pan-y' // Allow vertical scrolling but prevent horizontal scroll
      }}
    >

      {/* 🎯 CENTERED ITEM DISPLAY */}
      <div 
        ref={scrollRef}
        className="relative flex justify-center items-center px-10 md:px-20 h-[500px] md:h-[600px]"
      >
        {manga.map((item, index) => (
          <div 
            key={item.id}
            onClick={() => !isDragging && handleItemClick(item, index)}
            className={`absolute flex-shrink-0 w-[300px] md:w-[400px] transition-all duration-500 ease-out cursor-pointer group ${
              index === currentIndex 
                ? 'scale-100 opacity-100 z-20 translate-x-0' 
                : index === currentIndex - 1
                  ? 'scale-75 opacity-50 z-10 -translate-x-1/2'
                  : index === currentIndex + 1
                    ? 'scale-75 opacity-50 z-10 translate-x-1/2'
                    : 'scale-0 opacity-0 z-0'
            }`}
            style={{
              transform: isDragging && index === currentIndex 
                ? `translateX(${dragOffset * 0.3}px)` 
                : undefined
            }}
          >
            {/* Rating Tag (Top Left) */}
            <div className="absolute top-2 left-2 z-10 bg-black/80 backdrop-blur-md px-2 py-1 rounded flex items-center gap-1 border border-white/10">
              <Star size={10} className="text-yellow-400" fill="currentColor" />
              <span className="text-[10px] font-semibold leading-none" style={{ color: darkMode ? '#e5e7eb' : '#ffffff' }}>{item.rating || 'N/A'}</span>
            </div>

            {/* Poster Image */}
            <div className="rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/5 group-hover:border-blue-500/50 transition-colors">
              <img
                src={item.cover_url || item.cover}
                alt={item.title}
                className="w-full aspect-[3/4.5] object-cover"
              />
            </div>

            {/* Floating Title (Appears on Hover) */}
            <div className="absolute bottom-4 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 z-30">
              <h3 className="text-sm font-black uppercase tracking-tight truncate px-2 text-white drop-shadow-lg bg-black/60 backdrop-blur-sm rounded-lg">
                {item.title?.replace(/^\d+\.\d+/, '')}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* 🎮 NAVIGATION OVERLAYS */}
      <button
        onClick={() => scroll('left')}
        disabled={currentIndex === 0}
        className={`absolute left-0 top-0 bottom-0 w-20 ${darkMode ? 'bg-gradient-to-r from-[#050505]' : 'bg-gradient-to-r from-[#FAFAF8]'} to-transparent flex items-center justify-start pl-4 opacity-0 group-hover/carousel:opacity-100 transition-opacity z-50 disabled:opacity-30`}
      >
        <div className={`p-3 rounded-full ${darkMode ? 'bg-white/5 border-white/10 hover:bg-white/20' : 'bg-stone-100 border-stone-200 hover:bg-stone-200'} backdrop-blur-md border transition-all`}>
          <ChevronLeft size={30} />
        </div>
      </button>

      <button
        onClick={() => scroll('right')}
        disabled={currentIndex === manga.length - 1}
        className={`absolute right-0 top-0 bottom-0 w-20 ${darkMode ? 'bg-gradient-to-l from-[#050505]' : 'bg-gradient-to-l from-[#FAFAF8]'} to-transparent flex items-center justify-end pr-4 opacity-0 group-hover/carousel:opacity-100 transition-opacity z-50 disabled:opacity-30`}
      >
        <div className={`p-3 rounded-full ${darkMode ? 'bg-white/5 border-white/10 hover:bg-white/20' : 'bg-stone-100 border-stone-200 hover:bg-stone-200'} backdrop-blur-md border transition-all`}>
          <ChevronRight size={30} />
        </div>
      </button>

      {/* 📍 Page Indicators */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-40">
        {manga.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setCurrentIndex(index);
              scrollToIndex(index);
            }}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex 
                ? `${darkMode ? 'bg-white' : 'bg-black'} w-8` 
                : `${darkMode ? 'bg-white/30 hover:bg-white/50' : 'bg-black/30 hover:bg-black/50'}`
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroCarousel;