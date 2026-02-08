import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';

export default function AchievementsScreen({ route }) {
  const theme = useTheme();
  const { user: authUser } = useAuth();
  const user = route?.params?.user || authUser;
  
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState({});
  const [familyAchievements, setFamilyAchievements] = useState([]);
  const [familyStats, setFamilyStats] = useState({});
  const [seasonalChallenges, setSeasonalChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [showCelebration, setShowCelebration] = useState(null);
  const [celebrationAnim] = useState(new Animated.Value(0));

  const fetchAchievements = useCallback(async () => {
    if (!user?.user_id) {
      setLoading(false);
      return;
    }
    
    try {
      const [userRes, familyRes, seasonalRes] = await Promise.all([
        apiService.get(`/achievements/user/${user.user_id}`).catch(() => null),
        apiService.get('/achievements/family').catch(() => null),
        apiService.get('/achievements/seasonal').catch(() => null),
      ]);

      if (userRes) {
        setAchievements(userRes.achievements || []);
        setStats(userRes.stats || {});
      }

      if (familyRes) {
        setFamilyAchievements(familyRes.achievements || []);
        setFamilyStats(familyRes.family_stats || {});
      }

      if (seasonalRes) {
        setSeasonalChallenges([
          ...(seasonalRes.default_challenges || []),
          ...(seasonalRes.custom_challenges || []),
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.user_id]);

  const checkForNewAchievements = useCallback(async () => {
    try {
      const res = await apiService.post('/achievements/check', {});
      if (res?.newly_earned?.length > 0) {
        setShowCelebration(res.newly_earned[0]);
        Animated.spring(celebrationAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
        fetchAchievements();
      }
    } catch (error) {
      console.error('Failed to check achievements:', error);
    }
  }, [fetchAchievements, celebrationAnim]);

  useEffect(() => {
    if (user?.user_id) {
      fetchAchievements();
      checkForNewAchievements();
    }
  }, [user?.user_id, fetchAchievements, checkForNewAchievements]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAchievements();
  };

  const closeCelebration = () => {
    Animated.timing(celebrationAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowCelebration(null));
  };

  const getCategoryBadges = (category) => {
    return achievements.filter((a) => a.category === category);
  };

  const renderProgressBar = (progress, requirement) => {
    const percent = Math.min(100, Math.round((progress / requirement) * 100));
    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${percent}%` }]} />
      </View>
    );
  };

  const renderBadge = (achievement) => (
    <View
      key={achievement.achievement_id}
      style={[
        styles.badgeCard,
        achievement.earned && styles.badgeCardEarned,
        { borderColor: achievement.earned ? theme.primary : '#374151' },
      ]}
    >
      <View style={styles.badgeContent}>
        <Text style={[styles.badgeIcon, !achievement.earned && styles.badgeIconGray]}>
          {achievement.icon}
        </Text>
        <View style={styles.badgeInfo}>
          <Text style={[styles.badgeName, !achievement.earned && styles.textGray]}>
            {achievement.name}
          </Text>
          <Text style={styles.badgeDescription}>{achievement.description}</Text>
          {!achievement.earned && (
            <>
              {renderProgressBar(achievement.progress, achievement.requirement)}
              <Text style={styles.progressText}>
                {achievement.progress} / {achievement.requirement}
              </Text>
            </>
          )}
          {achievement.earned && achievement.earned_at && (
            <Text style={styles.earnedText}>
              Earned {new Date(achievement.earned_at).toLocaleDateString()}
            </Text>
          )}
        </View>
        {achievement.earned && (
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
        )}
      </View>
    </View>
  );

  const renderStatsCards = () => (
    <View style={styles.statsContainer}>
      <View style={[styles.statCard, { backgroundColor: '#f9731620' }]}>
        <Text style={styles.statEmoji}>🔥</Text>
        <Text style={styles.statValue}>{stats.chore_streak || 0}</Text>
        <Text style={styles.statLabel}>Day Streak</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: '#3b82f620' }]}>
        <Text style={styles.statEmoji}>📚</Text>
        <Text style={styles.statValue}>{stats.reading_streak || 0}</Text>
        <Text style={styles.statLabel}>Reading</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: '#a855f720' }]}>
        <Text style={styles.statEmoji}>⭐</Text>
        <Text style={styles.statValue}>{stats.total_earned || 0}</Text>
        <Text style={styles.statLabel}>Badges</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: '#eab30820' }]}>
        <Text style={styles.statEmoji}>💰</Text>
        <Text style={styles.statValue}>{stats.total_points || 0}</Text>
        <Text style={styles.statLabel}>Points</Text>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      {['personal', 'family', 'seasonal'].map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[
            styles.tab,
            activeTab === tab && { backgroundColor: theme.primary },
          ]}
          onPress={() => setActiveTab(tab)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
            {tab === 'personal' && '🎯 Personal'}
            {tab === 'family' && '👨‍👩‍👧‍👦 Family'}
            {tab === 'seasonal' && '🌟 Seasonal'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="trophy" size={48} color={theme.primary} />
        <Text style={styles.loadingText}>Loading achievements...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🏆 Achievements</Text>
          <Text style={styles.headerSubtitle}>Track your progress and unlock badges</Text>
        </View>

        {/* Stats */}
        {renderStatsCards()}

        {/* Tabs */}
        {renderTabs()}

        {/* Personal Achievements */}
        {activeTab === 'personal' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔥 Streak Badges</Text>
            {getCategoryBadges('streak').map(renderBadge)}
            
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>⭐ Milestone Badges</Text>
            {getCategoryBadges('milestone').map(renderBadge)}
          </View>
        )}

        {/* Family Achievements */}
        {activeTab === 'family' && (
          <View style={styles.section}>
            <View style={styles.familyStatsCard}>
              <Text style={styles.familyStatsLabel}>Family Progress</Text>
              <Text style={styles.familyStatsValue}>
                {familyStats.total_chores || 0} chores completed together
              </Text>
            </View>
            {familyAchievements.map(renderBadge)}
          </View>
        )}

        {/* Seasonal Challenges */}
        {activeTab === 'seasonal' && (
          <View style={styles.section}>
            {seasonalChallenges.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🌟</Text>
                <Text style={styles.emptyText}>No active seasonal challenges</Text>
                <Text style={styles.emptySubtext}>Check back later for new challenges!</Text>
              </View>
            ) : (
              seasonalChallenges.map((challenge) => (
                <View key={challenge.challenge_id} style={styles.seasonalCard}>
                  <Text style={styles.seasonalIcon}>{challenge.icon}</Text>
                  <View style={styles.seasonalInfo}>
                    <Text style={styles.seasonalName}>{challenge.name}</Text>
                    <Text style={styles.seasonalDesc}>{challenge.description}</Text>
                    <Text style={styles.seasonalGoal}>
                      Goal: {challenge.requirement} {challenge.type}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Celebration Modal */}
      <Modal visible={!!showCelebration} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.celebrationModal,
              {
                transform: [
                  {
                    scale: celebrationAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
                opacity: celebrationAnim,
              },
            ]}
          >
            <Text style={styles.celebrationIcon}>{showCelebration?.icon}</Text>
            <Text style={styles.celebrationTitle}>Achievement Unlocked!</Text>
            <Text style={styles.celebrationName}>{showCelebration?.name}</Text>
            <Text style={styles.celebrationDesc}>{showCelebration?.description}</Text>
            <TouchableOpacity style={styles.celebrationBtn} onPress={closeCelebration}>
              <Text style={styles.celebrationBtnText}>Awesome!</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 12,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    color: '#9ca3af',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  tabText: {
    color: '#9ca3af',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  badgeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  badgeCardEarned: {
    backgroundColor: '#6366f115',
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeIcon: {
    fontSize: 36,
    marginRight: 12,
  },
  badgeIconGray: {
    opacity: 0.4,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  badgeDescription: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  textGray: {
    color: '#6b7280',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#a855f7',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  earnedText: {
    fontSize: 11,
    color: '#10b981',
    marginTop: 4,
  },
  familyStatsCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  familyStatsLabel: {
    color: '#9ca3af',
    fontSize: 12,
  },
  familyStatsValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  seasonalCard: {
    backgroundColor: '#eab30815',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eab30830',
  },
  seasonalIcon: {
    fontSize: 36,
    marginRight: 12,
  },
  seasonalInfo: {
    flex: 1,
  },
  seasonalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  seasonalDesc: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  seasonalGoal: {
    fontSize: 12,
    color: '#eab308',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationModal: {
    backgroundColor: '#581c87',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 24,
  },
  celebrationIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  celebrationTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  celebrationName: {
    fontSize: 18,
    color: '#d8b4fe',
    marginBottom: 8,
  },
  celebrationDesc: {
    fontSize: 14,
    color: '#e9d5ff',
    textAlign: 'center',
    marginBottom: 24,
  },
  celebrationBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  celebrationBtnText: {
    color: '#581c87',
    fontWeight: '600',
    fontSize: 16,
  },
});
