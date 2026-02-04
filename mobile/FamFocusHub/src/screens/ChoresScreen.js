import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';

export default function ChoresScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chores, setChores] = useState([]);
  const [filter, setFilter] = useState('all'); // all, pending, completed

  const fetchChores = useCallback(async () => {
    try {
      const data = await apiService.getChores();
      setChores(data.chores || []);
    } catch (error) {
      console.error('Failed to fetch chores:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChores();
  }, [fetchChores]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChores();
    setRefreshing(false);
  }, [fetchChores]);

  const handleCompleteChore = async (choreId) => {
    try {
      await apiService.completeChore(choreId);
      fetchChores();
    } catch (error) {
      console.error('Failed to complete chore:', error);
    }
  };

  const getFilteredChores = () => {
    switch (filter) {
      case 'pending':
        return chores.filter(c => c.status !== 'completed');
      case 'completed':
        return chores.filter(c => c.status === 'completed');
      default:
        return chores;
    }
  };

  const groupChoresByDate = () => {
    const grouped = {};
    getFilteredChores().forEach(chore => {
      const date = chore.scheduled_date || 'Unscheduled';
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(chore);
    });
    return grouped;
  };

  const formatDate = (dateStr) => {
    if (dateStr === 'Unscheduled') return dateStr;
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  const groupedChores = groupChoresByDate();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#1e1b4b']}
        style={styles.gradient}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Chores</Text>
        {user?.role === 'parent' && (
          <TouchableOpacity 
            onPress={() => navigation.navigate('ChoreScheduler')}
            style={styles.addButton}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {['all', 'pending', 'completed'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
      >
        {Object.keys(groupedChores).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkbox-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyText}>No chores found</Text>
            {user?.role === 'parent' && (
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => navigation.navigate('ChoreScheduler')}
              >
                <Text style={styles.createButtonText}>Create Chores</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          Object.entries(groupedChores).map(([date, dateChores]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{formatDate(date)}</Text>
              {dateChores.map((chore) => (
                <View key={chore.chore_id} style={styles.choreCard}>
                  <View style={[
                    styles.statusIndicator,
                    chore.status === 'completed' && styles.statusCompleted
                  ]} />
                  <View style={styles.choreContent}>
                    <Text style={[
                      styles.choreName,
                      chore.status === 'completed' && styles.choreNameCompleted
                    ]}>
                      {chore.title}
                    </Text>
                    {chore.assigned_to && (
                      <Text style={styles.choreAssignee}>
                        Assigned to: {chore.assignee_name || 'Unknown'}
                      </Text>
                    )}
                    <View style={styles.choreFooter}>
                      <View style={styles.pointsBadge}>
                        <Ionicons name="star" size={12} color="#fbbf24" />
                        <Text style={styles.pointsText}>{chore.points || 10} pts</Text>
                      </View>
                      {chore.status === 'completed' && (
                        <View style={styles.completedBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                          <Text style={styles.completedText}>Done</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {chore.status !== 'completed' && (
                    <TouchableOpacity
                      style={styles.completeButton}
                      onPress={() => handleCompleteChore(chore.chore_id)}
                    >
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          ))
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    padding: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 8,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 27, 75, 0.5)',
  },
  filterTabActive: {
    backgroundColor: '#6366f1',
  },
  filterTabText: {
    color: '#a5b4fc',
    fontSize: 14,
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    color: '#a5b4fc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  choreCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6b7280',
    marginRight: 12,
  },
  statusCompleted: {
    backgroundColor: '#10b981',
  },
  choreContent: {
    flex: 1,
  },
  choreName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  choreNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#6b7280',
  },
  choreAssignee: {
    color: '#a5b4fc',
    fontSize: 13,
    marginBottom: 8,
  },
  choreFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pointsText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    color: '#10b981',
    fontSize: 12,
  },
  completeButton: {
    backgroundColor: '#10b981',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
