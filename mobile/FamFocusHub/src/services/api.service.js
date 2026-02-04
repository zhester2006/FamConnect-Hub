import * as SecureStore from 'expo-secure-store';
import API_BASE_URL, { API_ENDPOINTS } from './api.config';
import offlineService from './offline.service';

const SESSION_KEY = 'famfocus_session_token';

class ApiService {
  constructor() {
    this.sessionToken = null;
  }

  async init() {
    try {
      this.sessionToken = await SecureStore.getItemAsync(SESSION_KEY);
      await offlineService.init();
    } catch (error) {
      console.error('Failed to init API service:', error);
    }
  }

  async setSession(token) {
    this.sessionToken = token;
    await SecureStore.setItemAsync(SESSION_KEY, token);
  }

  async clearSession() {
    this.sessionToken = null;
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.sessionToken) {
      headers['Cookie'] = `session_token=${this.sessionToken}`;
    }
    return headers;
  }

  async request(endpoint, options = {}, cacheKey = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
      credentials: 'include',
    };

    // For GET requests, try cache first if offline
    if (options.method === 'GET' || !options.method) {
      if (!offlineService.isOnline && cacheKey) {
        const cached = await offlineService.getCachedData(cacheKey);
        if (cached) {
          return cached;
        }
        throw new Error('No internet connection and no cached data available');
      }
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Request failed');
      }
      
      // Cache successful GET responses
      if ((options.method === 'GET' || !options.method) && cacheKey) {
        await offlineService.cacheData(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      // For GET requests, fall back to cache on network error
      if ((options.method === 'GET' || !options.method) && cacheKey) {
        const cached = await offlineService.getCachedData(cacheKey);
        if (cached) {
          console.log('Using cached data due to network error');
          return cached;
        }
      }
      
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // GET request with caching
  get(endpoint, cacheKey = null) {
    return this.request(endpoint, { method: 'GET' }, cacheKey || endpoint);
  }

  // POST request (queue if offline)
  async post(endpoint, data, offlineAction = null) {
    if (!offlineService.isOnline && offlineAction) {
      await offlineService.queueAction(offlineAction);
      return { queued: true, message: 'Action queued for sync' };
    }
    
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Auth
  async getCurrentUser() {
    return this.get(API_ENDPOINTS.AUTH_ME, 'current_user');
  }

  async logout() {
    await this.post(API_ENDPOINTS.AUTH_LOGOUT, {});
    await this.clearSession();
  }

  // Family (with caching)
  async getFamilies() {
    return this.get(API_ENDPOINTS.FAMILIES, 'families');
  }

  async getFamilyMembers() {
    return this.get(API_ENDPOINTS.FAMILY_MEMBERS, 'family_members');
  }

  async switchFamily(familyId) {
    return this.post(API_ENDPOINTS.FAMILY_SWITCH(familyId), {});
  }

  // Chores (with caching and offline support)
  async getChores() {
    return this.get(API_ENDPOINTS.CHORES, 'chores');
  }

  async getChoreTypes() {
    return this.get(API_ENDPOINTS.CHORE_TYPES, 'chore_types');
  }

  async completeChore(choreId) {
    return this.post(
      API_ENDPOINTS.CHORE_COMPLETE(choreId), 
      {},
      { type: 'COMPLETE_CHORE', choreId }
    );
  }

  async createChore(choreData) {
    return this.post(API_ENDPOINTS.CHORES, choreData);
  }

  // Tasks (with offline support)
  async getTasks() {
    return this.get(API_ENDPOINTS.TASKS, 'tasks');
  }

  async completeTask(taskId) {
    return this.post(
      API_ENDPOINTS.TASK_COMPLETE(taskId), 
      {},
      { type: 'COMPLETE_TASK', taskId }
    );
  }

  // Messages (with caching and offline support)
  async getMessages() {
    return this.get(API_ENDPOINTS.MESSAGES, 'messages');
  }

  async sendMessage(content) {
    return this.post(
      API_ENDPOINTS.MESSAGES, 
      { content },
      { type: 'SEND_MESSAGE', content }
    );
  }

  async markMessageRead(messageId) {
    return this.put(API_ENDPOINTS.MESSAGE_READ(messageId), {});
  }

  // Family Wall (with caching)
  async getFamilyWall() {
    return this.get(API_ENDPOINTS.FAMILY_WALL, 'family_wall');
  }

  async createPost(content, type = 'text') {
    return this.post(
      API_ENDPOINTS.FAMILY_WALL, 
      { content, type },
      { type: 'CREATE_POST', content, postType: type }
    );
  }

  async getDailyQuote(refresh = false) {
    const endpoint = refresh 
      ? `${API_ENDPOINTS.DAILY_QUOTE}?refresh=true`
      : API_ENDPOINTS.DAILY_QUOTE;
    return this.get(endpoint, refresh ? null : 'daily_quote');
  }

  // Events (with caching)
  async getEvents() {
    return this.get(API_ENDPOINTS.EVENTS, 'events');
  }

  async createEvent(eventData) {
    return this.post(API_ENDPOINTS.EVENTS, eventData);
  }

  // Rewards (with caching)
  async getRewards() {
    return this.get(API_ENDPOINTS.REWARDS, 'rewards');
  }

  async redeemReward(rewardId) {
    return this.post(API_ENDPOINTS.REDEEM_REWARD(rewardId), {});
  }

  // Leaderboard (with caching)
  async getLeaderboard() {
    return this.get(API_ENDPOINTS.LEADERBOARD, 'leaderboard');
  }

  // Weather (short cache)
  async getWeather() {
    return this.get(API_ENDPOINTS.WEATHER, 'weather');
  }

  // Shopping (with caching and offline support)
  async getShoppingList() {
    return this.get(API_ENDPOINTS.SHOPPING_LIST, 'shopping_list');
  }

  async addShoppingItem(item) {
    return this.post(
      API_ENDPOINTS.SHOPPING_LIST, 
      item,
      { type: 'ADD_SHOPPING_ITEM', item }
    );
  }

  // Location
  async updateLocation(latitude, longitude) {
    return this.post(API_ENDPOINTS.LOCATION_UPDATE, { latitude, longitude });
  }

  // Battery
  async updateBattery(level, charging) {
    return this.post(API_ENDPOINTS.BATTERY_UPDATE, { level, charging });
  }

  async getBatteryStatus() {
    return this.get(API_ENDPOINTS.BATTERY_STATUS, 'battery_status');
  }

  // Notifications
  async getNotifications() {
    return this.get(API_ENDPOINTS.NOTIFICATIONS, 'notifications');
  }

  // Tutorial
  async getTutorialContent() {
    return this.get('/tutorial/content', 'tutorial_content');
  }

  async completeTutorial() {
    return this.post('/tutorial/complete', {});
  }

  async resetTutorial() {
    return this.post('/tutorial/reset', {});
  }

  // Family Wall Extended
  async getFamilyWallPosts() {
    return this.get('/family-wall', 'family_wall_posts');
  }

  async createFamilyWallPost(data) {
    return this.post('/family-wall', data);
  }

  async likePost(postId) {
    return this.post(`/family-wall/${postId}/like`, {});
  }

  async searchGifs(query) {
    return this.get(`/gifs/search?q=${encodeURIComponent(query)}`);
  }

  // Shopping List Extended
  async updateShoppingItem(itemId, data) {
    return this.put(`/shopping/${itemId}`, data);
  }

  async deleteShoppingItem(itemId) {
    return this.delete(`/shopping/${itemId}`);
  }

  // Dinner Planner
  async getDinnerPlan() {
    return this.get('/dinner-plan', 'dinner_plan');
  }

  async updateDinnerPlan(day, mealType, meal) {
    return this.post('/dinner-plan', { day, meal_type: mealType, meal });
  }

  async generateDinnerPlan() {
    return this.post('/dinner-plan/generate', {});
  }

  // Location & Geofencing
  async getGeofences() {
    return this.get('/geofences', 'geofences');
  }

  async createGeofence(data) {
    return this.post('/geofences', data);
  }

  async deleteGeofence(geofenceId) {
    return this.delete(`/geofences/${geofenceId}`);
  }

  async getCheckins() {
    return this.get('/checkins', 'checkins');
  }

  async createCheckin(data) {
    return this.post('/checkins', data);
  }

  async getLocationAlerts() {
    return this.get('/location/alerts', 'location_alerts');
  }

  async sendGeofenceAlert(data) {
    return this.post('/location/geofence-alert', data);
  }

  // Battery Monitoring
  async updateBattery(level, state) {
    return this.post('/battery/update', { level, state });
  }

  async getBatteryStatus(userId) {
    return this.get(`/battery/status/${userId}`);
  }

  async getFamilyBatteryStatus() {
    return this.get('/battery/family-status', 'family_battery');
  }

  // Check pending sync actions
  async getPendingSyncCount() {
    const pending = await offlineService.getPendingActions();
    return pending.length;
  }

  // Force sync
  async forceSync() {
    return offlineService.syncPendingActions();
  }
}

export const apiService = new ApiService();
export default apiService;
