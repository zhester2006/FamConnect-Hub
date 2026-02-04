import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';

export default function RewardsScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rewards, setRewards] = useState([]);
  const [redeemedHistory, setRedeemedHistory] = useState([]);
  const [redeeming, setRedeeming] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReward, setNewReward] = useState({ name: '', description: '', points_required: '' });
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [rewardsData, historyData] = await Promise.all([
        apiService.getRewards(),
        apiService.get('/rewards/history').catch(() => ({ history: [] })),
      ]);
      setRewards(rewardsData.rewards || []);
      setRedeemedHistory(historyData.history || []);
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
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

  const handleRedeem = async (reward) => {
    if ((user?.points || 0) < reward.points_required) {
      Alert.alert(
        'Not Enough Points', 
        `You need ${reward.points_required - (user?.points || 0)} more points to redeem this reward.`
      );
      return;
    }

    Alert.alert(
      'Redeem Reward',
      `Spend ${reward.points_required} points to redeem "${reward.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Redeem', 
          onPress: async () => {
            setRedeeming(reward.reward_id);
            try {
              await apiService.redeemReward(reward.reward_id);
              if (refreshUser) await refreshUser();
              Alert.alert('🎉 Success!', `You've redeemed "${reward.name}"!`);
              fetchData();
            } catch (error) {
              Alert.alert('Error', 'Failed to redeem reward. Please try again.');
            } finally {
              setRedeeming(null);
            }
          }
        }
      ]
    );
  };

  const handleCreateReward = async () => {
    if (!newReward.name.trim() || !newReward.points_required) {
      Alert.alert('Error', 'Please fill in name and points required');
      return;
    }

    setProcessing(true);
    try {
      await apiService.post('/rewards', {
        name: newReward.name,
        description: newReward.description,
        points_required: parseInt(newReward.points_required),
      });
      setShowAddModal(false);
      setNewReward({ name: '', description: '', points_required: '' });
      fetchData();
      Alert.alert('Success', 'Reward created!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create reward');
    } finally {
      setProcessing(false);
    }
  };

  const getRewardIcon = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('game') || lower.includes('screen')) return 'game-controller';
    if (lower.includes('movie') || lower.includes('tv')) return 'film';
    if (lower.includes('ice cream') || lower.includes('treat')) return 'ice-cream';
    if (lower.includes('toy') || lower.includes('store')) return 'cart';
    if (lower.includes('sleep') || lower.includes('bedtime')) return 'moon';
    if (lower.includes('trip') || lower.includes('outing')) return 'car';
    return 'gift';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
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
          <Text style={styles.title}>Rewards Shop</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Ionicons name="star" size={16} color="#fbbf24" />
          <Text style={styles.pointsText}>{user?.points || 0}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a855f7" />
        }
      >
        {/* Points Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="star" size={32} color="#fbbf24" />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Your Points</Text>
            <Text style={styles.summaryPoints}>{user?.points || 0}</Text>
          </View>
          <TouchableOpacity 
            style={styles.earnButton}
            onPress={() => navigation.navigate('Chores')}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.earnButtonText}>Earn More</Text>
          </TouchableOpacity>
        </View>

        {/* Create Reward - Parents Only */}
        {user?.role === 'parent' && (
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add-circle" size={20} color="#a855f7" />
            <Text style={styles.createButtonText}>Create New Reward</Text>
          </TouchableOpacity>
        )}

        {/* Available Rewards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Rewards</Text>
          {rewards.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="gift-outline" size={64} color="#6b7280" />
              <Text style={styles.emptyText}>No rewards available</Text>
              <Text style={styles.emptySubtext}>
                {user?.role === 'parent' ? 'Create some rewards for your family!' : 'Check back later for rewards!'}
              </Text>
            </View>
          ) : (
            <View style={styles.rewardsGrid}>
              {rewards.map((reward) => {
                const canAfford = (user?.points || 0) >= reward.points_required;
                const iconName = getRewardIcon(reward.name);
                
                return (
                  <View key={reward.reward_id} style={styles.rewardCard}>
                    <View style={[styles.rewardIconContainer, !canAfford && styles.rewardIconDisabled]}>
                      <Ionicons name={iconName} size={36} color={canAfford ? '#a855f7' : '#4b5563'} />
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
                            {canAfford ? 'Redeem' : `Need ${reward.points_required - (user?.points || 0)} more`}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Redemption History */}
        {redeemedHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recently Redeemed</Text>
            {redeemedHistory.slice(0, 5).map((item, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyName}>{item.reward_name}</Text>
                  <Text style={styles.historyDate}>{item.redeemed_at || 'Recently'}</Text>
                </View>
                <Text style={styles.historyPoints}>-{item.points_spent} pts</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create Reward Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Reward</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Reward name"
              placeholderTextColor="#6b7280"
              value={newReward.name}
              onChangeText={(text) => setNewReward({ ...newReward, name: text })}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              placeholderTextColor="#6b7280"
              value={newReward.description}
              onChangeText={(text) => setNewReward({ ...newReward, description: text })}
              multiline
            />
            
            <TextInput
              style={styles.input}
              placeholder="Points required"
              placeholderTextColor="#6b7280"
              value={newReward.points_required}
              onChangeText={(text) => setNewReward({ ...newReward, points_required: text })}
              keyboardType="numeric"
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitBtn, processing && styles.submitBtnDisabled]}
                onPress={handleCreateReward}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Create</Text>
                )}
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
  headerContent: { flex: 1, marginLeft: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251, 191, 36, 0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  pointsText: { color: '#fbbf24', fontWeight: 'bold', fontSize: 16 },
  scrollView: { flex: 1, padding: 16 },
  
  // Summary Card
  summaryCard: { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)' },
  summaryIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(251, 191, 36, 0.2)', justifyContent: 'center', alignItems: 'center' },
  summaryInfo: { flex: 1, marginLeft: 16 },
  summaryLabel: { color: '#a5b4fc', fontSize: 13 },
  summaryPoints: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  earnButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#a855f7', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20 },
  earnButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  
  // Create Button
  createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(168, 85, 247, 0.1)', borderWidth: 2, borderColor: 'rgba(168, 85, 247, 0.3)', borderStyle: 'dashed', borderRadius: 16, padding: 16, marginBottom: 20 },
  createButtonText: { color: '#a855f7', fontWeight: '600' },
  
  // Sections
  section: { marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  
  // Rewards Grid
  rewardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rewardCard: { width: '48%', backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 20, padding: 16 },
  rewardIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(168, 85, 247, 0.2)', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 },
  rewardIconDisabled: { backgroundColor: 'rgba(75, 85, 99, 0.2)' },
  rewardName: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  rewardDesc: { color: '#a5b4fc', fontSize: 11, textAlign: 'center', marginBottom: 12, lineHeight: 16 },
  rewardFooter: { alignItems: 'center', gap: 10 },
  costBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  costText: { color: '#fbbf24', fontWeight: 'bold', fontSize: 16 },
  redeemButton: { backgroundColor: '#a855f7', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, width: '100%', alignItems: 'center' },
  redeemButtonDisabled: { backgroundColor: '#4b5563' },
  redeemButtonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  
  // Empty State
  emptyCard: { backgroundColor: 'rgba(30, 27, 75, 0.5)', borderRadius: 20, padding: 40, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 16, marginTop: 12 },
  emptySubtext: { color: '#4b5563', fontSize: 13, marginTop: 4, textAlign: 'center' },
  
  // History
  historyItem: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  historyIcon: { marginRight: 12 },
  historyInfo: { flex: 1 },
  historyName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  historyDate: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  historyPoints: { color: '#ef4444', fontWeight: '600' },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  input: { backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)', marginBottom: 12 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, backgroundColor: '#374151', paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  submitBtn: { flex: 1, backgroundColor: '#a855f7', paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
