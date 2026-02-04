import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/api.service';

export default function LeaderboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const data = await apiService.getLeaderboard();
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMedalColor = (rank) => {
    switch (rank) {
      case 1: return '#fbbf24';
      case 2: return '#94a3b8';
      case 3: return '#cd7f32';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1e1b4b', '#312e81', '#1e1b4b']} style={styles.gradient} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <View style={styles.podium}>
          {/* 2nd Place */}
          <View style={[styles.podiumSpot, styles.secondPlace]}>
            <View style={[styles.medal, { backgroundColor: getMedalColor(2) }]}>
              <Text style={styles.medalText}>2</Text>
            </View>
            <View style={styles.podiumAvatar}>
              <Text style={styles.podiumAvatarText}>{leaderboard[1]?.name?.charAt(0)}</Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>{leaderboard[1]?.nickname || leaderboard[1]?.name}</Text>
            <Text style={styles.podiumPoints}>{leaderboard[1]?.points || 0} pts</Text>
          </View>
          
          {/* 1st Place */}
          <View style={[styles.podiumSpot, styles.firstPlace]}>
            <Ionicons name="trophy" size={32} color="#fbbf24" style={styles.trophy} />
            <View style={[styles.podiumAvatar, styles.firstPlaceAvatar]}>
              <Text style={styles.podiumAvatarText}>{leaderboard[0]?.name?.charAt(0)}</Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>{leaderboard[0]?.nickname || leaderboard[0]?.name}</Text>
            <Text style={styles.podiumPoints}>{leaderboard[0]?.points || 0} pts</Text>
          </View>
          
          {/* 3rd Place */}
          <View style={[styles.podiumSpot, styles.thirdPlace]}>
            <View style={[styles.medal, { backgroundColor: getMedalColor(3) }]}>
              <Text style={styles.medalText}>3</Text>
            </View>
            <View style={styles.podiumAvatar}>
              <Text style={styles.podiumAvatarText}>{leaderboard[2]?.name?.charAt(0)}</Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>{leaderboard[2]?.nickname || leaderboard[2]?.name}</Text>
            <Text style={styles.podiumPoints}>{leaderboard[2]?.points || 0} pts</Text>
          </View>
        </View>
      )}

      {/* Full List */}
      <ScrollView style={styles.listContainer}>
        {leaderboard.slice(3).map((user, index) => (
          <View key={user.user_id} style={styles.listItem}>
            <Text style={styles.rank}>{index + 4}</Text>
            <View style={styles.listAvatar}>
              <Text style={styles.listAvatarText}>{user.name?.charAt(0)}</Text>
            </View>
            <View style={styles.listInfo}>
              <Text style={styles.listName}>{user.nickname || user.name}</Text>
              <Text style={styles.listChores}>{user.completed_chores || 0} chores done</Text>
            </View>
            <View style={styles.listPoints}>
              <Ionicons name="star" size={14} color="#fbbf24" />
              <Text style={styles.listPointsText}>{user.points || 0}</Text>
            </View>
          </View>
        ))}
        
        {leaderboard.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyText}>No one on the leaderboard yet!</Text>
            <Text style={styles.emptySubtext}>Complete chores to earn points</Text>
          </View>
        )}
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
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 24, paddingVertical: 32 },
  podiumSpot: { alignItems: 'center', width: '30%' },
  firstPlace: { marginBottom: 20 },
  secondPlace: {},
  thirdPlace: {},
  trophy: { marginBottom: 8 },
  medal: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  medalText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  podiumAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  firstPlaceAvatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#fbbf24' },
  podiumAvatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  podiumName: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 8 },
  podiumPoints: { color: '#fbbf24', fontSize: 12, marginTop: 2 },
  listContainer: { flex: 1, padding: 16 },
  listItem: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rank: { color: '#6b7280', fontSize: 16, fontWeight: 'bold', width: 30 },
  listAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  listAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  listInfo: { flex: 1, marginLeft: 12 },
  listName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  listChores: { color: '#a5b4fc', fontSize: 12, marginTop: 2 },
  listPoints: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listPointsText: { color: '#fbbf24', fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#6b7280', fontSize: 16, marginTop: 16 },
  emptySubtext: { color: '#4b5563', fontSize: 14, marginTop: 4 },
});
