import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Details from './pages/Details';
import History from './pages/History';
import Collections from './pages/Collections';
import Library from './pages/Library';
import Settings from './pages/Settings';
import Reader from './pages/Reader';
import { ThemeProvider } from './contexts/ThemeContext';
import './App.css';

// App content component that uses router hooks
function AppContent() {
  const [activeMangaId, setActiveMangaId] = useState(null);
  const [detailsManga, setDetailsManga] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const addToHistory = (manga, chapter) => {
    if (!manga?.id) return;
    const HISTORY_KEY = 'manga_reader_history_v1';
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const list = raw ? JSON.parse(raw) : [];

      const nextItem = {
        mangaId: manga.id,
        title: manga.title,
        coverUrl: manga.cover_url,
        manga,
        lastChapterId: chapter?.id || chapter, 
        lastChapterLabel: chapter?.chapter_num ? `Chapter ${chapter.chapter_num}` : 'Last read',
        lastReadAt: Date.now(),
      };

      const existingIdx = list.findIndex((x) => x?.mangaId === manga.id);
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...nextItem };
      } else {
        list.push(nextItem);
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (err) { console.error("History Error:", err); }
  };

  const handleChapterNavigation = (nextChapterId) => {
    setActiveMangaId(nextChapterId);
    navigate(`/reader/${encodeURIComponent(nextChapterId)}`);
    if (detailsManga) {
      addToHistory(detailsManga, { id: nextChapterId });
    }
  };

  const handleMangaSelect = (id) => {
    setActiveMangaId(id);
    navigate(`/reader/${encodeURIComponent(id)}`);
  };

  const handleMangaDetails = (manga) => {
    setDetailsManga(manga);
    navigate(`/details/${encodeURIComponent(manga.id)}`);
  };

  const handleBack = () => {
    setDetailsManga(null);
    navigate(-1);
  };

  const handleReaderExit = () => {
    setActiveMangaId(null);
    navigate(-1);
  };

  const handleChapterRead = (chapter) => {
    addToHistory(detailsManga, chapter);
    setActiveMangaId(chapter?.id);
    navigate(`/reader/${encodeURIComponent(chapter?.id)}`);
  };

  // Get current page from URL path
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path.startsWith('/reader')) return 'reader';
    if (path.startsWith('/details')) return 'details';
    if (path.startsWith('/collections')) return 'collections';
    if (path.startsWith('/history')) return 'history';
    if (path.startsWith('/library')) return 'library';
    if (path.startsWith('/settings')) return 'settings';
    return 'home';
  };

  return (
    <Layout 
      currentPage={getCurrentPage()} 
      setCurrentPage={(page) => navigate(`/${page}`)}
      onMangaSelect={(manga) => {
        setDetailsManga(manga);
        setActiveMangaId(null);
        navigate(`/details/${encodeURIComponent(manga.id)}`);
      }}
    >
      <Routes>
        <Route path="/" element={<Home onMangaSelect={handleMangaSelect} onMangaDetails={handleMangaDetails} />} />
        <Route path="/home" element={<Home onMangaSelect={handleMangaSelect} onMangaDetails={handleMangaDetails} />} />
        <Route path="/collections" element={<Collections onMangaSelect={handleMangaSelect} onMangaDetails={handleMangaDetails} />} />
        <Route path="/history" element={<History onOpenManga={(manga) => setDetailsManga(manga)} />} />
        <Route path="/library" element={<Library onMangaSelect={handleMangaSelect} onMangaDetails={handleMangaDetails} />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/more" element={<Settings />} />
        <Route 
          path="/details/:mangaId" 
          element={
            <Details 
              onBack={() => navigate(-1)}
              onChapterRead={handleChapterRead}
            />
          } 
        />
        <Route 
          path="/reader/:chapterId" 
          element={
            <Reader 
              onNavigate={handleChapterNavigation}
              onExit={() => navigate(-1)} 
            />
          } 
        />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App;