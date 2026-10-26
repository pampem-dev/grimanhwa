import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { ThemeProvider } from './contexts/ThemeContext';
import { CollectionsProvider } from './contexts/CollectionsContext';
import './App.css';

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home'));
const Details = lazy(() => import('./pages/Details'));
const History = lazy(() => import('./pages/History'));
const Collections = lazy(() => import('./pages/Collections'));
const Library = lazy(() => import('./pages/Library'));
const Settings = lazy(() => import('./pages/Settings'));
const Reader = lazy(() => import('./pages/Reader'));
const Login = lazy(() => import('./pages/Login'));
const Profile = lazy(() => import('./pages/Profile'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-[#050505]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

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
    navigate(`/reader/${encodeURIComponent(nextChapterId)}?manga=${encodeURIComponent(detailsManga?.id || '')}`);
    if (detailsManga) {
      addToHistory(detailsManga, { id: nextChapterId });
    }
  };

  const handleMangaSelect = (id) => {
    setActiveMangaId(id);
    // If id is a chapter ID, navigate directly. If it's a manga ID, we need manga context
    navigate(`/reader/${encodeURIComponent(id)}`);
  };

  const handleMangaDetails = (manga) => {
    setDetailsManga(manga);
    // Cache the manga for faster loading if user navigates directly via URL
    localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
      data: manga,
      timestamp: Date.now()
    }));
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

  const handleHistoryMangaOpen = (manga) => {
    setDetailsManga(manga);
    // Cache the manga for faster loading if user navigates directly via URL
    localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
      data: manga,
      timestamp: Date.now()
    }));
    navigate(`/details/${encodeURIComponent(manga.id)}`);
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
    if (path.startsWith('/login')) return 'login';
    if (path.startsWith('/profile')) return 'profile';
    if (path.startsWith('/privacy')) return 'privacy';
    return 'home';
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={
          <Layout
            currentPage={getCurrentPage()}
            setCurrentPage={(page) => navigate(`/${page}`)}
            onMangaSelect={(manga) => {
              setDetailsManga(manga);
              setActiveMangaId(null);
              localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
                data: manga,
                timestamp: Date.now()
              }));
              navigate(`/details/${encodeURIComponent(manga.id)}`);
            }}
          >
            <Home onMangaSelect={handleMangaSelect} onMangaDetails={handleMangaDetails} />
          </Layout>
        } />
        <Route path="/home" element={
          <Layout
            currentPage={getCurrentPage()}
            setCurrentPage={(page) => navigate(`/${page}`)}
            onMangaSelect={(manga) => {
              setDetailsManga(manga);
              setActiveMangaId(null);
              localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
                data: manga,
                timestamp: Date.now()
              }));
              navigate(`/details/${encodeURIComponent(manga.id)}`);
            }}
          >
            <Home onMangaSelect={handleMangaSelect} onMangaDetails={handleMangaDetails} />
          </Layout>
        } />
        <Route path="/collections" element={
          <Layout
            currentPage={getCurrentPage()}
            setCurrentPage={(page) => navigate(`/${page}`)}
            onMangaSelect={(manga) => {
              setDetailsManga(manga);
              setActiveMangaId(null);
              localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
                data: manga,
                timestamp: Date.now()
              }));
              navigate(`/details/${encodeURIComponent(manga.id)}`);
            }}
          >
            <Collections onMangaSelect={handleMangaSelect} onMangaDetails={handleMangaDetails} />
          </Layout>
        } />
        <Route path="/history" element={
          <Layout
            currentPage={getCurrentPage()}
            setCurrentPage={(page) => navigate(`/${page}`)}
            onMangaSelect={(manga) => {
              setDetailsManga(manga);
              setActiveMangaId(null);
              localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
                data: manga,
                timestamp: Date.now()
              }));
              navigate(`/details/${encodeURIComponent(manga.id)}`);
            }}
          >
            <History onOpenManga={handleHistoryMangaOpen} />
          </Layout>
        } />
        <Route path="/library" element={
          <Layout
            currentPage={getCurrentPage()}
            setCurrentPage={(page) => navigate(`/${page}`)}
            onMangaSelect={(manga) => {
              setDetailsManga(manga);
              setActiveMangaId(null);
              localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
                data: manga,
                timestamp: Date.now()
              }));
              navigate(`/details/${encodeURIComponent(manga.id)}`);
            }}
          >
            <Library onMangaSelect={handleMangaSelect} onMangaDetails={handleMangaDetails} />
          </Layout>
        } />
        <Route path="/settings" element={
          <Layout
            currentPage={getCurrentPage()}
            setCurrentPage={(page) => navigate(`/${page}`)}
            onMangaSelect={(manga) => {
              setDetailsManga(manga);
              setActiveMangaId(null);
              localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
                data: manga,
                timestamp: Date.now()
              }));
              navigate(`/details/${encodeURIComponent(manga.id)}`);
            }}
          >
            <Settings />
          </Layout>
        } />
        <Route path="/more" element={
          <Layout
            currentPage={getCurrentPage()}
            setCurrentPage={(page) => navigate(`/${page}`)}
            onMangaSelect={(manga) => {
              setDetailsManga(manga);
              setActiveMangaId(null);
              localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
                data: manga,
                timestamp: Date.now()
              }));
              navigate(`/details/${encodeURIComponent(manga.id)}`);
            }}
          >
            <Settings />
          </Layout>
        } />
        <Route path="/login" element={
          <Layout
            currentPage={getCurrentPage()}
            setCurrentPage={(page) => navigate(`/${page}`)}
            onMangaSelect={(manga) => {
              setDetailsManga(manga);
              setActiveMangaId(null);
              localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
                data: manga,
                timestamp: Date.now()
              }));
              navigate(`/details/${encodeURIComponent(manga.id)}`);
            }}
          >
            <Login />
          </Layout>
        } />
        <Route path="/profile" element={
          <Layout
            currentPage={getCurrentPage()}
            setCurrentPage={(page) => navigate(`/${page}`)}
            onMangaSelect={(manga) => {
              setDetailsManga(manga);
              setActiveMangaId(null);
              localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
                data: manga,
                timestamp: Date.now()
              }));
              navigate(`/details/${encodeURIComponent(manga.id)}`);
            }}
          >
            <Profile />
          </Layout>
        } />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route
          path="/details/:mangaId"
          element={
            <Layout
              currentPage={getCurrentPage()}
              setCurrentPage={(page) => navigate(`/${page}`)}
              onMangaSelect={(manga) => {
                setDetailsManga(manga);
                setActiveMangaId(null);
                localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
                  data: manga,
                  timestamp: Date.now()
                }));
                navigate(`/details/${encodeURIComponent(manga.id)}`);
              }}
            >
              <Details
                onBack={() => navigate(-1)}
                onChapterRead={handleChapterRead}
              />
            </Layout>
          }
        />
        <Route
          path="/reader/:chapterId"
          element={
            <Layout
              currentPage={getCurrentPage()}
              setCurrentPage={(page) => navigate(`/${page}`)}
              onMangaSelect={(manga) => {
                setDetailsManga(manga);
                setActiveMangaId(null);
                localStorage.setItem(`cached_manga_${manga.id}`, JSON.stringify({
                  data: manga,
                  timestamp: Date.now()
                }));
                navigate(`/details/${encodeURIComponent(manga.id)}`);
              }}
            >
              <Reader
                onNavigate={handleChapterNavigation}
                onExit={handleReaderExit}
              />
            </Layout>
          }
        />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <CollectionsProvider>
        <Router>
          <AppContent />
        </Router>
      </CollectionsProvider>
    </ThemeProvider>
  );
}

export default App;