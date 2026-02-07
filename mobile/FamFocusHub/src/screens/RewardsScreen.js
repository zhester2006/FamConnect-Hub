import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput, FlatList 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';
import MedalEmblem from '../components/MedalEmblem';

export default function RewardsScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rewards, setRewards] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [pendingRedemptions, setPendingRedemptions] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [redeeming, setRedeeming] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [activeTab, setActiveTab] = useState('shop');
  const [newReward, setNewReward] = useState({ name: '', description: '', points_required: '' });
  const [newTask, setNewTask] = useState({ title: '', points: '10', deadline: '' });
  const [awardData, setAwardData] = useState({ child_id: '', points: '', reason: '', isDeduction: false });
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [rewardsData, tasksData, pendingData, membersData, leaderboardData] = await Promise.all([
        apiService.getRewards(),
        apiService.get('/tasks').catch(() => ({ tasks: [] })),
        apiService.get('/rewards/pending').catch(() => ({ pending: [] })),
        apiService.getFamilyMembers().catch(() => ({ members: [] })),
        apiService.getLeaderboard().catch(() => ({ leaderboard: [] })),
      ]);
      setRewards(rewardsData.rewards || []);
      setTasks(tasksData.tasks || []);
      setPendingRedemptions(pendingData.pending || []);
      
      const members = membersData.members || [];
      const leaderboard = leaderboardData.leaderboard || [];
      
      // Create a map of user_id to rank
      const rankMap = {};
      leaderboard.forEach((child, index) => {
        rankMap[child.user_id] = index + 1;
      });
      
      // Add rank to members
      const childrenWithRank = members.filter(m => m.role === 'child').map(member => ({
        ...member,
        rank: rankMap[member.user_id] || null
      }));
      
      setFamilyMembers(childrenWithRank);
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
      `Spend ${reward.points_required} points to request "${reward.name}"?\n\nA parent will need to approve this redemption.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Request', 
          onPress: async () => {
            setRedeeming(reward.reward_id);
            try {
              await apiService.post('/rewards/redeem', { reward_id: reward.reward_id });
              Alert.alert('📨 Request Sent!', `Your request for "${reward.name}" has been sent to your parents for approval.`);
              fetchData();
            } catch (error) {
              Alert.alert('Error', 'Failed to request reward. Please try again.');
            } finally {
              setRedeeming(null);
            }
          }
        }
      ]
    );
  };

  const handleApproveRedemption = async (redemption, approved) => {
    setProcessing(true);
    try {
      await apiService.post(`/rewards/redemptions/${redemption.redemption_id}/approve`, { approved });
      Alert.alert(
        approved ? 'Approved!' : 'Denied',
        approved 
          ? `${redemption.child_name}'s reward has been approved!` 
          : 'Redemption request has been denied.'
      );
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to process approval');
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteTask = async (task) => {
    try {
      await apiService.post(`/tasks/${task.task_id}/complete`);
      Alert.alert('✨ Task Submitted!', 'Your task completion has been submitted for approval.');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to complete task');
    }
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

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !newTask.points) {
      Alert.alert('Error', 'Please fill in task title and points');
      return;
    }

    setProcessing(true);
    try {
      await apiService.post('/tasks', {
        title: newTask.title,
        points: parseInt(newTask.points),
        deadline: newTask.deadline || null,
      });
      setShowTaskModal(false);
      setNewTask({ title: '', points: '10', deadline: '' });
      fetchData();
      Alert.alert('Success', 'Task created!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create task');
    } finally {
      setProcessing(false);
    }
  };

  const handleAwardPoints = async () => {
    if (!awardData.child_id || !awardData.points) {
      Alert.alert('Error', 'Please select a child and enter points');
      return;
    }

    const pointsValue = parseInt(awardData.points);
    if (isNaN(pointsValue) || pointsValue <= 0) {
      Alert.alert('Error', 'Please enter a valid positive number');
      return;
    }

    // Calculate the amount (negative for deduction, positive for award)
    const amount = awardData.isDeduction ? -pointsValue : pointsValue;

    setProcessing(true);
    try {
      // Use the points modification endpoint that supports both add/remove
      await apiService.post(`/users/${awardData.child_id}/points`, {
        amount: amount,
        reason: awardData.reason || (awardData.isDeduction ? 'Points deducted by parent' : 'Parent bonus'),
      });
      setShowAwardModal(false);
      setAwardData({ child_id: '', points: '', reason: '', isDeduction: false });
      fetchData();
      
      if (awardData.isDeduction) {
        Alert.alert('📉 Points Deducted', `Successfully deducted ${pointsValue} points.`);
      } else {
        Alert.alert('🎉 Points Awarded!', `Successfully awarded ${pointsValue} points!`);
      }
    } catch (error) {
      console.error('Points operation failed:', error);
      Alert.alert('Error', awardData.isDeduction ? 'Failed to deduct points' : 'Failed to award points');
    } finally {
      setProcessing(false);
    }
  };

  const getRewardIcon = (name) => {
    const lower = (name || '').toLowerCase();
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
          <Text style={styles.title}>Rewards</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Ionicons name="star" size={16} color="#fbbf24" />
          <Text style={styles.pointsText}>{user?.points || 0}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {['shop', 'earn', ...(user?.role === 'parent' ? ['pending'] : [])].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Ionicons 
              name={tab === 'shop' ? 'gift' : tab === 'earn' ? 'trophy' : 'time'} 
              size={18} 
              color={activeTab === tab ? '#a855f7' : '#6b7280'} 
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'shop' ? 'Shop' : tab === 'earn' ? 'Earn' : 'Pending'}
            </Text>
            {tab === 'pending' && pendingRedemptions.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingRedemptions.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
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
          {user?.role === 'parent' && (
            <TouchableOpacity 
              style={styles.awardButton}
              onPress={() => setShowAwardModal(true)}
            >
              <Ionicons name="gift" size={18} color="#fff" />
              <Text style={styles.awardButtonText}>Award</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Shop Tab */}
        {activeTab === 'shop' && (
          <>
            {user?.role === 'parent' && (
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => setShowAddModal(true)}
              >
                <Ionicons name="add-circle" size={20} color="#a855f7" />
                <Text style={styles.createButtonText}>Create New Reward</Text>
              </TouchableOpacity>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available Rewards</Text>
              {rewards.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="gift-outline" size={64} color="#6b7280" />
                  <Text style={styles.emptyText}>No rewards available</Text>
                </View>
              ) : (
                rewards.map((reward) => (
                  <View key={reward.reward_id} style={styles.rewardCard}>
                    <View style={[styles.rewardIcon, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
                      <Ionicons name={getRewardIcon(reward.name)} size={28} color="#a855f7" />
                    </View>
                    <View style={styles.rewardInfo}>
                      <Text style={styles.rewardName}>{reward.name}</Text>
                      {reward.description && (
                        <Text style={styles.rewardDesc} numberOfLines={1}>{reward.description}</Text>
                      )}
                      <View style={styles.rewardPoints}>
                        <Ionicons name="star" size={14} color="#fbbf24" />
                        <Text style={styles.rewardPointsText}>{reward.points_required} pts</Text>
                      </View>
                    </View>
                    {user?.role === 'child' && (
                      <TouchableOpacity
                        style={[
                          styles.redeemButton,
                          (user?.points || 0) < reward.points_required && styles.redeemButtonDisabled
                        ]}
                        onPress={() => handleRedeem(reward)}
                        disabled={redeeming === reward.reward_id}
                      >
                        {redeeming === reward.reward_id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.redeemButtonText}>Redeem</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
            
            {/* Link to Earn tab from Shop */}
            {user?.role === 'child' && (
              <TouchableOpacity 
                style={styles.earnMoreLink}
                onPress={() => setActiveTab('earn')}
              >
                <Ionicons name="trophy" size={20} color="#10b981" />
                <Text style={styles.earnMoreLinkText}>Need more points? Go to Earn tab</Text>
                <Ionicons name="chevron-forward" size={16} color="#10b981" />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Earn Tab */}
        {activeTab === 'earn' && (
          <>
            {user?.role === 'parent' && (
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => setShowTaskModal(true)}
              >
                <Ionicons name="add-circle" size={20} color="#10b981" />
                <Text style={[styles.createButtonText, { color: '#10b981' }]}>Add New Task</Text>
              </TouchableOpacity>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tasks to Earn Points</Text>
              {tasks.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="trophy-outline" size={64} color="#6b7280" />
                  <Text style={styles.emptyText}>No tasks available</Text>
                  <Text style={styles.emptySubtext}>Complete chores to earn points!</Text>
                </View>
              ) : (
                tasks.map((task) => {
                  // Determine if task is completed or pending review
                  const isCompleted = task.status === 'completed' || task.status === 'approved';
                  const isPendingReview = task.status === 'completed';
                  const isApproved = task.status === 'approved';
                  const claimedByName = task.completed_by_name || task.claimed_by_name;
                  
                  return (
                    <View key={task.task_id} style={[styles.taskCard, isCompleted && styles.taskCardCompleted]}>
                      <View style={[
                        styles.rewardIcon, 
                        { backgroundColor: isApproved ? 'rgba(16, 185, 129, 0.3)' : 
                                          isPendingReview ? 'rgba(251, 191, 36, 0.2)' : 
                                          'rgba(16, 185, 129, 0.2)' }
                      ]}>
                        <Ionicons 
                          name={isApproved ? "checkmark-circle" : isPendingReview ? "hourglass" : "checkbox-outline"} 
                          size={28} 
                          color={isApproved ? "#10b981" : isPendingReview ? "#fbbf24" : "#10b981"} 
                        />
                      </View>
                      <View style={styles.rewardInfo}>
                        <Text style={[styles.rewardName, isApproved && styles.taskTitleCompleted]}>{task.title}</Text>
                        {claimedByName && (
                          <Text style={styles.taskClaimedBy}>
                            {isApproved ? `✓ Completed by ${claimedByName}` : 
                             isPendingReview ? `⏳ ${claimedByName} - Awaiting approval` : 
                             `Claimed by ${claimedByName}`}
                          </Text>
                        )}
                        {task.deadline && (
                          <Text style={styles.taskDeadline}>Due: {new Date(task.deadline).toLocaleDateString()}</Text>
                        )}
                        <View style={styles.rewardPoints}>
                          <Ionicons name="star" size={14} color="#fbbf24" />
                          <Text style={styles.rewardPointsText}>+{task.points} pts</Text>
                        </View>
                      </View>
                      {user?.role === 'child' && !isCompleted && (
                        <TouchableOpacity
                          style={[styles.redeemButton, { backgroundColor: '#10b981' }]}
                          onPress={() => handleCompleteTask(task)}
                        >
                          <Text style={styles.redeemButtonText}>Done</Text>
                        </TouchableOpacity>
                      )}
                      {isPendingReview && !isApproved && (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>Pending</Text>
                        </View>
                      )}
                      {isApproved && (
                        <View style={styles.approvedBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>

            {/* Quick link to more ways to earn - switches to Earn tab */}
            <TouchableOpacity 
              style={styles.choreLink}
              onPress={() => {
                // Switch to the Earn tab (already on it, but this provides confirmation)
                // If user is on Shop tab and wants more ways to earn, switch to Earn
                if (activeTab !== 'earn') {
                  setActiveTab('earn');
                } else {
                  // Already on Earn tab, navigate to Chores screen for more options
                  navigation.navigate('Chores');
                }
              }}
            >
              <Ionicons name="checkbox" size={24} color="#a855f7" />
              <Text style={styles.choreLinkText}>
                {activeTab === 'earn' ? 'Go to Chores for more tasks' : 'View all ways to earn'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Pending Tab (Parents) */}
        {activeTab === 'pending' && user?.role === 'parent' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Redemptions</Text>
            {pendingRedemptions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle-outline" size={64} color="#6b7280" />
                <Text style={styles.emptyText}>No pending requests</Text>
              </View>
            ) : (
              pendingRedemptions.map((item) => (
                <View key={item.redemption_id} style={styles.pendingCard}>
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingChild}>{item.child_name}</Text>
                    <Text style={styles.pendingReward}>{item.reward_name}</Text>
                    <View style={styles.rewardPoints}>
                      <Ionicons name="star" size={14} color="#fbbf24" />
                      <Text style={styles.rewardPointsText}>{item.points_cost} pts</Text>
                    </View>
                  </View>
                  <View style={styles.approvalButtons}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApproveRedemption(item, true)}
                    >
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.denyBtn}
                      onPress={() => handleApproveRedemption(item, false)}
                    >
                      <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Reward Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Reward</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
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
              style={styles.input}
              placeholder="Description (optional)"
              placeholderTextColor="#6b7280"
              value={newReward.description}
              onChangeText={(text) => setNewReward({ ...newReward, description: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Points required"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={newReward.points_required}
              onChangeText={(text) => setNewReward({ ...newReward, points_required: text })}
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
                <Text style={styles.submitBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Task Modal */}
      <Modal visible={showTaskModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Task</Text>
              <TouchableOpacity onPress={() => setShowTaskModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Task title"
              placeholderTextColor="#6b7280"
              value={newTask.title}
              onChangeText={(text) => setNewTask({ ...newTask, title: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Points to earn"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={newTask.points}
              onChangeText={(text) => setNewTask({ ...newTask, points: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Deadline (YYYY-MM-DD, optional)"
              placeholderTextColor="#6b7280"
              value={newTask.deadline}
              onChangeText={(text) => setNewTask({ ...newTask, deadline: text })}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTaskModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitBtn, { backgroundColor: '#10b981' }, processing && styles.submitBtnDisabled]}
                onPress={handleCreateTask}
                disabled={processing}
              >
                <Text style={styles.submitBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Award/Deduct Points Modal */}
      <Modal visible={showAwardModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{awardData.isDeduction ? 'Deduct Points' : 'Award Points'}</Text>
              <TouchableOpacity onPress={() => { setShowAwardModal(false); setAwardData({ child_id: '', points: '', reason: '', isDeduction: false }); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Award/Deduct Toggle */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleOption, !awardData.isDeduction && styles.toggleOptionActive]}
                onPress={() => setAwardData({ ...awardData, isDeduction: false })}
              >
                <Ionicons name="add-circle" size={20} color={!awardData.isDeduction ? '#10b981' : '#6b7280'} />
                <Text style={[styles.toggleOptionText, !awardData.isDeduction && { color: '#10b981' }]}>Award</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleOption, awardData.isDeduction && styles.toggleOptionActiveDeduct]}
                onPress={() => setAwardData({ ...awardData, isDeduction: true })}
              >
                <Ionicons name="remove-circle" size={20} color={awardData.isDeduction ? '#ef4444' : '#6b7280'} />
                <Text style={[styles.toggleOptionText, awardData.isDeduction && { color: '#ef4444' }]}>Deduct</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Select Child</Text>
            <View style={styles.childSelector}>
              {familyMembers.map((child) => (
                <TouchableOpacity
                  key={child.user_id}
                  style={[styles.childOption, awardData.child_id === child.user_id && styles.childOptionActive]}
                  onPress={() => setAwardData({ ...awardData, child_id: child.user_id })}
                >
                  <Text style={[styles.childOptionText, awardData.child_id === child.user_id && styles.childOptionTextActive]}>
                    {child.nickname || child.name}
                  </Text>
                  <Text style={styles.childPointsText}>{child.points || 0} pts</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={styles.input}
              placeholder={awardData.isDeduction ? 'Points to deduct' : 'Points to award'}
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={awardData.points}
              onChangeText={(text) => setAwardData({ ...awardData, points: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Reason (optional)"
              placeholderTextColor="#6b7280"
              value={awardData.reason}
              onChangeText={(text) => setAwardData({ ...awardData, reason: text })}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAwardModal(false); setAwardData({ child_id: '', points: '', reason: '', isDeduction: false }); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitBtn, { backgroundColor: awardData.isDeduction ? '#ef4444' : '#fbbf24' }, processing && styles.submitBtnDisabled]}
                onPress={handleAwardPoints}
                disabled={processing}
              >
                <Text style={[styles.submitBtnText, { color: awardData.isDeduction ? '#fff' : '#000' }]}>
                  {awardData.isDeduction ? 'Deduct' : 'Award'}
                </Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  backButton: { padding: 8 },
  headerContent: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251, 191, 36, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pointsText: { color: '#fbbf24', fontWeight: 'bold', fontSize: 14 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12 },
  tabActive: { backgroundColor: 'rgba(168, 85, 247, 0.2)', borderWidth: 1, borderColor: '#a855f7' },
  tabText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#a855f7' },
  tabBadge: { backgroundColor: '#ef4444', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 27, 75, 0.8)', marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 16 },
  summaryIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(251, 191, 36, 0.2)', justifyContent: 'center', alignItems: 'center' },
  summaryInfo: { flex: 1, marginLeft: 16 },
  summaryLabel: { color: '#6b7280', fontSize: 12 },
  summaryPoints: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  awardButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fbbf24', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  awardButtonText: { color: '#000', fontWeight: '600', fontSize: 13 },
  createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(168, 85, 247, 0.1)', marginHorizontal: 16, marginBottom: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)', borderStyle: 'dashed' },
  createButtonText: { color: '#a855f7', fontSize: 14, fontWeight: '600' },
  section: { paddingHorizontal: 16 },
  sectionTitle: { color: '#a5b4fc', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  emptyCard: { alignItems: 'center', paddingVertical: 40, backgroundColor: 'rgba(30, 27, 75, 0.5)', borderRadius: 16 },
  emptyText: { color: '#6b7280', fontSize: 16, marginTop: 12 },
  emptySubtext: { color: '#4b5563', fontSize: 13, marginTop: 4 },
  rewardCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 16, padding: 14, marginBottom: 10 },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(6, 78, 59, 0.5)', borderRadius: 16, padding: 14, marginBottom: 10 },
  taskCardCompleted: { backgroundColor: 'rgba(6, 78, 59, 0.3)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  taskTitleCompleted: { textDecorationLine: 'line-through', color: '#6b7280' },
  taskClaimedBy: { color: '#fbbf24', fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  pendingBadge: { backgroundColor: 'rgba(251, 191, 36, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  pendingBadgeText: { color: '#fbbf24', fontSize: 11, fontWeight: '600' },
  approvedBadge: { padding: 6 },
  rewardIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  rewardInfo: { flex: 1, marginLeft: 14 },
  rewardName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rewardDesc: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  taskDeadline: { color: '#fbbf24', fontSize: 11, marginTop: 2 },
  rewardPoints: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rewardPointsText: { color: '#fbbf24', fontSize: 13, fontWeight: '600' },
  redeemButton: { backgroundColor: '#a855f7', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  redeemButtonDisabled: { backgroundColor: '#4b5563' },
  redeemButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  choreLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20, marginHorizontal: 16, marginTop: 8 },
  choreLinkText: { color: '#a855f7', fontSize: 14, fontWeight: '500' },
  earnMoreLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', marginHorizontal: 16, marginTop: 12, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  earnMoreLinkText: { color: '#10b981', fontSize: 13, fontWeight: '500' },
  pendingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251, 191, 36, 0.1)', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.3)' },
  pendingInfo: { flex: 1 },
  pendingChild: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },
  pendingReward: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 2 },
  approvalButtons: { flexDirection: 'row', gap: 8 },
  approveBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' },
  denyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  inputLabel: { color: '#a5b4fc', fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16, marginBottom: 12 },
  childSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  childOption: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  childOptionActive: { backgroundColor: '#6366f1' },
  childOptionText: { color: '#a5b4fc', fontSize: 14 },
  childOptionTextActive: { color: '#fff', fontWeight: '600' },
  childPointsText: { color: '#fbbf24', fontSize: 12 },
  toggleContainer: { flexDirection: 'row', marginBottom: 16, backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 12, padding: 4 },
  toggleOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  toggleOptionActive: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  toggleOptionActiveDeduct: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  toggleOptionText: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(99, 102, 241, 0.2)', alignItems: 'center' },
  cancelBtnText: { color: '#a5b4fc', fontSize: 16, fontWeight: '600' },
  submitBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#a855f7', alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  taskCardCompleted: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  taskTitleCompleted: { textDecorationLine: 'line-through', opacity: 0.7 },
  taskClaimedBy: { color: '#10b981', fontSize: 11, marginTop: 2, fontWeight: '500' },
  pendingBadge: { backgroundColor: '#fbbf24', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  pendingBadgeText: { color: '#000', fontSize: 10, fontWeight: '600' },
  approvedBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: 8, borderRadius: 20 },
});
