// Date and Time Utilities for FamFocus Hub Mobile App

/**
 * Safely format a date string - handles invalid dates gracefully
 */
export const formatDate = (dateInput, options = {}) => {
  if (!dateInput) return '';
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    const defaultOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...options
    };
    
    return date.toLocaleDateString('en-US', defaultOptions);
  } catch (error) {
    console.warn('Date format error:', error);
    return '';
  }
};

/**
 * Format time from date string
 */
export const formatTime = (dateInput, options = {}) => {
  if (!dateInput) return '';
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    const defaultOptions = {
      hour: '2-digit',
      minute: '2-digit',
      ...options
    };
    
    return date.toLocaleTimeString('en-US', defaultOptions);
  } catch (error) {
    console.warn('Time format error:', error);
    return '';
  }
};

/**
 * Format date and time together
 */
export const formatDateTime = (dateInput) => {
  if (!dateInput) return '';
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    return `${formatDate(dateInput)} at ${formatTime(dateInput)}`;
  } catch (error) {
    return '';
  }
};

/**
 * Get relative time string (e.g., "2 hours ago", "just now")
 */
export const getRelativeTime = (dateInput) => {
  if (!dateInput) return '';
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    
    return formatDate(dateInput, { month: 'short', day: 'numeric' });
  } catch (error) {
    return '';
  }
};

/**
 * Format duration in seconds to readable string
 */
export const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Check if date is today
 */
export const isToday = (dateInput) => {
  if (!dateInput) return false;
  
  try {
    const date = new Date(dateInput);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  } catch {
    return false;
  }
};

/**
 * Check if date is in the past
 */
export const isPast = (dateInput) => {
  if (!dateInput) return false;
  
  try {
    const date = new Date(dateInput);
    return date < new Date();
  } catch {
    return false;
  }
};

/**
 * Get day of week name
 */
export const getDayName = (dateInput, short = false) => {
  if (!dateInput) return '';
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleDateString('en-US', { weekday: short ? 'short' : 'long' });
  } catch {
    return '';
  }
};

export default {
  formatDate,
  formatTime,
  formatDateTime,
  getRelativeTime,
  formatDuration,
  isToday,
  isPast,
  getDayName,
};
