import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'famfocus_theme';
const THEME_MODE_KEY = 'famfocus_theme_mode';

export const THEMES = {
  cosmic_explorer: {
    id: 'cosmic_explorer',
    name: 'Cosmic Explorer',
    colors: ['#1e1b4b', '#312e81', '#4c1d95'],
    primary: '#6366f1',
    secondary: '#818cf8',
    accent: '#a855f7',
  },
  ocean_breeze: {
    id: 'ocean_breeze',
    name: 'Ocean Breeze',
    colors: ['#164e63', '#0e7490', '#06b6d4'],
    primary: '#06b6d4',
    secondary: '#22d3ee',
    accent: '#67e8f9',
  },
  forest_haven: {
    id: 'forest_haven',
    name: 'Forest Haven',
    colors: ['#14532d', '#166534', '#22c55e'],
    primary: '#22c55e',
    secondary: '#4ade80',
    accent: '#86efac',
  },
  sunset_glow: {
    id: 'sunset_glow',
    name: 'Sunset Glow',
    colors: ['#7c2d12', '#c2410c', '#f97316'],
    primary: '#f97316',
    secondary: '#fb923c',
    accent: '#fdba74',
  },
  cherry_blossom: {
    id: 'cherry_blossom',
    name: 'Cherry Blossom',
    colors: ['#831843', '#be185d', '#ec4899'],
    primary: '#ec4899',
    secondary: '#f472b6',
    accent: '#f9a8d4',
  },
  midnight_sky: {
    id: 'midnight_sky',
    name: 'Midnight Sky',
    colors: ['#0f172a', '#1e293b', '#334155'],
    primary: '#64748b',
    secondary: '#94a3b8',
    accent: '#cbd5e1',
  },
};

export const THEME_MODES = {
  dark: {
    id: 'dark',
    name: 'Dark Mode',
    icon: 'moon',
    background: '#0f0d1a',
    surface: 'rgba(30, 27, 75, 0.8)',
    text: '#ffffff',
    textSecondary: '#a5b4fc',
    textMuted: '#6b7280',
  },
  light: {
    id: 'light',
    name: 'Light Mode',
    icon: 'sunny',
    background: '#f8fafc',
    surface: 'rgba(255, 255, 255, 0.95)',
    text: '#1e293b',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    icon: 'color-palette',
    background: '#0f0d1a',
    surface: 'rgba(30, 27, 75, 0.8)',
    text: '#ffffff',
    textSecondary: '#a5b4fc',
    textMuted: '#6b7280',
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(THEMES.cosmic_explorer);
  const [themeMode, setThemeMode] = useState(THEME_MODES.dark);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const [savedTheme, savedMode] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(THEME_MODE_KEY),
      ]);
      
      if (savedTheme && THEMES[savedTheme]) {
        setCurrentTheme(THEMES[savedTheme]);
      }
      if (savedMode && THEME_MODES[savedMode]) {
        setThemeMode(THEME_MODES[savedMode]);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const changeTheme = async (themeId) => {
    if (THEMES[themeId]) {
      setCurrentTheme(THEMES[themeId]);
      try {
        await AsyncStorage.setItem(THEME_KEY, themeId);
      } catch (error) {
        console.error('Failed to save theme:', error);
      }
    }
  };

  const changeThemeMode = async (modeId) => {
    if (THEME_MODES[modeId]) {
      setThemeMode(THEME_MODES[modeId]);
      try {
        await AsyncStorage.setItem(THEME_MODE_KEY, modeId);
      } catch (error) {
        console.error('Failed to save theme mode:', error);
      }
    }
  };

  const value = {
    currentTheme,
    themeMode,
    themes: THEMES,
    themeModes: THEME_MODES,
    changeTheme,
    changeThemeMode,
    isLoading,
    // Convenience getters
    colors: currentTheme.colors,
    primary: currentTheme.primary,
    secondary: currentTheme.secondary,
    accent: currentTheme.accent,
    background: themeMode.background,
    surface: themeMode.surface,
    text: themeMode.text,
    textSecondary: themeMode.textSecondary,
    textMuted: themeMode.textMuted,
    isDark: themeMode.id !== 'light',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
