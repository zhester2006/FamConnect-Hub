// ErrorHandler.js - Centralized error handling for native module issues
// Handles crypto module errors, SQLite errors, and other device-level issues

import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ErrorHandler {
  constructor() {
    this.errorCounts = {};
    this.maxRetries = 3;
    this.hasShownStorageWarning = false;
  }

  // Handle crypto module errors
  handleCryptoError(error) {
    console.warn('Crypto module error:', error);
    
    // Crypto errors are usually non-fatal - app can continue
    // These occur when expo-crypto can't access native crypto
    // The app should use fallback methods where possible
    
    return {
      handled: true,
      fallbackAvailable: true,
      message: 'Using fallback encryption method',
    };
  }

  // Handle SQLite/storage full errors
  handleStorageError(error) {
    const errorString = error?.message || error?.toString() || '';
    
    if (errorString.includes('SQLITE_FULL') || errorString.includes('disk is full')) {
      console.error('Storage full error:', error);
      
      // Only show warning once per session
      if (!this.hasShownStorageWarning) {
        this.hasShownStorageWarning = true;
        
        // Try to free up space
        this.attemptStorageCleanup().then(freed => {
          if (!freed) {
            Alert.alert(
              'Storage Full',
              'Your device storage is running low. Some features may not work correctly.\n\nTry clearing some space on your device.',
              [
                { text: 'OK', style: 'default' },
                { 
                  text: 'Clear Cache', 
                  onPress: () => this.clearAppCache(),
                  style: 'destructive'
                },
              ]
            );
          }
        });
      }
      
      return {
        handled: true,
        isFatal: false,
        shouldRetry: false,
        message: 'Storage space is low',
      };
    }
    
    return {
      handled: false,
      isFatal: false,
    };
  }

  // Attempt to clean up storage
  async attemptStorageCleanup() {
    try {
      // Get all AsyncStorage keys
      const keys = await AsyncStorage.getAllKeys();
      
      // Identify cache keys that can be safely cleared
      const cacheKeys = keys.filter(key => 
        key.includes('_cache') || 
        key.includes('_temp') ||
        key.includes('offline_')
      );
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`Cleared ${cacheKeys.length} cached items`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Storage cleanup failed:', error);
      return false;
    }
  }

  // Clear all app cache
  async clearAppCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      
      // Keep essential keys
      const essentialKeys = [
        '@user_session',
        '@firebase_session',
        '@auth_token',
        'userId',
        'themeMode',
        'familyTheme',
      ];
      
      const keysToRemove = keys.filter(key => 
        !essentialKeys.some(essential => key.includes(essential))
      );
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        Alert.alert('Cache Cleared', 'App cache has been cleared. Some data may need to reload.');
      }
      
      return true;
    } catch (error) {
      console.error('Cache clear failed:', error);
      Alert.alert('Error', 'Failed to clear cache. Please try again later.');
      return false;
    }
  }

  // Handle general native module errors
  handleNativeModuleError(moduleName, error) {
    const errorKey = `${moduleName}_error`;
    
    this.errorCounts[errorKey] = (this.errorCounts[errorKey] || 0) + 1;
    
    console.warn(`Native module error (${moduleName}):`, error);
    
    // Only show alert if error persists
    if (this.errorCounts[errorKey] >= this.maxRetries) {
      return {
        handled: true,
        isFatal: false,
        message: `Some features may be limited. The ${moduleName} module encountered an issue.`,
        showAlert: true,
      };
    }
    
    return {
      handled: true,
      isFatal: false,
      shouldRetry: true,
    };
  }

  // Handle network errors
  handleNetworkError(error) {
    const errorString = error?.message || error?.toString() || '';
    
    if (errorString.includes('Network request failed') || 
        errorString.includes('timeout') ||
        errorString.includes('ECONNREFUSED')) {
      return {
        handled: true,
        isFatal: false,
        isOffline: true,
        message: 'Unable to connect. Working in offline mode.',
      };
    }
    
    return { handled: false };
  }

  // Main error handler - dispatch to appropriate handler
  handle(error, context = {}) {
    const errorString = error?.message || error?.toString() || '';
    
    // Check for specific error types
    if (errorString.includes('crypto') || errorString.includes('Crypto')) {
      return this.handleCryptoError(error);
    }
    
    if (errorString.includes('SQLITE') || errorString.includes('disk is full') || errorString.includes('database')) {
      return this.handleStorageError(error);
    }
    
    if (errorString.includes('Network') || errorString.includes('timeout') || errorString.includes('fetch')) {
      return this.handleNetworkError(error);
    }
    
    if (context.moduleName) {
      return this.handleNativeModuleError(context.moduleName, error);
    }
    
    // Default handling
    console.error('Unhandled error:', error);
    return {
      handled: false,
      isFatal: false,
    };
  }

  // Get storage usage stats
  async getStorageStats() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const data = await AsyncStorage.multiGet(keys);
      
      let totalSize = 0;
      const itemSizes = {};
      
      data.forEach(([key, value]) => {
        const size = value ? value.length * 2 : 0; // Approximate bytes (UTF-16)
        totalSize += size;
        itemSizes[key] = size;
      });
      
      return {
        totalItems: keys.length,
        totalSizeBytes: totalSize,
        totalSizeKB: Math.round(totalSize / 1024),
        itemSizes,
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return null;
    }
  }

  // Reset error counts (call on app restart or successful operation)
  resetErrorCounts() {
    this.errorCounts = {};
    this.hasShownStorageWarning = false;
  }
}

const errorHandler = new ErrorHandler();
export default errorHandler;
