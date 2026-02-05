// Offline-First Cache Service for React Native
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_PREFIX = '@famfocus_cache_';
const QUEUE_KEY = '@famfocus_action_queue';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

class OfflineCacheService {
  constructor() {
    this.isOnline = true;
    this.listeners = [];
    this.actionQueue = [];
    this.initNetworkListener();
    this.loadActionQueue();
  }

  // Initialize network state listener
  initNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;
      
      // Notify listeners of connectivity change
      this.listeners.forEach(listener => listener(this.isOnline));
      
      // Process queued actions when coming back online
      if (wasOffline && this.isOnline) {
        this.processQueue();
      }
    });
  }

  // Subscribe to connectivity changes
  onConnectivityChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  // Get current online status
  getOnlineStatus() {
    return this.isOnline;
  }

  // Cache data with key
  async cacheData(key, data) {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRY,
      };
      await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheItem));
      return true;
    } catch (error) {
      console.error('Failed to cache data:', error);
      return false;
    }
  }

  // Get cached data
  async getCachedData(key, ignoreExpiry = false) {
    try {
      const cached = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return null;

      const cacheItem = JSON.parse(cached);
      
      // Check if expired
      if (!ignoreExpiry && Date.now() > cacheItem.expiresAt) {
        await this.clearCache(key);
        return null;
      }
      
      return cacheItem.data;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  // Clear specific cache
  async clearCache(key) {
    try {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  // Clear all cache
  async clearAllCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Failed to clear all cache:', error);
    }
  }

  // Queue action for later execution (when offline)
  async queueAction(action) {
    this.actionQueue.push({
      id: Date.now().toString(),
      action,
      timestamp: Date.now(),
      retries: 0,
    });
    await this.saveActionQueue();
    return true;
  }

  // Load action queue from storage
  async loadActionQueue() {
    try {
      const queue = await AsyncStorage.getItem(QUEUE_KEY);
      this.actionQueue = queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Failed to load action queue:', error);
      this.actionQueue = [];
    }
  }

  // Save action queue to storage
  async saveActionQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.actionQueue));
    } catch (error) {
      console.error('Failed to save action queue:', error);
    }
  }

  // Process queued actions when back online
  async processQueue() {
    if (this.actionQueue.length === 0) return;
    
    console.log(`Processing ${this.actionQueue.length} queued actions...`);
    
    const processedIds = [];
    
    for (const item of this.actionQueue) {
      try {
        const { action } = item;
        
        // Execute the action based on type
        if (action.type === 'API_CALL') {
          const response = await fetch(action.url, {
            method: action.method,
            headers: action.headers,
            body: action.body,
            credentials: 'include',
          });
          
          if (response.ok) {
            processedIds.push(item.id);
            console.log(`Processed queued action: ${action.type}`);
          } else if (item.retries < 3) {
            item.retries++;
          } else {
            processedIds.push(item.id); // Give up after 3 retries
          }
        }
      } catch (error) {
        console.error('Failed to process queued action:', error);
        if (item.retries < 3) {
          item.retries++;
        } else {
          processedIds.push(item.id);
        }
      }
    }
    
    // Remove processed items
    this.actionQueue = this.actionQueue.filter(item => !processedIds.includes(item.id));
    await this.saveActionQueue();
  }

  // Get queue status
  getQueueStatus() {
    return {
      count: this.actionQueue.length,
      items: this.actionQueue.map(item => ({
        id: item.id,
        type: item.action.type,
        timestamp: item.timestamp,
        retries: item.retries,
      })),
    };
  }

  // Fetch with cache - tries cache first when offline
  async fetchWithCache(url, options = {}, cacheKey) {
    const key = cacheKey || url;
    
    // If online, try to fetch fresh data
    if (this.isOnline) {
      try {
        const response = await fetch(url, {
          ...options,
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          await this.cacheData(key, data);
          return { data, fromCache: false };
        }
      } catch (error) {
        console.warn('Fetch failed, falling back to cache:', error);
      }
    }
    
    // Fall back to cache
    const cachedData = await this.getCachedData(key, true); // Ignore expiry when offline
    if (cachedData) {
      return { data: cachedData, fromCache: true };
    }
    
    throw new Error('No data available - offline with no cache');
  }

  // Create queued API call action
  createApiAction(url, method, body, headers = {}) {
    return {
      type: 'API_CALL',
      url,
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
  }
}

export const offlineCache = new OfflineCacheService();
export default offlineCache;
