import React, { useState } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import Details from './pages/Details';
import History from './pages/History';
import Collections from './pages/Collections';
import Library from './pages/Library';
import Settings from './pages/Settings';
import Reader from './pages/Reader';
import './App.css';

function App() {
  const [activeMangaId, setActiveMangaId] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [detailsManga, setDetailsManga] = useState(null);

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
    if (detailsManga) {
      addToHistory(detailsManga, { id: nextChapterId });
    }
  };

  const getActualPage = () => {
    if (activeMangaId) return 'reader';
    if (detailsManga) return 'details';
    return currentPage;
  };

  const renderPage = () => {
    if (activeMangaId) {
      return (
        <Reader 
          /* The 'key' ensures the Reader resets completely on navigation */
          key={activeMangaId} 
          chapterId={activeMangaId} 
          onNavigate={handleChapterNavigation}
          onExit={() => setActiveMangaId(null)} 
        />
      );
    }

    if (detailsManga) {
      return (
        <Details 
          manga={detailsManga}
          onBack={() => setDetailsManga(null)}
          onChapterRead={(chapter) => {
            addToHistory(detailsManga, chapter);
            setActiveMangaId(chapter?.id);
          }}
        />
      );
    }

    switch (currentPage) {
      case 'home':
        return <Home onMangaSelect={(id) => setActiveMangaId(id)} onMangaDetails={(manga) => setDetailsManga(manga)} />;
      case 'collections':
        return <Collections onMangaSelect={(id) => setActiveMangaId(id)} onMangaDetails={(manga) => setDetailsManga(manga)} />;
      case 'history':
        return <History onOpenManga={(manga) => setDetailsManga(manga)} />;
      case 'library':
        return <Library onMangaSelect={(manga) => setDetailsManga(manga)} onMangaDetails={(manga) => setDetailsManga(manga)} />;
      case 'settings':
      case 'more':
        return <Settings />;
      default:
        return <Home onMangaSelect={(id) => setActiveMangaId(id)} />;
    }
  };

  return (
  <Layout 
    currentPage={getActualPage()} 
    setCurrentPage={setCurrentPage}
    // Pass the function here!
    onMangaSelect={(manga) => {
      setDetailsManga(manga);  // Set the details page to show this manga
      setActiveMangaId(null);  // Close the reader if it's open
    }}
  >
    {renderPage()}
  </Layout>
  );
}

export default App;