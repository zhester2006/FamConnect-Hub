import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';

export default function CalendarScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);
  
  // Modals
  const [showDayModal, setShowDayModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  // Form data
  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventType, setEventType] = useState('event');

  const fetchEvents = useCallback(async () => {
    try {
      const data = await apiService.getEvents();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  }, [fetchEvents]);

  const getDaysInMonth = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(i);
    }
    return days;
  };

  const getDateString = (day) => {
    if (!day) return '';
    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    return d.toISOString().split('T')[0];
  };

  const getEventsForDate = (day) => {
    if (!day) return [];
    const dateStr = getDateString(day);
    return events.filter(e => e.event_date === dateStr || e.date === dateStr);
  };

  const changeMonth = (delta) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setSelectedDate(newDate);
  };

  const handleDayPress = (day) => {
    if (!day) return;
    const dayEvents = getEventsForDate(day);
    setSelectedDayEvents(dayEvents);
    setShowDayModal(true);
  };

  const handleAddEvent = async () => {
    if (!eventTitle.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }
    
    try {
      const dateStr = selectedDayEvents.length > 0 
        ? (selectedDayEvents[0]?.event_date || selectedDayEvents[0]?.date)
        : new Date().toISOString().split('T')[0];
        
      await apiService.createEvent({
        title: eventTitle,
        event_date: dateStr,
        time: eventTime || null,
        event_type: eventType,
      });
      
      Alert.alert('Success', 'Event created!');
      setShowAddModal(false);
      setEventTitle('');
      setEventTime('');
      fetchEvents();
    } catch (error) {
      Alert.alert('Error', 'Failed to create event');
    }
  };

  const handleEditEvent = async () => {
    if (!selectedEvent || !eventTitle.trim()) return;
    
    try {
      await apiService.put(`/events/${selectedEvent.event_id}`, {
        title: eventTitle,
        time: eventTime || null,
        event_type: eventType,
      });
      
      Alert.alert('Success', 'Event updated!');
      setShowEditModal(false);
      setSelectedEvent(null);
      fetchEvents();
    } catch (error) {
      Alert.alert('Error', 'Failed to update event');
    }
  };

  const handleDeleteEvent = (event) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.delete(`/events/${event.event_id}`);
              Alert.alert('Deleted', 'Event has been removed');
              const updatedEvents = selectedDayEvents.filter(e => e.event_id !== event.event_id);
              setSelectedDayEvents(updatedEvents);
              fetchEvents();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (event) => {
    setSelectedEvent(event);
    setEventTitle(event.title);
    setEventTime(event.time || '');
    setEventType(event.event_type || 'event');
    setShowEditModal(true);
  };

  const today = new Date();
  const isToday = (day) => {
    return day === today.getDate() && 
           selectedDate.getMonth() === today.getMonth() && 
           selectedDate.getFullYear() === today.getFullYear();
  };

  const getEventTypeColor = (type) => {
    switch (type) {
      case 'event': return '#06b6d4';
      case 'work': return '#3b82f6';
      case 'appointment': return '#f59e0b';
      case 'task': return '#10b981';
      case 'birthday': return '#ec4899';
      case 'holiday': return '#10b981';
      case 'reminder': return '#6366f1';
      default: return '#06b6d4';
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
    <AnimatedBackground page="calendar">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Calendar</Text>
        <TouchableOpacity 
          onPress={() => {
            setEventTitle('');
            setEventTime('');
            setEventType('event');
            setShowAddModal(true);
          }}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
      >
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color="#a5b4fc" />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color="#a5b4fc" />
          </TouchableOpacity>
        </View>

        {/* Event Type Legend */}
        <View style={styles.legendContainer}>
          {[
            { type: 'event', label: 'Event', color: '#06b6d4' },
            { type: 'work', label: 'Work', color: '#3b82f6' },
            { type: 'appointment', label: 'Appt', color: '#f59e0b' },
            { type: 'task', label: 'Task', color: '#10b981' },
          ].map((item) => (
            <View key={item.type} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Card */}
        <View style={styles.calendarCard}>
          {/* Weekday Headers */}
          <View style={styles.weekDays}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <Text key={i} style={styles.weekDayText}>{day}</Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {getDaysInMonth().map((day, index) => {
              const dayEvents = getEventsForDate(day);
              const hasEvents = dayEvents.length > 0;
              
              return (
                <TouchableOpacity 
                  key={index} 
                  style={styles.dayCell}
                  onPress={() => handleDayPress(day)}
                  disabled={!day}
                >
                  {day && (
                    <View style={[styles.dayButton, isToday(day) && styles.todayButton]}>
                      <Text style={[styles.dayText, isToday(day) && styles.todayText]}>{day}</Text>
                      {hasEvents && (
                        <View style={styles.eventIndicators}>
                          {dayEvents.slice(0, 3).map((e, i) => (
                            <View 
                              key={i} 
                              style={[styles.eventDot, { backgroundColor: getEventTypeColor(e.event_type) }]} 
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Upcoming Events */}
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          {events.length === 0 ? (
            <View style={styles.emptyEvents}>
              <Ionicons name="calendar-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyText}>No events scheduled</Text>
              <Text style={styles.emptySubtext}>Tap + to add an event</Text>
            </View>
          ) : (
            events.slice(0, 8).map((event) => (
              <TouchableOpacity 
                key={event.event_id} 
                style={styles.eventCard}
                onPress={() => openEditModal(event)}
              >
                <View style={[styles.eventColorBar, { backgroundColor: getEventTypeColor(event.event_type) }]} />
                <View style={styles.eventDateBadge}>
                  <Text style={styles.eventDay}>
                    {new Date(event.event_date || event.date).getDate()}
                  </Text>
                  <Text style={styles.eventMonth}>
                    {new Date(event.event_date || event.date).toLocaleDateString('en-US', { month: 'short' })}
                  </Text>
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventTime}>{event.time || 'All Day'}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteEvent(event)}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Day Events Modal */}
      <Modal visible={showDayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Events
              </Text>
              <TouchableOpacity onPress={() => setShowDayModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            
            {selectedDayEvents.length === 0 ? (
              <View style={styles.noEventsContainer}>
                <Ionicons name="calendar-outline" size={48} color="#6b7280" />
                <Text style={styles.noEventsText}>No events this day</Text>
              </View>
            ) : (
              <ScrollView style={styles.dayEventsList}>
                {selectedDayEvents.map((event) => (
                  <View key={event.event_id} style={styles.dayEventItem}>
                    <View style={[styles.dayEventDot, { backgroundColor: getEventTypeColor(event.event_type) }]} />
                    <View style={styles.dayEventInfo}>
                      <Text style={styles.dayEventTitle}>{event.title}</Text>
                      <Text style={styles.dayEventTime}>{event.time || 'All Day'}</Text>
                    </View>
                    <View style={styles.dayEventActions}>
                      <TouchableOpacity 
                        style={styles.eventActionBtn}
                        onPress={() => { setShowDayModal(false); openEditModal(event); }}
                      >
                        <Ionicons name="create-outline" size={20} color="#a5b4fc" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.eventActionBtn}
                        onPress={() => handleDeleteEvent(event)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            
            <TouchableOpacity 
              style={styles.addEventBtn}
              onPress={() => { setShowDayModal(false); setShowAddModal(true); }}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addEventBtnText}>Add Event</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Event Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Event</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Event title"
              placeholderTextColor="#6b7280"
              value={eventTitle}
              onChangeText={setEventTitle}
              autoFocus
            />
            
            <TextInput
              style={styles.input}
              placeholder="Time (optional, e.g., 3:00 PM)"
              placeholderTextColor="#6b7280"
              value={eventTime}
              onChangeText={setEventTime}
            />
            
            <Text style={styles.inputLabel}>Event Type</Text>
            <View style={styles.typeSelector}>
              {[
                { type: 'event', label: 'Event', icon: 'calendar', color: '#06b6d4' },
                { type: 'work', label: 'Work', icon: 'briefcase', color: '#3b82f6' },
                { type: 'appointment', label: 'Appt', icon: 'time', color: '#f59e0b' },
                { type: 'task', label: 'Task', icon: 'checkbox', color: '#10b981' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.type}
                  style={[styles.typeOption, eventType === item.type && styles.typeOptionActive]}
                  onPress={() => setEventType(item.type)}
                >
                  <Ionicons 
                    name={item.icon} 
                    size={18} 
                    color={eventType === item.type ? '#fff' : '#6b7280'} 
                  />
                  <Text style={[styles.typeOptionText, eventType === item.type && styles.typeOptionTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleAddEvent}>
                <Text style={styles.submitBtnText}>Add Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Event Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Event</Text>
              <TouchableOpacity onPress={() => { setShowEditModal(false); setSelectedEvent(null); }}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Event title"
              placeholderTextColor="#6b7280"
              value={eventTitle}
              onChangeText={setEventTitle}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Time (optional)"
              placeholderTextColor="#6b7280"
              value={eventTime}
              onChangeText={setEventTime}
            />
            
            <Text style={styles.inputLabel}>Event Type</Text>
            <View style={styles.typeSelector}>
              {[
                { type: 'event', label: 'Event', icon: 'calendar', color: '#06b6d4' },
                { type: 'work', label: 'Work', icon: 'briefcase', color: '#3b82f6' },
                { type: 'appointment', label: 'Appt', icon: 'time', color: '#f59e0b' },
                { type: 'task', label: 'Task', icon: 'checkbox', color: '#10b981' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.type}
                  style={[styles.typeOption, eventType === item.type && styles.typeOptionActive]}
                  onPress={() => setEventType(item.type)}
                >
                  <Ionicons 
                    name={item.icon} 
                    size={18} 
                    color={eventType === item.type ? '#fff' : '#6b7280'} 
                  />
                  <Text style={[styles.typeOptionText, eventType === item.type && styles.typeOptionTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.deleteEventBtn} 
                onPress={() => selectedEvent && handleDeleteEvent(selectedEvent)}
              >
                <Ionicons name="trash" size={18} color="#ef4444" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowEditModal(false); setSelectedEvent(null); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleEditEvent}>
                <Text style={styles.submitBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d1a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  addButton: { padding: 8, backgroundColor: 'rgba(99, 102, 241, 0.3)', borderRadius: 12 },
  scrollView: { flex: 1, padding: 16 },
  
  // Month Navigation
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navButton: { padding: 8 },
  monthText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  
  // Calendar Card
  calendarCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 20, padding: 16, marginBottom: 20 },
  weekDays: { flexDirection: 'row', marginBottom: 8 },
  weekDayText: { flex: 1, textAlign: 'center', color: '#6b7280', fontSize: 12, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, padding: 2 },
  dayButton: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  todayButton: { backgroundColor: '#6366f1' },
  dayText: { color: '#fff', fontSize: 14 },
  todayText: { fontWeight: 'bold' },
  eventIndicators: { flexDirection: 'row', position: 'absolute', bottom: 4, gap: 2 },
  eventDot: { width: 4, height: 4, borderRadius: 2 },
  
  // Upcoming Section
  upcomingSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  emptyEvents: { alignItems: 'center', paddingVertical: 40, backgroundColor: 'rgba(30, 27, 75, 0.5)', borderRadius: 16 },
  emptyText: { color: '#6b7280', marginTop: 12, fontSize: 15 },
  emptySubtext: { color: '#4b5563', marginTop: 4, fontSize: 13 },
  
  // Event Cards
  eventCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  eventColorBar: { width: 4, height: '100%', borderRadius: 2, position: 'absolute', left: 0 },
  eventDateBadge: { backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: 12, padding: 10, alignItems: 'center', marginLeft: 8 },
  eventDay: { fontSize: 20, fontWeight: 'bold', color: '#818cf8' },
  eventMonth: { fontSize: 11, color: '#a5b4fc', textTransform: 'uppercase' },
  eventInfo: { flex: 1, marginLeft: 14 },
  eventTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  eventTime: { color: '#a5b4fc', fontSize: 13, marginTop: 2 },
  deleteBtn: { padding: 8 },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  
  // Day Events
  noEventsContainer: { alignItems: 'center', paddingVertical: 40 },
  noEventsText: { color: '#6b7280', marginTop: 12 },
  dayEventsList: { maxHeight: 300 },
  dayEventItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 13, 26, 0.5)', borderRadius: 12, padding: 14, marginBottom: 10 },
  dayEventDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  dayEventInfo: { flex: 1 },
  dayEventTitle: { color: '#fff', fontSize: 15, fontWeight: '500' },
  dayEventTime: { color: '#a5b4fc', fontSize: 13, marginTop: 2 },
  dayEventActions: { flexDirection: 'row', gap: 8 },
  eventActionBtn: { padding: 8 },
  addEventBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 30, marginTop: 16 },
  addEventBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  // Form
  input: { backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)', marginBottom: 16 },
  inputLabel: { color: '#a5b4fc', fontSize: 14, marginBottom: 10 },
  typeSelector: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeOption: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, gap: 4 },
  typeOptionActive: { backgroundColor: '#6366f1' },
  typeOptionText: { color: '#6b7280', fontSize: 11, fontWeight: '600' },
  typeOptionTextActive: { color: '#fff' },
  
  // Modal Actions
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, backgroundColor: '#374151', paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  submitBtn: { flex: 1, backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteEventBtn: { padding: 16, backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 30, alignItems: 'center' },
});
