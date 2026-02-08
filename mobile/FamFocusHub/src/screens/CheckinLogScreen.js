import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';
import ProfileAvatar from '../components/ProfileAvatar';

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const getLocationIcon = (type) => {
  switch (type?.toLowerCase()) {
    case 'home': return 'home';
    case 'school': return 'school';
    case 'work': return 'briefcase';
    case 'gym': return 'fitness';
    case 'park': return 'leaf';
    case 'store': return 'cart';
    case 'restaurant': return 'restaurant';
    default: return 'location';
  }
};

const getLocationColor = (type) => {
  switch (type?.toLowerCase()) {
    case 'home': return '#10b981';
    case 'school': return '#6366f1';
    case 'work': return '#f59e0b';
    case 'gym': return '#ec4899';
    default: return '#06b6d4';
  }
};

export default function CheckinLogScreen({ navigation }) {
  const { user } = useAuth();
  const theme = useTheme();
  const primaryColor = theme?.primary || '#6366f1';
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      // Fetch family members
      const membersData = await apiService.getFamilyMembers();
      const childMembers = (membersData.members || []).filter(m => m.role === 'child');
      setChildren(childMembers);
      
      if (childMembers.length > 0 && !selectedChild) {
        setSelectedChild(childMembers[0]);
      }
      
      // Fetch check-ins
      const checkinsData = await apiService.getCheckins();
      setCheckins(checkinsData.checkins || []);
      
      // Fetch location alerts
      const alertsData = await apiService.getLocationAlerts();
      setAlerts(alertsData.alerts || []);
    } catch (error) {
      console.error('Failed to fetch check-in data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedChild]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Filter check-ins for selected child
  const childCheckins = selectedChild 
    ? (checkins || []).filter(c => c && c.user_id === selectedChild.user_id)
    : [];

  // Group check-ins by date
  const groupedCheckins = childCheckins.reduce((groups, checkin) => {
    if (!checkin) return groups;
    const date = formatDate(checkin.timestamp || checkin.created_at);
    if (!date) return groups;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(checkin);
    return groups;
  }, {});

  // Get child's recent alerts
  const childAlerts = selectedChild
    ? (alerts || []).filter(a => a && a.user_id === selectedChild.user_id).slice(0, 5)
    : [];

  if (loading) {
    return (
      <AnimatedBackground page="location">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </AnimatedBackground>
    );
  }

  return (
    <AnimatedBackground page="location">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Check-in Log</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Child Selector */}
      {children.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childSelector}>
          {children.map((child) => (
            <TouchableOpacity
              key={child.user_id}
              style={[
                styles.childChip,
                selectedChild?.user_id === child.user_id && { backgroundColor: primaryColor }
              ]}
              onPress={() => setSelectedChild(child)}
            >
              <ProfileAvatar
                picture={child.picture}
                name={child.nickname || child.name}
                size="tiny"
              />
              <Text style={[
                styles.childChipText,
                selectedChild?.user_id === child.user_id && { color: '#fff' }
              ]}>
                {child.nickname || child.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {children.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#4b5563" />
          <Text style={styles.emptyTitle}>No Children Added</Text>
          <Text style={styles.emptyText}>Add children to your family to track their check-ins</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Selected Child Info */}
          {selectedChild && (
            <View style={styles.childInfoCard}>
              <ProfileAvatar
                picture={selectedChild.picture}
                name={selectedChild.nickname || selectedChild.name}
                size="large"
              />
              <View style={styles.childInfoText}>
                <Text style={styles.childName}>{selectedChild.nickname || selectedChild.name}</Text>
                <Text style={styles.childStatus}>
                  {selectedChild.online_status ? '🟢 Online' : '⚪ Offline'}
                </Text>
                {selectedChild.last_location && (
                  <View style={styles.lastLocation}>
                    <Ionicons name="location" size={12} color="#6b7280" />
                    <Text style={styles.lastLocationText}>
                      Last seen: {selectedChild.last_location}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.childStats}>
                <View style={styles.childStat}>
                  <Text style={styles.childStatNumber}>{childCheckins.length}</Text>
                  <Text style={styles.childStatLabel}>Check-ins</Text>
                </View>
              </View>
            </View>
          )}

          {/* Recent Alerts */}
          {childAlerts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="notifications" size={18} color="#f59e0b" />
                <Text style={styles.sectionTitle}>Recent Alerts</Text>
              </View>
              {childAlerts.map((alert, index) => (
                <View key={alert.alert_id || index} style={styles.alertCard}>
                  <View style={[styles.alertIcon, { 
                    backgroundColor: alert.type === 'exit' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)' 
                  }]}>
                    <Ionicons 
                      name={alert.type === 'exit' ? 'exit-outline' : 'enter-outline'} 
                      size={18} 
                      color={alert.type === 'exit' ? '#ef4444' : '#10b981'} 
                    />
                  </View>
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertTitle}>
                      {alert.type === 'exit' ? 'Left' : 'Arrived at'} {alert.zone_name || 'location'}
                    </Text>
                    <Text style={styles.alertTime}>
                      {formatDate(alert.timestamp)} at {formatTime(alert.timestamp)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Check-in Timeline */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={18} color={primaryColor} />
              <Text style={styles.sectionTitle}>Check-in History</Text>
            </View>

            {Object.keys(groupedCheckins).length === 0 ? (
              <View style={styles.noCheckins}>
                <Ionicons name="location-outline" size={40} color="#4b5563" />
                <Text style={styles.noCheckinsText}>No check-ins recorded yet</Text>
              </View>
            ) : (
              Object.entries(groupedCheckins).map(([date, dayCheckins]) => (
                <View key={date} style={styles.dayGroup}>
                  <Text style={styles.dayLabel}>{date}</Text>
                  {dayCheckins.map((checkin, index) => {
                    const locationType = checkin.location_type || checkin.zone_type;
                    const locColor = getLocationColor(locationType);
                    
                    return (
                      <View key={checkin.checkin_id || index} style={styles.checkinItem}>
                        <View style={styles.timelineConnector}>
                          <View style={[styles.timelineDot, { backgroundColor: locColor }]} />
                          {index < dayCheckins.length - 1 && <View style={styles.timelineLine} />}
                        </View>
                        <View style={styles.checkinCard}>
                          <View style={[styles.checkinIcon, { backgroundColor: `${locColor}20` }]}>
                            <Ionicons 
                              name={getLocationIcon(locationType)} 
                              size={18} 
                              color={locColor} 
                            />
                          </View>
                          <View style={styles.checkinInfo}>
                            <Text style={styles.checkinLocation}>
                              {checkin.location_name || checkin.zone_name || 'Unknown Location'}
                            </Text>
                            <Text style={styles.checkinAddress} numberOfLines={1}>
                              {checkin.address || `${checkin.lat?.toFixed(4)}, ${checkin.lng?.toFixed(4)}`}
                            </Text>
                          </View>
                          <Text style={styles.checkinTime}>
                            {formatTime(checkin.timestamp || checkin.created_at)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16 },
  backBtn: { padding: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  refreshBtn: { padding: 8 },
  
  childSelector: { paddingHorizontal: 16, marginBottom: 12 },
  childChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 20, marginRight: 10, gap: 8 },
  childChipText: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center' },
  
  content: { flex: 1, paddingHorizontal: 16 },
  
  childInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 16, padding: 16, marginBottom: 16, gap: 12 },
  childInfoText: { flex: 1 },
  childName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  childStatus: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  lastLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  lastLocationText: { fontSize: 11, color: '#6b7280' },
  childStats: { alignItems: 'center' },
  childStat: { alignItems: 'center' },
  childStatNumber: { fontSize: 24, fontWeight: '800', color: '#fff' },
  childStatLabel: { fontSize: 10, color: '#6b7280' },
  
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 12, padding: 12, marginBottom: 8, gap: 12 },
  alertIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  alertInfo: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  alertTime: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  
  noCheckins: { alignItems: 'center', paddingVertical: 40 },
  noCheckinsText: { color: '#6b7280', marginTop: 12 },
  
  dayGroup: { marginBottom: 16 },
  dayLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  
  checkinItem: { flexDirection: 'row', marginBottom: 4 },
  timelineConnector: { width: 24, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 14 },
  timelineLine: { width: 2, flex: 1, backgroundColor: 'rgba(99, 102, 241, 0.2)', marginTop: 4 },
  
  checkinCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 12, padding: 10, marginLeft: 8, gap: 10 },
  checkinIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  checkinInfo: { flex: 1 },
  checkinLocation: { fontSize: 13, fontWeight: '600', color: '#fff' },
  checkinAddress: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  checkinTime: { fontSize: 12, fontWeight: '600', color: '#a5b4fc' },
});
