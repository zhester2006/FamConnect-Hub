import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_PREFIX = 'famfocus_cache_';
const PENDING_ACTIONS_KEY = 'famfocus_pending_actions';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

class OfflineService {
  constructor() {
    this.isOnline = true;
    this.syncInProgress = false;
    this.listeners = [];
  }

  // Initialize network monitoring
  async init() {
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected && state.isInternetReachable;
    
    // Subscribe to network changes
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;
      
      // Notify listeners
      this.listeners.forEach(listener => listener(this.isOnline));
      
      // If we came back online, sync pending actions
      if (wasOffline && this.isOnline) {
        this.syncPendingActions();
      }
    });
  }

  addNetworkListener(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Cache data locally
  async cacheData(key, data) {
    try {
      const cacheEntry = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + CACHE_EXPIRY,
      };
      await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheEntry));
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  // Get cached data
  async getCachedData(key) {
    try {
      const cached = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return null;
      
      const cacheEntry = JSON.parse(cached);
      
      // Check if expired
      if (Date.now() > cacheEntry.expiry) {
        await AsyncStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      
      return cacheEntry.data;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  // Check if data is cached and fresh
  async hasFreshCache(key) {
    try {
      const cached = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return false;
      
      const cacheEntry = JSON.parse(cached);
      return Date.now() < cacheEntry.expiry;
    } catch (error) {
      return false;
    }
  }

  // Queue an action for later sync
  async queueAction(action) {
    try {
      const pendingStr = await AsyncStorage.getItem(PENDING_ACTIONS_KEY);
      const pending = pendingStr ? JSON.parse(pendingStr) : [];
      
      pending.push({
        ...action,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        queuedAt: Date.now(),
      });
      
      await AsyncStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(pending));
    } catch (error) {
      console.error('Failed to queue action:', error);
    }
  }

  // Get pending actions
  async getPendingActions() {
    try {
      const pendingStr = await AsyncStorage.getItem(PENDING_ACTIONS_KEY);
      return pendingStr ? JSON.parse(pendingStr) : [];
    } catch (error) {
      return [];
    }
  }

  // Remove a pending action
  async removePendingAction(actionId) {
    try {
      const pendingStr = await AsyncStorage.getItem(PENDING_ACTIONS_KEY);
      const pending = pendingStr ? JSON.parse(pendingStr) : [];
      const filtered = pending.filter(a => a.id !== actionId);
      await AsyncStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove pending action:', error);
    }
  }

  // Sync all pending actions with backend
  async syncPendingActions() {
    if (this.syncInProgress || !this.isOnline) return;
    
    this.syncInProgress = true;
    const apiService = require('./api.service').default;
    
    try {
      const pending = await this.getPendingActions();
      
      for (const action of pending) {
        try {
          switch (action.type) {
            case 'COMPLETE_CHORE':
              await apiService.completeChore(action.choreId);
              break;
            case 'COMPLETE_TASK':
              await apiService.completeTask(action.taskId);
              break;
            case 'SEND_MESSAGE':
              await apiService.sendMessage(action.content);
              break;
            case 'CREATE_POST':
              await apiService.createPost(action.content, action.postType);
              break;
            case 'ADD_SHOPPING_ITEM':
              await apiService.addShoppingItem(action.item);
              break;
            default:
              console.log('Unknown action type:', action.type);
          }
          
          // Remove successfully synced action
          await this.removePendingAction(action.id);
        } catch (error) {
          console.error('Failed to sync action:', action, error);
          // Keep action in queue for retry
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  // Clear all cached data
  async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  // Get cache size (approximate)
  async getCacheSize() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      let totalSize = 0;
      
      for (const key of cacheKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }
}

export const offlineService = new OfflineService();
export default offlineService;
