// Widget Service for iOS and Android Home Screen Widgets
// Manages widget data synchronization and updates

import AsyncStorage from '@react-native-async-storage/async-storage';

const WIDGET_DATA_KEY = '@widget_data';
const WIDGET_CONFIG_KEY = '@widget_config';

class WidgetService {
  constructor() {
    this.widgetData = null;
    this.config = {
      refreshInterval: 15 * 60 * 1000, // 15 minutes
      enabledWidgets: ['chores', 'events', 'points', 'weather'],
    };
  }

  // Initialize widget service
  async init() {
    try {
      const [data, config] = await Promise.all([
        AsyncStorage.getItem(WIDGET_DATA_KEY),
        AsyncStorage.getItem(WIDGET_CONFIG_KEY),
      ]);
      
      if (data) this.widgetData = JSON.parse(data);
      if (config) this.config = { ...this.config, ...JSON.parse(config) };
      
      console.log('Widget service initialized');
      return true;
    } catch (error) {
      console.error('Widget service init error:', error);
      return false;
    }
  }

  // Get widget data for a specific widget type
  async getWidgetData(widgetType) {
    try {
      const data = await AsyncStorage.getItem(WIDGET_DATA_KEY);
      const widgetData = data ? JSON.parse(data) : {};
      return widgetData[widgetType] || null;
    } catch (error) {
      console.error('Error getting widget data:', error);
      return null;
    }
  }

  // Update widget data - called when app data changes
  async updateWidgetData(type, data) {
    try {
      const existingData = await AsyncStorage.getItem(WIDGET_DATA_KEY);
      const widgetData = existingData ? JSON.parse(existingData) : {};
      
      widgetData[type] = {
        ...data,
        lastUpdated: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetData));
      
      // Trigger native widget update (platform-specific)
      this.triggerWidgetRefresh(type);
      
      return true;
    } catch (error) {
      console.error('Error updating widget data:', error);
      return false;
    }
  }

  // Update chores widget data
  async updateChoresWidget(chores, userName) {
    const todayChores = chores.filter(c => {
      const today = new Date().toISOString().split('T')[0];
      return c.scheduled_date === today && c.status !== 'completed';
    }).slice(0, 5); // Max 5 chores for widget

    return this.updateWidgetData('chores', {
      userName,
      chores: todayChores.map(c => ({
        id: c._id || c.id,
        title: c.title,
        points: c.points,
        status: c.status,
      })),
      totalToday: todayChores.length,
    });
  }

  // Update events widget data
  async updateEventsWidget(events) {
    const today = new Date();
    const upcomingEvents = events
      .filter(e => new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3); // Max 3 events for widget

    return this.updateWidgetData('events', {
      events: upcomingEvents.map(e => ({
        id: e._id || e.id,
        title: e.title,
        date: e.date,
        time: e.event_time,
        type: e.event_type,
      })),
    });
  }

  // Update points/leaderboard widget
  async updatePointsWidget(leaderboard, currentUser) {
    const userRank = leaderboard.findIndex(u => u.user_id === currentUser?.user_id) + 1;
    const userPoints = leaderboard.find(u => u.user_id === currentUser?.user_id)?.total_points || 0;
    
    return this.updateWidgetData('points', {
      userName: currentUser?.name,
      rank: userRank,
      points: userPoints,
      topThree: leaderboard.slice(0, 3).map(u => ({
        name: u.name,
        points: u.total_points,
      })),
    });
  }

  // Update weather widget
  async updateWeatherWidget(weather) {
    return this.updateWidgetData('weather', {
      temp: weather.temp,
      condition: weather.condition,
      icon: weather.icon,
      humidity: weather.humidity,
      location: weather.location,
    });
  }

  // Update family quick stats widget
  async updateFamilyWidget(familyData) {
    return this.updateWidgetData('family', {
      totalMembers: familyData.members?.length || 0,
      pendingChores: familyData.pendingChores || 0,
      todayEvents: familyData.todayEvents || 0,
      unreadMessages: familyData.unreadMessages || 0,
    });
  }

  // Trigger native widget refresh (platform-specific implementation)
  triggerWidgetRefresh(widgetType) {
    // This would be implemented via native modules
    // For now, we store a refresh flag that native code can check
    try {
      AsyncStorage.setItem(`@widget_refresh_${widgetType}`, Date.now().toString());
    } catch (error) {
      console.warn('Widget refresh trigger error:', error);
    }
  }

  // Get widget configuration
  async getConfig() {
    try {
      const config = await AsyncStorage.getItem(WIDGET_CONFIG_KEY);
      return config ? JSON.parse(config) : this.config;
    } catch (error) {
      return this.config;
    }
  }

  // Update widget configuration
  async updateConfig(newConfig) {
    try {
      this.config = { ...this.config, ...newConfig };
      await AsyncStorage.setItem(WIDGET_CONFIG_KEY, JSON.stringify(this.config));
      return true;
    } catch (error) {
      console.error('Error updating widget config:', error);
      return false;
    }
  }

  // Enable/disable specific widget
  async toggleWidget(widgetType, enabled) {
    const enabledWidgets = new Set(this.config.enabledWidgets);
    if (enabled) {
      enabledWidgets.add(widgetType);
    } else {
      enabledWidgets.delete(widgetType);
    }
    return this.updateConfig({ enabledWidgets: Array.from(enabledWidgets) });
  }

  // Get all widget data for bulk refresh
  async getAllWidgetData() {
    try {
      const data = await AsyncStorage.getItem(WIDGET_DATA_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting all widget data:', error);
      return {};
    }
  }

  // Clear all widget data
  async clearAllWidgetData() {
    try {
      await AsyncStorage.removeItem(WIDGET_DATA_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing widget data:', error);
      return false;
    }
  }
}

const widgetService = new WidgetService();
export default widgetService;
