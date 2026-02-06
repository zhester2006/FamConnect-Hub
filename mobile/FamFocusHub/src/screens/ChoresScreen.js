import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert, Switch, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';
import MedalEmblem from '../components/MedalEmblem';

// Default chore types that can be quickly assigned
const CHORE_TYPES = [
  { name: 'Make Bed', icon: 'bed', points: 5, color: '#8b5cf6' },
  { name: 'Clean Room', icon: 'home', points: 15, color: '#3b82f6' },
  { name: 'Do Dishes', icon: 'restaurant', points: 10, color: '#14b8a6' },
  { name: 'Take Out Trash', icon: 'trash', points: 10, color: '#f59e0b' },
  { name: 'Vacuum', icon: 'sparkles', points: 15, color: '#ec4899' },
  { name: 'Laundry', icon: 'shirt', points: 20, color: '#6366f1' },
  { name: 'Mow Lawn', icon: 'leaf', points: 25, color: '#10b981' },
  { name: 'Walk Dog', icon: 'paw', points: 15, color: '#f97316' },
];

export default function ChoresScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chores, setChores] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [filter, setFilter] = useState('all'); // all, pending, completed, approved
  const [viewMode, setViewMode] = useState('list'); // list, calendar, byChild
  const [processing, setProcessing] = useState(null);
  
  // Create/Edit Chore Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAiScheduler, setShowAiScheduler] = useState(false);
  const [showQuickAssign, setShowQuickAssign] = useState(false);
  const [editingChore, setEditingChore] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  // Form state
  const [choreForm, setChoreForm] = useState({
    title: '',
    description: '',
    points: '10',
    assignedTo: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    isRepeat: false,
  });
  
  // AI Scheduler state
  const [aiDays, setAiDays] = useState(7);
  const [aiPreferences, setAiPreferences] = useState('');
  const [aiSchedule, setAiSchedule] = useState('');

  const isParent = user?.role === 'parent';
  const primaryColor = theme?.primary || '#6366f1';

  const fetchData = useCallback(async () => {
    try {
      const [choresData, membersData, leaderboardData] = await Promise.all([
        apiService.getChores(),
        apiService.getFamilyMembers(),
        apiService.getLeaderboard().catch(() => ({ leaderboard: [] })),
      ]);
      setChores(choresData.chores || []);
      
      const members = membersData.members || [];
      const leaderboard = leaderboardData.leaderboard || [];
      
      // Create a rank map
      const rankMap = {};
      leaderboard.forEach((child, index) => {
        rankMap[child.user_id] = index + 1;
      });
      
      // Add rank to members
      const membersWithRank = members.map(member => ({
        ...member,
        rank: rankMap[member.user_id] || null
      }));
      
      setFamilyMembers(membersWithRank);
    } catch (error) {
      console.error('Failed to fetch data:', error);
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

  const childMembers = familyMembers.filter(m => m.role === 'child');

  const handleCompleteChore = async (chore) => {
    setProcessing(chore.chore_id);
    try {
      await apiService.completeChore(chore.chore_id);
      Alert.alert('Submitted!', 'Your chore has been submitted for approval.');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit chore');
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveChore = async (chore, approved) => {
    setProcessing(chore.chore_id);
    try {
      await apiService.approveChore(chore.chore_id, approved);
      if (approved) {
        Alert.alert('Approved!', `${chore.points || 10} points awarded!`);
        refreshUser();
      }
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to process chore');
    } finally {
      setProcessing(null);
    }
  };

  const handleCreateChore = async () => {
    if (!choreForm.title.trim()) {
      Alert.alert('Error', 'Please enter a chore name');
      return;
    }

    setProcessing('create');
    try {
      await apiService.createChore({
        title: choreForm.title,
        description: choreForm.description,
        points: parseInt(choreForm.points) || 10,
        assigned_to: choreForm.assignedTo || undefined,
        scheduled_date: choreForm.scheduledDate,
        is_repeat: choreForm.isRepeat,
      });
      setShowCreateModal(false);
      resetForm();
      fetchData();
      Alert.alert('Success', 'Chore created!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create chore');
    } finally {
      setProcessing(null);
    }
  };

  const handleQuickAssign = async (choreType, childId) => {
    setProcessing('quick');
    try {
      await apiService.createChore({
        title: choreType.name,
        points: choreType.points,
        assigned_to: childId,
        scheduled_date: new Date().toISOString().split('T')[0],
      });
      fetchData();
      Alert.alert('Assigned!', `${choreType.name} assigned!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to assign chore');
    } finally {
      setProcessing(null);
    }
  };

  const handleGenerateAiSchedule = async () => {
    setAiLoading(true);
    try {
      const result = await apiService.generateAiSchedule({
        preferences: aiPreferences,
        days: aiDays,
        children: childMembers.map(c => ({ name: c.name, user_id: c.user_id })),
      });
      setAiSchedule(result.schedule || 'No schedule generated');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate schedule');
    } finally {
      setAiLoading(false);
    }
  };

  const handleClaimChore = async (chore) => {
    setProcessing(chore.chore_id);
    try {
      await apiService.claimChore(chore.chore_id);
      Alert.alert('Claimed!', `"${chore.title}" is now assigned to you. Complete it to earn ${chore.points || 10} points!`);
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to claim chore');
    } finally {
      setProcessing(null);
    }
  };

  const handleEditChore = (chore) => {
    setEditingChore(chore);
    setChoreForm({
      title: chore.title || '',
      description: chore.description || '',
      points: String(chore.points || 10),
      assignedTo: chore.assigned_to || '',
      scheduledDate: chore.scheduled_date || new Date().toISOString().split('T')[0],
      isRepeat: chore.recurring || false,
    });
    setShowCreateModal(true);
  };

  const handleUpdateChore = async () => {
    if (!choreForm.title.trim()) {
      Alert.alert('Error', 'Please enter a chore name');
      return;
    }

    setProcessing('update');
    try {
      await apiService.updateChore(editingChore.chore_id, {
        title: choreForm.title,
        description: choreForm.description,
        points: parseInt(choreForm.points) || 10,
        assigned_to: choreForm.assignedTo || null,
        scheduled_date: choreForm.scheduledDate,
        recurring: choreForm.isRepeat,
      });
      setShowCreateModal(false);
      resetForm();
      fetchData();
      Alert.alert('Success', 'Chore updated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update chore');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteChore = (chore) => {
    Alert.alert(
      'Delete Chore',
      `Are you sure you want to delete "${chore.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiService.deleteChore(chore.chore_id);
            fetchData();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete chore');
          }
        }},
      ]
    );
  };

  const resetForm = () => {
    setChoreForm({
      title: '',
      description: '',
      points: '10',
      assignedTo: '',
      scheduledDate: new Date().toISOString().split('T')[0],
      isRepeat: false,
    });
    setEditingChore(null);
  };

  const getFilteredChores = () => {
    let filtered = chores;
    
    if (filter === 'pending') {
      filtered = filtered.filter(c => c.status === 'pending');
    } else if (filter === 'completed') {
      filtered = filtered.filter(c => c.status === 'completed');
    } else if (filter === 'approved') {
      filtered = filtered.filter(c => c.status === 'approved');
    }
    
    // Sort: pending/completed first, then by date
    return filtered.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'completed') return -1;
        if (b.status === 'completed') return 1;
        if (a.status === 'pending') return -1;
        if (b.status === 'pending') return 1;
      }
      return new Date(b.scheduled_date) - new Date(a.scheduled_date);
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getChoresByChild = () => {
    const grouped = {};
    childMembers.forEach(child => {
      grouped[child.user_id] = {
        child,
        chores: chores.filter(c => c.assigned_to === child.user_id)
      };
    });
    // Add unassigned
    grouped['unassigned'] = {
      child: { user_id: 'unassigned', name: 'Unassigned', nickname: 'Anyone' },
      chores: chores.filter(c => !c.assigned_to)
    };
    return grouped;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <AnimatedBackground page="chores">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Chores</Text>
          <Text style={styles.subtitle}>
            {chores.filter(c => c.status !== 'approved').length} active
          </Text>
        </View>
        {isParent && (
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: primaryColor }]}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* View Mode Tabs (Parents only) */}
      {isParent && (
        <View style={styles.viewModeRow}>
          <TouchableOpacity
            style={[styles.viewModeTab, viewMode === 'list' && { backgroundColor: primaryColor }]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={18} color={viewMode === 'list' ? '#fff' : '#9ca3af'} />
            <Text style={[styles.viewModeText, viewMode === 'list' && { color: '#fff' }]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeTab, viewMode === 'byChild' && { backgroundColor: primaryColor }]}
            onPress={() => setViewMode('byChild')}
          >
            <Ionicons name="people" size={18} color={viewMode === 'byChild' ? '#fff' : '#9ca3af'} />
            <Text style={[styles.viewModeText, viewMode === 'byChild' && { color: '#fff' }]}>By Child</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeTab, viewMode === 'calendar' && { backgroundColor: primaryColor }]}
            onPress={() => setViewMode('calendar')}
          >
            <Ionicons name="calendar" size={18} color={viewMode === 'calendar' ? '#fff' : '#9ca3af'} />
            <Text style={[styles.viewModeText, viewMode === 'calendar' && { color: '#fff' }]}>Week</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AI & Quick Assign Buttons (Parents) */}
      {isParent && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}
            onPress={() => setShowAiScheduler(true)}
          >
            <Ionicons name="sparkles" size={18} color={primaryColor} />
            <Text style={[styles.actionBtnText, { color: primaryColor }]}>AI Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}
            onPress={() => setShowQuickAssign(true)}
          >
            <Ionicons name="flash" size={18} color="#10b981" />
            <Text style={[styles.actionBtnText, { color: '#10b981' }]}>Quick Assign</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Available Chores Section (Parents only) */}
      {isParent && (
        <View style={styles.availableChoresSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles" size={18} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Available Chores</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.availableChoresScroll}>
            {CHORE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.name}
                style={[styles.availableChoreCard, { borderColor: type.color + '40' }]}
                onPress={() => {
                  setChoreForm({ ...choreForm, title: type.name, points: String(type.points) });
                  setShowCreateModal(true);
                }}
              >
                <View style={[styles.availableChoreIcon, { backgroundColor: type.color + '20' }]}>
                  <Ionicons name={type.icon} size={20} color={type.color} />
                </View>
                <Text style={styles.availableChoreTitle}>{type.name}</Text>
                <Text style={styles.availableChorePoints}>{type.points} pts</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {['all', 'pending', 'completed', 'approved'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && { backgroundColor: primaryColor }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && { color: '#fff' }]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chores List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === 'list' && (
          <>
            {getFilteredChores().length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-done-circle" size={48} color="#4b5563" />
                <Text style={styles.emptyText}>No chores found</Text>
                {isParent && (
                  <TouchableOpacity 
                    style={[styles.createFirstBtn, { backgroundColor: primaryColor }]}
                    onPress={() => setShowCreateModal(true)}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.createFirstText}>Create First Chore</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              getFilteredChores().map((chore) => (
                <View key={chore.chore_id} style={styles.choreCard}>
                  <View style={styles.choreMain}>
                    <View style={[
                      styles.statusIndicator,
                      { backgroundColor: chore.status === 'approved' ? '#10b981' :
                                        chore.status === 'completed' ? '#f59e0b' : '#6b7280' }
                    ]} />
                    <View style={styles.choreContent}>
                      <Text style={[styles.choreTitle, chore.status === 'approved' && styles.choreTitleDone]}>
                        {chore.title}
                      </Text>
                      <View style={styles.choreMetaRow}>
                        {chore.assignee_name && (
                          <View style={styles.assigneeBadge}>
                            {chore.assignee_picture ? (
                              <Image source={{ uri: chore.assignee_picture }} style={styles.assigneeAvatar} />
                            ) : (
                              <View style={[styles.assigneeAvatarPlaceholder, { backgroundColor: primaryColor }]}>
                                <Text style={styles.assigneeAvatarText}>{chore.assignee_name?.charAt(0)}</Text>
                              </View>
                            )}
                            <Text style={styles.assigneeName}>{chore.assignee_name}</Text>
                          </View>
                        )}
                        <Text style={styles.choreDate}>{formatDate(chore.scheduled_date)}</Text>
                      </View>
                      <View style={styles.choreFooter}>
                        <View style={styles.pointsBadge}>
                          <Ionicons name="star" size={14} color="#f59e0b" />
                          <Text style={styles.pointsText}>{chore.points || 10} pts</Text>
                        </View>
                        {chore.status === 'approved' && (
                          <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                            <Text style={[styles.statusText, { color: '#10b981' }]}>Done</Text>
                          </View>
                        )}
                        {chore.status === 'completed' && (
                          <View style={[styles.statusBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                            <Ionicons name="time" size={14} color="#f59e0b" />
                            <Text style={[styles.statusText, { color: '#f59e0b' }]}>Pending Review</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  
                  {/* Actions */}
                  <View style={styles.choreActions}>
                    {/* Child: Claim unassigned chore */}
                    {!isParent && chore.status === 'pending' && !chore.assigned_to && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#6366f1' }]}
                        onPress={() => handleClaimChore(chore)}
                        disabled={processing === chore.chore_id}
                      >
                        {processing === chore.chore_id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="hand-left" size={16} color="#fff" />
                            <Text style={styles.actionButtonText}>Claim</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    
                    {/* Child: Mark Complete */}
                    {!isParent && chore.status === 'pending' && chore.assigned_to === user?.user_id && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#10b981' }]}
                        onPress={() => handleCompleteChore(chore)}
                        disabled={processing === chore.chore_id}
                      >
                        {processing === chore.chore_id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={16} color="#fff" />
                            <Text style={styles.actionButtonText}>Done</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    
                    {/* Parent: Approve/Deny */}
                    {isParent && chore.status === 'completed' && (
                      <View style={styles.approvalButtons}>
                        <TouchableOpacity
                          style={[styles.approvalBtn, { backgroundColor: '#10b981' }]}
                          onPress={() => handleApproveChore(chore, true)}
                          disabled={processing === chore.chore_id}
                        >
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.approvalBtn, { backgroundColor: '#ef4444' }]}
                          onPress={() => handleApproveChore(chore, false)}
                          disabled={processing === chore.chore_id}
                        >
                          <Ionicons name="close" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    {/* Parent: Edit */}
                    {isParent && chore.status === 'pending' && (
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => handleEditChore(chore)}
                      >
                        <Ionicons name="pencil" size={18} color="#6b7280" />
                      </TouchableOpacity>
                    )}
                    
                    {/* Parent: Delete */}
                    {isParent && chore.status !== 'completed' && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteChore(chore)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {viewMode === 'byChild' && (
          <>
            {Object.entries(getChoresByChild()).map(([key, { child, chores: childChores }]) => (
              <View key={key} style={styles.childSection}>
                <View style={styles.childSectionHeader}>
                  <View style={styles.childAvatar}>
                    <Text style={styles.childAvatarText}>{child.name?.charAt(0)}</Text>
                    {child.rank && child.rank <= 3 && (
                      <View style={styles.childMedalPosition}>
                        <MedalEmblem rank={child.rank} size="tiny" />
                      </View>
                    )}
                  </View>
                  <View style={styles.childSectionInfo}>
                    <Text style={styles.childSectionName}>{child.nickname || child.name}</Text>
                    <Text style={styles.childSectionCount}>{childChores.length} chores</Text>
                  </View>
                </View>
                {childChores.length === 0 ? (
                  <Text style={styles.noChoresText}>No chores assigned</Text>
                ) : (
                  childChores.map(chore => (
                    <View key={chore.chore_id} style={styles.miniChoreCard}>
                      <View style={[
                        styles.miniStatusDot,
                        { backgroundColor: chore.status === 'approved' ? '#10b981' :
                                          chore.status === 'completed' ? '#f59e0b' : '#6b7280' }
                      ]} />
                      <Text style={styles.miniChoreTitle} numberOfLines={1}>{chore.title}</Text>
                      <Text style={styles.miniChorePoints}>{chore.points}pts</Text>
                    </View>
                  ))
                )}
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create/Edit Chore Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingChore ? 'Edit Chore' : 'Create Chore'}</Text>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Chore Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Clean bedroom"
                placeholderTextColor="#6b7280"
                value={choreForm.title}
                onChangeText={(text) => setChoreForm({ ...choreForm, title: text })}
              />

              <Text style={styles.inputLabel}>Scheduled Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#6b7280"
                value={choreForm.scheduledDate}
                onChangeText={(text) => setChoreForm({ ...choreForm, scheduledDate: text })}
              />

              <Text style={styles.inputLabel}>Points</Text>
              <View style={styles.pointsSelector}>
                {[5, 10, 15, 20, 25].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.pointOption, choreForm.points === String(p) && { backgroundColor: primaryColor }]}
                    onPress={() => setChoreForm({ ...choreForm, points: String(p) })}
                  >
                    <Text style={[styles.pointOptionText, choreForm.points === String(p) && { color: '#fff' }]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Assign To</Text>
              <View style={styles.memberSelector}>
                <TouchableOpacity
                  style={[styles.memberOption, !choreForm.assignedTo && { backgroundColor: primaryColor }]}
                  onPress={() => setChoreForm({ ...choreForm, assignedTo: '' })}
                >
                  <Text style={[styles.memberOptionText, !choreForm.assignedTo && { color: '#fff' }]}>Anyone</Text>
                </TouchableOpacity>
                {childMembers.map((member) => (
                  <TouchableOpacity
                    key={member.user_id}
                    style={[styles.memberOption, choreForm.assignedTo === member.user_id && { backgroundColor: primaryColor }]}
                    onPress={() => setChoreForm({ ...choreForm, assignedTo: member.user_id })}
                  >
                    <Text style={[styles.memberOptionText, choreForm.assignedTo === member.user_id && { color: '#fff' }]}>
                      {member.nickname || member.name}
                    </Text>
                    {member.rank && member.rank <= 3 && <MedalEmblem rank={member.rank} size="tiny" />}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.repeatRow}>
                <View style={styles.repeatInfo}>
                  <Ionicons name="repeat" size={18} color={primaryColor} />
                  <Text style={styles.repeatLabel}>Repeat Daily</Text>
                </View>
                <Switch
                  value={choreForm.isRepeat}
                  onValueChange={(val) => setChoreForm({ ...choreForm, isRepeat: val })}
                  trackColor={{ false: '#4b5563', true: primaryColor }}
                  thumbColor="#fff"
                />
              </View>

              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: primaryColor }]}
                onPress={editingChore ? handleUpdateChore : handleCreateChore}
                disabled={processing === 'create' || processing === 'update'}
              >
                {(processing === 'create' || processing === 'update') ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name={editingChore ? "checkmark-circle" : "add-circle"} size={20} color="#fff" />
                    <Text style={styles.createButtonText}>{editingChore ? 'Update Chore' : 'Create Chore'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Quick Assign Modal */}
      <Modal visible={showQuickAssign} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quick Assign</Text>
              <TouchableOpacity onPress={() => setShowQuickAssign(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text style={styles.quickAssignHint}>Tap a chore type, then select a child to assign</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {CHORE_TYPES.map((type) => (
                <View key={type.name} style={styles.quickAssignRow}>
                  <View style={[styles.quickAssignType, { backgroundColor: `${type.color}20` }]}>
                    <Ionicons name={type.icon} size={20} color={type.color} />
                    <Text style={styles.quickAssignName}>{type.name}</Text>
                    <Text style={styles.quickAssignPoints}>{type.points}pts</Text>
                  </View>
                  <View style={styles.quickAssignChildren}>
                    {childMembers.map((child) => (
                      <TouchableOpacity
                        key={child.user_id}
                        style={styles.quickAssignChild}
                        onPress={() => handleQuickAssign(type, child.user_id)}
                      >
                        <Text style={styles.quickAssignChildText}>{child.name?.charAt(0)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* AI Scheduler Modal */}
      <Modal visible={showAiScheduler} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.aiHeaderInfo}>
                <View style={[styles.aiIcon, { backgroundColor: primaryColor }]}>
                  <Ionicons name="sparkles" size={20} color="#fff" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>AI Scheduler</Text>
                  <Text style={styles.aiSubtitle}>Generate fair weekly schedule</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => { setShowAiScheduler(false); setAiSchedule(''); }}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {!aiSchedule ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Schedule Duration</Text>
                <View style={styles.daysSelector}>
                  {[3, 5, 7, 14].map(days => (
                    <TouchableOpacity
                      key={days}
                      style={[styles.dayOption, aiDays === days && { backgroundColor: primaryColor }]}
                      onPress={() => setAiDays(days)}
                    >
                      <Text style={[styles.dayOptionText, aiDays === days && { color: '#fff' }]}>
                        {days} days
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Preferences (optional)</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="e.g., Alex does outdoor chores, no chores on weekends..."
                  placeholderTextColor="#6b7280"
                  value={aiPreferences}
                  onChangeText={setAiPreferences}
                  multiline
                />

                <View style={styles.aiInfoBox}>
                  <Ionicons name="information-circle" size={16} color="#6b7280" />
                  <Text style={styles.aiInfoText}>
                    AI will analyze your children's recent history and create a balanced schedule.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.createButton, { backgroundColor: primaryColor }]}
                  onPress={handleGenerateAiSchedule}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={20} color="#fff" />
                      <Text style={styles.createButtonText}>Generate Schedule</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.scheduleResult}>
                  <View style={styles.scheduleHeader}>
                    <Ionicons name="calendar" size={18} color={primaryColor} />
                    <Text style={styles.scheduleTitle}>{aiDays}-Day Schedule</Text>
                  </View>
                  <Text style={styles.scheduleText}>{aiSchedule}</Text>
                </View>

                <View style={styles.scheduleActions}>
                  <TouchableOpacity style={styles.regenerateBtn} onPress={() => setAiSchedule('')}>
                    <Text style={styles.regenerateBtnText}>Generate New</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.applyBtn, { backgroundColor: primaryColor }]}
                    onPress={() => { setShowAiScheduler(false); setAiSchedule(''); Alert.alert('Success', 'Schedule applied!'); }}
                  >
                    <Text style={styles.applyBtnText}>Apply Schedule</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d1a' },
  
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, marginLeft: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

  viewModeRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  viewModeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(30, 27, 75, 0.6)' },
  viewModeText: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },

  actionButtons: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  actionBtnText: { fontSize: 13, fontWeight: '600' },

  // Available Chores Section
  availableChoresSection: { paddingHorizontal: 16, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  availableChoresScroll: { marginHorizontal: -4 },
  availableChoreCard: { width: 100, backgroundColor: 'rgba(30, 27, 75, 0.6)', borderRadius: 12, padding: 12, marginHorizontal: 4, alignItems: 'center', borderWidth: 1 },
  availableChoreIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  availableChoreTitle: { fontSize: 11, fontWeight: '600', color: '#fff', textAlign: 'center', marginBottom: 4 },
  availableChorePoints: { fontSize: 10, color: '#f59e0b', fontWeight: '600' },

  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(30, 27, 75, 0.6)', marginRight: 8 },
  filterText: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#6b7280', marginTop: 12, marginBottom: 20 },
  createFirstBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  createFirstText: { color: '#fff', fontWeight: '600' },

  choreCard: { backgroundColor: 'rgba(30, 27, 75, 0.6)', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  choreMain: { flexDirection: 'row', alignItems: 'flex-start' },
  statusIndicator: { width: 4, height: '100%', minHeight: 50, borderRadius: 2, marginRight: 12 },
  choreContent: { flex: 1 },
  choreTitle: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 6 },
  choreTitleDone: { textDecorationLine: 'line-through', opacity: 0.6 },
  choreMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  assigneeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assigneeAvatar: { width: 20, height: 20, borderRadius: 10 },
  assigneeAvatarPlaceholder: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  assigneeAvatarText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  assigneeName: { color: '#a5b4fc', fontSize: 12 },
  choreDate: { color: '#6b7280', fontSize: 11 },
  choreFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pointsText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '600' },

  choreActions: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 20 },
  actionButtonText: { color: '#fff', fontWeight: '600' },
  approvalButtons: { flexDirection: 'row', gap: 10 },
  approvalBtn: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { alignSelf: 'flex-end', padding: 8 },

  childSection: { backgroundColor: 'rgba(30, 27, 75, 0.6)', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  childSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  childAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  childAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  childMedalPosition: { position: 'absolute', bottom: -2, right: -2 },
  childSectionInfo: { marginLeft: 12 },
  childSectionName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  childSectionCount: { fontSize: 11, color: '#9ca3af' },
  noChoresText: { color: '#6b7280', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  miniChoreCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 13, 26, 0.5)', borderRadius: 10, padding: 10, marginBottom: 6 },
  miniStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  miniChoreTitle: { flex: 1, fontSize: 13, color: '#fff' },
  miniChorePoints: { fontSize: 11, color: '#f59e0b', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  aiHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  aiSubtitle: { fontSize: 12, color: '#9ca3af' },

  deleteBtn: { padding: 8 },
  editBtn: { padding: 8, marginRight: 4 },

  inputLabel: { fontSize: 13, color: '#9ca3af', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  pointsSelector: { flexDirection: 'row', gap: 8 },
  pointOption: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: 'rgba(30, 27, 75, 0.8)', alignItems: 'center' },
  pointOptionText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  memberSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(30, 27, 75, 0.8)' },
  memberOptionText: { color: '#9ca3af', fontSize: 13, fontWeight: '500' },
  repeatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(30, 27, 75, 0.5)', borderRadius: 12, padding: 14, marginTop: 16 },
  repeatInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  repeatLabel: { color: '#fff', fontSize: 14 },
  createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 20, marginTop: 20 },
  createButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  quickAssignHint: { color: '#9ca3af', fontSize: 12, marginBottom: 16 },
  quickAssignRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  quickAssignType: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 },
  quickAssignName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500' },
  quickAssignPoints: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  quickAssignChildren: { flexDirection: 'row', gap: 8, marginLeft: 10 },
  quickAssignChild: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  quickAssignChildText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  daysSelector: { flexDirection: 'row', gap: 8 },
  dayOption: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: 'rgba(30, 27, 75, 0.8)', alignItems: 'center' },
  dayOptionText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  aiInfoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(30, 27, 75, 0.5)', borderRadius: 12, padding: 12, marginTop: 16 },
  aiInfoText: { flex: 1, fontSize: 12, color: '#9ca3af', lineHeight: 18 },
  scheduleResult: { backgroundColor: 'rgba(30, 27, 75, 0.5)', borderRadius: 16, padding: 16 },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  scheduleTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  scheduleText: { fontSize: 13, color: '#d1d5db', lineHeight: 22 },
  scheduleActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  regenerateBtn: { flex: 1, paddingVertical: 14, borderRadius: 20, backgroundColor: 'rgba(55, 65, 81, 0.8)', alignItems: 'center' },
  regenerateBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  applyBtn: { flex: 1, paddingVertical: 14, borderRadius: 20, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
