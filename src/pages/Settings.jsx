import React, { useState, useEffect } from 'react';
import {Moon, Sun, Download, Trash2, Shield, Bell, Globe, ChevronRight, Info, ExternalLink, BookOpen } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const Settings = () => {
  const { darkMode, toggleDarkMode } = useTheme();
  const [autoDownload, setAutoDownload] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [readingMode, setReadingMode] = useState('continuous'); // continuous, single, double
  const [fontSize, setFontSize] = useState('medium'); // small, medium, large
  const [language, setLanguage] = useState('english');

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
    if (window.confirm('Clear all cached data? This will remove offline content but keep your library and history.')) {
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
      
      window.alert(`Cache cleared successfully! Removed ${clearedCount} cached items.`);
    }
  };

  const handleClearAllData = () => {
    if (window.confirm('⚠️ WARNING: This will delete ALL your data including library, history, and settings. This action cannot be undone. Are you sure?')) {
      localStorage.clear();
      window.alert('All data cleared. The page will now refresh.');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 sm:p-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          </div>
          <div className="text-sm text-gray-500">
            Version 1.0.0
          </div>
        </div>

        <div className="max-w-4xl">
          {/* Appearance Section */}
          <section className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Moon size={20} className="text-blue-400" />
              Appearance
            </h2>
            <div className="space-y-4">
              {/* Dark Mode Toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
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
                    darkMode ? 'bg-blue-600' : 'bg-gray-600'
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
              <Download size={20} className="text-blue-400" />
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
                className="w-full flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Trash2 size={18} className="text-red-400" />
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
              <Info size={20} className="text-blue-400" />
              About
            </h2>
            <div className="space-y-4">
              {/* App Info */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-white">grimanhwa</p>
                  <span className="text-sm text-gray-400">v1.0.0</span>
                </div>
                <div className="flex gap-4">
                  <button className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    <ExternalLink size={14} />
                    Privacy Policy
                  </button>
                  <button className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    <ExternalLink size={14} />
                    Terms of Service
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
                className="w-full flex items-center justify-between p-4 bg-red-600/10 rounded-xl border border-red-600/20 hover:bg-red-600/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Trash2 size={18} className="text-red-400" />
                  <div className="text-left">
                    <p className="font-medium text-red-400">Clear All Data</p>
                    <p className="text-sm text-red-300/70">Permanently delete everything</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-red-400" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
