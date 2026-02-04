import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';

export default function LeaderboardScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [timeframe, setTimeframe] = useState('all-time');

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await apiService.getLeaderboard();
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  }, [fetchLeaderboard]);

  const getRankInfo = (index) => {
    if (index === 0) return { bg: ['#fbbf24', '#f59e0b'], emoji: '🥇', text: 'Champion', textColor: '#fbbf24' };
    if (index === 1) return { bg: ['#94a3b8', '#64748b'], emoji: '🥈', text: 'Runner-up', textColor: '#94a3b8' };
    if (index === 2) return { bg: ['#f97316', '#ea580c'], emoji: '🥉', text: 'Third Place', textColor: '#f97316' };
    return { bg: ['#475569', '#334155'], emoji: `#${index + 1}`, text: `Rank ${index + 1}`, textColor: '#94a3b8' };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  return (
    <AnimatedBackground page="rewards">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="trophy" size={28} color="#fbbf24" />
          <Text style={styles.title}>Leaderboard</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Timeframe Selector */}
      <View style={styles.timeframeContainer}>
        {['all-time', 'this-week', 'this-month'].map(tf => (
          <TouchableOpacity
            key={tf}
            style={[styles.timeframeBtn, timeframe === tf && styles.timeframeBtnActive]}
            onPress={() => setTimeframe(tf)}
          >
            <Text style={[styles.timeframeBtnText, timeframe === tf && styles.timeframeBtnTextActive]}>
              {tf.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fbbf24" />
        }
      >
        {leaderboard.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyTitle}>No Rankings Yet</Text>
            <Text style={styles.emptyText}>Complete chores to earn points and climb the leaderboard!</Text>
          </View>
        ) : (
          <>
            {/* Top 3 Podium */}
            {leaderboard.length >= 3 && (
              <View style={styles.podium}>
                {/* Second Place */}
                <View style={styles.podiumItem}>
                  <View style={[styles.podiumAvatar, styles.podiumSecond]}>
                    <Text style={styles.podiumAvatarText}>{leaderboard[1]?.name?.charAt(0)}</Text>
                  </View>
                  <Text style={styles.podiumEmoji}>🥈</Text>
                  <Text style={styles.podiumName} numberOfLines={1}>{leaderboard[1]?.nickname || leaderboard[1]?.name}</Text>
                  <Text style={styles.podiumPoints}>{leaderboard[1]?.points} pts</Text>
                  <View style={[styles.podiumBar, styles.podiumBarSecond]} />
                </View>
                
                {/* First Place */}
                <View style={styles.podiumItem}>
                  <View style={[styles.podiumAvatar, styles.podiumFirst]}>
                    <Text style={styles.podiumAvatarText}>{leaderboard[0]?.name?.charAt(0)}</Text>
                    <View style={styles.crownBadge}>
                      <Ionicons name="trophy" size={12} color="#fbbf24" />
                    </View>
                  </View>
                  <Text style={styles.podiumEmoji}>🥇</Text>
                  <Text style={styles.podiumName} numberOfLines={1}>{leaderboard[0]?.nickname || leaderboard[0]?.name}</Text>
                  <Text style={[styles.podiumPoints, { color: '#fbbf24' }]}>{leaderboard[0]?.points} pts</Text>
                  <View style={[styles.podiumBar, styles.podiumBarFirst]} />
                </View>
                
                {/* Third Place */}
                <View style={styles.podiumItem}>
                  <View style={[styles.podiumAvatar, styles.podiumThird]}>
                    <Text style={styles.podiumAvatarText}>{leaderboard[2]?.name?.charAt(0)}</Text>
                  </View>
                  <Text style={styles.podiumEmoji}>🥉</Text>
                  <Text style={styles.podiumName} numberOfLines={1}>{leaderboard[2]?.nickname || leaderboard[2]?.name}</Text>
                  <Text style={styles.podiumPoints}>{leaderboard[2]?.points} pts</Text>
                  <View style={[styles.podiumBar, styles.podiumBarThird]} />
                </View>
              </View>
            )}

            {/* Full Rankings */}
            <View style={styles.rankingsContainer}>
              <Text style={styles.rankingsTitle}>Full Rankings</Text>
              {leaderboard.map((child, index) => {
                const rankInfo = getRankInfo(index);
                const isCurrentUser = child.user_id === user?.user_id;
                
                return (
                  <View 
                    key={child.user_id} 
                    style={[styles.rankCard, isCurrentUser && styles.rankCardHighlight]}
                  >
                    <View style={[styles.rankBadge, { backgroundColor: rankInfo.bg[0] }]}>
                      <Text style={styles.rankBadgeText}>{rankInfo.emoji}</Text>
                    </View>
                    
                    <View style={styles.rankInfo}>
                      <View style={styles.rankNameRow}>
                        <Text style={styles.rankName}>{child.nickname || child.name}</Text>
                        {isCurrentUser && (
                          <View style={styles.youBadge}>
                            <Text style={styles.youBadgeText}>YOU</Text>
                          </View>
                        )}
                        {index === 0 && (
                          <Ionicons name="trophy" size={16} color="#fbbf24" style={{ marginLeft: 4 }} />
                        )}
                      </View>
                      <Text style={[styles.rankSubtext, { color: rankInfo.textColor }]}>{rankInfo.text}</Text>
                    </View>
                    
                    <View style={styles.rankStats}>
                      <View style={styles.pointsBadge}>
                        <Ionicons name="star" size={14} color="#fbbf24" />
                        <Text style={styles.pointsText}>{child.points}</Text>
                      </View>
                      {child.badges?.length > 0 && (
                        <View style={styles.badgeCount}>
                          <Ionicons name="ribbon" size={14} color="#a855f7" />
                          <Text style={styles.badgeCountText}>{child.badges.length}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* How Points Work */}
            <View style={styles.pointsInfoCard}>
              <Text style={styles.pointsInfoTitle}>How Points Work</Text>
              <View style={styles.pointsInfoItem}>
                <View style={[styles.pointsInfoBadge, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
                  <Text style={[styles.pointsInfoBadgeText, { color: '#6366f1' }]}>5</Text>
                </View>
                <View>
                  <Text style={styles.pointsInfoName}>Simple Chores</Text>
                  <Text style={styles.pointsInfoDesc}>Quick tasks like feeding pets</Text>
                </View>
              </View>
              <View style={styles.pointsInfoItem}>
                <View style={[styles.pointsInfoBadge, { backgroundColor: 'rgba(236, 72, 153, 0.2)' }]}>
                  <Text style={[styles.pointsInfoBadgeText, { color: '#ec4899' }]}>10</Text>
                </View>
                <View>
                  <Text style={styles.pointsInfoName}>Regular Chores</Text>
                  <Text style={styles.pointsInfoDesc}>Standard tasks like dishes</Text>
                </View>
              </View>
              <View style={styles.pointsInfoItem}>
                <View style={[styles.pointsInfoBadge, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}>
                  <Text style={[styles.pointsInfoBadgeText, { color: '#fbbf24' }]}>20</Text>
                </View>
                <View>
                  <Text style={styles.pointsInfoName}>Big Chores</Text>
                  <Text style={styles.pointsInfoDesc}>Larger tasks like yard work</Text>
                </View>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d1a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 },
  backButton: { padding: 8 },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  scrollView: { flex: 1, padding: 16 },
  
  // Timeframe
  timeframeContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  timeframeBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(30, 27, 75, 0.8)', alignItems: 'center' },
  timeframeBtnActive: { backgroundColor: '#6366f1' },
  timeframeBtnText: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
  timeframeBtnTextActive: { color: '#fff' },
  
  // Empty State
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 16 },
  emptyText: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 8, maxWidth: 250 },
  
  // Podium
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 24, paddingTop: 20 },
  podiumItem: { alignItems: 'center', width: '30%' },
  podiumAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  podiumFirst: { backgroundColor: '#fbbf24', width: 70, height: 70, borderRadius: 35 },
  podiumSecond: { backgroundColor: '#94a3b8' },
  podiumThird: { backgroundColor: '#f97316' },
  podiumAvatarText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  crownBadge: { position: 'absolute', top: -8, right: -4, backgroundColor: '#1e1b4b', borderRadius: 12, padding: 4 },
  podiumEmoji: { fontSize: 24, marginBottom: 4 },
  podiumName: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  podiumPoints: { color: '#a5b4fc', fontSize: 12, marginTop: 2 },
  podiumBar: { width: '80%', borderRadius: 4, marginTop: 8 },
  podiumBarFirst: { height: 80, backgroundColor: 'rgba(251, 191, 36, 0.3)' },
  podiumBarSecond: { height: 60, backgroundColor: 'rgba(148, 163, 184, 0.3)' },
  podiumBarThird: { height: 40, backgroundColor: 'rgba(249, 115, 22, 0.3)' },
  
  // Rankings
  rankingsContainer: { marginBottom: 20 },
  rankingsTitle: { color: '#6b7280', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  rankCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rankCardHighlight: { borderWidth: 2, borderColor: '#6366f1' },
  rankBadge: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  rankBadgeText: { fontSize: 18, fontWeight: 'bold' },
  rankInfo: { flex: 1, marginLeft: 12 },
  rankNameRow: { flexDirection: 'row', alignItems: 'center' },
  rankName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  youBadge: { backgroundColor: 'rgba(99, 102, 241, 0.3)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  youBadgeText: { color: '#818cf8', fontSize: 9, fontWeight: 'bold' },
  rankSubtext: { fontSize: 12, marginTop: 2 },
  rankStats: { alignItems: 'flex-end', gap: 6 },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251, 191, 36, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pointsText: { color: '#fbbf24', fontSize: 14, fontWeight: 'bold' },
  badgeCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeCountText: { color: '#a855f7', fontSize: 12, fontWeight: '600' },
  
  // Points Info
  pointsInfoCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 20, padding: 16 },
  pointsInfoTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
  pointsInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  pointsInfoBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  pointsInfoBadgeText: { fontSize: 14, fontWeight: 'bold' },
  pointsInfoName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  pointsInfoDesc: { color: '#6b7280', fontSize: 12, marginTop: 2 },
});
