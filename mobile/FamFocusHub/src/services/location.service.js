import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Haptics from 'expo-haptics';
import { Platform, AppState } from 'react-native';
import apiService from './api.service';
import pushNotificationService from './push.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_TASK_NAME = 'famfocus-background-location';
const GEOFENCING_TASK_NAME = 'famfocus-geofencing';
const LOCATION_STORAGE_KEY = '@famfocus_location_settings';
const GEOFENCE_STORAGE_KEY = '@famfocus_geofences';

// Haversine formula for distance calculation
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 5280; // Convert to feet
};

// Define background location task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    const location = locations[0];
    
    if (location) {
      try {
        // Send location to backend
        await apiService.updateLocation(
          location.coords.latitude,
          location.coords.longitude
        );
        
        // Check geofences
        await locationService.checkGeofencesBackground(
          location.coords.latitude,
          location.coords.longitude
        );
      } catch (err) {
        console.error('Failed to process background location:', err);
      }
    }
  }
});

// Define geofencing task
TaskManager.defineTask(GEOFENCING_TASK_NAME, async ({ data: { eventType, region }, error }) => {
  if (error) {
    console.error('Geofencing error:', error);
    return;
  }
  
  const entering = eventType === Location.GeofencingEventType.Enter;
  const exiting = eventType === Location.GeofencingEventType.Exit;
  
  if (entering || exiting) {
    try {
      // Send alert to backend
      await apiService.sendGeofenceAlert({
        geofence_id: region.identifier,
        entered: entering,
        region_name: region.identifier,
      });
      
      // Show local notification
      const action = entering ? 'entered' : 'left';
      await pushNotificationService.scheduleLocalNotification(
        entering ? '✅ Safe Zone Entered' : '⚠️ Safe Zone Exited',
        `${action.charAt(0).toUpperCase() + action.slice(1)} ${region.identifier}`,
        { 
          type: 'geofence_alert', 
          geofence_id: region.identifier,
          action: entering ? 'enter' : 'exit'
        }
      );
    } catch (err) {
      console.error('Failed to handle geofence event:', err);
    }
  }
});

class LocationService {
  constructor() {
    this.foregroundSubscription = null;
    this.backgroundEnabled = false;
    this.geofences = [];
    this.lastKnownLocation = null;
    this.listeners = [];
  }

  async init() {
    // Load saved settings
    try {
      const settings = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      if (settings) {
        const parsed = JSON.parse(settings);
        this.backgroundEnabled = parsed.backgroundEnabled || false;
      }
      
      const savedGeofences = await AsyncStorage.getItem(GEOFENCE_STORAGE_KEY);
      if (savedGeofences) {
        this.geofences = JSON.parse(savedGeofences);
      }
    } catch (error) {
      console.error('Failed to load location settings:', error);
    }
  }

  async requestForegroundPermission() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  async requestBackgroundPermission() {
    // First ensure foreground is granted
    const foregroundGranted = await this.requestForegroundPermission();
    if (!foregroundGranted) return false;

    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  }

  async checkPermissions() {
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();
    
    return {
      foreground: foreground.status === 'granted',
      background: background.status === 'granted',
    };
  }

  async getCurrentLocation() {
    const granted = await this.requestForegroundPermission();
    if (!granted) return null;

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      this.lastKnownLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
      };
      
      return this.lastKnownLocation;
    } catch (error) {
      console.error('Failed to get current location:', error);
      return null;
    }
  }

  async startForegroundTracking(onLocationUpdate) {
    const granted = await this.requestForegroundPermission();
    if (!granted) return false;

    this.foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10, // Update every 10 meters
        timeInterval: 30000, // Or every 30 seconds
      },
      (location) => {
        this.lastKnownLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: new Date().toISOString(),
        };
        
        if (onLocationUpdate) {
          onLocationUpdate(this.lastKnownLocation);
        }
        
        // Check geofences
        this.checkGeofencesForeground(
          location.coords.latitude,
          location.coords.longitude
        );
        
        // Send to backend
        apiService.updateLocation(
          location.coords.latitude,
          location.coords.longitude
        ).catch(console.error);
      }
    );

    return true;
  }

  async stopForegroundTracking() {
    if (this.foregroundSubscription) {
      this.foregroundSubscription.remove();
      this.foregroundSubscription = null;
    }
  }

  async startBackgroundTracking() {
    const backgroundGranted = await this.requestBackgroundPermission();
    if (!backgroundGranted) {
      console.log('Background permission not granted');
      return false;
    }

    const isTaskDefined = await TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    if (!isTaskDefined) {
      console.error('Background location task not defined');
      return false;
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      console.log('Background tracking already started');
      return true;
    }

    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 50, // Update every 50 meters in background
        timeInterval: 60000, // Or every minute
        foregroundService: {
          notificationTitle: 'FamFocus Location',
          notificationBody: 'Tracking your location for family safety',
          notificationColor: '#6366f1',
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Other,
      });

      this.backgroundEnabled = true;
      await this.saveSettings();
      
      return true;
    } catch (error) {
      console.error('Failed to start background tracking:', error);
      return false;
    }
  }

  async stopBackgroundTracking() {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
      
      this.backgroundEnabled = false;
      await this.saveSettings();
      
      return true;
    } catch (error) {
      console.error('Failed to stop background tracking:', error);
      return false;
    }
  }

  async isBackgroundTrackingEnabled() {
    try {
      return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {
      return false;
    }
  }

  // Geofencing
  async addGeofence(geofence) {
    const { geofence_id, name, latitude, longitude, radius_feet } = geofence;
    
    // Convert feet to meters for expo-location
    const radiusMeters = radius_feet * 0.3048;
    
    const region = {
      identifier: name,
      latitude,
      longitude,
      radius: radiusMeters,
      notifyOnEnter: true,
      notifyOnExit: true,
    };

    this.geofences.push({ ...geofence, region });
    await this.saveGeofences();

    // Start native geofencing if background permission is granted
    const { background } = await this.checkPermissions();
    if (background) {
      await this.startGeofencing();
    }

    return true;
  }

  async removeGeofence(geofenceId) {
    this.geofences = this.geofences.filter(g => g.geofence_id !== geofenceId);
    await this.saveGeofences();
    await this.startGeofencing(); // Restart with updated list
  }

  async startGeofencing() {
    if (this.geofences.length === 0) {
      await this.stopGeofencing();
      return;
    }

    const { background } = await this.checkPermissions();
    if (!background) {
      console.log('Background permission needed for geofencing');
      return;
    }

    try {
      const regions = this.geofences.map(g => g.region);
      await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, regions);
    } catch (error) {
      console.error('Failed to start geofencing:', error);
    }
  }

  async stopGeofencing() {
    try {
      const hasStarted = await Location.hasStartedGeofencingAsync(GEOFENCING_TASK_NAME);
      if (hasStarted) {
        await Location.stopGeofencingAsync(GEOFENCING_TASK_NAME);
      }
    } catch (error) {
      console.error('Failed to stop geofencing:', error);
    }
  }

  async checkGeofencesForeground(latitude, longitude) {
    for (const fence of this.geofences) {
      const distance = calculateDistance(
        latitude, longitude,
        fence.latitude, fence.longitude
      );
      
      const wasInside = fence.isInside;
      const isInside = distance <= fence.radius_feet;
      
      if (isInside !== wasInside) {
        fence.isInside = isInside;
        
        // Trigger haptic
        Haptics.notificationAsync(
          isInside 
            ? Haptics.NotificationFeedbackType.Success 
            : Haptics.NotificationFeedbackType.Warning
        );
        
        // Show notification
        await pushNotificationService.scheduleLocalNotification(
          isInside ? '✅ Safe Zone Entered' : '⚠️ Safe Zone Exited',
          `${isInside ? 'Entered' : 'Left'} ${fence.name}`,
          { 
            type: 'geofence_alert',
            geofence_id: fence.geofence_id,
            action: isInside ? 'enter' : 'exit'
          }
        );
        
        // Send to backend
        apiService.sendGeofenceAlert({
          geofence_id: fence.geofence_id,
          entered: isInside,
          latitude,
          longitude,
        }).catch(console.error);
        
        // Notify listeners
        this.notifyListeners('geofence', {
          geofence: fence,
          entered: isInside,
          latitude,
          longitude,
        });
      }
    }
    
    await this.saveGeofences();
  }

  async checkGeofencesBackground(latitude, longitude) {
    // Simplified check for background - just send to backend
    for (const fence of this.geofences) {
      const distance = calculateDistance(
        latitude, longitude,
        fence.latitude, fence.longitude
      );
      
      const wasInside = fence.isInside;
      const isInside = distance <= fence.radius_feet;
      
      if (isInside !== wasInside) {
        fence.isInside = isInside;
        
        // Send to backend (notification handled by task)
        await apiService.sendGeofenceAlert({
          geofence_id: fence.geofence_id,
          entered: isInside,
          latitude,
          longitude,
        });
      }
    }
    
    await this.saveGeofences();
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
        console.error('Listener error:', error);
      }
    });
  }

  // Storage
  async saveSettings() {
    try {
      await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({
        backgroundEnabled: this.backgroundEnabled,
      }));
    } catch (error) {
      console.error('Failed to save location settings:', error);
    }
  }

  async saveGeofences() {
    try {
      await AsyncStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(this.geofences));
    } catch (error) {
      console.error('Failed to save geofences:', error);
    }
  }

  async loadGeofences() {
    try {
      const saved = await AsyncStorage.getItem(GEOFENCE_STORAGE_KEY);
      if (saved) {
        this.geofences = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load geofences:', error);
    }
  }

  // Get geofences with current status
  getGeofencesWithStatus() {
    if (!this.lastKnownLocation) return this.geofences;
    
    return this.geofences.map(fence => {
      const distance = calculateDistance(
        this.lastKnownLocation.latitude,
        this.lastKnownLocation.longitude,
        fence.latitude,
        fence.longitude
      );
      
      return {
        ...fence,
        distance,
        isInside: distance <= fence.radius_feet,
      };
    });
  }
}

export const locationService = new LocationService();
export default locationService;
