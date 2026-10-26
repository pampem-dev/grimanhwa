import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const Footer = ({ userCount }) => {
  const currentYear = new Date().getFullYear();
  const { darkMode } = useTheme();

  return (
    <footer className={`border-t ${darkMode ? 'bg-[#0a0a0a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className={`text-center text-xs ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
            <span>© {new Date().getFullYear()} grimanhwa</span>
            {userCount !== null && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span>{userCount} {userCount === 1 ? 'user' : 'users'}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
