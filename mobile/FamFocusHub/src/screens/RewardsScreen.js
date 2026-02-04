import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';

export default function RewardsScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState([]);
  const [redeeming, setRedeeming] = useState(null);

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      const data = await apiService.getRewards();
      setRewards(data.rewards || []);
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (reward) => {
    if ((user?.points || 0) < reward.points_required) {
      Alert.alert('Not Enough Points', `You need ${reward.points_required - (user?.points || 0)} more points to redeem this reward.`);
      return;
    }

    Alert.alert(
      'Redeem Reward',
      `Are you sure you want to redeem "${reward.name}" for ${reward.points_required} points?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Redeem', onPress: () => confirmRedeem(reward) }
      ]
    );
  };

  const confirmRedeem = async (reward) => {
    setRedeeming(reward.reward_id);
    try {
      await apiService.redeemReward(reward.reward_id);
      await refreshUser();
      Alert.alert('Success!', `You've redeemed "${reward.name}"!`);
      fetchRewards();
    } catch (error) {
      Alert.alert('Error', 'Failed to redeem reward. Please try again.');
    } finally {
      setRedeeming(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2e1065', '#581c87', '#2e1065']} style={styles.gradient} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Rewards Shop</Text>
        <View style={styles.pointsBadge}>
          <Ionicons name="star" size={16} color="#fbbf24" />
          <Text style={styles.pointsText}>{user?.points || 0}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {rewards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="gift-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyText}>No rewards available yet</Text>
          </View>
        ) : (
          <View style={styles.rewardsGrid}>
            {rewards.map((reward) => {
              const canAfford = (user?.points || 0) >= reward.points_required;
              return (
                <View key={reward.reward_id} style={styles.rewardCard}>
                  <View style={styles.rewardIcon}>
                    <Ionicons name="gift" size={40} color="#a855f7" />
                  </View>
                  <Text style={styles.rewardName}>{reward.name}</Text>
                  {reward.description && (
                    <Text style={styles.rewardDesc} numberOfLines={2}>{reward.description}</Text>
                  )}
                  <View style={styles.rewardFooter}>
                    <View style={styles.costBadge}>
                      <Ionicons name="star" size={14} color="#fbbf24" />
                      <Text style={styles.costText}>{reward.points_required}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.redeemButton, !canAfford && styles.redeemButtonDisabled]}
                      onPress={() => handleRedeem(reward)}
                      disabled={!canAfford || redeeming === reward.reward_id}
                    >
                      {redeeming === reward.reward_id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.redeemButtonText}>
                          {canAfford ? 'Redeem' : 'Need More'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a0a2e' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a0a2e' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251, 191, 36, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 4 },
  pointsText: { color: '#fbbf24', fontWeight: 'bold' },
  scrollView: { flex: 1, padding: 16 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#6b7280', marginTop: 16 },
  rewardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rewardCard: { width: '48%', backgroundColor: 'rgba(46, 16, 101, 0.8)', borderRadius: 16, padding: 16 },
  rewardIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(168, 85, 247, 0.2)', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 },
  rewardName: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  rewardDesc: { color: '#a5b4fc', fontSize: 12, textAlign: 'center', marginBottom: 12 },
  rewardFooter: { alignItems: 'center', gap: 8 },
  costBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  costText: { color: '#fbbf24', fontWeight: 'bold' },
  redeemButton: { backgroundColor: '#a855f7', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, width: '100%', alignItems: 'center' },
  redeemButtonDisabled: { backgroundColor: '#4b5563' },
  redeemButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
