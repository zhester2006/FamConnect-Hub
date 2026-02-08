import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, TextInput, Dimensions, ImageBackground, Animated, Image 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import { formatDate, formatTime } from '../utils/dateUtils';
import MedalEmblem from '../components/MedalEmblem';
import QuickActionsWidget from '../components/QuickActionsWidget';

const { width, height } = Dimensions.get('window');

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Nature and Historical Places for Screensaver (NO PEOPLE)
const SCREENSAVER_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',   // Swiss Alps Mountains
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800',   // Foggy Mountains
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',   // Mountain Peak
  'https://images.unsplash.com/photo-1548013146-72479768bada?w=800',     // Taj Mahal (monument only)
  'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800',     // Rome Colosseum
  'https://images.unsplash.com/photo-1526711657229-e7e080ed7aa1?w=800',  // Grand Canyon
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',  // Japan Temple
  'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800',  // Northern Lights
  'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=800',  // Great Wall China
  'https://images.unsplash.com/photo-1492136344046-866c85e0bf04?w=800',  // Waterfall
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800',  // Lake reflection
  'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800',  // Forest waterfall
  'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=800',  // Autumn forest
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',  // Mountain sunrise
  'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=800',  // Forest path
];

// Weather Icon Component
const WeatherIcon = ({ condition, size = 32 }) => {
  const iconMap = {
    sunny: { name: 'sunny', color: '#fbbf24' },
    clear: { name: 'sunny', color: '#fbbf24' },
    cloudy: { name: 'cloudy', color: '#9ca3af' },
    clouds: { name: 'cloudy', color: '#9ca3af' },
    rainy: { name: 'rainy', color: '#60a5fa' },
    rain: { name: 'rainy', color: '#60a5fa' },
    windy: { name: 'cloudy-outline', color: '#67e8f9' },
    snowy: { name: 'snow', color: '#e0f2fe' },
    snow: { name: 'snow', color: '#e0f2fe' },
    stormy: { name: 'thunderstorm', color: '#a78bfa' },
    thunderstorm: { name: 'thunderstorm', color: '#a78bfa' },
  };
  const icon = iconMap[condition?.toLowerCase()] || iconMap.sunny;
  return <Ionicons name={icon.name} size={size} color={icon.color} />;
};

// Mini Calendar Component
const MiniCalendar = ({ events, currentDate, setCurrentDate, onDayPress }) => {
  const today = new Date();
  
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const hasEvents = (day) => {
    if (!day) return false;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.some(e => e.event_date === dateStr);
  };

  return (
    <View style={styles.miniCalendar}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity 
          onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
        >
          <Ionicons name="chevron-back" size={16} color="#6b7280" />
        </TouchableOpacity>
        <Text style={styles.calendarMonthText}>
          {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>
        <TouchableOpacity 
          onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
        >
          <Ionicons name="chevron-forward" size={16} color="#6b7280" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.calendarDayNames}>
        {DAYS.map((d, i) => (
          <Text key={i} style={styles.dayName}>{d}</Text>
        ))}
      </View>
      
      <View style={styles.calendarDays}>
        {getDaysInMonth(currentDate).map((day, i) => {
          const isToday = day === today.getDate() && 
                         currentDate.getMonth() === today.getMonth() && 
                         currentDate.getFullYear() === today.getFullYear();
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.calendarDay,
                isToday && styles.calendarDayToday,
              ]}
              onPress={() => day && onDayPress && onDayPress(day)}
              disabled={!day}
            >
              <Text style={[
                styles.calendarDayText,
                isToday && styles.calendarDayTextToday,
              ]}>
                {day || ''}
              </Text>
              {hasEvents(day) && <View style={styles.eventDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default function HomeHubScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [time, setTime] = useState(new Date());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [familyMembers, setFamilyMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [quote, setQuote] = useState('');
  const [shoppingItems, setShoppingItems] = useState([]);
  const [todayChores, setTodayChores] = useState([]);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayEvents, setDayEvents] = useState([]);
  const [weather, setWeather] = useState({ condition: 'sunny', temp: 72, location: 'Loading...' });
  const [lastWeatherUpdate, setLastWeatherUpdate] = useState(null);
  
  // Quick Panel toggle (saved per user)
  const [showQuickPanel, setShowQuickPanel] = useState(true);
  
  // Screensaver state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Modals
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newItem, setNewItem] = useState('');

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Rotate screensaver images every 30 seconds
  useEffect(() => {
    const imageTimer = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
      
      setCurrentImageIndex(prev => (prev + 1) % SCREENSAVER_IMAGES.length);
    }, 30000);
    
    return () => clearInterval(imageTimer);
  }, [fadeAnim]);

  // Update weather every hour
  useEffect(() => {
    const weatherTimer = setInterval(() => {
      fetchWeather();
    }, 60 * 60 * 1000); // Every hour
    
    return () => clearInterval(weatherTimer);
  }, []);

  const fetchWeather = async () => {
    try {
      // Request and get current location for accurate weather
      let lat = null, lon = null;
      try {
        // Request permission if not granted
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const result = await Location.requestForegroundPermissionsAsync();
          status = result.status;
        }
        
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({ 
            accuracy: Location.Accuracy.Balanced,
            timeout: 10000,
          });
          lat = location.coords.latitude;
          lon = location.coords.longitude;
          console.log('Weather location:', lat, lon);
        }
      } catch (locError) {
        console.log('Location not available for weather:', locError.message);
      }
      
      const weatherData = await apiService.getWeather(lat, lon);
      if (weatherData) {
        setWeather({
          temp: Math.round(weatherData.temp || weatherData.temperature || 72),
          condition: weatherData.condition || weatherData.weather || 'sunny',
          location: weatherData.location || weatherData.city || 'Unknown',
        });
        setLastWeatherUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      setWeather(prev => ({ ...prev, location: 'Unavailable' }));
    }
  };

  const fetchData = useCallback(async () => {
    try {
      // Fetch all data with individual error handling
      const [membersData, eventsData, quoteData, shoppingData, choresData] = await Promise.all([
        apiService.getFamilyMembers().catch((e) => { console.log('Family members fetch failed:', e); return { members: [] }; }),
        apiService.getEvents().catch((e) => { console.log('Events fetch failed:', e); return { events: [] }; }),
        apiService.getDailyQuote().catch((e) => { console.log('Quote fetch failed:', e); return { quote: 'Family is not an important thing. It\'s everything.' }; }),
        apiService.getShoppingList().catch((e) => { console.log('Shopping fetch failed:', e); return { items: [] }; }),
        apiService.getChores().catch((e) => { console.log('Chores fetch failed:', e); return { chores: [] }; }),
      ]);

      // Fetch weather separately (non-blocking)
      fetchWeather().catch(e => console.log('Weather fetch failed:', e));

      setFamilyMembers(membersData?.members || []);
      setEvents(eventsData?.events || []);
      setQuote(quoteData?.quote || 'Family is everything.');
      setShoppingItems(shoppingData?.items || []);
      
      const today = new Date().toISOString().split('T')[0];
      setTodayChores((choresData?.chores || []).filter(c => c.scheduled_date === today));
    } catch (error) {
      console.error('Failed to fetch hub data:', error);
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

  const handleAddEvent = async () => {
    if (!newEventTitle.trim()) return;
    try {
      await apiService.createEvent({
        title: newEventTitle,
        event_date: new Date().toISOString().split('T')[0],
        event_type: 'event',
      });
      setShowAddEvent(false);
      setNewEventTitle('');
      fetchData();
    } catch (error) {
      console.error('Failed to add event:', error);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.trim()) return;
    try {
      await apiService.addShoppingItem({ name: newItem });
      setShowAddItem(false);
      setNewItem('');
      fetchData();
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  const todayEvents = events.filter(e => e.event_date === new Date().toISOString().split('T')[0]);
  const onlineMembers = familyMembers.filter(m => m.online_status);

  const handleDayPress = (day) => {
    const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const eventsForDay = events.filter(e => e.event_date === dateStr || e.date === dateStr);
    setSelectedDay({ day, dateStr });
    setDayEvents(eventsForDay);
    setShowDayModal(true);
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
      {/* Screensaver Background */}
      <Animated.View style={[styles.screensaverContainer, { opacity: fadeAnim }]}>
        <ImageBackground 
          source={{ uri: SCREENSAVER_IMAGES[currentImageIndex] }}
          style={styles.screensaverImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(15, 13, 26, 0.7)', 'rgba(15, 13, 26, 0.85)', 'rgba(15, 13, 26, 0.95)']}
            style={styles.screensaverOverlay}
          />
        </ImageBackground>
      </Animated.View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Home Hub</Text>
        <View style={styles.headerActions}>
          {user?.role === 'parent' && (
            <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsButton}>
              <Ionicons name="settings-outline" size={20} color="#a5b4fc" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color="#a5b4fc" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
      >
        {/* Weather & Time Row */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.weatherCard} onPress={fetchWeather}>
            <LinearGradient
              colors={['rgba(59, 130, 246, 0.3)', 'rgba(147, 51, 234, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.weatherGradient}
            >
              <View style={styles.weatherIconContainer}>
                <WeatherIcon condition={weather.condition} size={36} />
              </View>
              <View style={styles.weatherInfo}>
                <Text style={styles.temperature}>{Math.round(weather.temp || 72)}°F</Text>
                {weather.location ? (
                  <Text style={styles.weatherLocation}>{weather.location}</Text>
                ) : (
                  <Text style={styles.weatherCondition}>{weather.condition || 'Sunny'}</Text>
                )}
              </View>
              <Ionicons name="refresh-outline" size={14} color="#a5b4fc" style={{ opacity: 0.6 }} />
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.timeCard}>
            <Text style={styles.timeText}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.dateText}>
              {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.onlineCard}>
            <View style={styles.avatarRow}>
              {familyMembers.slice(0, 4).map((member, i) => (
                <View 
                  key={member.user_id} 
                  style={[styles.miniAvatar, { marginLeft: i > 0 ? -8 : 0 }]}
                >
                  <Text style={styles.miniAvatarText}>{member.name?.charAt(0)}</Text>
                  <View style={[
                    styles.onlineDot,
                    { backgroundColor: member.online_status ? '#10b981' : '#6b7280' }
                  ]} />
                </View>
              ))}
            </View>
            <Text style={styles.onlineText}>{onlineMembers.length} online</Text>
          </View>
        </View>

        {/* Daily Inspiration */}
        <View style={styles.quoteCard}>
          <Ionicons name="sparkles" size={18} color="#f59e0b" style={{ marginRight: 8 }} />
          <View style={styles.quoteContent}>
            <Text style={styles.quoteLabel}>Daily Inspiration</Text>
            <Text style={styles.quoteText}>"{quote}"</Text>
          </View>
        </View>

        {/* Quick Actions Widget (Parents Only - Toggleable) */}
        {user?.role === 'parent' && showQuickPanel && (
          <QuickActionsWidget onRefresh={fetchData} />
        )}

        {/* Main Content Grid */}
        <View style={styles.contentGrid}>
          {/* Left Column: Calendar + Today's Events */}
          <View style={styles.leftColumn}>
            {/* Calendar */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar" size={16} color="#06b6d4" />
                <Text style={styles.cardTitle}>Calendar</Text>
                <TouchableOpacity 
                  onPress={() => setShowAddEvent(true)}
                  style={styles.addButton}
                >
                  <Ionicons name="add" size={16} color="#06b6d4" />
                </TouchableOpacity>
              </View>
              <MiniCalendar 
                events={events}
                currentDate={calendarDate}
                setCurrentDate={setCalendarDate}
                onDayPress={handleDayPress}
              />
            </View>

            {/* Today's Events */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="notifications" size={16} color="#f59e0b" />
                <Text style={styles.cardTitle}>Today</Text>
                <Text style={styles.cardBadge}>{todayEvents.length}</Text>
              </View>
              {todayEvents.length === 0 ? (
                <Text style={styles.emptyText}>No events today</Text>
              ) : (
                todayEvents.slice(0, 3).map(event => (
                  <View key={event.event_id} style={styles.eventItem}>
                    <View style={styles.eventDotLarge} />
                    <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Right Column: Chores + Shopping */}
          <View style={styles.rightColumn}>
            {/* Chores */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="checkbox" size={16} color="#10b981" />
                <Text style={styles.cardTitle}>Chores</Text>
                <Text style={styles.cardBadge}>
                  {todayChores.filter(c => c.status === 'approved').length}/{todayChores.length}
                </Text>
              </View>
              {todayChores.length === 0 ? (
                <Text style={styles.emptyText}>No chores today!</Text>
              ) : (
                todayChores.slice(0, 4).map(chore => (
                  <View key={chore.chore_id} style={styles.choreItem}>
                    <Ionicons 
                      name={chore.status === 'approved' ? 'checkmark-circle' : 'ellipse-outline'} 
                      size={16} 
                      color={chore.status === 'approved' ? '#10b981' : '#6b7280'} 
                    />
                    <View style={styles.choreInfo}>
                      <Text style={styles.choreTitle} numberOfLines={1}>{chore.title}</Text>
                      <View style={styles.choreMetaRow}>
                        {chore.assignee_name && (
                          <View style={styles.choreAssignee}>
                            {chore.assignee_picture ? (
                              <Image source={{ uri: chore.assignee_picture }} style={styles.choreAssigneeAvatar} />
                            ) : (
                              <View style={styles.choreAssigneeAvatarPlaceholder}>
                                <Text style={styles.choreAssigneeAvatarText}>{chore.assignee_name?.charAt(0)}</Text>
                              </View>
                            )}
                            <Text style={styles.choreAssigneeName}>{chore.assignee_name}</Text>
                          </View>
                        )}
                        <Text style={styles.chorePoints}>+{chore.points || 10}pts</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Shopping */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="cart" size={16} color="#3b82f6" />
                <Text style={styles.cardTitle}>Shopping</Text>
                <TouchableOpacity 
                  onPress={() => setShowAddItem(true)}
                  style={styles.addButton}
                >
                  <Ionicons name="add" size={16} color="#3b82f6" />
                </TouchableOpacity>
              </View>
              {shoppingItems.length === 0 ? (
                <Text style={styles.emptyText}>List empty</Text>
              ) : (
                shoppingItems.slice(0, 6).map(item => (
                  <View key={item.item_id} style={styles.shoppingItem}>
                    <View style={[
                      styles.shoppingDot,
                      { backgroundColor: item.status === 'purchased' ? '#6b7280' : '#fbbf24' }
                    ]} />
                    <Text 
                      style={[
                        styles.shoppingText,
                        item.status === 'purchased' && styles.shoppingTextDone
                      ]} 
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>

        {/* Weather Update Info */}
        {lastWeatherUpdate && (
          <Text style={styles.lastUpdateText}>
            Weather updated {lastWeatherUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Event Modal */}
      <Modal visible={showAddEvent} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Event</Text>
              <TouchableOpacity onPress={() => setShowAddEvent(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Event title"
              placeholderTextColor="#6b7280"
              value={newEventTitle}
              onChangeText={setNewEventTitle}
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleAddEvent}>
              <Text style={styles.submitButtonText}>Add Event</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Shopping Item Modal */}
      <Modal visible={showAddItem} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Item</Text>
              <TouchableOpacity onPress={() => setShowAddItem(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Item name"
              placeholderTextColor="#6b7280"
              value={newItem}
              onChangeText={setNewItem}
            />
            <TouchableOpacity style={[styles.submitButton, { backgroundColor: '#3b82f6' }]} onPress={handleAddItem}>
              <Text style={styles.submitButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Day Events Popup Modal */}
      <Modal visible={showDayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDay ? new Date(selectedDay.dateStr).toLocaleDateString('en-US', { 
                  weekday: 'long', month: 'long', day: 'numeric' 
                }) : 'Events'}
              </Text>
              <TouchableOpacity onPress={() => setShowDayModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            
            {dayEvents.length === 0 ? (
              <View style={styles.emptyDayEvents}>
                <Ionicons name="calendar-outline" size={48} color="#6b7280" />
                <Text style={styles.emptyDayText}>No events this day</Text>
                <TouchableOpacity 
                  style={styles.addEventBtn}
                  onPress={() => { setShowDayModal(false); setShowAddEvent(true); }}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.addEventBtnText}>Add Event</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={styles.dayEventsList}>
                {dayEvents.map((event, index) => (
                  <View key={event.event_id || index} style={styles.dayEventItem}>
                    <View style={[
                      styles.dayEventDot, 
                      { backgroundColor: event.type === 'work' ? '#3b82f6' : 
                                        event.type === 'appointment' ? '#f59e0b' : 
                                        event.type === 'task' ? '#10b981' : '#06b6d4' }
                    ]} />
                    <View style={styles.dayEventInfo}>
                      <Text style={styles.dayEventTitle}>{event.title}</Text>
                      {event.time && (
                        <Text style={styles.dayEventTime}>{event.time}</Text>
                      )}
                      <Text style={styles.dayEventType}>{event.type || 'event'}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0d1a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d1a' },
  screensaverContainer: { position: 'absolute', width: '100%', height: '100%' },
  screensaverImage: { width: '100%', height: '100%' },
  screensaverOverlay: { position: 'absolute', width: '100%', height: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, zIndex: 10 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  refreshButton: { padding: 8 },
  scrollView: { flex: 1, padding: 12, zIndex: 10 },
  topRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  weatherCard: { flex: 1.2, overflow: 'hidden', borderRadius: 12 },
  weatherGradient: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  weatherIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  weatherInfo: { flex: 1 },
  temperature: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  weatherLocation: { fontSize: 11, color: '#a5b4fc', marginTop: 2 },
  weatherCondition: { fontSize: 11, color: '#a5b4fc', textTransform: 'capitalize', marginTop: 2 },
  timeCard: { flex: 1, backgroundColor: 'rgba(30, 27, 75, 0.9)', borderRadius: 12, padding: 12, alignItems: 'center' },
  timeText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  dateText: { fontSize: 10, color: '#a5b4fc' },
  onlineCard: { flex: 1, backgroundColor: 'rgba(30, 27, 75, 0.9)', borderRadius: 12, padding: 12, alignItems: 'center' },
  avatarRow: { flexDirection: 'row' },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0f0d1a' },
  miniAvatarText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  onlineDot: { position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#0f0d1a' },
  onlineText: { fontSize: 10, color: '#10b981', marginTop: 4 },
  quoteCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(245, 158, 11, 0.15)', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.2)' },
  quoteContent: { flex: 1 },
  quoteLabel: { fontSize: 10, color: '#f59e0b', fontWeight: '600', marginBottom: 4 },
  quoteText: { fontSize: 13, color: '#fff', fontStyle: 'italic', lineHeight: 18 },
  contentGrid: { flexDirection: 'row', gap: 12 },
  leftColumn: { flex: 1, gap: 12 },
  rightColumn: { flex: 1, gap: 12 },
  card: { backgroundColor: 'rgba(30, 27, 75, 0.9)', borderRadius: 12, padding: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  cardTitle: { flex: 1, fontSize: 12, fontWeight: '600', color: '#fff' },
  cardBadge: { fontSize: 10, color: '#6b7280' },
  addButton: { padding: 4 },
  emptyText: { fontSize: 11, color: '#6b7280', textAlign: 'center', paddingVertical: 8 },
  miniCalendar: {},
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calendarMonthText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  calendarDayNames: { flexDirection: 'row', marginBottom: 4 },
  dayName: { flex: 1, fontSize: 9, color: '#6b7280', textAlign: 'center', fontWeight: '600' },
  calendarDays: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: { width: `${100/7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  calendarDayToday: { backgroundColor: '#6366f1', borderRadius: 12 },
  calendarDayText: { fontSize: 10, color: '#9ca3af' },
  calendarDayTextToday: { color: '#fff', fontWeight: 'bold' },
  eventDot: { position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: '#f59e0b' },
  eventItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  eventDotLarge: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' },
  eventTitle: { flex: 1, fontSize: 12, color: '#fff' },
  choreItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  choreInfo: { flex: 1 },
  choreTitle: { fontSize: 11, color: '#fff', marginBottom: 2 },
  choreMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choreAssignee: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  choreAssigneeAvatar: { width: 14, height: 14, borderRadius: 7 },
  choreAssigneeAvatarPlaceholder: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  choreAssigneeAvatarText: { color: '#fff', fontSize: 7, fontWeight: 'bold' },
  choreAssigneeName: { fontSize: 9, color: '#a5b4fc' },
  chorePoints: { fontSize: 10, color: '#f59e0b', fontWeight: '600' },
  shoppingItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  shoppingDot: { width: 6, height: 6, borderRadius: 3 },
  shoppingText: { flex: 1, fontSize: 11, color: '#fff' },
  shoppingTextDone: { color: '#6b7280', textDecorationLine: 'line-through' },
  lastUpdateText: { fontSize: 10, color: '#4b5563', textAlign: 'center', marginTop: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  input: { backgroundColor: 'rgba(15, 13, 26, 0.5)', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  submitButton: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  // Day Events Popup styles
  emptyDayEvents: { alignItems: 'center', paddingVertical: 30 },
  emptyDayText: { color: '#6b7280', fontSize: 14, marginTop: 12, marginBottom: 16 },
  addEventBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  addEventBtnText: { color: '#fff', fontWeight: '600' },
  dayEventsList: { maxHeight: 300 },
  dayEventItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 12, padding: 14, marginBottom: 10 },
  dayEventDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  dayEventInfo: { flex: 1 },
  dayEventTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  dayEventTime: { color: '#a5b4fc', fontSize: 12, marginTop: 2 },
  dayEventType: { color: '#6b7280', fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
});
