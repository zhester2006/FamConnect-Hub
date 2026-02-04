import * as SecureStore from 'expo-secure-store';
import API_BASE_URL, { API_ENDPOINTS } from './api.config';

const SESSION_KEY = 'famfocus_session_token';

class ApiService {
  constructor() {
    this.sessionToken = null;
  }

  async init() {
    try {
      this.sessionToken = await SecureStore.getItemAsync(SESSION_KEY);
    } catch (error) {
      console.error('Failed to load session:', error);
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

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
      credentials: 'include',
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Request failed');
      }
      
      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // GET request
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST request
  post(endpoint, data) {
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
    return this.get(API_ENDPOINTS.AUTH_ME);
  }

  async logout() {
    await this.post(API_ENDPOINTS.AUTH_LOGOUT, {});
    await this.clearSession();
  }

  // Family
  async getFamilies() {
    return this.get(API_ENDPOINTS.FAMILIES);
  }

  async getFamilyMembers() {
    return this.get(API_ENDPOINTS.FAMILY_MEMBERS);
  }

  async switchFamily(familyId) {
    return this.post(API_ENDPOINTS.FAMILY_SWITCH(familyId), {});
  }

  // Chores
  async getChores() {
    return this.get(API_ENDPOINTS.CHORES);
  }

  async getChoreTypes() {
    return this.get(API_ENDPOINTS.CHORE_TYPES);
  }

  async completeChore(choreId) {
    return this.post(API_ENDPOINTS.CHORE_COMPLETE(choreId), {});
  }

  async createChore(choreData) {
    return this.post(API_ENDPOINTS.CHORES, choreData);
  }

  // Tasks
  async getTasks() {
    return this.get(API_ENDPOINTS.TASKS);
  }

  async completeTask(taskId) {
    return this.post(API_ENDPOINTS.TASK_COMPLETE(taskId), {});
  }

  // Messages
  async getMessages() {
    return this.get(API_ENDPOINTS.MESSAGES);
  }

  async sendMessage(content) {
    return this.post(API_ENDPOINTS.MESSAGES, { content });
  }

  async markMessageRead(messageId) {
    return this.put(API_ENDPOINTS.MESSAGE_READ(messageId), {});
  }

  // Family Wall
  async getFamilyWall() {
    return this.get(API_ENDPOINTS.FAMILY_WALL);
  }

  async createPost(content, type = 'text') {
    return this.post(API_ENDPOINTS.FAMILY_WALL, { content, type });
  }

  async getDailyQuote(refresh = false) {
    const endpoint = refresh 
      ? `${API_ENDPOINTS.DAILY_QUOTE}?refresh=true`
      : API_ENDPOINTS.DAILY_QUOTE;
    return this.get(endpoint);
  }

  // Events
  async getEvents() {
    return this.get(API_ENDPOINTS.EVENTS);
  }

  async createEvent(eventData) {
    return this.post(API_ENDPOINTS.EVENTS, eventData);
  }

  // Rewards
  async getRewards() {
    return this.get(API_ENDPOINTS.REWARDS);
  }

  async redeemReward(rewardId) {
    return this.post(API_ENDPOINTS.REDEEM_REWARD(rewardId), {});
  }

  // Leaderboard
  async getLeaderboard() {
    return this.get(API_ENDPOINTS.LEADERBOARD);
  }

  // Weather
  async getWeather() {
    return this.get(API_ENDPOINTS.WEATHER);
  }

  // Shopping
  async getShoppingList() {
    return this.get(API_ENDPOINTS.SHOPPING_LIST);
  }

  async addShoppingItem(item) {
    return this.post(API_ENDPOINTS.SHOPPING_LIST, item);
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
    return this.get(API_ENDPOINTS.BATTERY_STATUS);
  }

  // Notifications
  async getNotifications() {
    return this.get(API_ENDPOINTS.NOTIFICATIONS);
  }
}

export const apiService = new ApiService();
export default apiService;
