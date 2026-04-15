import React, { useState, useEffect } from 'react';
import { User, Mail, Clock, List, ChevronLeft, Shield, LogOut, BookOpen, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config/api';

const Profile = () => {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ totalRead: 0, librarySize: 0, lastRead: 'Never', memberSince: '2024' });
  const [localStats, setLocalStats] = useState({ totalRead: 0, librarySize: 0 });
  const [streak, setStreak] = useState(0);
  const [readingDays, setReadingDays] = useState([]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/login');
    window.location.reload();
  };

  // Fetch user stats from API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}api/user/stats/`, {
          headers: {
            'Authorization': `Token ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          const memberSince = user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '2024';
          setStats({
            totalRead: data.total_read || 0,
            librarySize: data.library_size || 0,
            lastRead: data.last_read || 'Never',
            memberSince,
          });
          setStreak(data.reading_streak || 0);
          setReadingDays(data.reading_days || []);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    if (user) {
      fetchStats();
    }
  }, [user]);

  // Calculate local stats from localStorage
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('manga_reader_history_v1') || '[]');
    const library = JSON.parse(localStorage.getItem('mangaLibrary') || '[]');
    console.log('Local history:', history.length, history);
    console.log('Local library:', library.length, library);
    setLocalStats({
      totalRead: history.length,
      librarySize: library.length,
    });
  }, []);

  if (!user) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-[#050505]' : 'bg-[#FAFAF8]'} flex items-center justify-center`}>
        <div className={`w-8 h-8 border ${darkMode ? 'border-gray-600 border-t-blue-500' : 'border-stone-300 border-t-stone-800'} rounded-full animate-spin`} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#050505] text-white' : 'bg-[#FAFAF8] text-stone-800'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-20">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className={`p-3 rounded-lg transition-colors border ${darkMode ? 'border-white/20 hover:bg-white/5 text-gray-400 hover:text-white' : 'border-stone-300 hover:bg-stone-50 text-stone-400 hover:text-stone-800'}`}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={() => navigate('/settings')}
            className={`p-3 rounded-lg transition-colors border ${darkMode ? 'border-white/20 hover:bg-white/5 text-gray-400 hover:text-white' : 'border-stone-300 hover:bg-stone-50 text-stone-400 hover:text-stone-800'}`}
          >
            <Edit size={24} />
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column - Profile Card */}
          <div className="lg:col-span-1">
            <div className={`rounded-2xl p-8 ${darkMode ? 'bg-[#0a0a0a] border border-white/10' : 'bg-white border border-stone-200'}`}>
              <div className="flex flex-col items-center text-center">
                <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-6 ${darkMode ? 'bg-white/5' : 'bg-stone-100'}`}>
                  <User size={56} className={darkMode ? 'text-gray-400' : 'text-stone-400'} />
                </div>
                <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-stone-900'}`}>{user.username}</h2>
                <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>{user.email}</p>
                <div className={`px-4 py-1.5 rounded-full text-xs font-semibold mb-6 ${darkMode ? 'bg-white/10 text-gray-300 border border-white/20' : 'bg-stone-100 text-stone-600 border border-stone-300'}`}>
                  Member
                </div>
                <div className={`flex items-center gap-2 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>
                  <Shield size={14} className={darkMode ? 'text-gray-400' : 'text-stone-400'} />
                  Member since {stats.memberSince}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Stats & Info */}
          <div className="lg:col-span-2 space-y-6">

            {/* Stats Grid */}
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4`}>
              <div className={`rounded-xl p-6 ${darkMode ? 'bg-[#0a0a0a] border border-white/10' : 'bg-white border border-stone-200'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${darkMode ? 'bg-white/10' : 'bg-stone-100'}`}>
                    <BookOpen size={20} className={darkMode ? 'text-gray-400' : 'text-stone-400'} />
                  </div>
                  <p className={`text-xs uppercase tracking-widest font-semibold ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>Total Read</p>
                </div>
                <p className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-stone-900'}`}>{localStats.totalRead}</p>
                <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>{stats.totalRead} from cloud</p>
              </div>

              <div className={`rounded-xl p-6 ${darkMode ? 'bg-[#0a0a0a] border border-white/10' : 'bg-white border border-stone-200'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${darkMode ? 'bg-white/10' : 'bg-stone-100'}`}>
                    <List size={20} className={darkMode ? 'text-gray-400' : 'text-stone-400'} />
                  </div>
                  <p className={`text-xs uppercase tracking-widest font-semibold ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>Library</p>
                </div>
                <p className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-stone-900'}`}>{localStats.librarySize}</p>
                <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>{stats.librarySize} from cloud</p>
              </div>

              <div className={`rounded-xl p-6 ${darkMode ? 'bg-[#0a0a0a] border border-white/10' : 'bg-white border border-stone-200'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${darkMode ? 'bg-white/10' : 'bg-stone-100'}`}>
                    <Clock size={20} className={darkMode ? 'text-gray-400' : 'text-stone-400'} />
                  </div>
                  <p className={`text-xs uppercase tracking-widest font-semibold ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>Last Read</p>
                </div>
                <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-900'}`}>{stats.lastRead}</p>
                <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>Recent activity</p>
              </div>
            </div>

            {/* Account Information */}
            <div className={`rounded-xl ${darkMode ? 'bg-[#0a0a0a] border border-white/10' : 'bg-white border border-stone-200'}`}>
              <div className={`p-6 border-b ${darkMode ? 'border-white/10' : 'border-stone-200'}`}>
                <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-stone-900'}`}>Account Information</h3>
                <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>Your account details and settings</p>
              </div>
              <div className={`divide-y ${darkMode ? 'divide-white/10' : 'divide-stone-200'}`}>
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${darkMode ? 'bg-white/5' : 'bg-stone-100'}`}>
                      <Mail size={18} className={darkMode ? 'text-gray-400' : 'text-stone-500'} />
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wider font-semibold mb-0.5 ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>Email</p>
                      <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-800'}`}>{user.email}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${darkMode ? 'bg-white/5' : 'bg-stone-100'}`}>
                      <User size={18} className={darkMode ? 'text-gray-400' : 'text-stone-500'} />
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wider font-semibold mb-0.5 ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>Username</p>
                      <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-800'}`}>{user.username}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Streak Calendar */}
            <div className={`rounded-2xl ${darkMode ? 'bg-[#0a0a0a] border border-white/10' : 'bg-white border border-stone-200'}`}>
              <div className={`p-6 border-b ${darkMode ? 'border-white/10' : 'border-stone-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-stone-900'}`}>Reading Streak</h3>
                    <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>Track your daily reading activity</p>
                  </div>
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${darkMode ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-50 border border-orange-200'}`}>
                    <span className="text-lg">🔥</span>
                    <span className={`text-2xl font-bold ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>{streak}</span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                      {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <div className={`flex items-center gap-4 text-xs ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${darkMode ? 'bg-orange-500' : 'bg-orange-500'}`} />
                      <span>Read</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${darkMode ? 'bg-white/10' : 'bg-stone-200'}`} />
                      <span>Not Read</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className={`text-center text-xs font-semibold py-2 ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>
                      {day}
                    </div>
                  ))}
                  {(() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    const startDay = firstDay.getDay();
                    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                    
                    const calendarDays = [];
                    
                    // Empty cells for days before the first day of the month
                    for (let i = 0; i < startDay; i++) {
                      calendarDays.push(<div key={`empty-${i}`} className="aspect-square" />);
                    }
                    
                    // Days of the month
                    for (let day = 1; day <= daysInMonth; day++) {
                      const date = new Date(now.getFullYear(), now.getMonth(), day);
                      const dateStr = date.toISOString().split('T')[0];
                      const hasRead = readingDays.includes(dateStr);
                      const isToday = day === now.getDate();
                      
                      calendarDays.push(
                        <div
                          key={day}
                          className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all cursor-default hover:scale-105 ${
                            hasRead
                              ? darkMode
                              ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25'
                              : 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25'
                              : darkMode
                              ? 'bg-white/5 text-gray-400 hover:bg-white/10'
                              : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                          } ${isToday ? 'ring-2 ring-orange-500 ring-offset-2' : ''}`}
                        >
                          {day}
                        </div>
                      );
                    }
                    
                    return calendarDays;
                  })()}
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all ${darkMode ? 'bg-red-600/10 text-red-400 border border-red-600/20 hover:bg-red-600/20' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}
            >
              <LogOut size={18} />
              Logout
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;