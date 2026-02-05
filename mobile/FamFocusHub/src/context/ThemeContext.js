import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme, Appearance } from 'react-native';

// Light theme colors
const LIGHT_THEME = {
  mode: 'light',
  primary: '#6366f1',
  secondary: '#818cf8',
  accent: '#a5b4fc',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  gradientStart: '#f1f5f9',
  gradientEnd: '#e2e8f0',
};

// Dark theme colors (default)
const DARK_THEME = {
  mode: 'dark',
  primary: '#6366f1',
  secondary: '#818cf8',
  accent: '#a5b4fc',
  background: '#0f0d1a',
  surface: '#1e1b4b',
  text: '#ffffff',
  textSecondary: '#9ca3af',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  gradientStart: '#1e1b4b',
  gradientEnd: '#0f0d1a',
};

// Default theme - Standard violet/purple palette
const DEFAULT_THEME = DARK_THEME;

// Standard theme (non-editable baseline)
const STANDARD_THEME = { ...DEFAULT_THEME, mode: 'standard' };

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [autoMode, setAutoMode] = useState(false); // Auto dark/light mode
  const [loading, setLoading] = useState(true);

  // Listen for system color scheme changes
  useEffect(() => {
    let subscription = null;
    try {
      subscription = Appearance.addChangeListener(({ colorScheme }) => {
        if (autoMode) {
          applyAutoTheme(colorScheme);
        }
      });
    } catch (error) {
      console.warn('Appearance listener not available:', error);
    }

    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, [autoMode]);

  // Apply theme based on system preference
  const applyAutoTheme = (colorScheme) => {
    try {
      if (colorScheme === 'dark') {
        setTheme(prev => ({ ...prev, ...DARK_THEME, mode: prev.mode }));
      } else {
        setTheme(prev => ({ ...prev, ...LIGHT_THEME, mode: prev.mode }));
      }
    } catch (error) {
      console.warn('Failed to apply auto theme:', error);
    }
  };

  // Load saved theme on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('familyTheme');
      const savedMode = await AsyncStorage.getItem('themeMode');
      const savedAutoMode = await AsyncStorage.getItem('autoThemeMode');
      
      // Check if auto mode is enabled
      if (savedAutoMode === 'true') {
        setAutoMode(true);
        let currentScheme = 'dark'; // Default to dark
        try {
          currentScheme = Appearance.getColorScheme() || 'dark';
        } catch (e) {
          console.warn('Could not get color scheme:', e);
        }
        const baseTheme = currentScheme === 'light' ? LIGHT_THEME : DARK_THEME;
        setTheme({ ...baseTheme, mode: 'auto' });
        setIsCustomMode(false);
      } else if (savedMode === 'custom' && savedTheme) {
        const parsed = JSON.parse(savedTheme);
        setTheme({ ...DEFAULT_THEME, ...parsed, mode: 'custom' });
        setIsCustomMode(true);
      } else {
        setTheme(STANDARD_THEME);
        setIsCustomMode(false);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
      setTheme(STANDARD_THEME);
    } finally {
      setLoading(false);
    }
  };

  // Save theme changes
  const saveTheme = async (newTheme) => {
    try {
      await AsyncStorage.setItem('familyTheme', JSON.stringify(newTheme));
      await AsyncStorage.setItem('themeMode', newTheme.mode || 'custom');
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  // Toggle auto dark/light mode
  const toggleAutoMode = async (enabled) => {
    setAutoMode(enabled);
    await AsyncStorage.setItem('autoThemeMode', enabled ? 'true' : 'false');
    
    if (enabled) {
      setIsCustomMode(false);
      const currentScheme = Appearance.getColorScheme();
      const baseTheme = currentScheme === 'light' ? LIGHT_THEME : DARK_THEME;
      setTheme({ ...baseTheme, mode: 'auto' });
    }
  };

  // Update a single color
  const updateColor = (colorKey, value) => {
    console.log('updateColor called:', colorKey, value, 'isCustomMode:', isCustomMode);
    if (!isCustomMode) {
      console.log('Cannot update color in standard mode');
      return;
    }
    
    const newTheme = { ...theme, [colorKey]: value, mode: 'custom' };
    setTheme(newTheme);
    saveTheme(newTheme);
    console.log('Theme updated:', newTheme);
  };

  // Update multiple colors at once
  const updateColors = (colors) => {
    if (!isCustomMode) return;
    
    const newTheme = { ...theme, ...colors, mode: 'custom' };
    setTheme(newTheme);
    saveTheme(newTheme);
  };

  // Switch to custom mode
  const enableCustomMode = () => {
    console.log('enableCustomMode called');
    setIsCustomMode(true);
    const customTheme = { ...theme, mode: 'custom' };
    setTheme(customTheme);
    saveTheme(customTheme);
    console.log('Custom mode enabled, theme:', customTheme);
  };

  // Switch to standard mode
  const enableStandardMode = () => {
    console.log('enableStandardMode called');
    setIsCustomMode(false);
    setTheme(STANDARD_THEME);
    AsyncStorage.setItem('themeMode', 'standard');
    console.log('Standard mode enabled');
  };

  // Reset to default colors (only in custom mode)
  const resetToDefault = () => {
    if (isCustomMode) {
      const resetTheme = { ...DEFAULT_THEME, mode: 'custom' };
      setTheme(resetTheme);
      saveTheme(resetTheme);
    }
  };

  // Get computed styles for common elements
  const getButtonStyle = (variant = 'primary') => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: theme.primary };
      case 'secondary':
        return { backgroundColor: theme.secondary };
      case 'success':
        return { backgroundColor: theme.success };
      case 'warning':
        return { backgroundColor: theme.warning };
      case 'error':
        return { backgroundColor: theme.error };
      case 'outline':
        return { borderColor: theme.primary, borderWidth: 1, backgroundColor: 'transparent' };
      default:
        return { backgroundColor: theme.primary };
    }
  };

  const getCardStyle = () => ({
    backgroundColor: `${theme.surface}99`, // with transparency
    borderColor: `${theme.primary}33`,
  });

  const value = {
    // Current theme colors
    ...theme,
    
    // Theme state
    isCustomMode,
    loading,
    autoMode,
    isDarkMode: theme.mode === 'dark' || (autoMode && Appearance.getColorScheme() === 'dark'),
    
    // Actions
    updateColor,
    updateColors,
    enableCustomMode,
    enableStandardMode,
    resetToDefault,
    toggleAutoMode,
    
    // Utility functions
    getButtonStyle,
    getCardStyle,
    
    // Constants for pickers
    availableColors: {
      primary: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'],
      accent: ['#a5b4fc', '#c4b5fd', '#f9a8d4', '#fca5a5', '#fdba74', '#fde047', '#86efac', '#5eead4', '#7dd3fc'],
    },
  };

  if (loading) {
    return null; // Or a loading spinner
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    console.warn('useTheme must be used within a ThemeProvider');
    return DEFAULT_THEME;
  }
  return context;
}

export default ThemeContext;
