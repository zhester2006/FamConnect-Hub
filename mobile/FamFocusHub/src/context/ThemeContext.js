import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@famfocus_theme';
const THEME_MODE_KEY = '@famfocus_theme_mode';

// Available color themes
export const THEMES = {
  purple: {
    id: 'purple',
    name: 'Purple Dream',
    primary: '#6366f1',
    secondary: '#818cf8',
    accent: '#a5b4fc',
    colors: ['#1e1b4b', '#312e81', '#4f46e5'],
  },
  green: {
    id: 'green',
    name: 'Forest',
    primary: '#22c55e',
    secondary: '#4ade80',
    accent: '#86efac',
    colors: ['#064e3b', '#065f46', '#059669'],
  },
  blue: {
    id: 'blue',
    name: 'Ocean',
    primary: '#3b82f6',
    secondary: '#60a5fa',
    accent: '#93c5fd',
    colors: ['#1e3a8a', '#1d4ed8', '#2563eb'],
  },
  pink: {
    id: 'pink',
    name: 'Sunset',
    primary: '#ec4899',
    secondary: '#f472b6',
    accent: '#f9a8d4',
    colors: ['#831843', '#be185d', '#db2777'],
  },
  teal: {
    id: 'teal',
    name: 'Aqua',
    primary: '#14b8a6',
    secondary: '#2dd4bf',
    accent: '#5eead4',
    colors: ['#134e4a', '#115e59', '#0f766e'],
  },
  orange: {
    id: 'orange',
    name: 'Amber',
    primary: '#f59e0b',
    secondary: '#fbbf24',
    accent: '#fcd34d',
    colors: ['#78350f', '#92400e', '#b45309'],
  },
};

// Theme modes: Standard (default dark) vs Custom (user-selected)
export const THEME_MODES = {
  standard: {
    id: 'standard',
    name: 'Standard',
    icon: 'contrast',
    // Default dark colors
    background: '#0f0d1a',
    surface: 'rgba(30, 27, 75, 0.8)',
    text: '#ffffff',
    textSecondary: '#a5b4fc',
    textMuted: '#6b7280',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    icon: 'color-palette',
    // Custom applies the selected theme colors
    background: '#0f0d1a',
    surface: 'rgba(30, 27, 75, 0.8)',
    text: '#ffffff',
    textSecondary: '#a5b4fc',
    textMuted: '#6b7280',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(THEMES.purple);
  const [themeMode, setThemeMode] = useState(THEME_MODES.standard);
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
      // Automatically switch to custom mode when selecting a theme
      if (themeMode.id === 'standard') {
        setThemeMode(THEME_MODES.custom);
        await AsyncStorage.setItem(THEME_MODE_KEY, 'custom');
      }
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

  // Calculate active colors based on mode
  const getActiveColors = () => {
    if (themeMode.id === 'custom') {
      return {
        primary: currentTheme.primary,
        secondary: currentTheme.secondary,
        accent: currentTheme.accent,
        gradientColors: currentTheme.colors,
      };
    }
    // Standard mode uses default purple
    return {
      primary: THEMES.purple.primary,
      secondary: THEMES.purple.secondary,
      accent: THEMES.purple.accent,
      gradientColors: THEMES.purple.colors,
    };
  };

  const activeColors = getActiveColors();

  const value = {
    currentTheme,
    themeMode,
    themes: THEMES,
    themeModes: THEME_MODES,
    changeTheme,
    changeThemeMode,
    isLoading,
    // Active colors (respects mode)
    primary: activeColors.primary,
    secondary: activeColors.secondary,
    accent: activeColors.accent,
    gradientColors: activeColors.gradientColors,
    // Mode-based colors
    background: themeMode.background,
    surface: themeMode.surface,
    text: themeMode.text,
    textSecondary: themeMode.textSecondary,
    textMuted: themeMode.textMuted,
    // Legacy support
    colors: currentTheme.colors,
    isDark: true,
    isCustomMode: themeMode.id === 'custom',
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
