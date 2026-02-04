import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';

export default function ParentDashboard({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [children, setChildren] = useState([]);
  const [chores, setChores] = useState([]);
  const [events, setEvents] = useState([]);
  const [weather, setWeather] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [membersData, choresData, eventsData, weatherData] = await Promise.all([
        apiService.getFamilyMembers(),
        apiService.getChores(),
        apiService.getEvents(),
        apiService.getWeather().catch(() => null),
      ]);

      setChildren((membersData.members || []).filter(m => m.role === 'child'));
      setChores(choresData.chores || []);
      setEvents(eventsData.events || []);
      setWeather(weatherData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const getTodayChores = () => {
    const today = new Date().toISOString().split('T')[0];
    return chores.filter(c => c.scheduled_date === today);
  };

  const getUpcomingEvents = () => {
    return events.slice(0, 3);
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
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name || 'Parent'}</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#a5b4fc" />
          </TouchableOpacity>
        </View>

        {/* Weather Card */}
        {weather && (
          <View style={styles.card}>
            <View style={styles.weatherCard}>
              <Ionicons name="partly-sunny" size={32} color="#fbbf24" />
              <View style={styles.weatherInfo}>
                <Text style={styles.temperature}>{Math.round(weather.temp || 72)}°F</Text>
                <Text style={styles.weatherDesc}>{weather.description || 'Partly Cloudy'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
            <Ionicons name="people" size={24} color="#818cf8" />
            <Text style={styles.statNumber}>{children.length}</Text>
            <Text style={styles.statLabel}>Children</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <Text style={styles.statNumber}>{getTodayChores().length}</Text>
            <Text style={styles.statLabel}>Today's Chores</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}>
            <Ionicons name="calendar" size={24} color="#fbbf24" />
            <Text style={styles.statNumber}>{events.length}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
        </View>

        {/* Children Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Children</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Family')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {children.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={40} color="#6b7280" />
              <Text style={styles.emptyText}>No children added yet</Text>
            </View>
          ) : (
            children.map((child) => (
              <TouchableOpacity 
                key={child.user_id} 
                style={styles.childCard}
                onPress={() => navigation.navigate('ChildDetail', { child })}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{child.name?.charAt(0)}</Text>
                </View>
                <View style={styles.childInfo}>
                  <Text style={styles.childName}>{child.nickname || child.name}</Text>
                  <Text style={styles.childPoints}>{child.points || 0} points</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Today's Chores */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Chores</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Chores')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {getTodayChores().length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-done-outline" size={40} color="#10b981" />
              <Text style={styles.emptyText}>No chores scheduled for today!</Text>
            </View>
          ) : (
            getTodayChores().slice(0, 3).map((chore) => (
              <View key={chore.chore_id} style={styles.choreCard}>
                <View style={[styles.choreStatus, chore.status === 'completed' && styles.choreCompleted]} />
                <View style={styles.choreInfo}>
                  <Text style={styles.choreName}>{chore.title}</Text>
                  <Text style={styles.choreAssignee}>
                    {children.find(c => c.user_id === chore.assigned_to)?.name || 'Unassigned'}
                  </Text>
                </View>
                <View style={styles.chorePoints}>
                  <Text style={styles.pointsText}>{chore.points || 10} pts</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Calendar')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {getUpcomingEvents().length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={40} color="#6b7280" />
              <Text style={styles.emptyText}>No upcoming events</Text>
            </View>
          ) : (
            getUpcomingEvents().map((event) => (
              <View key={event.event_id} style={styles.eventCard}>
                <View style={styles.eventDate}>
                  <Text style={styles.eventDay}>
                    {new Date(event.date).getDate()}
                  </Text>
                  <Text style={styles.eventMonth}>
                    {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
                  </Text>
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventTime}>{event.time || 'All Day'}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('ChoreScheduler')}
          >
            <Ionicons name="add-circle" size={24} color="#818cf8" />
            <Text style={styles.actionText}>Schedule Chores</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Chat')}
          >
            <Ionicons name="chatbubbles" size={24} color="#10b981" />
            <Text style={styles.actionText}>Family Chat</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
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
    height: 300,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0d1a',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 48,
  },
  greeting: {
    fontSize: 14,
    color: '#a5b4fc',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  settingsButton: {
    padding: 8,
  },
  card: {
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherInfo: {
    marginLeft: 16,
  },
  temperature: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  weatherDesc: {
    fontSize: 14,
    color: '#a5b4fc',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#a5b4fc',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  seeAll: {
    fontSize: 14,
    color: '#818cf8',
  },
  emptyCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.5)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    marginTop: 8,
  },
  childCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  childInfo: {
    flex: 1,
    marginLeft: 12,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  childPoints: {
    fontSize: 14,
    color: '#fbbf24',
  },
  choreCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  choreStatus: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6b7280',
  },
  choreCompleted: {
    backgroundColor: '#10b981',
  },
  choreInfo: {
    flex: 1,
    marginLeft: 12,
  },
  choreName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  choreAssignee: {
    fontSize: 14,
    color: '#a5b4fc',
  },
  chorePoints: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pointsText: {
    color: '#fbbf24',
    fontWeight: '600',
  },
  eventCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDate: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minWidth: 60,
  },
  eventDay: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#818cf8',
  },
  eventMonth: {
    fontSize: 12,
    color: '#a5b4fc',
  },
  eventInfo: {
    flex: 1,
    marginLeft: 16,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  eventTime: {
    fontSize: 14,
    color: '#a5b4fc',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontWeight: '500',
  },
});
