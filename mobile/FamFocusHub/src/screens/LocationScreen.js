import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert,
  Linking, Platform, Dimensions, Switch, AppState, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import locationService from '../services/location.service';
import batteryService from '../services/battery.service';
import MedalEmblem from '../components/MedalEmblem';

// Maps disabled for Expo Go compatibility
// To enable maps, build with: npx expo run:android
const mapsAvailable = false;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Haversine formula to calculate distance between two coordinates
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

export default function LocationScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [permissions, setPermissions] = useState({ foreground: false, background: false });
  const [foregroundTracking, setForegroundTracking] = useState(false);
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [batterySharing, setBatterySharing] = useState(false);
  const [batteryInfo, setBatteryInfo] = useState(null);
  const [geofences, setGeofences] = useState([]);
  const [children, setChildren] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showAddGeofence, setShowAddGeofence] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [newGeofence, setNewGeofence] = useState({ name: '', radius: 300 });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mapError, setMapError] = useState(false);
  const appState = useRef(AppState.currentState);
  const mapRef = useRef(null);

  useEffect(() => {
    initServices();
    fetchData();
    
    let subscription = null;
    let locationListener = null;
    
    // Listen for app state changes
    try {
      subscription = AppState.addEventListener('change', handleAppStateChange);
    } catch (e) {
      console.warn('AppState listener error:', e);
    }
    
    // Listen for location service updates
    try {
      locationListener = locationService.addListener((type, data) => {
        if (type === 'geofence') {
          fetchData(); // Refresh alerts when geofence triggered
        }
      });
    } catch (e) {
      console.warn('Location listener error:', e);
    }
    
    return () => {
      if (subscription?.remove) {
        try { subscription.remove(); } catch (e) {}
      }
      if (locationListener) {
        try { locationListener(); } catch (e) {}
      }
    };
  }, []);

  const handleAppStateChange = async (nextAppState) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground - refresh data
      await fetchData();
      await updateBatteryInfo();
    }
    appState.current = nextAppState;
  };

  const initServices = async () => {
    try {
      // Initialize services with error handling
      try {
        await locationService.init();
      } catch (locErr) {
        console.warn('Location service init warning:', locErr);
      }
      
      try {
        await batteryService.init();
      } catch (batErr) {
        console.warn('Battery service init warning:', batErr);
      }
      
      // Check permissions
      try {
        const perms = await locationService.checkPermissions();
        setPermissions(perms);
      } catch (permErr) {
        console.warn('Permission check warning:', permErr);
        setPermissions({ foreground: false, background: false });
      }
      
      // Check if background tracking is active
      try {
        const bgEnabled = await locationService.isBackgroundTrackingEnabled();
        setBackgroundTracking(bgEnabled);
      } catch (bgErr) {
        console.warn('Background tracking check warning:', bgErr);
      }
      
      // Check battery sharing status
      try {
        const batteryEnabled = batteryService.isSharingEnabled();
        setBatterySharing(batteryEnabled);
      } catch (batShareErr) {
        console.warn('Battery sharing check warning:', batShareErr);
      }
      
      // Get current location
      try {
        const location = await locationService.getCurrentLocation();
        if (location) {
          setCurrentLocation(location);
        }
      } catch (currLocErr) {
        console.warn('Current location warning:', currLocErr);
      }
      
      // Get battery info
      try {
        await updateBatteryInfo();
      } catch (batInfoErr) {
        console.warn('Battery info warning:', batInfoErr);
      }
    } catch (error) {
      console.error('Service init error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateBatteryInfo = async () => {
    const info = await batteryService.getBatteryInfo();
    setBatteryInfo(info);
  };

  const fetchData = async () => {
    try {
      const [geofencesRes, membersRes, alertsRes, batteryRes, leaderboardRes] = await Promise.all([
        apiService.getGeofences().catch(e => { console.warn('Geofences fetch:', e); return { geofences: [] }; }),
        apiService.getFamilyMembers().catch(e => { console.warn('Members fetch:', e); return { members: [] }; }),
        apiService.getLocationAlerts().catch(e => { console.warn('Alerts fetch:', e); return { alerts: [] }; }),
        user?.role === 'parent' ? apiService.getFamilyBatteryStatus().catch(e => { console.warn('Battery status:', e); return { members: [] }; }) : Promise.resolve(null),
        apiService.getLeaderboard().catch(e => { console.warn('Leaderboard fetch:', e); return { leaderboard: [] }; }),
      ]);
      
      setGeofences(geofencesRes?.geofences || []);
      const members = membersRes?.members || [];
      const leaderboard = leaderboardRes?.leaderboard || [];
      
      // Create a map of user_id to rank
      const rankMap = {};
      leaderboard.forEach((child, index) => {
        rankMap[child.user_id] = index + 1;
      });
      
      // Add rank and battery info to children
      const childMembers = members.filter(m => m.role === 'child').map(child => {
        const batteryInfo = batteryRes?.members?.find(m => m.user_id === child.user_id);
        return {
          ...child,
          rank: rankMap[child.user_id] || null,
          battery: batteryInfo?.battery
        };
      });
      
      setChildren(childMembers);
      setAlerts(alertsRes?.alerts || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    await updateBatteryInfo();
    const location = await locationService.getCurrentLocation();
    if (location) setCurrentLocation(location);
    setRefreshing(false);
  }, []);

  const handleRequestBackgroundPermission = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const granted = await locationService.requestBackgroundPermission();
    setPermissions(await locationService.checkPermissions());
    
    if (granted) {
      Alert.alert('Success', 'Background location permission granted!');
      setShowPermissionModal(false);
    } else {
      Alert.alert(
        'Permission Needed',
        'Background location is required for continuous tracking. Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
    }
  };

  const handleToggleForegroundTracking = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (foregroundTracking) {
      await locationService.stopForegroundTracking();
      setForegroundTracking(false);
    } else {
      const success = await locationService.startForegroundTracking((location) => {
        setCurrentLocation(location);
      });
      
      if (success) {
        setForegroundTracking(true);
      } else {
        Alert.alert('Error', 'Failed to start location tracking');
      }
    }
  };

  const handleToggleBackgroundTracking = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (!permissions.background) {
      setShowPermissionModal(true);
      return;
    }
    
    if (backgroundTracking) {
      await locationService.stopBackgroundTracking();
      setBackgroundTracking(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      const success = await locationService.startBackgroundTracking();
      if (success) {
        setBackgroundTracking(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Background Tracking', 'Your location will be tracked even when the app is closed.');
      } else {
        Alert.alert('Error', 'Failed to enable background tracking');
      }
    }
  };

  const handleToggleBatterySharing = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const newValue = !batterySharing;
    await batteryService.setSharingEnabled(newValue);
    setBatterySharing(newValue);
    
    if (newValue) {
      Alert.alert('Battery Sharing', 'Your battery level will be shared with family members.');
    }
  };

  const handleCheckIn = async () => {
    if (!currentLocation) {
      const location = await locationService.getCurrentLocation();
      if (!location) {
        Alert.alert('Error', 'Unable to get current location');
        return;
      }
      setCurrentLocation(location);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
      await apiService.createCheckin({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
      Alert.alert('Success', 'Check-in recorded!');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to check in');
    }
  };

  const handleAddGeofence = async () => {
    if (!newGeofence.name.trim()) {
      Alert.alert('Error', 'Please enter a zone name');
      return;
    }
    
    // Use selected location from map, or current location as fallback
    const locationToUse = selectedLocation || currentLocation;
    
    if (!locationToUse) {
      Alert.alert('Error', 'Please select a location on the map or enable location services');
      return;
    }

    setSaving(true);
    try {
      const result = await apiService.createGeofence({
        name: newGeofence.name,
        latitude: locationToUse.latitude,
        longitude: locationToUse.longitude,
        radius_feet: newGeofence.radius,
      });
      
      // Add to local service
      await locationService.addGeofence({
        geofence_id: result.geofence_id,
        name: newGeofence.name,
        latitude: locationToUse.latitude,
        longitude: locationToUse.longitude,
        radius_feet: newGeofence.radius,
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddGeofence(false);
      setShowMapPicker(false);
      setNewGeofence({ name: '', radius: 300 });
      setSelectedLocation(null);
      fetchData();
      Alert.alert('Success', 'Safe zone created! You\'ll be notified when entering or leaving.');
    } catch (error) {
      Alert.alert('Error', 'Failed to create safe zone');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGeofence = async (geofenceId) => {
    Alert.alert(
      'Delete Safe Zone',
      'Are you sure you want to remove this safe zone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteGeofence(geofenceId);
              await locationService.removeGeofence(geofenceId);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              fetchData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLocation({ latitude, longitude });
  };

  const handleOpenMapPicker = () => {
    // Initialize selected location to current location
    if (currentLocation && !selectedLocation) {
      setSelectedLocation({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
    }
    setShowMapPicker(true);
  };

  const handleUseCurrentLocation = async () => {
    const location = await locationService.getCurrentLocation();
    if (location) {
      setSelectedLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Error', 'Unable to get current location');
    }
  };

  const openMaps = (lat, lng, label) => {
    const scheme = Platform.OS === 'ios' ? 'maps:' : 'geo:';
    const url = Platform.OS === 'ios'
      ? `${scheme}?q=${encodeURIComponent(label)}&ll=${lat},${lng}`
      : `${scheme}${lat},${lng}?q=${encodeURIComponent(label)}`;
    Linking.openURL(url);
  };

  const openNavigationToChild = (child) => {
    if (!child.last_location) return;
    
    const lat = child.last_location.lat || child.last_location.latitude;
    const lng = child.last_location.lng || child.last_location.longitude;
    
    if (!lat || !lng) return;
    
    const scheme = Platform.OS === 'ios' ? 'maps:' : 'google.navigation:';
    const url = Platform.OS === 'ios'
      ? `${scheme}?daddr=${lat},${lng}&dirflg=d`
      : `${scheme}q=${lat},${lng}`;
    Linking.openURL(url);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) return 'Today';
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
      return '';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#1e1b4b']}
        style={styles.gradient}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Location</Text>
          <Text style={styles.subtitle}>GPS Tracking & Safe Zones</Text>
        </View>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
      >
        {/* Tracking Controls Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tracking Settings</Text>
          
          {/* Foreground Tracking */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, foregroundTracking && styles.settingIconActive]}>
                <Ionicons name="location" size={20} color={foregroundTracking ? '#10b981' : '#6b7280'} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Live Tracking</Text>
                <Text style={styles.settingDescription}>Track while app is open</Text>
              </View>
            </View>
            <Switch
              value={foregroundTracking}
              onValueChange={handleToggleForegroundTracking}
              trackColor={{ false: '#374151', true: '#10b981' }}
              thumbColor="#fff"
            />
          </View>

          {/* Background Tracking */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, backgroundTracking && styles.settingIconActive]}>
                <Ionicons name="navigate" size={20} color={backgroundTracking ? '#818cf8' : '#6b7280'} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Background Tracking</Text>
                <Text style={styles.settingDescription}>
                  {permissions.background ? 'Track continuously' : 'Permission required'}
                </Text>
              </View>
            </View>
            <Switch
              value={backgroundTracking}
              onValueChange={handleToggleBackgroundTracking}
              trackColor={{ false: '#374151', true: '#818cf8' }}
              thumbColor="#fff"
            />
          </View>

          {/* Battery Sharing */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, batterySharing && styles.settingIconBattery]}>
                <Ionicons 
                  name={batteryInfo?.isCharging ? 'battery-charging' : 'battery-half'} 
                  size={20} 
                  color={batterySharing ? '#fbbf24' : '#6b7280'} 
                />
              </View>
              <View>
                <Text style={styles.settingLabel}>Share Battery Level</Text>
                <Text style={styles.settingDescription}>
                  {batteryInfo ? `${batteryInfo.level}% ${batteryInfo.isCharging ? '(Charging)' : ''}` : 'Unknown'}
                </Text>
              </View>
            </View>
            <Switch
              value={batterySharing}
              onValueChange={handleToggleBatterySharing}
              trackColor={{ false: '#374151', true: '#fbbf24' }}
              thumbColor="#fff"
            />
          </View>

          {/* Current Location */}
          {currentLocation && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color="#818cf8" />
              <Text style={styles.locationText}>
                {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
              </Text>
              <TouchableOpacity onPress={() => openMaps(currentLocation.latitude, currentLocation.longitude, 'My Location')}>
                <Text style={styles.mapLink}>Open Map</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Check-in Button */}
          <TouchableOpacity 
            style={styles.checkinButton}
            onPress={handleCheckIn}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.checkinButtonText}>Check In Now</Text>
          </TouchableOpacity>
        </View>

        {/* Children's Status (Parent View) */}
        {user?.role === 'parent' && children.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Family Members</Text>
            {children.map((child) => {
              const lastLocation = child.last_location;
              const battery = child.battery;
              const isOnline = child.online_status;
              const gpsEnabled = child.permissions?.share_location;
              const batteryEnabled = child.permissions?.share_battery;
              
              return (
                <View key={child.user_id} style={styles.childCard}>
                  <View style={styles.childHeader}>
                    <View style={styles.childAvatarContainer}>
                      <View style={styles.childAvatar}>
                        <Text style={styles.childAvatarText}>{child.name?.charAt(0)}</Text>
                        <View style={[styles.onlineIndicator, isOnline && styles.onlineIndicatorActive]} />
                      </View>
                      {child.rank && child.rank <= 3 && (
                        <View style={styles.childMedalPosition}>
                          <MedalEmblem rank={child.rank} size="small" />
                        </View>
                      )}
                    </View>
                    <View style={styles.childInfo}>
                      <Text style={styles.childName}>{child.nickname || child.name}</Text>
                      <View style={styles.childMeta}>
                        {gpsEnabled && lastLocation ? (
                          <>
                            <Ionicons name="location" size={12} color="#10b981" />
                            <Text style={styles.childMetaText}>
                              {formatDate(lastLocation.timestamp)} {formatTime(lastLocation.timestamp)}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="location-outline" size={12} color="#6b7280" />
                            <Text style={styles.childMetaText}>Location off</Text>
                          </>
                        )}
                      </View>
                    </View>
                    
                    {/* Battery Status */}
                    {batteryEnabled && battery && (
                      <View style={[styles.batteryBadge, battery.level <= 20 && styles.batteryBadgeLow]}>
                        <Ionicons 
                          name={battery.state === 'charging' ? 'battery-charging' : 
                            battery.level >= 50 ? 'battery-full' : 
                            battery.level >= 20 ? 'battery-half' : 'battery-dead'} 
                          size={14} 
                          color={battery.level <= 20 ? '#ef4444' : battery.level <= 50 ? '#fbbf24' : '#10b981'} 
                        />
                        <Text style={[styles.batteryText, battery.level <= 20 && styles.batteryTextLow]}>
                          {battery.level}%
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Action Buttons */}
                  {lastLocation && (
                    <View style={styles.childActions}>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => openMaps(
                          lastLocation.lat || lastLocation.latitude, 
                          lastLocation.lng || lastLocation.longitude, 
                          child.name
                        )}
                      >
                        <Ionicons name="map-outline" size={16} color="#818cf8" />
                        <Text style={styles.actionButtonText}>View on Map</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.actionButtonPrimary]}
                        onPress={() => openNavigationToChild(child)}
                      >
                        <Ionicons name="navigate" size={16} color="#fff" />
                        <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Navigate</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Safe Zones */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Safe Zones</Text>
            {user?.role === 'parent' && (
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setShowAddGeofence(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          
          {geofences.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="shield-outline" size={40} color="#6b7280" />
              <Text style={styles.emptyText}>No safe zones set up</Text>
              <Text style={styles.emptySubtext}>
                Get notified when entering or leaving zones
              </Text>
            </View>
          ) : (
            geofences.map((fence) => {
              const distance = currentLocation 
                ? calculateDistance(currentLocation.latitude, currentLocation.longitude, fence.latitude, fence.longitude)
                : null;
              const isInside = distance !== null && distance <= fence.radius_feet;
              
              return (
                <View key={fence.geofence_id} style={[styles.geofenceCard, isInside && styles.geofenceCardInside]}>
                  <View style={[styles.geofenceIcon, isInside && styles.geofenceIconInside]}>
                    <Ionicons 
                      name={isInside ? 'shield-checkmark' : 'shield-outline'} 
                      size={24} 
                      color={isInside ? '#10b981' : '#818cf8'} 
                    />
                  </View>
                  <View style={styles.geofenceInfo}>
                    <Text style={styles.geofenceName}>{fence.name}</Text>
                    <Text style={styles.geofenceDetails}>
                      {fence.radius_feet} ft radius
                      {distance !== null && ` • ${Math.round(distance)} ft away`}
                    </Text>
                    {isInside && (
                      <View style={styles.insideBadge}>
                        <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                        <Text style={styles.insideBadgeText}>Inside zone</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.geofenceActions}>
                    <TouchableOpacity onPress={() => openMaps(fence.latitude, fence.longitude, fence.name)}>
                      <Ionicons name="map-outline" size={20} color="#6b7280" />
                    </TouchableOpacity>
                    {user?.role === 'parent' && (
                      <TouchableOpacity onPress={() => handleDeleteGeofence(fence.geofence_id)}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Recent Alerts */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Alerts</Text>
            {alerts.slice(0, 5).map((alert, index) => (
              <View key={index} style={styles.alertCard}>
                <View style={[
                  styles.alertIcon, 
                  alert.type === 'enter' ? styles.alertIconEnter : styles.alertIconExit
                ]}>
                  <Ionicons 
                    name={alert.type === 'enter' ? 'enter' : 'exit'} 
                    size={18} 
                    color={alert.type === 'enter' ? '#10b981' : '#f59e0b'} 
                  />
                </View>
                <View style={styles.alertInfo}>
                  <Text style={styles.alertText}>
                    {alert.child_name || 'You'} {alert.type === 'enter' ? 'entered' : 'left'} {alert.zone_name}
                  </Text>
                  <Text style={styles.alertTime}>
                    {formatDate(alert.timestamp)} at {formatTime(alert.timestamp)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add Geofence Modal */}
      <Modal visible={showAddGeofence} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Safe Zone</Text>
              <TouchableOpacity onPress={() => { setShowAddGeofence(false); setSelectedLocation(null); }}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtext}>
              Select a location on the map or use your current location for this safe zone.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Zone name (e.g., Home, School)"
              placeholderTextColor="#6b7280"
              value={newGeofence.name}
              onChangeText={(text) => setNewGeofence(prev => ({ ...prev, name: text }))}
              autoFocus
            />

            <Text style={styles.label}>Select Location</Text>
            <View style={styles.locationButtons}>
              <TouchableOpacity 
                style={styles.locationButton}
                onPress={handleUseCurrentLocation}
              >
                <Ionicons name="locate" size={18} color="#818cf8" />
                <Text style={styles.locationButtonText}>Use Current</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.locationButton, styles.mapButton]}
                onPress={handleOpenMapPicker}
              >
                <Ionicons name="map" size={18} color="#10b981" />
                <Text style={[styles.locationButtonText, { color: '#10b981' }]}>Choose on Map</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Radius (feet)</Text>
            <View style={styles.radiusOptions}>
              {[100, 300, 500, 1000].map((radius) => (
                <TouchableOpacity
                  key={radius}
                  style={[styles.radiusOption, newGeofence.radius === radius && styles.radiusOptionActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setNewGeofence(prev => ({ ...prev, radius }));
                  }}
                >
                  <Text style={[styles.radiusOptionText, newGeofence.radius === radius && styles.radiusOptionTextActive]}>
                    {radius}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(selectedLocation || currentLocation) && (
              <View style={styles.locationPreview}>
                <Ionicons name="location" size={16} color="#818cf8" />
                <Text style={styles.locationPreviewText}>
                  {selectedLocation 
                    ? `Selected: ${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}`
                    : `Current: ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                  }
                </Text>
                {selectedLocation && (
                  <TouchableOpacity onPress={() => setSelectedLocation(null)}>
                    <Ionicons name="close-circle" size={18} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity 
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleAddGeofence}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Create Safe Zone</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Map Picker Modal */}
      <Modal visible={showMapPicker} animationType="slide">
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowMapPicker(false)} style={styles.mapBackButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.mapTitleContainer}>
              <Text style={styles.mapTitle}>Select Location</Text>
              <Text style={styles.mapSubtitle}>Tap on the map to place the safe zone</Text>
            </View>
            <TouchableOpacity onPress={handleUseCurrentLocation} style={styles.mapLocateButton}>
              <Ionicons name="locate" size={22} color="#818cf8" />
            </TouchableOpacity>
          </View>
          
          {(selectedLocation || currentLocation) ? (
            (mapError || !mapsAvailable) ? (
              // Static Map Fallback when MapView fails or not available (Expo Go)
              <View style={styles.staticMapContainer}>
                <Image
                  source={{
                    uri: `https://maps.googleapis.com/maps/api/staticmap?center=${
                      selectedLocation?.latitude || currentLocation?.latitude
                    },${
                      selectedLocation?.longitude || currentLocation?.longitude
                    }&zoom=15&size=600x400&maptype=roadmap&markers=color:purple%7C${
                      selectedLocation?.latitude || currentLocation?.latitude
                    },${
                      selectedLocation?.longitude || currentLocation?.longitude
                    }&key=AIzaSyBx${Date.now().toString(36)}` // Placeholder key for demo
                  }}
                  style={styles.staticMapImage}
                  onError={() => console.log('Static map also failed')}
                />
                <View style={styles.staticMapOverlay}>
                  <Ionicons name="location" size={48} color="#818cf8" />
                  <Text style={styles.staticMapText}>
                    {!mapsAvailable 
                      ? "Maps not available in Expo Go. Build the app for full map support."
                      : "Tap 'Use Current Location' to set the safe zone at your current position"
                    }
                  </Text>
                  <TouchableOpacity 
                    style={styles.staticMapButton}
                    onPress={handleUseCurrentLocation}
                  >
                    <Ionicons name="locate" size={20} color="#fff" />
                    <Text style={styles.staticMapButtonText}>Use Current Location</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={{
                  latitude: selectedLocation?.latitude || currentLocation?.latitude || 37.78825,
                  longitude: selectedLocation?.longitude || currentLocation?.longitude || -122.4324,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onPress={handleMapPress}
                onMapReady={() => setMapError(false)}
                onError={(e) => {
                  console.log('MapView error:', e);
                  setMapError(true);
                }}
                showsUserLocation
                showsMyLocationButton={false}
              >
                {selectedLocation && (
                  <>
                    <Marker
                      coordinate={selectedLocation}
                      pinColor="#818cf8"
                      title={newGeofence.name || "New Safe Zone"}
                    />
                    <Circle
                      center={selectedLocation}
                      radius={newGeofence.radius * 0.3048}
                      strokeColor="rgba(129, 140, 248, 0.8)"
                      fillColor="rgba(129, 140, 248, 0.2)"
                      strokeWidth={2}
                    />
                  </>
                )}
                
                {/* Show existing geofences on map */}
                {geofences.map((fence) => (
                  <React.Fragment key={fence.geofence_id}>
                    <Marker
                      coordinate={{ latitude: fence.latitude, longitude: fence.longitude }}
                      pinColor="#10b981"
                      title={fence.name}
                      description={`${fence.radius_feet} ft radius`}
                  />
                  <Circle
                    center={{ latitude: fence.latitude, longitude: fence.longitude }}
                    radius={fence.radius_feet * 0.3048}
                    strokeColor="rgba(16, 185, 129, 0.8)"
                    fillColor="rgba(16, 185, 129, 0.15)"
                    strokeWidth={2}
                  />
                </React.Fragment>
              ))}
            </MapView>
            )
          ) : (
            <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e1b4b' }]}>
              <ActivityIndicator size="large" color="#818cf8" />
              <Text style={{ color: '#9ca3af', marginTop: 10 }}>Getting location...</Text>
            </View>
          )}
          
          {/* Bottom info panel */}
          <View style={styles.mapBottomPanel}>
            {selectedLocation ? (
              <>
                <View style={styles.mapLocationInfo}>
                  <Ionicons name="location" size={20} color="#818cf8" />
                  <Text style={styles.mapLocationText}>
                    {selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.mapConfirmButton}
                  onPress={() => setShowMapPicker(false)}
                >
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.mapConfirmText}>Use This Location</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.mapHelpText}>
                Tap anywhere on the map to select a location for your safe zone
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Background Permission Modal */}
      <Modal visible={showPermissionModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.permissionIcon}>
              <Ionicons name="navigate" size={40} color="#818cf8" />
            </View>
            <Text style={styles.modalTitle}>Background Location</Text>
            <Text style={styles.permissionText}>
              To track your location when the app is closed, FamFocus needs background location permission.
              {'\n\n'}
              This helps keep your family informed of your whereabouts even when you're not using the app.
            </Text>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleRequestBackgroundPermission}
            >
              <Text style={styles.saveButtonText}>Enable Background Location</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowPermissionModal(false)}
            >
              <Text style={styles.cancelButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0d1a' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#9ca3af', marginTop: 2 },
  refreshButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  card: { backgroundColor: 'rgba(30,27,75,0.6)', borderRadius: 16, marginHorizontal: 20, marginBottom: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 16 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  settingIconActive: { backgroundColor: 'rgba(16,185,129,0.1)' },
  settingIconBattery: { backgroundColor: 'rgba(251,191,36,0.1)' },
  settingLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  settingDescription: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, marginTop: 4 },
  locationText: { color: '#6b7280', fontSize: 12, flex: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  mapLink: { color: '#818cf8', fontSize: 13 },
  checkinButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#818cf8', paddingVertical: 14, borderRadius: 12, marginTop: 16 },
  checkinButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  section: { marginHorizontal: 20, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 12 },
  addButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#818cf8', justifyContent: 'center', alignItems: 'center' },
  childCard: { backgroundColor: 'rgba(30,27,75,0.6)', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  childHeader: { flexDirection: 'row', alignItems: 'center' },
  childAvatarContainer: { position: 'relative' },
  childAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#818cf8', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  childAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  childMedalPosition: { position: 'absolute', bottom: -2, right: -2 },
  onlineIndicator: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#6b7280', borderWidth: 2, borderColor: '#1e1b4b' },
  onlineIndicatorActive: { backgroundColor: '#10b981' },
  childInfo: { flex: 1, marginLeft: 12 },
  childName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  childMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  childMetaText: { color: '#9ca3af', fontSize: 12 },
  batteryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  batteryBadgeLow: { backgroundColor: 'rgba(239,68,68,0.1)' },
  batteryText: { color: '#10b981', fontSize: 12, fontWeight: '600' },
  batteryTextLow: { color: '#ef4444' },
  childActions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  actionButtonPrimary: { backgroundColor: '#818cf8' },
  actionButtonText: { color: '#818cf8', fontSize: 13, fontWeight: '500' },
  actionButtonTextPrimary: { color: '#fff' },
  geofenceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,27,75,0.6)', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  geofenceCardInside: { borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.05)' },
  geofenceIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(129,140,248,0.1)', justifyContent: 'center', alignItems: 'center' },
  geofenceIconInside: { backgroundColor: 'rgba(16,185,129,0.1)' },
  geofenceInfo: { flex: 1, marginLeft: 12 },
  geofenceName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  geofenceDetails: { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  insideBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  insideBadgeText: { color: '#10b981', fontSize: 12 },
  geofenceActions: { flexDirection: 'row', gap: 12 },
  emptyCard: { alignItems: 'center', backgroundColor: 'rgba(30,27,75,0.4)', borderRadius: 12, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  emptyText: { color: '#9ca3af', fontSize: 16, marginTop: 12 },
  emptySubtext: { color: '#6b7280', fontSize: 13, marginTop: 4, textAlign: 'center' },
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,27,75,0.4)', borderRadius: 12, padding: 12, marginBottom: 8 },
  alertIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  alertIconEnter: { backgroundColor: 'rgba(16,185,129,0.1)' },
  alertIconExit: { backgroundColor: 'rgba(245,158,11,0.1)' },
  alertInfo: { flex: 1, marginLeft: 12 },
  alertText: { color: '#fff', fontSize: 14 },
  alertTime: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  bottomSpacer: { height: 100 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  modalSubtext: { color: '#9ca3af', fontSize: 14, marginBottom: 20, lineHeight: 20 },
  permissionIcon: { alignSelf: 'center', marginBottom: 16 },
  permissionText: { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16, marginBottom: 16 },
  label: { color: '#9ca3af', fontSize: 14, marginBottom: 8 },
  radiusOptions: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  radiusOption: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  radiusOptionActive: { backgroundColor: 'rgba(129,140,248,0.2)', borderWidth: 1, borderColor: '#818cf8' },
  radiusOptionText: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
  radiusOptionTextActive: { color: '#818cf8' },
  locationPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(129,140,248,0.1)', padding: 12, borderRadius: 8, marginBottom: 16, flex: 1 },
  locationPreviewText: { color: '#a5b4fc', fontSize: 13, flex: 1 },
  locationButtons: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  locationButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10, backgroundColor: 'rgba(129,140,248,0.1)', borderWidth: 1, borderColor: 'rgba(129,140,248,0.3)' },
  locationButtonText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },
  mapButton: { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#818cf8', borderRadius: 12, paddingVertical: 16 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  cancelButtonText: { color: '#6b7280', fontSize: 14 },
  // Map picker styles
  mapContainer: { flex: 1, backgroundColor: '#0f0d1a' },
  mapHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#1e1b4b', zIndex: 10 },
  mapBackButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  mapTitleContainer: { flex: 1, marginLeft: 12 },
  mapTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  mapSubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  mapLocateButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(129,140,248,0.15)', justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  mapBottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1e1b4b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  mapLocationInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  mapLocationText: { color: '#fff', fontSize: 14 },
  mapConfirmButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 16 },
  mapConfirmText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  mapHelpText: { color: '#9ca3af', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  // Static map fallback styles
  staticMapContainer: { flex: 1, backgroundColor: '#1e1b4b', justifyContent: 'center', alignItems: 'center' },
  staticMapImage: { width: SCREEN_WIDTH, height: 300, opacity: 0.3 },
  staticMapOverlay: { position: 'absolute', justifyContent: 'center', alignItems: 'center', padding: 32 },
  staticMapText: { color: '#9ca3af', fontSize: 16, textAlign: 'center', marginTop: 16, marginBottom: 24, lineHeight: 24 },
  staticMapButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#818cf8', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  staticMapButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
