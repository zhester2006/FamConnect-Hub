import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert,
  Linking, Platform, Dimensions, Switch
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [locationPermission, setLocationPermission] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [geofences, setGeofences] = useState([]);
  const [children, setChildren] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showAddGeofence, setShowAddGeofence] = useState(false);
  const [newGeofence, setNewGeofence] = useState({ name: '', radius: 300 });
  const [saving, setSaving] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const locationSubscription = useRef(null);

  useEffect(() => {
    initLocation();
    fetchData();
    
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const initLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        // Send initial location update
        await sendLocationUpdate(location.coords.latitude, location.coords.longitude);
      }
    } catch (error) {
      console.error('Location init error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [geofencesRes, membersRes, checkinsRes, alertsRes] = await Promise.all([
        apiService.getGeofences(),
        apiService.getFamilyMembers(),
        apiService.getCheckins().catch(() => ({ checkins: [] })),
        apiService.getLocationAlerts().catch(() => ({ alerts: [] })),
      ]);
      
      setGeofences(geofencesRes.geofences || []);
      setChildren((membersRes.members || []).filter(m => m.role === 'child'));
      setCheckins(checkinsRes.checkins || []);
      setAlerts(alertsRes.alerts || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const sendLocationUpdate = async (latitude, longitude) => {
    try {
      await apiService.updateLocation(latitude, longitude);
      checkGeofences(latitude, longitude);
    } catch (error) {
      console.error('Failed to send location:', error);
    }
  };

  const checkGeofences = (lat, lng) => {
    geofences.forEach(fence => {
      const distance = calculateDistance(lat, lng, fence.latitude, fence.longitude);
      const wasInside = fence.isInside;
      const isInside = distance <= fence.radius_feet;
      
      if (isInside !== wasInside) {
        // Trigger haptic feedback on geofence enter/exit
        Haptics.notificationAsync(
          isInside ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
        );
        
        // Send alert
        apiService.sendGeofenceAlert({
          geofence_id: fence.geofence_id,
          entered: isInside,
          latitude: lat,
          longitude: lng,
        });
      }
    });
  };

  const startTracking = async () => {
    if (!locationPermission) {
      Alert.alert(
        'Permission Required',
        'Location permission is needed for tracking.',
        [{ text: 'OK', onPress: () => Linking.openSettings() }]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTracking(true);
    
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10, // Update every 10 meters
        timeInterval: 30000, // Or every 30 seconds
      },
      (location) => {
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        sendLocationUpdate(location.coords.latitude, location.coords.longitude);
      }
    );
  };

  const stopTracking = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTracking(false);
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  const handleCheckIn = async () => {
    if (!currentLocation) {
      Alert.alert('Error', 'Unable to get current location');
      return;
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
    if (!newGeofence.name.trim() || !currentLocation) {
      Alert.alert('Error', 'Please enter a name and ensure location is available');
      return;
    }

    setSaving(true);
    try {
      await apiService.createGeofence({
        name: newGeofence.name,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radius_feet: newGeofence.radius,
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddGeofence(false);
      setNewGeofence({ name: '', radius: 300 });
      fetchData();
      Alert.alert('Success', 'Safe zone created!');
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

  const openMaps = (lat, lng, label) => {
    const scheme = Platform.OS === 'ios' ? 'maps:' : 'geo:';
    const url = Platform.OS === 'ios'
      ? `${scheme}?q=${label}&ll=${lat},${lng}`
      : `${scheme}${lat},${lng}?q=${label}`;
    Linking.openURL(url);
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
          <Text style={styles.subtitle}>GPS Check-in & Safe Zones</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.trackingButton, tracking && styles.trackingButtonActive]}
            onPress={tracking ? stopTracking : startTracking}
          >
            <Ionicons 
              name={tracking ? 'location' : 'location-outline'} 
              size={20} 
              color={tracking ? '#10b981' : '#fff'} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
      >
        {/* GPS Status Card */}
        <View style={[styles.card, styles.statusCard]}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIcon}>
              <Ionicons 
                name={locationPermission ? 'location' : 'location-outline'} 
                size={24} 
                color={locationPermission ? '#10b981' : '#ef4444'} 
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {locationPermission ? 'Location Active' : 'Location Disabled'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {tracking ? 'Real-time tracking enabled' : 'Tap to enable tracking'}
              </Text>
            </View>
            <Switch
              value={tracking}
              onValueChange={tracking ? stopTracking : startTracking}
              trackColor={{ false: '#374151', true: '#10b981' }}
              thumbColor={tracking ? '#fff' : '#9ca3af'}
            />
          </View>
          
          {currentLocation && (
            <View style={styles.coordinatesRow}>
              <Text style={styles.coordinatesText}>
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </Text>
              <TouchableOpacity 
                style={styles.mapButton}
                onPress={() => openMaps(currentLocation.latitude, currentLocation.longitude, 'My Location')}
              >
                <Ionicons name="navigate" size={16} color="#818cf8" />
                <Text style={styles.mapButtonText}>Open Map</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Check-in Button */}
          <TouchableOpacity 
            style={styles.checkinButton}
            onPress={handleCheckIn}
            disabled={!currentLocation}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.checkinButtonText}>Check In Now</Text>
          </TouchableOpacity>
        </View>

        {/* Children's Locations (Parent View) */}
        {user?.role === 'parent' && children.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Family Members</Text>
            {children.map((child) => {
              const lastLocation = child.last_location;
              const isOnline = child.online_status;
              const gpsEnabled = child.permissions?.share_location;
              
              return (
                <TouchableOpacity 
                  key={child.user_id} 
                  style={styles.childCard}
                  onPress={() => {
                    if (lastLocation) {
                      openMaps(lastLocation.lat, lastLocation.lng, child.name);
                    }
                  }}
                  disabled={!lastLocation}
                >
                  <View style={styles.childAvatar}>
                    <Text style={styles.childAvatarText}>{child.name?.charAt(0)}</Text>
                    <View style={[styles.onlineIndicator, isOnline && styles.onlineIndicatorActive]} />
                  </View>
                  <View style={styles.childInfo}>
                    <Text style={styles.childName}>{child.nickname || child.name}</Text>
                    <View style={styles.childMeta}>
                      {gpsEnabled ? (
                        lastLocation ? (
                          <>
                            <Ionicons name="location" size={12} color="#10b981" />
                            <Text style={styles.childLocationText}>
                              Last seen {formatDate(lastLocation.timestamp)} at {formatTime(lastLocation.timestamp)}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="help-circle" size={12} color="#fbbf24" />
                            <Text style={styles.childLocationText}>Location not available</Text>
                          </>
                        )
                      ) : (
                        <>
                          <Ionicons name="eye-off" size={12} color="#6b7280" />
                          <Text style={styles.childLocationText}>Location sharing disabled</Text>
                        </>
                      )}
                    </View>
                  </View>
                  {lastLocation && (
                    <Ionicons name="navigate-outline" size={20} color="#818cf8" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Safe Zones (Geofences) */}
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
                {user?.role === 'parent' ? 'Add a safe zone to get alerts' : 'Ask a parent to set up safe zones'}
              </Text>
            </View>
          ) : (
            geofences.map((fence) => {
              const distance = currentLocation 
                ? calculateDistance(currentLocation.latitude, currentLocation.longitude, fence.latitude, fence.longitude)
                : null;
              const isInside = distance !== null && distance <= fence.radius_feet;
              
              return (
                <View key={fence.geofence_id} style={styles.geofenceCard}>
                  <View style={[styles.geofenceIcon, isInside && styles.geofenceIconActive]}>
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
                    <TouchableOpacity 
                      onPress={() => openMaps(fence.latitude, fence.longitude, fence.name)}
                    >
                      <Ionicons name="map-outline" size={20} color="#6b7280" />
                    </TouchableOpacity>
                    {user?.role === 'parent' && (
                      <TouchableOpacity 
                        onPress={() => handleDeleteGeofence(fence.geofence_id)}
                        style={styles.deleteButton}
                      >
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
                    {alert.child_name} {alert.type === 'enter' ? 'entered' : 'left'} {alert.zone_name}
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
      <Modal
        visible={showAddGeofence}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Safe Zone</Text>
              <TouchableOpacity onPress={() => setShowAddGeofence(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtext}>
              This will create a safe zone at your current location
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Zone name (e.g., Home, School)"
              placeholderTextColor="#6b7280"
              value={newGeofence.name}
              onChangeText={(text) => setNewGeofence(prev => ({ ...prev, name: text }))}
              autoFocus
            />

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

            {currentLocation && (
              <View style={styles.locationPreview}>
                <Ionicons name="location" size={16} color="#818cf8" />
                <Text style={styles.locationPreviewText}>
                  {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0d1a',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0d1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  trackingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(30, 27, 75, 0.6)',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusCard: {
    gap: 12,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusSubtitle: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  coordinatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  coordinatesText: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapButtonText: {
    color: '#818cf8',
    fontSize: 13,
  },
  checkinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#818cf8',
    paddingVertical: 14,
    borderRadius: 12,
  },
  checkinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#818cf8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.6)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#818cf8',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  childAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6b7280',
    borderWidth: 2,
    borderColor: '#1e1b4b',
  },
  onlineIndicatorActive: {
    backgroundColor: '#10b981',
  },
  childInfo: {
    flex: 1,
    marginLeft: 12,
  },
  childName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  childMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  childLocationText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  geofenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.6)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  geofenceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  geofenceIconActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  geofenceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  geofenceName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  geofenceDetails: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  insideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  insideBadgeText: {
    color: '#10b981',
    fontSize: 12,
  },
  geofenceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteButton: {
    padding: 4,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.4)',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 12,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertIconEnter: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  alertIconExit: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  alertInfo: {
    flex: 1,
    marginLeft: 12,
  },
  alertText: {
    color: '#fff',
    fontSize: 14,
  },
  alertTime: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  bottomSpacer: {
    height: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e1b4b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalSubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  label: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  radiusOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  radiusOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  radiusOptionActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#818cf8',
  },
  radiusOptionText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  radiusOptionTextActive: {
    color: '#818cf8',
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationPreviewText: {
    color: '#a5b4fc',
    fontSize: 13,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#818cf8',
    borderRadius: 12,
    paddingVertical: 16,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
