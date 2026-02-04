import * as Battery from 'expo-battery';
import { Platform, AppState } from 'react-native';
import apiService from './api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BATTERY_STORAGE_KEY = '@famfocus_battery_settings';
const BATTERY_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

class BatteryService {
  constructor() {
    this.isMonitoring = false;
    this.batterySubscription = null;
    this.intervalId = null;
    this.lastReportedLevel = null;
    this.listeners = [];
    this.sharingEnabled = false;
  }

  async init() {
    try {
      const settings = await AsyncStorage.getItem(BATTERY_STORAGE_KEY);
      if (settings) {
        const parsed = JSON.parse(settings);
        this.sharingEnabled = parsed.sharingEnabled || false;
        
        if (this.sharingEnabled) {
          await this.startMonitoring();
        }
      }
    } catch (error) {
      console.error('Failed to load battery settings:', error);
    }
  }

  async getBatteryLevel() {
    try {
      const level = await Battery.getBatteryLevelAsync();
      return Math.round(level * 100);
    } catch (error) {
      console.error('Failed to get battery level:', error);
      return null;
    }
  }

  async getBatteryState() {
    try {
      const state = await Battery.getBatteryStateAsync();
      return this.mapBatteryState(state);
    } catch (error) {
      console.error('Failed to get battery state:', error);
      return 'unknown';
    }
  }

  mapBatteryState(state) {
    switch (state) {
      case Battery.BatteryState.CHARGING:
        return 'charging';
      case Battery.BatteryState.FULL:
        return 'full';
      case Battery.BatteryState.UNPLUGGED:
        return 'unplugged';
      default:
        return 'unknown';
    }
  }

  async getPowerState() {
    try {
      const powerState = await Battery.getPowerStateAsync();
      return {
        batteryLevel: Math.round(powerState.batteryLevel * 100),
        batteryState: this.mapBatteryState(powerState.batteryState),
        lowPowerMode: powerState.lowPowerMode,
      };
    } catch (error) {
      console.error('Failed to get power state:', error);
      return null;
    }
  }

  async startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Initial report
    await this.reportBatteryLevel();
    
    // Subscribe to battery level changes
    this.batterySubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      const level = Math.round(batteryLevel * 100);
      this.notifyListeners('level', level);
      
      // Report significant changes (every 5% or low battery thresholds)
      if (
        this.lastReportedLevel === null ||
        Math.abs(level - this.lastReportedLevel) >= 5 ||
        (level <= 20 && this.lastReportedLevel > 20) ||
        (level <= 10 && this.lastReportedLevel > 10) ||
        (level <= 5 && this.lastReportedLevel > 5)
      ) {
        this.reportBatteryLevel(level);
      }
    });
    
    // Also report periodically
    this.intervalId = setInterval(() => {
      this.reportBatteryLevel();
    }, BATTERY_UPDATE_INTERVAL);
    
    // Subscribe to battery state changes (charging/unplugged)
    this.stateSubscription = Battery.addBatteryStateListener(({ batteryState }) => {
      const state = this.mapBatteryState(batteryState);
      this.notifyListeners('state', state);
      this.reportBatteryLevel(); // Report when charging state changes
    });
    
    await this.saveSettings();
  }

  async stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.batterySubscription) {
      this.batterySubscription.remove();
      this.batterySubscription = null;
    }
    
    if (this.stateSubscription) {
      this.stateSubscription.remove();
      this.stateSubscription = null;
    }
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    await this.saveSettings();
  }

  async reportBatteryLevel(level = null) {
    if (!this.sharingEnabled) return;
    
    try {
      if (level === null) {
        level = await this.getBatteryLevel();
      }
      
      if (level === null) return;
      
      const state = await this.getBatteryState();
      
      await apiService.updateBattery(level, state);
      this.lastReportedLevel = level;
      
      // Notify listeners
      this.notifyListeners('reported', { level, state });
    } catch (error) {
      console.error('Failed to report battery level:', error);
    }
  }

  async setSharingEnabled(enabled) {
    this.sharingEnabled = enabled;
    
    if (enabled) {
      await this.startMonitoring();
    } else {
      await this.stopMonitoring();
    }
    
    await this.saveSettings();
  }

  isSharingEnabled() {
    return this.sharingEnabled;
  }

  // Listeners
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(type, data) {
    this.listeners.forEach(listener => {
      try {
        listener(type, data);
      } catch (error) {
        console.error('Battery listener error:', error);
      }
    });
  }

  // Storage
  async saveSettings() {
    try {
      await AsyncStorage.setItem(BATTERY_STORAGE_KEY, JSON.stringify({
        sharingEnabled: this.sharingEnabled,
      }));
    } catch (error) {
      console.error('Failed to save battery settings:', error);
    }
  }

  // Get battery info for display
  async getBatteryInfo() {
    const level = await this.getBatteryLevel();
    const state = await this.getBatteryState();
    const powerState = await this.getPowerState();
    
    return {
      level,
      state,
      lowPowerMode: powerState?.lowPowerMode || false,
      isCharging: state === 'charging' || state === 'full',
      isCritical: level !== null && level <= 10,
      isLow: level !== null && level <= 20,
    };
  }

  // Get battery icon based on level and state
  getBatteryIcon(level, state) {
    if (state === 'charging' || state === 'full') {
      return 'battery-charging';
    }
    
    if (level === null) return 'battery-half';
    if (level >= 80) return 'battery-full';
    if (level >= 50) return 'battery-half';
    if (level >= 20) return 'battery-half';
    return 'battery-dead';
  }

  // Get battery color based on level
  getBatteryColor(level) {
    if (level === null) return '#6b7280';
    if (level >= 50) return '#10b981'; // Green
    if (level >= 20) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  }
}

export const batteryService = new BatteryService();
export default batteryService;
