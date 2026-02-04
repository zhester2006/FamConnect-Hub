import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Dimensions, Image 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import { formatDate, formatTime, getDayName } from '../utils/dateUtils';

const { width } = Dimensions.get('window');

export default function HomeHubScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState(null);
  const [events, setEvents] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [wallPosts, setWallPosts] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchData();
    
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      const [weatherData, eventsData, membersData, wallData] = await Promise.all([
        apiService.get('/weather').catch(() => null),
        apiService.get('/events').catch(() => ({ events: [] })),
        apiService.get('/family/members').catch(() => ({ members: [] })),
        apiService.get('/family-wall?limit=5').catch(() => ({ posts: [] })),
      ]);
      
      setWeather(weatherData);
      setEvents(eventsData.events || []);
      setFamilyMembers(membersData.members || []);
      setWallPosts(wallData.posts || []);
    } catch (error) {
      console.error('Failed to fetch hub data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTodayEvents = () => {
    const today = new Date().toDateString();
    return events.filter(e => new Date(e.date).toDateString() === today);
  };

  const getWeatherIcon = (condition) => {
    const icons = {
      'Clear': 'sunny',
      'Clouds': 'cloudy',
      'Rain': 'rainy',
      'Snow': 'snow',
      'Thunderstorm': 'thunderstorm',
      'Drizzle': 'rainy',
      'Mist': 'cloudy',
      'Fog': 'cloudy',
    };
    return icons[condition] || 'partly-sunny';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  const todayEvents = getTodayEvents();

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={['#0f172a', '#1e1b4b', '#312e81']} 
        style={styles.gradient}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Family Hub</Text>
        <TouchableOpacity onPress={fetchData} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Date & Time Widget */}
        <View style={styles.dateTimeWidget}>
          <Text style={styles.timeText}>
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.dateText}>
            {getDayName(currentTime)}, {formatDate(currentTime)}
          </Text>
        </View>

        {/* Weather Widget */}
        {weather && (
          <View style={styles.weatherWidget}>
            <View style={styles.weatherMain}>
              <Ionicons 
                name={getWeatherIcon(weather.condition)} 
                size={48} 
                color="#f59e0b" 
              />
              <View style={styles.weatherInfo}>
                <Text style={styles.temperature}>{Math.round(weather.temp || 0)}°F</Text>
                <Text style={styles.weatherCondition}>{weather.condition || 'Clear'}</Text>
              </View>
            </View>
            <View style={styles.weatherDetails}>
              <View style={styles.weatherDetail}>
                <Ionicons name="water" size={16} color="#60a5fa" />
                <Text style={styles.weatherDetailText}>{weather.humidity || 0}%</Text>
              </View>
              <View style={styles.weatherDetail}>
                <Ionicons name="speedometer" size={16} color="#60a5fa" />
                <Text style={styles.weatherDetailText}>{weather.wind_speed || 0} mph</Text>
              </View>
              <View style={styles.weatherDetail}>
                <Ionicons name="thermometer" size={16} color="#60a5fa" />
                <Text style={styles.weatherDetailText}>Feels {Math.round(weather.feels_like || 0)}°</Text>
              </View>
            </View>
          </View>
        )}

        {/* Today's Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Events</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Calendar')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {todayEvents.length > 0 ? (
            <View style={styles.eventsList}>
              {todayEvents.slice(0, 4).map((event, index) => (
                <View key={event.event_id || index} style={styles.eventCard}>
                  <View style={[styles.eventDot, { backgroundColor: event.color || '#818cf8' }]} />
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventTime}>
                      {event.time || formatTime(event.date)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyEvents}>
              <Ionicons name="calendar-outline" size={32} color="#4b5563" />
              <Text style={styles.emptyText}>No events today</Text>
            </View>
          )}
        </View>

        {/* Family Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Family</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Family')}>
              <Text style={styles.seeAll}>Manage</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
            {familyMembers.map((member, index) => (
              <TouchableOpacity 
                key={member.user_id || index} 
                style={styles.memberCard}
                onPress={() => {
                  if (member.role === 'child' && user?.role === 'parent') {
                    navigation.navigate('ChildDetail', { childId: member.user_id });
                  }
                }}
              >
                <View style={styles.memberAvatar}>
                  {member.picture ? (
                    <Image source={{ uri: member.picture }} style={styles.memberImage} />
                  ) : (
                    <Text style={styles.memberAvatarText}>{member.name?.charAt(0)}</Text>
                  )}
                  <View style={[styles.statusDot, { backgroundColor: member.online ? '#10b981' : '#6b7280' }]} />
                </View>
                <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
                <Text style={styles.memberRole}>{member.role}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Family Wall Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Family Wall</Text>
            <TouchableOpacity onPress={() => navigation.navigate('FamilyWall')}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {wallPosts.length > 0 ? (
            <View style={styles.wallPreview}>
              {wallPosts.slice(0, 3).map((post, index) => (
                <View key={post.post_id || index} style={styles.wallPost}>
                  <View style={styles.postHeader}>
                    <View style={styles.postAvatar}>
                      <Text style={styles.postAvatarText}>{post.user_name?.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={styles.postAuthor}>{post.user_name}</Text>
                      <Text style={styles.postTime}>{formatTime(post.created_at)}</Text>
                    </View>
                  </View>
                  <Text style={styles.postContent} numberOfLines={2}>{post.content}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyEvents}>
              <Ionicons name="chatbubbles-outline" size={32} color="#4b5563" />
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Chat')}>
              <View style={[styles.actionIcon, { backgroundColor: '#6366f120' }]}>
                <Ionicons name="chatbubbles" size={24} color="#6366f1" />
              </View>
              <Text style={styles.actionLabel}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Chores')}>
              <View style={[styles.actionIcon, { backgroundColor: '#10b98120' }]}>
                <Ionicons name="checkbox" size={24} color="#10b981" />
              </View>
              <Text style={styles.actionLabel}>Chores</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Shopping')}>
              <View style={[styles.actionIcon, { backgroundColor: '#f59e0b20' }]}>
                <Ionicons name="cart" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.actionLabel}>Shopping</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Location')}>
              <View style={[styles.actionIcon, { backgroundColor: '#ef444420' }]}>
                <Ionicons name="location" size={24} color="#ef4444" />
              </View>
              <Text style={styles.actionLabel}>Location</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0d1a' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d1a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  refreshButton: { padding: 8 },
  scrollView: { flex: 1, padding: 16 },
  dateTimeWidget: { alignItems: 'center', marginBottom: 24 },
  timeText: { fontSize: 56, fontWeight: '200', color: '#fff', letterSpacing: 4 },
  dateText: { fontSize: 18, color: '#a5b4fc', marginTop: 4 },
  weatherWidget: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 20, padding: 20, marginBottom: 20 },
  weatherMain: { flexDirection: 'row', alignItems: 'center' },
  weatherInfo: { marginLeft: 16 },
  temperature: { fontSize: 48, fontWeight: '300', color: '#fff' },
  weatherCondition: { fontSize: 16, color: '#a5b4fc' },
  weatherDetails: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  weatherDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weatherDetailText: { color: '#a5b4fc', fontSize: 14 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  seeAll: { color: '#818cf8', fontSize: 14 },
  eventsList: { gap: 8 },
  eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, padding: 12 },
  eventDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  eventInfo: { flex: 1 },
  eventTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  eventTime: { color: '#a5b4fc', fontSize: 13, marginTop: 2 },
  emptyEvents: { alignItems: 'center', padding: 24, backgroundColor: 'rgba(30, 27, 75, 0.5)', borderRadius: 12 },
  emptyText: { color: '#6b7280', marginTop: 8 },
  membersScroll: { marginHorizontal: -4 },
  memberCard: { alignItems: 'center', marginHorizontal: 8, width: 80 },
  memberAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  memberImage: { width: 60, height: 60, borderRadius: 30 },
  memberAvatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  statusDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#1e1b4b' },
  memberName: { color: '#fff', fontSize: 12, marginTop: 8, textAlign: 'center' },
  memberRole: { color: '#6b7280', fontSize: 10, textTransform: 'capitalize' },
  wallPreview: { gap: 12 },
  wallPost: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, padding: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  postAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  postAvatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  postAuthor: { color: '#fff', fontSize: 14, fontWeight: '600' },
  postTime: { color: '#6b7280', fontSize: 11 },
  postContent: { color: '#a5b4fc', fontSize: 14 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { width: (width - 56) / 4, alignItems: 'center' },
  actionIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionLabel: { color: '#fff', fontSize: 12 },
});
