import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, TextInput, Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';
import { formatDate, formatTime } from '../utils/dateUtils';

const { width } = Dimensions.get('window');

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Weather Icon Component
const WeatherIcon = ({ condition, size = 32 }) => {
  const iconMap = {
    sunny: { name: 'sunny', color: '#fbbf24' },
    cloudy: { name: 'cloudy', color: '#9ca3af' },
    rainy: { name: 'rainy', color: '#60a5fa' },
    windy: { name: 'cloudy-outline', color: '#67e8f9' },
    snowy: { name: 'snow', color: '#e0f2fe' },
    stormy: { name: 'thunderstorm', color: '#a78bfa' },
  };
  const icon = iconMap[condition] || iconMap.sunny;
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
  const [weather, setWeather] = useState({ condition: 'sunny', temp: 72 });
  
  // Modals
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newItem, setNewItem] = useState('');

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [membersData, eventsData, quoteData, shoppingData, choresData, weatherData] = await Promise.all([
        apiService.getFamilyMembers().catch(() => ({ members: [] })),
        apiService.getEvents().catch(() => ({ events: [] })),
        apiService.getDailyQuote().catch(() => ({ quote: 'Family is not an important thing. It\'s everything.' })),
        apiService.getShoppingList().catch(() => ({ items: [] })),
        apiService.getChores().catch(() => ({ chores: [] })),
        apiService.getWeather().catch(() => ({ temp: 72, condition: 'sunny' })),
      ]);

      setFamilyMembers(membersData.members || []);
      setEvents(eventsData.events || []);
      setQuote(quoteData.quote || 'Family is everything.');
      setShoppingItems(shoppingData.items || []);
      setWeather(weatherData || { temp: 72, condition: 'sunny' });
      
      const today = new Date().toISOString().split('T')[0];
      setTodayChores((choresData.chores || []).filter(c => c.scheduled_date === today));
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <AnimatedBackground page="homehub">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Home Hub</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
      >
        {/* Weather & Time Row */}
        <View style={styles.topRow}>
          <View style={styles.weatherCard}>
            <WeatherIcon condition={weather.condition} />
            <Text style={styles.temperature}>{Math.round(weather.temp || 72)}°F</Text>
          </View>
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
                      <Text style={styles.chorePoints}>+{chore.points || 10}pts</Text>
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
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0d1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
    padding: 12,
  },
  topRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  weatherCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  temperature: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  timeCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  dateText: {
    fontSize: 10,
    color: '#a5b4fc',
  },
  onlineCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
  },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0f0d1a',
  },
  miniAvatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#0f0d1a',
  },
  onlineText: {
    fontSize: 10,
    color: '#10b981',
    marginTop: 4,
  },
  quoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  quoteContent: {
    flex: 1,
  },
  quoteLabel: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '600',
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 13,
    color: '#fff',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  contentGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  leftColumn: {
    flex: 1,
    gap: 12,
  },
  rightColumn: {
    flex: 1,
    gap: 12,
  },
  card: {
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  cardBadge: {
    fontSize: 10,
    color: '#6b7280',
  },
  addButton: {
    padding: 4,
  },
  emptyText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Mini Calendar
  miniCalendar: {},
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarMonthText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  calendarDayNames: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayName: {
    flex: 1,
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '600',
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: `${100/7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayToday: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
  },
  calendarDayText: {
    fontSize: 10,
    color: '#9ca3af',
  },
  calendarDayTextToday: {
    color: '#fff',
    fontWeight: 'bold',
  },
  eventDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f59e0b',
  },
  // Event Items
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  eventDotLarge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  eventTitle: {
    flex: 1,
    fontSize: 12,
    color: '#fff',
  },
  // Chore Items
  choreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  choreInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  choreTitle: {
    flex: 1,
    fontSize: 11,
    color: '#fff',
  },
  chorePoints: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '600',
  },
  // Shopping Items
  shoppingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  shoppingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  shoppingText: {
    flex: 1,
    fontSize: 11,
    color: '#fff',
  },
  shoppingTextDone: {
    color: '#6b7280',
    textDecorationLine: 'line-through',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  input: {
    backgroundColor: 'rgba(15, 13, 26, 0.5)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  submitButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
