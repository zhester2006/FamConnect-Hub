import * as SecureStore from 'expo-secure-store';
import API_BASE_URL, { API_ENDPOINTS, FIREBASE_ONLY_MODE } from './api.config';
import offlineService from './offline.service';

const SESSION_KEY = 'famfocus_session_token';

class ApiService {
  constructor() {
    this.sessionToken = null;
    this.baseUrl = API_BASE_URL;
  }

  async init() {
    try {
      this.sessionToken = await SecureStore.getItemAsync(SESSION_KEY);
      // Initialize offline service (non-blocking)
      offlineService.init().catch(err => {
        console.warn('Offline service init warning:', err);
      });
    } catch (error) {
      console.error('Failed to init API service:', error);
    }
  }

  async setSession(token) {
    this.sessionToken = token;
    try {
      await SecureStore.setItemAsync(SESSION_KEY, token);
    } catch (error) {
      console.warn('Failed to save session:', error);
    }
  }

  async clearSession() {
    this.sessionToken = null;
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    } catch (error) {
      console.warn('Failed to clear session:', error);
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }
    return headers;
  }

  async request(endpoint, options = {}, cacheKey = null) {
    // In Firebase-only mode, return mock data for most endpoints
    if (FIREBASE_ONLY_MODE) {
      return this.getMockData(endpoint, options);
    }
    
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      // Get response text first to handle non-JSON responses
      const text = await response.text();
      
      // Try to parse as JSON
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error(`JSON parse error for ${endpoint}:`, text.substring(0, 100));
        // If response is not JSON, create an error object
        if (!response.ok) {
          throw new Error(text || `HTTP ${response.status}`);
        }
        // For successful non-JSON responses, return the text
        data = { message: text };
      }
      
      if (!response.ok) {
        throw new Error(data.detail || data.message || `HTTP ${response.status}`);
      }
      
      // Cache successful GET responses
      if ((options.method === 'GET' || !options.method) && cacheKey) {
        await offlineService.cacheData(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      // Handle abort/timeout
      if (error.name === 'AbortError') {
        error.message = 'Request timeout';
      }
      
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
    return this.put(
      API_ENDPOINTS.CHORE_COMPLETE(choreId), 
      {},
      { type: 'COMPLETE_CHORE', choreId }
    );
  }

  async createChore(choreData) {
    return this.post(API_ENDPOINTS.CHORES, choreData);
  }

  async updateChore(choreId, choreData) {
    return this.put(`/chores/${choreId}`, choreData);
  }

  async deleteChore(choreId) {
    return this.delete(`/chores/${choreId}`);
  }

  async claimChore(choreId) {
    return this.put(`/chores/${choreId}/claim`, {});
  }

  async approveChore(choreId, approved, points = null) {
    const data = { approved };
    if (points !== null) data.points = points;
    return this.put(`/chores/${choreId}/approve`, data);
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

  async sendMessage(content, encryptedContent = null) {
    const payload = { content };
    if (encryptedContent) {
      payload.encrypted_content = encryptedContent;
    }
    return this.post(
      API_ENDPOINTS.MESSAGES, 
      payload,
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

  // Leaderboard (with caching and timeframe filter)
  async getLeaderboard(timeframe = 'all-time') {
    const url = `${API_ENDPOINTS.LEADERBOARD}?timeframe=${timeframe}`;
    return this.get(url, `leaderboard_${timeframe}`);
  }

  // Weather (short cache)
  async getWeather(lat = null, lon = null) {
    let url = API_ENDPOINTS.WEATHER;
    if (lat !== null && lon !== null) {
      url += `?lat=${lat}&lon=${lon}`;
    }
    return this.get(url, 'weather');
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

  async votePoll(postId, optionIndex) {
    return this.post(`/family-wall/${postId}/vote`, { option_index: optionIndex });
  }

  async searchGifs(query) {
    const response = await this.get(`/gifs/search?q=${encodeURIComponent(query)}`);
    return { results: response.gifs || [] };
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

  // Family Management Extended
  async createFamily(data) {
    return this.post('/families', data);
  }

  async inviteToFamily(familyId, data) {
    return this.post(`/families/${familyId}/invite`, data);
  }

  async getPendingInvites() {
    return this.get('/families/invites/pending', 'pending_invites');
  }

  async getFamilyMembers(familyId) {
    if (familyId) {
      return this.get(`/families/${familyId}/members`);
    }
    return this.get('/family/members', 'family_members');
  }

  // Reading Logs
  async getReadingLogs(childId = null) {
    const endpoint = childId ? `/reading-logs?child_id=${childId}` : '/reading-logs';
    return this.get(endpoint, 'reading_logs');
  }

  async submitReadingLog(data) {
    return this.post('/reading-logs', data);
  }

  async approveReadingLog(logId, approved) {
    return this.post(`/reading-logs/${logId}/approve`, { approved });
  }

  // Themes & Profile
  async updateUserTheme(userId, theme) {
    return this.put(`/users/${userId}`, { settings: { theme } });
  }

  async updateProfile(userId, data) {
    return this.put(`/users/${userId}`, data);
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

  // Points Management
  async modifyChildPoints(userId, amount, reason = '') {
    return this.post(`/users/${userId}/points`, { amount, reason });
  }

  // AI-Powered Features
  async generateAiSchedule(data) {
    return this.post('/chores/ai-schedule', data);
  }

  async getAiMealSuggestion(preferences = '', servings = 4) {
    return this.post('/ai/meal-plan', { preferences, servings });
  }

  async getAiChoreTips(title, childAge = 10) {
    return this.post('/ai/chore-tips', { title, child_age: childAge });
  }

  async getAiFamilyActivity(data = {}) {
    return this.post('/ai/family-activity', data);
  }

  async askPixie(message, userName = 'Friend', userRole = 'child', context = []) {
    return this.post('/ai/pixie', { message, user_name: userName, user_role: userRole, context });
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

  // Goals
  async getGoals() {
    return this.get('/goals', 'goals');
  }

  async createGoal(goalData) {
    return this.post('/goals', goalData);
  }

  async updateGoal(goalId, data) {
    return this.put(`/goals/${goalId}`, data);
  }

  async deleteGoal(goalId) {
    return this.delete(`/goals/${goalId}`);
  }

  // Pantry
  async getPantryItems() {
    return this.get('/pantry', 'pantry_items');
  }

  async addPantryItem(itemData) {
    return this.post('/pantry', itemData);
  }

  async updatePantryItem(itemId, data) {
    return this.put(`/pantry/${itemId}`, data);
  }

  async removePantryItem(itemId) {
    return this.delete(`/pantry/${itemId}`);
  }

  async getAiPantrySuggestions(pantryItems) {
    return this.post('/pantry/ai-suggestions', { items: pantryItems });
  }

  async getAiShoppingSuggestions(pantryItems) {
    return this.post('/pantry/ai-shopping', { items: pantryItems });
  }

  // Recipes
  async getRecipes() {
    return this.get('/recipes', 'recipes');
  }

  async createRecipe(recipeData) {
    return this.post('/recipes', recipeData);
  }

  async updateRecipe(recipeId, data) {
    return this.put(`/recipes/${recipeId}`, data);
  }

  async deleteRecipe(recipeId) {
    return this.delete(`/recipes/${recipeId}`);
  }

  async markRecipeMade(recipeId) {
    return this.post(`/recipes/${recipeId}/made`, {});
  }

  async getAiRecipeSuggestions(basedOn = 'history') {
    return this.get(`/recipes/suggestions?based_on=${basedOn}`, null);
  }

  // Achievements
  async getAchievements(userId = null) {
    const endpoint = userId ? `/achievements?user_id=${userId}` : '/achievements';
    return this.get(endpoint, 'achievements');
  }

  async getFamilyAchievements() {
    return this.get('/achievements/family', 'family_achievements');
  }

  // Dashboard Config
  async getDashboardConfig() {
    return this.get('/dashboard/config', 'dashboard_config');
  }

  async updateDashboardConfig(config) {
    return this.post('/dashboard/config', config);
  }

  // Rewards Extended
  async createReward(rewardData) {
    return this.post('/rewards', rewardData);
  }

  async updateReward(rewardId, data) {
    return this.put(`/rewards/${rewardId}`, data);
  }

  async deleteReward(rewardId) {
    return this.delete(`/rewards/${rewardId}`);
  }

  async getPendingRedemptions() {
    return this.get('/rewards/pending', 'pending_redemptions');
  }

  async approveRedemption(redemptionId, approved) {
    return this.put(`/rewards/redemptions/${redemptionId}`, { approved });
  }

  // Mock data for Firebase-only mode
  getMockData(endpoint, options = {}) {
    console.log('[ApiService] Firebase-only mode - returning mock data for:', endpoint);
    
    // Handle POST requests (like AI endpoints)
    const method = options.method || 'GET';
    let bodyData = {};
    if (options.body) {
      try {
        bodyData = JSON.parse(options.body);
      } catch (e) {}
    }
    
    // AI Pixie endpoint - return helpful responses
    if (endpoint.includes('/ai/pixie')) {
      const message = bodyData.message || '';
      const userName = bodyData.user_name || 'Friend';
      
      // Generate contextual responses
      let response = '';
      if (message.toLowerCase().includes('dinner') || message.toLowerCase().includes('meal')) {
        response = `Great question, ${userName}! Here are some quick dinner ideas:\n\n🍝 **Pasta Night** - Quick marinara with garlic bread\n🌮 **Taco Tuesday** - Ground beef tacos with all the fixings\n🍗 **Sheet Pan Chicken** - Chicken with roasted veggies\n🥗 **Stir Fry** - Quick veggie stir fry with rice\n\nWant me to help with a specific recipe?`;
      } else if (message.toLowerCase().includes('activity') || message.toLowerCase().includes('fun')) {
        response = `Here are some fun family activities, ${userName}!\n\n🎲 **Game Night** - Board games or card games\n🎬 **Movie Marathon** - Pick a theme and watch together\n🎨 **Craft Time** - DIY projects or painting\n🌳 **Outdoor Adventure** - Park visit or nature walk\n🍪 **Baking Together** - Make cookies or cupcakes\n\nWhich sounds fun to you?`;
      } else if (message.toLowerCase().includes('chore') || message.toLowerCase().includes('clean')) {
        response = `Here are some chore tips, ${userName}!\n\n⏰ **Set a Timer** - 15-minute cleaning sprints work great\n🎵 **Play Music** - Makes cleaning more fun\n✅ **Checklist** - Break tasks into smaller steps\n🏆 **Reward Yourself** - Treat after completing tasks\n👥 **Team Up** - Clean together as a family\n\nNeed help with a specific task?`;
      } else if (message.toLowerCase().includes('homework') || message.toLowerCase().includes('study')) {
        response = `Study tips for you, ${userName}!\n\n📚 **Quiet Space** - Find a distraction-free area\n⏰ **Pomodoro** - 25 min work, 5 min break\n📝 **Take Notes** - Writing helps memory\n❓ **Ask Questions** - Don't be afraid to ask for help\n🎯 **One at a Time** - Focus on one subject\n\nWhat subject do you need help with?`;
      } else if (message.toLowerCase().includes('weather')) {
        response = `Weather planning tips, ${userName}!\n\n☀️ **Sunny Day** - Perfect for outdoor activities!\n🌧️ **Rainy Day** - Indoor games, movies, or baking\n❄️ **Cold Day** - Hot cocoa and cozy activities\n\nCheck your local weather app for today's forecast!`;
      } else {
        response = `Hi ${userName}! I'm Pixie, your family assistant! 🧚‍♀️\n\nI can help you with:\n• 🍽️ Meal and dinner ideas\n• 🎮 Fun family activities\n• 🧹 Chore tips and motivation\n• 📚 Homework and study help\n• ☀️ Weather-based activity suggestions\n\nJust ask me anything!`;
      }
      
      return { response, success: true };
    }
    
    // AI meal plan
    if (endpoint.includes('/ai/meal-plan')) {
      return {
        response: "Here's a quick meal suggestion:\n\n**Chicken Stir Fry**\n- 1 lb chicken breast\n- Mixed vegetables\n- Soy sauce & ginger\n- Serve over rice\n\nCook time: 20 minutes!",
        success: true
      };
    }
    
    // AI chore tips
    if (endpoint.includes('/ai/chore-tips')) {
      return {
        response: "Make it fun! Set a timer and see how fast you can clean. Play your favorite music!",
        success: true
      };
    }
    
    // AI family activity
    if (endpoint.includes('/ai/family-activity')) {
      return {
        response: "How about a game night? Try playing charades or a board game together!",
        success: true
      };
    }
    
    // Weather endpoint
    if (endpoint.includes('/weather')) {
      return {
        weather: {
          temperature: 72,
          condition: 'Partly Cloudy',
          icon: 'partly-sunny',
          humidity: 45,
          location: 'Your Location'
        },
        success: true
      };
    }
    
    // Daily quote
    if (endpoint.includes('/daily-quote') || endpoint.includes('/quotes')) {
      const quotes = [
        "Family is not an important thing. It's everything. - Michael J. Fox",
        "The love of family is life's greatest blessing.",
        "Together is a wonderful place to be.",
        "Family: where life begins and love never ends.",
        "Home is where your family is."
      ];
      return { quote: quotes[Math.floor(Math.random() * quotes.length)] };
    }
    
    // GIF search
    if (endpoint.includes('/gifs')) {
      return { gifs: [], results: [] };
    }
    
    // Tutorial
    if (endpoint.includes('/tutorial')) {
      return { completed: true, slides: [] };
    }
    
    // Checkins
    if (endpoint.includes('/checkins')) {
      return { checkins: [], success: true };
    }
    
    // Goals
    if (endpoint.includes('/goals')) {
      return { goals: [] };
    }
    
    // Family wall
    if (endpoint.includes('/family-wall')) {
      return { posts: [] };
    }
    
    // Messages
    if (endpoint.includes('/messages')) {
      return { messages: [] };
    }
    
    // Return appropriate mock data based on endpoint
    if (endpoint.includes('/chores')) {
      return { chores: [], total: 0 };
    }
    if (endpoint.includes('/shopping')) {
      return { items: [], total: 0 };
    }
    if (endpoint.includes('/events') || endpoint.includes('/calendar')) {
      return { events: [], total: 0 };
    }
    if (endpoint.includes('/family/members') || endpoint.includes('/families')) {
      return { members: [], families: [] };
    }
    if (endpoint.includes('/reading')) {
      return { logs: [], total: 0 };
    }
    if (endpoint.includes('/leaderboard')) {
      return { leaderboard: [], rankings: [] };
    }
    if (endpoint.includes('/rewards')) {
      return { rewards: [], total: 0 };
    }
    if (endpoint.includes('/achievements')) {
      return { achievements: [], badges: [] };
    }
    if (endpoint.includes('/battery')) {
      return { battery_status: [], members: [] };
    }
    if (endpoint.includes('/geofences') || endpoint.includes('/location')) {
      return { geofences: [], locations: [], alerts: [] };
    }
    if (endpoint.includes('/user') || endpoint.includes('/profile')) {
      return { user: null };
    }
    if (endpoint.includes('/notifications')) {
      return { notifications: [] };
    }
    if (endpoint.includes('/pantry')) {
      return { items: [] };
    }
    if (endpoint.includes('/recipes')) {
      return { recipes: [] };
    }
    if (endpoint.includes('/meals') || endpoint.includes('/dinner')) {
      return { meals: [], plan: [] };
    }
    if (endpoint.includes('/dashboard')) {
      return { config: {} };
    }
    
    // For POST/PUT requests, return success
    if (method === 'POST' || method === 'PUT') {
      return { success: true, message: 'Action completed (offline mode)' };
    }
    
    // Default empty response
    return {};
  }
}

export const apiService = new ApiService();
export default apiService;
