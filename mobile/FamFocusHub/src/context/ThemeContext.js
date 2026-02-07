import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Pre-defined theme presets
const THEME_PRESETS = {
  violet: {
    name: 'Violet',
    primary: '#6366f1',
    accent: '#a5b4fc',
    background: '#0f0d1a',
    surface: '#1e1b4b',
  },
  ocean: {
    name: 'Ocean',
    primary: '#06b6d4',
    accent: '#67e8f9',
    background: '#0c1929',
    surface: '#164e63',
  },
  rose: {
    name: 'Rose',
    primary: '#ec4899',
    accent: '#f9a8d4',
    background: '#1a0d14',
    surface: '#4a1d3a',
  },
  emerald: {
    name: 'Emerald',
    primary: '#10b981',
    accent: '#6ee7b7',
    background: '#0d1a14',
    surface: '#1d4a3a',
  },
  amber: {
    name: 'Amber',
    primary: '#f59e0b',
    accent: '#fcd34d',
    background: '#1a150d',
    surface: '#4a3a1d',
  },
  coral: {
    name: 'Coral',
    primary: '#f43f5e',
    accent: '#fda4af',
    background: '#1a0d10',
    surface: '#4a1d25',
  },
};

// Base colors that don't change
const BASE_COLORS = {
  text: '#ffffff',
  textSecondary: '#9ca3af',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  secondary: '#818cf8',
};

const STORAGE_KEY = 'famfocus_theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [selectedPreset, setSelectedPreset] = useState('violet');
  const [customPrimary, setCustomPrimary] = useState(null);
  const [customAccent, setCustomAccent] = useState(null);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load theme on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setSelectedPreset(data.preset || 'violet');
        setIsCustomMode(data.isCustomMode || false);
        setCustomPrimary(data.customPrimary || null);
        setCustomAccent(data.customAccent || null);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTheme = async (data) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  // Select a preset theme
  const selectPreset = (presetKey) => {
    setSelectedPreset(presetKey);
    setIsCustomMode(false);
    setCustomPrimary(null);
    setCustomAccent(null);
    saveTheme({ preset: presetKey, isCustomMode: false });
  };

  // Enable custom mode with current preset as base
  const enableCustomMode = () => {
    const preset = THEME_PRESETS[selectedPreset];
    setIsCustomMode(true);
    setCustomPrimary(preset.primary);
    setCustomAccent(preset.accent);
    saveTheme({
      preset: selectedPreset,
      isCustomMode: true,
      customPrimary: preset.primary,
      customAccent: preset.accent,
    });
  };

  // Update custom primary color
  const setPrimaryColor = (color) => {
    if (!isCustomMode) return;
    setCustomPrimary(color);
    saveTheme({
      preset: selectedPreset,
      isCustomMode: true,
      customPrimary: color,
      customAccent: customAccent,
    });
  };

  // Update custom accent color
  const setAccentColor = (color) => {
    if (!isCustomMode) return;
    setCustomAccent(color);
    saveTheme({
      preset: selectedPreset,
      isCustomMode: true,
      customPrimary: customPrimary,
      customAccent: color,
    });
  };

  // Get current theme colors
  const getTheme = () => {
    const preset = THEME_PRESETS[selectedPreset] || THEME_PRESETS.violet;
    
    return {
      ...BASE_COLORS,
      primary: isCustomMode && customPrimary ? customPrimary : preset.primary,
      accent: isCustomMode && customAccent ? customAccent : preset.accent,
      background: preset.background,
      surface: preset.surface,
      gradientStart: preset.surface,
      gradientEnd: preset.background,
    };
  };

  const theme = getTheme();

  // Available colors for custom picker
  const availablePrimaryColors = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  ];

  const availableAccentColors = [
    '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc', '#f9a8d4', '#fda4af',
    '#fca5a5', '#fdba74', '#fcd34d', '#fde047', '#bef264', '#86efac',
    '#6ee7b7', '#5eead4', '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc',
  ];

  const value = {
    // Current theme colors (spread for easy access)
    ...theme,
    
    // Theme state
    selectedPreset,
    isCustomMode,
    loading,
    
    // Preset management
    presets: THEME_PRESETS,
    selectPreset,
    
    // Custom mode
    enableCustomMode,
    disableCustomMode: () => selectPreset(selectedPreset),
    setPrimaryColor,
    setAccentColor,
    
    // Available colors for pickers
    availablePrimaryColors,
    availableAccentColors,
    
    // Utility for button styles
    getButtonStyle: (variant = 'primary') => ({
      backgroundColor: variant === 'primary' ? theme.primary :
                       variant === 'accent' ? theme.accent :
                       variant === 'success' ? theme.success :
                       variant === 'error' ? theme.error :
                       theme.primary
    }),
    
    getCardStyle: () => ({
      backgroundColor: `${theme.surface}ee`,
      borderColor: `${theme.primary}33`,
    }),
  };

  if (loading) {
    return null;
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
    // Return default theme if context not available
    return {
      primary: '#6366f1',
      accent: '#a5b4fc',
      background: '#0f0d1a',
      surface: '#1e1b4b',
      text: '#ffffff',
      textSecondary: '#9ca3af',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      secondary: '#818cf8',
    };
  }
  return context;
}

export default ThemeContext;
