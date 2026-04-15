import React, { useState, useEffect } from 'react';
import {Moon, Sun, Download, Trash2, Shield, ChevronRight, Info, ExternalLink, User, RefreshCw, Database } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';

const Settings = () => {
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [autoDownload, setAutoDownload] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [readingMode, setReadingMode] = useState('continuous'); // continuous, single, double
  const [fontSize, setFontSize] = useState('medium'); // small, medium, large
  const [language, setLanguage] = useState('english');
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [user, setUser] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Check if user is logged in
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userData = localStorage.getItem('user');
    if (isLoggedIn === 'true' && userData) {
      setUser(JSON.parse(userData));
    } else {
      setUser(null);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    window.location.reload();
  };

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    if (savedSettings.autoDownload !== undefined) setAutoDownload(savedSettings.autoDownload);
    if (savedSettings.notifications !== undefined) setNotifications(savedSettings.notifications);
    if (savedSettings.autoPlay !== undefined) setAutoPlay(savedSettings.autoPlay);
    if (savedSettings.readingMode !== undefined) setReadingMode(savedSettings.readingMode);
    if (savedSettings.fontSize !== undefined) setFontSize(savedSettings.fontSize);
    if (savedSettings.language !== undefined) setLanguage(savedSettings.language);
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    const existingSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const settings = {
      ...existingSettings, // Keep existing settings like darkMode
      autoDownload,
      notifications,
      autoPlay,
      readingMode,
      fontSize,
      language
    };
    localStorage.setItem('appSettings', JSON.stringify(settings));
  }, [autoDownload, notifications, autoPlay, readingMode, fontSize, language]);

  const handleClearCache = () => {
    setShowClearCacheModal(true);
  };

  const confirmClearCache = () => {
    // Clear all manga cache entries
    let clearedCount = 0;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('mangaCache_') || key.startsWith('collectionsCache_') || key.startsWith('readerCache_') || key.startsWith('detailsCache_')) {
        localStorage.removeItem(key);
        clearedCount++;
      }
    });

    // Also clear any old cache format
    if (localStorage.getItem('mangaCache')) {
      localStorage.removeItem('mangaCache');
      clearedCount++;
    }

    setShowClearCacheModal(false);
    window.alert(`Cache cleared successfully! Removed ${clearedCount} cached items.`);
  };

  const handleClearAllData = () => {
    setShowClearDataModal(true);
  };

  const confirmClearAllData = () => {
    // Preserve auth and user data, clear everything else
    const authToken = localStorage.getItem('authToken');
    const user = localStorage.getItem('user');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    
    localStorage.clear();
    
    // Restore auth data
    if (authToken) localStorage.setItem('authToken', authToken);
    if (user) localStorage.setItem('user', user);
    if (isLoggedIn) localStorage.setItem('isLoggedIn', isLoggedIn);
    
    setShowClearDataModal(false);
    navigate('/');
  };

  const handleSync = async () => {
    setShowBackupModal(true);
  };

  const confirmBackup = async () => {
    setShowBackupModal(false);
    setSyncing(true);
    try {
      const token = localStorage.getItem('authToken');
      const history = JSON.parse(localStorage.getItem('manga_reader_history_v1') || '[]');
      let library = JSON.parse(localStorage.getItem('mangaLibrary') || '[]');

      // Fetch missing manga details for library items
      for (let i = 0; i < library.length; i++) {
        const item = library[i];
        // If item is just a string ID or missing title/cover
        if (typeof item === 'string' || !item.title || !item.cover_url) {
          const mangaId = typeof item === 'string' ? item : item.id;
          try {
            const response = await fetch(`${API_URL}api/kaynscan/manga/?id=${encodeURIComponent(mangaId)}&force_refresh=true`);
            if (response.ok) {
              const data = await response.json();
              // Update with full data
              library[i] = {
                id: mangaId,
                title: data.title || 'Unknown',
                cover_url: data.cover || '',
                cover: data.cover || '',
                dateAdded: typeof item === 'object' && item.dateAdded ? item.dateAdded : new Date().toISOString()
              };
            }
          } catch (error) {
            console.error('Failed to fetch manga details:', error);
          }
        }
      }

      // Update localStorage with enriched data
      localStorage.setItem('mangaLibrary', JSON.stringify(library));

      const response = await fetch(`${API_URL}api/user/sync/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          history,
          library
        })
      });

      if (response.ok) {
        alert('Backup successful!');
      } else {
        alert('Backup failed');
      }
    } catch (error) {
      alert('Backup error');
    } finally {
      setSyncing(false);
    }
  };

  const handleRestore = async () => {
    setShowSyncModal(true);
  };

  const confirmRestore = async () => {
    setShowSyncModal(false);
    setRestoring(true);
    try {
      const token = localStorage.getItem('authToken');

      // Fetch reading history
      const historyResponse = await fetch(`${API_URL}api/user/reading-history/get/`, {
        headers: {
          'Authorization': `Token ${token}`,
        },
      });

      // Fetch library
      const libraryResponse = await fetch(`${API_URL}api/user/library/get/`, {
        headers: {
          'Authorization': `Token ${token}`,
        },
      });

      if (historyResponse.ok && libraryResponse.ok) {
        const historyData = await historyResponse.json();
        const libraryData = await libraryResponse.json();

        // Restore to localStorage
        localStorage.setItem('manga_reader_history_v1', JSON.stringify(historyData.history || []));
        localStorage.setItem('mangaLibrary', JSON.stringify(libraryData.library || []));

        alert('Sync successful!');
        window.location.reload();
      } else {
        alert('Sync failed');
      }
    } catch (error) {
      alert('Sync error');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          </div>
          <div className="text-sm text-gray-500">
            Version 1.5.3
          </div>
        </div>

        {/* Account Section */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Shield size={20} className="text-gray-400" />
            Account
          </h2>
          <div className="space-y-4">
            {user ? (
              /* Profile */
              <button
                onClick={() => navigate('/profile')}
                className={`w-full flex items-center justify-between p-4 rounded-xl border hover:bg-white/10 transition-all ${darkMode ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-200'}`}
              >
                <div className="flex items-center gap-3">
                  <User size={18} className="text-gray-400" />
                  <div className="text-left">
                    <p className="font-medium text-white">Profile</p>
                    <p className="text-sm text-gray-400">View your profile</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            ) : (
              /* Login */
              <button
                onClick={() => navigate('/login')}
                className={`w-full flex items-center justify-between p-4 rounded-xl border hover:bg-white/10 transition-all ${darkMode ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-200'}`}
              >
                <div className="flex items-center gap-3">
                  <Shield size={18} className="text-gray-400" />
                  <div className="text-left">
                    <p className="font-medium text-white">Login</p>
                    <p className="text-sm text-gray-400">Sign in to your account</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            )}
          </div>
        </section>

        {/* Data Section */}
        {user && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Database size={20} className="text-gray-400" />
              Data
            </h2>
            <div className="space-y-4">
              {/* Backup Data */}
              <button
                onClick={handleSync}
                disabled={syncing}
                className={`w-full flex items-center justify-between p-4 rounded-xl border hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${darkMode ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-200'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${darkMode ? 'bg-white/5' : 'bg-stone-100'}`}>
                    {syncing ? (
                      <RefreshCw size={18} className={`animate-spin text-gray-400`} />
                    ) : (
                      <RefreshCw size={18} className="text-gray-400" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-white">Backup Data</p>
                    <p className="text-sm text-gray-400">{syncing ? 'Backing up...' : 'Save your data to cloud'}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </button>

              {/* Sync Data */}
              <button
                onClick={handleRestore}
                disabled={restoring}
                className={`w-full flex items-center justify-between p-4 rounded-xl border hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${darkMode ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-200'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${darkMode ? 'bg-white/5' : 'bg-stone-100'}`}>
                    {restoring ? (
                      <Download size={18} className={`animate-bounce text-gray-400`} />
                    ) : (
                      <Download size={18} className="text-gray-400" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-white">Sync Data</p>
                    <p className="text-sm text-gray-400">{restoring ? 'Syncing...' : 'Restore your saved data from cloud'}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            </div>
          </section>
        )}

        {/* Appearance Section */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Moon size={20} className="text-gray-400" />
            Appearance
          </h2>
          <div className="space-y-4">
            {/* Dark Mode Toggle */}
            <div className={`flex items-center justify-between p-4 rounded-xl border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-200'}`}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                  <div>
                    <p className="font-medium text-white">Dark Mode</p>
                    <p className="text-sm text-gray-400">Use dark theme across the app</p>
                  </div>
                </div>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  darkMode ? 'bg-white/20' : 'bg-gray-600'
                }`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

              {/* Font Size */}
              {/* <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div>
                  <p className="font-medium text-white">Font Size</p>
                  <p className="text-sm text-gray-400">Adjust reading text size</p>
                </div>
                <div className="flex gap-2">
                  {['small', 'medium', 'large'].map((size) => (
                    <button
                      key={size}
                      onClick={() => setFontSize(size)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        fontSize === size
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  ))}
                </div>
              </div> */}
            </div>
        </section>

        {/* Reading Section */}
        {/* <section className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <BookOpen size={20} className="text-blue-400" />
              Reading
            </h2>
            <div className="space-y-4"> */}
              {/* Reading Mode */}
              {/* <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div>
                  <p className="font-medium text-white">Reading Mode</p>
                  <p className="text-sm text-gray-400">Choose how chapters are displayed</p>
                </div>
                <div className="flex gap-2">
                  {['continuous', 'single', 'double'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setReadingMode(mode)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        readingMode === mode
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div> */}

              {/* Auto Play */}
              {/* <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div>
                  <p className="font-medium text-white">Auto Play</p>
                  <p className="text-sm text-gray-400">Automatically advance to next page</p>
                </div>
                <button
                  onClick={() => setAutoPlay(!autoPlay)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    autoPlay ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    autoPlay ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
        </section> */}

        {/* Downloads Section */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Download size={20} className="text-gray-400" />
            Cache
          </h2>
          <div className="space-y-4">
            {/* Auto Download */}
            {/* <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div>
                <p className="font-medium text-white">Auto Download</p>
                <p className="text-sm text-gray-400">Download chapters for offline reading</p>
              </div>
              <button
                onClick={() => setAutoDownload(!autoDownload)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  autoDownload ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  autoDownload ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div> */}

            {/* Clear Cache */}
            <button
              onClick={handleClearCache}
              className={`w-full flex items-center justify-between p-4 rounded-xl border hover:bg-white/10 transition-all ${darkMode ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-200'}`}
            >
              <div className="flex items-center gap-3">
                <Trash2 size={18} className="text-gray-400" />
                <div className="text-left">
                  <p className="font-medium text-white">Clear Cache</p>
                  <p className="text-sm text-gray-400">Remove offline content</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          </div>
        </section>

        {/* Notifications Section */}
        {/* <section className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Bell size={20} className="text-blue-400" />
              Notifications
            </h2>
            <div className="space-y-4"> */}
              {/* Notifications Toggle */}
              {/* <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div>
                  <p className="font-medium text-white">Push Notifications</p>
                  <p className="text-sm text-gray-400">Get notified about new chapters</p>
                </div>
                <button
                  onClick={() => setNotifications(!notifications)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notifications ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    notifications ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
        </section> */}

        {/* Language Section */}
        {/* <section className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Globe size={20} className="text-blue-400" />
              Language & Region
            </h2>
            <div className="space-y-4"> */}
              {/* Language Selection */}
              {/* <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div>
                  <p className="font-medium text-white">App Language</p>
                  <p className="text-sm text-gray-400">Choose display language</p>
                </div>
                <div className="flex gap-2">
                  {['english', 'spanish', 'japanese'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        language === lang
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
        </section> */}

        {/* About Section */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Info size={20} className="text-gray-400" />
            About
          </h2>
          <div className="space-y-4">
            {/* App Info */}
            <div className={`p-4 rounded-xl border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-white">grimanhwa</p>
                <span className="text-sm text-gray-400">v1.5.3</span>
              </div>
              <div className="flex gap-4">
                <a
                  href="https://github.com/pampem-dev/grimanhwa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <ExternalLink size={14} />
                  GitHub
                </a>
                <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors">
                  <ExternalLink size={14} />
                  Privacy Policy
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
            <Shield size={20} />
            Danger Zone
          </h2>
          <div className="space-y-4">
            {/* Clear All Data */}
          <button
            onClick={handleClearAllData}
            className="w-full flex items-center justify-between p-5 bg-red-600/5 rounded-2xl border border-red-600/20 hover:bg-red-600/10 transition-all duration-300 group"
          >
            <div className="flex items-center gap-4">
              {/* Icon Container with subtle animation */}
              <div className="w-12 h-12 bg-red-600/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Trash2 size={22} className="text-red-500" />
              </div>

              <div className="flex flex-col text-left">
                {/* Primary Title */}
                <h3 className="text-lg font-bold text-red-500 leading-tight">
                  Clear All Data
                </h3>
                {/* Semititle / Subtitle */}
                <p className="text-sm text-red-400/70 font-medium">
                  Clear data while preserving your streak
                </p>
              </div>
            </div>

            {/* Optional: Add a chevron or arrow to indicate it's an action */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight size={20} className="text-red-500" />
            </div>
          </button>
          </div>
        </section>
      </div>

      {/* Clear All Data Confirmation Modal */}
      {showClearDataModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#050505] border-white/10' : 'bg-white border-stone-200'} rounded-2xl p-6 max-w-md w-full shadow-2xl`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 bg-red-600/20 rounded-full flex items-center justify-center`}>
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-900'}`}>Clear All Data</h3>
            </div>
            <p className={`${darkMode ? 'text-gray-400' : 'text-stone-600'} mb-6`}>
              This will delete your library, history, and settings. Your reading streak will be preserved. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearDataModal(false)}
                className={`px-4 py-2 rounded-lg ${darkMode ? 'text-white hover:bg-white/10' : 'text-stone-600 hover:bg-stone-100'} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={confirmClearAllData}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
                style={{ color: 'white' }}
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Cache Confirmation Modal */}
      {showClearCacheModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#050505] border-white/10' : 'bg-white border-stone-200'} rounded-2xl p-6 max-w-md w-full shadow-2xl`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 bg-yellow-600/20 rounded-full flex items-center justify-center`}>
                <Download size={18} className="text-yellow-400" />
              </div>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-900'}`}>Clear Cache</h3>
            </div>
            <p className={`${darkMode ? 'text-gray-400' : 'text-stone-600'} mb-6`}>
              This will remove all cached data but keep your library and history.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearCacheModal(false)}
                className={`px-4 py-2 rounded-lg ${darkMode ? 'text-white hover:bg-white/10' : 'text-stone-600 hover:bg-stone-100'} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={confirmClearCache}
                className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 transition-colors"
                style={{ color: 'white' }}
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Confirmation Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#050505] border-white/10' : 'bg-white border-stone-200'} rounded-2xl p-6 max-w-md w-full shadow-2xl`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center`}>
                <RefreshCw size={18} className="text-blue-400" />
              </div>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-900'}`}>Backup Data</h3>
            </div>
            <p className={`${darkMode ? 'text-gray-400' : 'text-stone-600'} mb-6`}>
              This will backup your library, reading history, and reading streak to the cloud. Make sure you've synced first if you just logged in.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBackupModal(false)}
                className={`px-4 py-2 rounded-lg ${darkMode ? 'text-white hover:bg-white/10' : 'text-stone-600 hover:bg-stone-100'} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={confirmBackup}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
                style={{ color: 'white' }}
              >
                Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Confirmation Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#050505] border-yellow-500/30' : 'bg-white border-yellow-500'} rounded-2xl p-6 max-w-md w-full shadow-2xl`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 bg-yellow-600/20 rounded-full flex items-center justify-center`}>
                <Download size={18} className="text-yellow-400" />
              </div>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-900'}`}>Sync Data</h3>
            </div>
            <p className={`${darkMode ? 'text-yellow-400' : 'text-yellow-600'} mb-6 font-medium`}>
              ⚠️ Warning: This will replace your local data with cloud data. You will lose any unsynced local changes. Please backup first to avoid data loss.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSyncModal(false)}
                className={`px-4 py-2 rounded-lg ${darkMode ? 'text-white hover:bg-white/10' : 'text-stone-600 hover:bg-stone-100'} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 transition-colors"
                style={{ color: 'white' }}
              >
                Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
