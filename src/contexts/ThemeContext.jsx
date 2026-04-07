import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(true);

  // Load theme from localStorage
  useEffect(() => {
    const savedSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    if (savedSettings.darkMode !== undefined) {
      setDarkMode(savedSettings.darkMode);
    }
  }, []);

  // Apply theme to document root
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.remove('light');
      document.body.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.body.classList.add('light');
    }
  }, [darkMode]);

  // Save theme to localStorage
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    // Update localStorage settings
    const savedSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const updatedSettings = { ...savedSettings, darkMode: newDarkMode };
    localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
