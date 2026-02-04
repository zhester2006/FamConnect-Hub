import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert, Switch 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';
import MedalEmblem from '../components/MedalEmblem';

export default function ChoresScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chores, setChores] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [processing, setProcessing] = useState(null);
  
  // Create/Edit Chore Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAiScheduler, setShowAiScheduler] = useState(false);
  const [editingChore, setEditingChore] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  // Form state
  const [choreForm, setChoreForm] = useState({
    title: '',
    description: '',
    points: '10',
    assignedTo: '',
    scheduledDate: new Date().toISOString().split('T')[0],
  });
  
  // AI Scheduler state
  const [aiDays, setAiDays] = useState(7);
  const [aiPreferences, setAiPreferences] = useState('');
  const [includedMembers, setIncludedMembers] = useState([]);
  const [aiSchedule, setAiSchedule] = useState('');

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
      
      // Create a map of user_id to rank
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
      setIncludedMembers(membersWithRank.filter(m => m.role === 'child').map(m => m.user_id));
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
      await apiService.put(`/chores/${chore.chore_id}/approve`, { approved });
      if (approved && refreshUser) await refreshUser();
      Alert.alert(approved ? 'Approved!' : 'Denied', approved ? `Points awarded to ${chore.assignee_name}!` : 'Chore has been denied.');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to process approval');
    } finally {
      setProcessing(null);
    }
  };

  const handleCreateChore = async () => {
    if (!choreForm.title.trim()) {
      Alert.alert('Error', 'Please enter a chore title');
      return;
    }
    
    setProcessing('create');
    try {
      const payload = {
        title: choreForm.title,
        description: choreForm.description,
        points: parseInt(choreForm.points) || 10,
        assigned_to: choreForm.assignedTo || null,
        scheduled_date: choreForm.scheduledDate,
      };
      
      if (editingChore) {
        await apiService.put(`/chores/${editingChore.chore_id}`, payload);
        Alert.alert('Updated!', 'Chore has been updated');
      } else {
        await apiService.createChore(payload);
        Alert.alert('Created!', 'New chore has been created');
      }
      
      setShowCreateModal(false);
      resetChoreForm();
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to save chore');
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
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setProcessing(chore.chore_id);
            try {
              await apiService.delete(`/chores/${chore.chore_id}`);
              fetchData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete chore');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

  const handleGenerateAiSchedule = async () => {
    if (includedMembers.length === 0) {
      Alert.alert('Error', 'Please select at least one family member');
      return;
    }
    
    setAiLoading(true);
    try {
      const response = await apiService.post('/chores/ai-schedule', {
        days: aiDays,
        preferences: aiPreferences,
        included_members: includedMembers,
      });
      setAiSchedule(response.schedule || 'Schedule generated successfully!');
      Alert.alert('Success', 'AI schedule generated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate AI schedule');
    } finally {
      setAiLoading(false);
    }
  };

  const openEditModal = (chore) => {
    setEditingChore(chore);
    setChoreForm({
      title: chore.title,
      description: chore.description || '',
      points: String(chore.points || 10),
      assignedTo: chore.assigned_to || '',
      scheduledDate: chore.scheduled_date || new Date().toISOString().split('T')[0],
    });
    setShowCreateModal(true);
  };

  const resetChoreForm = () => {
    setEditingChore(null);
    setChoreForm({
      title: '',
      description: '',
      points: '10',
      assignedTo: '',
      scheduledDate: new Date().toISOString().split('T')[0],
    });
  };

  const toggleMemberInclusion = (memberId) => {
    setIncludedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const getFilteredChores = () => {
    switch (filter) {
      case 'pending': return chores.filter(c => c.status === 'pending' || !c.status);
      case 'submitted': return chores.filter(c => c.status === 'completed');
      case 'approved': return chores.filter(c => c.status === 'approved');
      default: return chores;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (dateStr === today.toISOString().split('T')[0]) return 'Today';
      if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch (error) {
      return dateStr;
    }
  };

  const isParent = user?.role === 'parent';
  const childMembers = familyMembers.filter(m => m.role === 'child');
  const pendingApprovals = chores.filter(c => c.status === 'completed');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
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
        <Text style={styles.title}>Chores</Text>
        {isParent && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => { resetChoreForm(); setShowCreateModal(true); }}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* AI Scheduler Button (Parents) */}
      {isParent && (
        <TouchableOpacity 
          style={styles.aiSchedulerButton}
          onPress={() => setShowAiScheduler(true)}
        >
          <Ionicons name="sparkles" size={20} color="#fbbf24" />
          <Text style={styles.aiSchedulerText}>AI Scheduler</Text>
          <Ionicons name="chevron-forward" size={16} color="#a5b4fc" />
        </TouchableOpacity>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {['all', 'pending', 'submitted', 'approved'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab === 'submitted' ? 'To Review' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            {tab === 'submitted' && pendingApprovals.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingApprovals.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />
        }
      >
        {getFilteredChores().length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkbox-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyText}>No chores found</Text>
            {isParent && (
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => { resetChoreForm(); setShowCreateModal(true); }}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Create Chore</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          getFilteredChores().map((chore) => (
            <View key={chore.chore_id} style={styles.choreCard}>
              <View style={styles.choreMain}>
                <View style={[
                  styles.statusDot,
                  chore.status === 'approved' && styles.statusApproved,
                  chore.status === 'completed' && styles.statusSubmitted,
                ]} />
                <View style={styles.choreContent}>
                  <Text style={[
                    styles.choreName,
                    chore.status === 'approved' && styles.choreNameDone
                  ]}>
                    {chore.title}
                  </Text>
                  <View style={styles.choreMeta}>
                    {chore.assignee_name && (
                      <View style={styles.assigneeBadge}>
                        <Ionicons name="person" size={12} color="#a5b4fc" />
                        <Text style={styles.assigneeText}>{chore.assignee_name}</Text>
                      </View>
                    )}
                    <Text style={styles.dateText}>{formatDate(chore.scheduled_date)}</Text>
                  </View>
                  <View style={styles.choreFooter}>
                    <View style={styles.pointsBadge}>
                      <Ionicons name="star" size={14} color="#fbbf24" />
                      <Text style={styles.pointsText}>{chore.points || 10} pts</Text>
                    </View>
                    {chore.status === 'approved' && (
                      <View style={styles.statusBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                        <Text style={styles.statusText}>Approved</Text>
                      </View>
                    )}
                    {chore.status === 'completed' && (
                      <View style={[styles.statusBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                        <Ionicons name="time" size={14} color="#f59e0b" />
                        <Text style={[styles.statusText, { color: '#f59e0b' }]}>Awaiting Approval</Text>
                      </View>
                    )}
                    {chore.is_repeat && (
                      <View style={styles.repeatBadge}>
                        <Ionicons name="refresh" size={12} color="#ef4444" />
                        <Text style={styles.repeatText}>Repeat</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              
              {/* Actions */}
              <View style={styles.choreActions}>
                {/* Child: Complete button */}
                {!isParent && chore.status !== 'completed' && chore.status !== 'approved' && (
                  <TouchableOpacity
                    style={styles.completeBtn}
                    onPress={() => handleCompleteChore(chore)}
                    disabled={processing === chore.chore_id}
                  >
                    {processing === chore.chore_id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                )}
                
                {/* Parent: Approve/Deny buttons */}
                {isParent && chore.status === 'completed' && (
                  <View style={styles.approvalButtons}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApproveChore(chore, true)}
                      disabled={processing === chore.chore_id}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.denyBtn}
                      onPress={() => handleApproveChore(chore, false)}
                      disabled={processing === chore.chore_id}
                    >
                      <Ionicons name="close" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
                
                {/* Parent: Edit/Delete */}
                {isParent && chore.status !== 'completed' && (
                  <View style={styles.editButtons}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => openEditModal(chore)}
                    >
                      <Ionicons name="create-outline" size={18} color="#a5b4fc" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteChore(chore)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create/Edit Chore Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingChore ? 'Edit Chore' : 'Create Chore'}</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              <TextInput
                style={styles.input}
                placeholder="Chore title"
                placeholderTextColor="#6b7280"
                value={choreForm.title}
                onChangeText={(text) => setChoreForm({ ...choreForm, title: text })}
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                placeholderTextColor="#6b7280"
                value={choreForm.description}
                onChangeText={(text) => setChoreForm({ ...choreForm, description: text })}
                multiline
              />
              
              <Text style={styles.inputLabel}>Points</Text>
              <View style={styles.pointsSelector}>
                {['5', '10', '15', '20', '25', '30'].map((pts) => (
                  <TouchableOpacity
                    key={pts}
                    style={[styles.pointOption, choreForm.points === pts && styles.pointOptionActive]}
                    onPress={() => setChoreForm({ ...choreForm, points: pts })}
                  >
                    <Text style={[styles.pointOptionText, choreForm.points === pts && styles.pointOptionTextActive]}>
                      {pts}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.inputLabel}>Assign To</Text>
              <View style={styles.memberSelector}>
                <TouchableOpacity
                  style={[styles.memberOption, !choreForm.assignedTo && styles.memberOptionActive]}
                  onPress={() => setChoreForm({ ...choreForm, assignedTo: '' })}
                >
                  <Text style={[styles.memberOptionText, !choreForm.assignedTo && styles.memberOptionTextActive]}>
                    Anyone
                  </Text>
                </TouchableOpacity>
                {childMembers.map((member) => (
                  <TouchableOpacity
                    key={member.user_id}
                    style={[styles.memberOption, choreForm.assignedTo === member.user_id && styles.memberOptionActive]}
                    onPress={() => setChoreForm({ ...choreForm, assignedTo: member.user_id })}
                  >
                    <View style={styles.memberOptionContent}>
                      <Text style={[styles.memberOptionText, choreForm.assignedTo === member.user_id && styles.memberOptionTextActive]}>
                        {member.nickname || member.name}
                      </Text>
                      {member.rank && member.rank <= 3 && (
                        <MedalEmblem rank={member.rank} size="tiny" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitBtn, processing === 'create' && styles.submitBtnDisabled]}
                onPress={handleCreateChore}
                disabled={processing === 'create'}
              >
                {processing === 'create' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>{editingChore ? 'Save' : 'Create'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Scheduler Modal */}
      <Modal visible={showAiScheduler} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.aiTitleRow}>
                <View style={styles.aiIcon}>
                  <Ionicons name="sparkles" size={20} color="#fff" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>AI Chore Scheduler</Text>
                  <Text style={styles.modalSubtitle}>Generate a fair schedule</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowAiScheduler(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.inputLabel}>Schedule Duration</Text>
              <View style={styles.daysSelector}>
                {[3, 5, 7, 14].map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[styles.dayOption, aiDays === days && styles.dayOptionActive]}
                    onPress={() => setAiDays(days)}
                  >
                    <Text style={[styles.dayOptionText, aiDays === days && styles.dayOptionTextActive]}>
                      {days} days
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.inputLabel}>Include Family Members</Text>
              <View style={styles.memberCheckboxes}>
                {childMembers.map((member) => (
                  <TouchableOpacity
                    key={member.user_id}
                    style={styles.memberCheckbox}
                    onPress={() => toggleMemberInclusion(member.user_id)}
                  >
                    <View style={[styles.checkbox, includedMembers.includes(member.user_id) && styles.checkboxChecked]}>
                      {includedMembers.includes(member.user_id) && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text style={styles.memberCheckboxText}>{member.nickname || member.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.inputLabel}>Preferences (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g., Alex prefers outdoor chores, rotate dishes daily..."
                placeholderTextColor="#6b7280"
                value={aiPreferences}
                onChangeText={setAiPreferences}
                multiline
              />
              
              <View style={styles.aiNote}>
                <Ionicons name="information-circle" size={16} color="#a5b4fc" />
                <Text style={styles.aiNoteText}>
                  AI will auto-adjust for incomplete chores (assign to next day) and skip points for repeat assignments.
                </Text>
              </View>
              
              {aiSchedule && (
                <View style={styles.aiResultCard}>
                  <Text style={styles.aiResultTitle}>Generated Schedule</Text>
                  <Text style={styles.aiResultText}>{aiSchedule}</Text>
                </View>
              )}
            </ScrollView>
            
            <TouchableOpacity 
              style={[styles.generateBtn, aiLoading && styles.generateBtnDisabled]}
              onPress={handleGenerateAiSchedule}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color="#fff" />
                  <Text style={styles.generateBtnText}>Generate Schedule</Text>
                </>
              )}
            </TouchableOpacity>
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
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  addButton: { padding: 8, backgroundColor: 'rgba(16, 185, 129, 0.3)', borderRadius: 10 },
  
  // AI Scheduler Button
  aiSchedulerButton: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, padding: 14, backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.3)' },
  aiSchedulerText: { flex: 1, color: '#fff', fontWeight: '600', marginLeft: 10 },
  
  // Filter Tabs
  filterTabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 6 },
  filterTab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(30, 27, 75, 0.5)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterTabActive: { backgroundColor: '#10b981' },
  filterTabText: { color: '#a5b4fc', fontSize: 13 },
  filterTabTextActive: { color: '#fff', fontWeight: '600' },
  tabBadge: { backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  
  scrollView: { flex: 1, paddingHorizontal: 16 },
  
  // Empty State
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#6b7280', fontSize: 16, marginVertical: 16 },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
  createButtonText: { color: '#fff', fontWeight: '600' },
  
  // Chore Cards
  choreCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 16, padding: 14, marginBottom: 10 },
  choreMain: { flexDirection: 'row', alignItems: 'flex-start' },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6b7280', marginTop: 6, marginRight: 12 },
  statusApproved: { backgroundColor: '#10b981' },
  statusSubmitted: { backgroundColor: '#f59e0b' },
  choreContent: { flex: 1 },
  choreName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  choreNameDone: { textDecorationLine: 'line-through', color: '#6b7280' },
  choreMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  assigneeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  assigneeText: { color: '#a5b4fc', fontSize: 12 },
  dateText: { color: '#6b7280', fontSize: 12 },
  choreFooter: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251, 191, 36, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pointsText: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#10b981', fontSize: 11, fontWeight: '500' },
  repeatBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  repeatText: { color: '#ef4444', fontSize: 11, fontWeight: '500' },
  
  // Chore Actions
  choreActions: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  completeBtn: { backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  approvalButtons: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  denyBtn: { flex: 1, backgroundColor: '#ef4444', paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  editButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  editBtn: { padding: 8 },
  deleteBtn: { padding: 8 },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  modalSubtitle: { fontSize: 12, color: '#a5b4fc', marginTop: 2 },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  modalScroll: { maxHeight: 400 },
  
  // Inputs
  input: { backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 14, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)', marginBottom: 12 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  inputLabel: { color: '#a5b4fc', fontSize: 13, marginBottom: 10 },
  
  // Points Selector
  pointsSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pointOption: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(30, 27, 75, 0.8)' },
  pointOptionActive: { backgroundColor: '#fbbf24' },
  pointOptionText: { color: '#6b7280', fontWeight: '600' },
  pointOptionTextActive: { color: '#000' },
  
  // Member Selector
  memberSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  memberOption: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(30, 27, 75, 0.8)' },
  memberOptionActive: { backgroundColor: '#6366f1' },
  memberOptionContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberOptionText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  memberOptionTextActive: { color: '#fff' },
  
  // Days Selector
  daysSelector: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dayOption: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(30, 27, 75, 0.8)', alignItems: 'center' },
  dayOptionActive: { backgroundColor: '#6366f1' },
  dayOptionText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  dayOptionTextActive: { color: '#fff' },
  
  // Member Checkboxes
  memberCheckboxes: { marginBottom: 16 },
  memberCheckbox: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#6b7280', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  memberCheckboxText: { color: '#fff', fontSize: 15 },
  
  // AI Note
  aiNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(30, 27, 75, 0.8)', padding: 12, borderRadius: 12, marginBottom: 16 },
  aiNoteText: { flex: 1, color: '#a5b4fc', fontSize: 12, lineHeight: 18 },
  
  // AI Result
  aiResultCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, padding: 14, marginBottom: 16 },
  aiResultTitle: { color: '#fff', fontWeight: '600', marginBottom: 8 },
  aiResultText: { color: '#a5b4fc', fontSize: 13, lineHeight: 20 },
  
  // Modal Actions
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, backgroundColor: '#374151', paddingVertical: 16, borderRadius: 25, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  submitBtn: { flex: 1, backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 25, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 25, marginTop: 16 },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
