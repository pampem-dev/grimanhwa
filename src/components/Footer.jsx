import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { darkMode } = useTheme();

  return (
    <footer className={`border-t ${darkMode ? 'bg-[#0a0a0a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className={`text-center text-xs ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
          © {new Date().getFullYear()} grimanhwa
        </div>
      </div>
    </footer>
  );
};

export default Footer;
