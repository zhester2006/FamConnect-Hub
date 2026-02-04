import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/api.service';

export default function CalendarScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

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

  const getDaysInMonth = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add empty slots for days before the first day of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(i);
    }
    
    return days;
  };

  const getEventsForDate = (day) => {
    if (!day) return [];
    const dateStr = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day).toISOString().split('T')[0];
    return events.filter(e => e.date === dateStr);
  };

  const changeMonth = (delta) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setSelectedDate(newDate);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  const today = new Date();
  const isToday = (day) => {
    return day === today.getDate() && 
           selectedDate.getMonth() === today.getMonth() && 
           selectedDate.getFullYear() === today.getFullYear();
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1e1b4b', '#312e81', '#1e1b4b']} style={styles.gradient} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Calendar</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => changeMonth(-1)}>
          <Ionicons name="chevron-back" size={24} color="#a5b4fc" />
        </TouchableOpacity>
        <Text style={styles.monthText}>
          {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={() => changeMonth(1)}>
          <Ionicons name="chevron-forward" size={24} color="#a5b4fc" />
        </TouchableOpacity>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekDays}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <Text key={day} style={styles.weekDayText}>{day}</Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {getDaysInMonth().map((day, index) => (
          <View key={index} style={styles.dayCell}>
            {day && (
              <TouchableOpacity 
                style={[styles.dayButton, isToday(day) && styles.todayButton]}
              >
                <Text style={[styles.dayText, isToday(day) && styles.todayText]}>{day}</Text>
                {getEventsForDate(day).length > 0 && (
                  <View style={styles.eventDot} />
                )}
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Events List */}
      <ScrollView style={styles.eventsList}>
        <Text style={styles.eventsTitle}>Upcoming Events</Text>
        {events.length === 0 ? (
          <View style={styles.emptyEvents}>
            <Ionicons name="calendar-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyText}>No events scheduled</Text>
          </View>
        ) : (
          events.slice(0, 5).map((event) => (
            <View key={event.event_id} style={styles.eventCard}>
              <View style={styles.eventDateBadge}>
                <Text style={styles.eventDay}>{new Date(event.date).getDate()}</Text>
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
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 16 },
  monthText: { fontSize: 18, fontWeight: '600', color: '#fff' },
  weekDays: { flexDirection: 'row', paddingHorizontal: 8 },
  weekDayText: { flex: 1, textAlign: 'center', color: '#6b7280', fontSize: 12, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  dayCell: { width: '14.28%', aspectRatio: 1, padding: 4 },
  dayButton: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  todayButton: { backgroundColor: '#6366f1' },
  dayText: { color: '#fff', fontSize: 14 },
  todayText: { fontWeight: 'bold' },
  eventDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fbbf24', position: 'absolute', bottom: 4 },
  eventsList: { flex: 1, padding: 16, marginTop: 16 },
  eventsTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  emptyEvents: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: '#6b7280', marginTop: 8 },
  eventCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, padding: 16, flexDirection: 'row', marginBottom: 8 },
  eventDateBadge: { backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: 8, padding: 8, alignItems: 'center', minWidth: 50 },
  eventDay: { fontSize: 20, fontWeight: 'bold', color: '#818cf8' },
  eventMonth: { fontSize: 12, color: '#a5b4fc' },
  eventInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  eventTitle: { color: '#fff', fontSize: 15, fontWeight: '500' },
  eventTime: { color: '#a5b4fc', fontSize: 13, marginTop: 2 },
});
