import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import MedalEmblem from '../components/MedalEmblem';

export default function ChildSpace({ navigation, route }) {
  const { user } = useAuth();
  // If viewing another child's profile (parent view), use route.params.child
  // Otherwise use the logged-in user (child's own view)
  const viewingChild = route?.params?.child || null;
  const targetChild = viewingChild || user;
  const isParentViewing = viewingChild && user?.role === 'parent';
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chores, setChores] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [readingLogs, setReadingLogs] = useState([]);
  const [quote, setQuote] = useState('');
  const [childRank, setChildRank] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [choresData, tasksData, rewardsData, quoteData, logsData, leaderboardData] = await Promise.all([
        apiService.getChores(),
        apiService.getTasks(),
        apiService.getRewards(),
        apiService.getDailyQuote().catch(() => ({ quote: 'Have an awesome day!' })),
        apiService.getReadingLogs(targetChild?.user_id).catch(() => ({ logs: [] })),
        apiService.getLeaderboard().catch(() => ({ leaderboard: [] })),
      ]);

      // Filter chores assigned to this child
      setChores((choresData.chores || []).filter(c => c.assigned_to === targetChild?.user_id));
      setTasks(tasksData.tasks || []);
      setRewards(rewardsData.rewards || []);
      setQuote(quoteData.quote || '');
      setReadingLogs((logsData.logs || []).slice(0, 3));
      
      // Find child's rank
      const leaderboard = leaderboardData.leaderboard || [];
      const rankIndex = leaderboard.findIndex(child => child.user_id === targetChild?.user_id);
      setChildRank(rankIndex >= 0 ? rankIndex + 1 : null);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [targetChild?.user_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleCompleteChore = async (choreId) => {
    try {
      await apiService.completeChore(choreId);
      fetchData();
    } catch (error) {
      console.error('Failed to complete chore:', error);
    }
  };

  const getPendingChores = () => chores.filter(c => c.status !== 'completed');
  const getCompletedChores = () => chores.filter(c => c.status === 'completed');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#064e3b', '#047857', '#064e3b']}
        style={styles.gradient}
      />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          {isParentViewing && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={isParentViewing ? { flex: 1, marginLeft: 8 } : {}}>
            <View style={styles.nameRow}>
              <Text style={styles.greeting}>{isParentViewing ? `${targetChild?.name}'s Space` : 'Hey there,'}</Text>
              {childRank && childRank <= 3 && (
                <MedalEmblem rank={childRank} size="medium" />
              )}
            </View>
            {!isParentViewing && (
              <Text style={styles.userName}>{targetChild?.nickname || targetChild?.name || 'Champ'}! 🌟</Text>
            )}
          </View>
          <View style={styles.pointsBadge}>
            <Ionicons name="star" size={20} color="#fbbf24" />
            <Text style={styles.pointsText}>{targetChild?.points || 0}</Text>
          </View>
        </View>

        {/* Daily Quote */}
        {quote && (
          <View style={styles.quoteCard}>
            <Ionicons name="sparkles" size={20} color="#fbbf24" />
            <Text style={styles.quoteText}>"{quote}"</Text>
          </View>
        )}

        {/* Progress Card */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Today's Progress</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${chores.length > 0 ? (getCompletedChores().length / chores.length) * 100 : 0}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {getCompletedChores().length} of {chores.length} chores done
          </Text>
        </View>

        {/* My Chores */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🧹 My Chores</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Chores')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {getPendingChores().length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-done-circle" size={48} color="#10b981" />
              <Text style={styles.emptyTitle}>All Done!</Text>
              <Text style={styles.emptyText}>You've completed all your chores today!</Text>
            </View>
          ) : (
            getPendingChores().map((chore) => (
              <View key={chore.chore_id} style={styles.choreCard}>
                <View style={styles.choreInfo}>
                  <Text style={styles.choreName}>{chore.title}</Text>
                  <View style={styles.chorePoints}>
                    <Ionicons name="star" size={14} color="#fbbf24" />
                    <Text style={styles.chorePointsText}>{chore.points || 10} pts</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.completeButton}
                  onPress={() => handleCompleteChore(chore.chore_id)}
                >
                  <Ionicons name="checkmark" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Rewards Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🎁 Rewards</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Rewards')}>
              <Text style={styles.seeAll}>Shop</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rewardsScroll}>
            {rewards.slice(0, 5).map((reward) => (
              <TouchableOpacity 
                key={reward.reward_id} 
                style={styles.rewardCard}
                onPress={() => navigation.navigate('Rewards')}
              >
                <View style={styles.rewardIcon}>
                  <Ionicons name="gift" size={32} color="#a855f7" />
                </View>
                <Text style={styles.rewardName} numberOfLines={2}>{reward.name}</Text>
                <View style={styles.rewardCost}>
                  <Ionicons name="star" size={12} color="#fbbf24" />
                  <Text style={styles.rewardCostText}>{reward.points_required}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Reading Log Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📚 Reading Log</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ReadingLogs')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {readingLogs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="book-outline" size={40} color="#6b7280" />
              <Text style={styles.emptyTitle}>No Books Yet</Text>
              <Text style={styles.emptyText}>Start reading and log your books!</Text>
            </View>
          ) : (
            readingLogs.map((log) => (
              <View key={log.log_id} style={styles.readingCard}>
                <View style={styles.readingInfo}>
                  <Text style={styles.bookTitle}>{log.book_title}</Text>
                  <Text style={styles.bookAuthor}>{log.author || 'Unknown Author'}</Text>
                  <View style={styles.readingMeta}>
                    <Ionicons name="book" size={12} color="#6b7280" />
                    <Text style={styles.pagesText}>{log.pages_read || 0} pages</Text>
                  </View>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: log.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(251, 191, 36, 0.2)' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: log.status === 'approved' ? '#10b981' : '#fbbf24' }
                  ]}>
                    {log.status === 'approved' ? '✓ Approved' : '⏳ Pending'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.quickAction, { backgroundColor: 'rgba(6, 182, 212, 0.2)' }]}
            onPress={() => navigation.navigate('Chat')}
          >
            <Ionicons name="chatbubbles" size={28} color="#06b6d4" />
            <Text style={styles.quickActionText}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.quickAction, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}
            onPress={() => navigation.navigate('Leaderboard')}
          >
            <Ionicons name="trophy" size={28} color="#a855f7" />
            <Text style={styles.quickActionText}>Leaderboard</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.quickAction, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}
            onPress={() => navigation.navigate('ReadingLogs')}
          >
            <Ionicons name="book" size={28} color="#3b82f6" />
            <Text style={styles.quickActionText}>Reading</Text>
          </TouchableOpacity>
        </View>

        {/* More Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.quickAction, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}
            onPress={() => navigation.navigate('Calendar')}
          >
            <Ionicons name="calendar" size={28} color="#fbbf24" />
            <Text style={styles.quickActionText}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.quickAction, { backgroundColor: 'rgba(236, 72, 153, 0.2)' }]}
            onPress={() => navigation.navigate('FamilyWall')}
          >
            <Ionicons name="people" size={28} color="#ec4899" />
            <Text style={styles.quickActionText}>Family Wall</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.quickAction, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}
            onPress={() => navigation.navigate('Shopping')}
          >
            <Ionicons name="cart" size={28} color="#10b981" />
            <Text style={styles.quickActionText}>Shopping</Text>
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
    backgroundColor: '#0a1f1a',
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
    backgroundColor: '#0a1f1a',
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
    color: '#6ee7b7',
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  pointsText: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quoteCard: {
    backgroundColor: 'rgba(6, 78, 59, 0.8)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  quoteText: {
    flex: 1,
    color: '#d1fae5',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  progressCard: {
    backgroundColor: 'rgba(6, 78, 59, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  progressTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressBar: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 6,
  },
  progressText: {
    color: '#6ee7b7',
    fontSize: 14,
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
    color: '#10b981',
  },
  emptyCard: {
    backgroundColor: 'rgba(6, 78, 59, 0.5)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptyText: {
    color: '#6ee7b7',
    marginTop: 4,
  },
  choreCard: {
    backgroundColor: 'rgba(6, 78, 59, 0.8)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  choreInfo: {
    flex: 1,
  },
  choreName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  chorePoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chorePointsText: {
    color: '#fbbf24',
    fontSize: 14,
  },
  completeButton: {
    backgroundColor: '#10b981',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardsScroll: {
    marginHorizontal: -8,
  },
  rewardCard: {
    backgroundColor: 'rgba(6, 78, 59, 0.8)',
    borderRadius: 16,
    padding: 16,
    width: 120,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  rewardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardName: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
    height: 32,
  },
  rewardCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardCostText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  quickAction: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  backButton: {
    padding: 8,
  },
  readingCard: {
    backgroundColor: 'rgba(6, 78, 59, 0.8)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  readingInfo: {
    flex: 1,
  },
  bookTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  bookAuthor: {
    color: '#6ee7b7',
    fontSize: 12,
    marginTop: 2,
  },
  readingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  pagesText: {
    color: '#6b7280',
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
