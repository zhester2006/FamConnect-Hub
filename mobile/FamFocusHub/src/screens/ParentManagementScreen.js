import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, TextInput, Alert, ActivityIndicator,
  FlatList, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';

const ACHIEVEMENT_ICONS = ['🏆', '⭐', '🎯', '🔥', '💪', '📚', '🎨', '🏅', '👑', '💎', '🌟', '🎖️', '🥇', '🥈', '🥉', '🌈'];
const BADGE_CATEGORIES = ['milestone', 'streak', 'special', 'family', 'seasonal'];

export default function ParentManagementScreen({ navigation }) {
  const { user } = useAuth();
  const theme = useTheme();
  const primaryColor = theme?.primary || '#6366f1';
  
  const [activeTab, setActiveTab] = useState('achievements');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Data
  const [customAchievements, setCustomAchievements] = useState([]);
  const [familyGoals, setFamilyGoals] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  
  // Editor modal
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState('add'); // 'add' or 'edit'
  const [editingItem, setEditingItem] = useState(null);
  
  // Form fields
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemIcon, setItemIcon] = useState('🏆');
  const [itemPoints, setItemPoints] = useState('50');
  const [itemRequirement, setItemRequirement] = useState('1');
  const [itemCategory, setItemCategory] = useState('milestone');
  const [itemType, setItemType] = useState('achievement'); // for goals: 'personal' or 'family'
  
  // Award modal
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardingItem, setAwardingItem] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [achievementsRes, membersRes] = await Promise.all([
        apiService.get('/achievements/custom').catch(() => ({ achievements: [] })),
        apiService.get('/family/members').catch(() => ({ members: [] })),
      ]);
      
      setCustomAchievements(achievementsRes.achievements || []);
      setFamilyMembers(membersRes.members || membersRes || []);
      
      // Fetch family goals
      const goalsRes = await apiService.get('/goals').catch(() => ({ goals: [] }));
      setFamilyGoals(goalsRes.goals || []);
    } catch (error) {
      console.error('Failed to fetch management data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const openEditor = (mode, item = null) => {
    setEditorMode(mode);
    if (item) {
      setEditingItem(item);
      setItemName(item.name || '');
      setItemDescription(item.description || '');
      setItemIcon(item.icon || '🏆');
      setItemPoints(String(item.points_value || item.points || 50));
      setItemRequirement(String(item.requirement || 1));
      setItemCategory(item.category || 'milestone');
    } else {
      resetEditor();
    }
    setShowEditor(true);
  };

  const resetEditor = () => {
    setEditingItem(null);
    setItemName('');
    setItemDescription('');
    setItemIcon('🏆');
    setItemPoints('50');
    setItemRequirement('1');
    setItemCategory('milestone');
    setEditorMode('add');
  };

  const closeEditor = () => {
    setShowEditor(false);
    resetEditor();
  };

  const handleSave = async () => {
    if (!itemName.trim() || !itemDescription.trim()) {
      Alert.alert('Missing Info', 'Please enter a name and description');
      return;
    }

    setProcessing(true);
    try {
      const data = {
        name: itemName.trim(),
        description: itemDescription.trim(),
        icon: itemIcon,
        points_value: parseInt(itemPoints) || 50,
        requirement: parseInt(itemRequirement) || 1,
        category: itemCategory,
      };

      if (activeTab === 'achievements') {
        if (editorMode === 'edit' && editingItem) {
          await apiService.put(`/achievements/custom/${editingItem.achievement_id}`, data);
          Alert.alert('Success', 'Achievement updated!');
        } else {
          await apiService.post('/achievements/custom', data);
          Alert.alert('Success', 'Achievement created!');
        }
      } else {
        // Goals
        const goalData = {
          title: itemName.trim(),
          description: itemDescription.trim(),
          target: parseInt(itemRequirement) || 1,
          type: itemType,
        };
        
        if (editorMode === 'edit' && editingItem) {
          await apiService.put(`/goals/${editingItem.goal_id}`, goalData);
          Alert.alert('Success', 'Goal updated!');
        } else {
          await apiService.post('/goals', goalData);
          Alert.alert('Success', 'Goal created!');
        }
      }

      closeEditor();
      fetchData();
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = (item) => {
    const itemType = activeTab === 'achievements' ? 'achievement' : 'goal';
    const itemId = item.achievement_id || item.goal_id;
    
    Alert.alert(
      `Delete ${itemType}?`,
      `Are you sure you want to delete "${item.name || item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activeTab === 'achievements') {
                await apiService.delete(`/achievements/custom/${itemId}`);
              } else {
                await apiService.delete(`/goals/${itemId}`);
              }
              Alert.alert('Deleted', `${itemType} removed successfully`);
              fetchData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete');
            }
          }
        }
      ]
    );
  };

  const handleAward = async () => {
    if (!selectedMember || !awardingItem) return;
    
    setProcessing(true);
    try {
      await apiService.post(`/achievements/custom/${awardingItem.achievement_id}/award`, {
        user_id: selectedMember.user_id,
      });
      Alert.alert('Success', `Achievement awarded to ${selectedMember.name || selectedMember.nickname}!`);
      setShowAwardModal(false);
      setAwardingItem(null);
      setSelectedMember(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to award achievement');
    } finally {
      setProcessing(false);
    }
  };

  const openAwardModal = (item) => {
    setAwardingItem(item);
    setSelectedMember(null);
    setShowAwardModal(true);
  };

  const fetchAiSuggestions = async () => {
    setProcessing(true);
    try {
      const res = await apiService.post('/achievements/ai-suggestions', {});
      setAiSuggestions(res.suggestions || []);
      if (res.suggestions?.length > 0) {
        Alert.alert('AI Suggestions', `Got ${res.suggestions.length} achievement ideas!`);
      } else {
        Alert.alert('No Suggestions', 'AI could not generate suggestions at this time.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get AI suggestions');
    } finally {
      setProcessing(false);
    }
  };

  const addSuggestionAsAchievement = (suggestion) => {
    setItemName(suggestion.name || '');
    setItemDescription(suggestion.description || '');
    setItemIcon(suggestion.icon || '🏆');
    setItemPoints(String(suggestion.points_value || 50));
    setItemRequirement(String(suggestion.requirement || 1));
    setEditorMode('add');
    setShowEditor(true);
  };

  const renderAchievementCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{item.icon}</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardDescription}>{item.description}</Text>
          <View style={styles.cardMeta}>
            <View style={styles.metaBadge}>
              <Ionicons name="star" size={12} color="#fbbf24" />
              <Text style={styles.metaText}>{item.points_value || 0} pts</Text>
            </View>
            <View style={styles.metaBadge}>
              <Ionicons name="flag" size={12} color="#10b981" />
              <Text style={styles.metaText}>{item.requirement || 1}x</Text>
            </View>
            <View style={[styles.metaBadge, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
              <Text style={styles.metaText}>{item.category}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}
          onPress={() => openAwardModal(item)}
        >
          <Ionicons name="gift" size={18} color="#10b981" />
          <Text style={[styles.actionBtnText, { color: '#10b981' }]}>Award</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}
          onPress={() => openEditor('edit', item)}
        >
          <Ionicons name="pencil" size={18} color="#6366f1" />
          <Text style={[styles.actionBtnText, { color: '#6366f1' }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGoalCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.goalProgress}>
          <Text style={styles.goalProgressText}>
            {item.current || 0}/{item.target || 1}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.title}</Text>
          <Text style={styles.cardDescription}>{item.description}</Text>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { width: `${Math.min(100, ((item.current || 0) / (item.target || 1)) * 100)}%` }
              ]} 
            />
          </View>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}
          onPress={() => openEditor('edit', item)}
        >
          <Ionicons name="pencil" size={18} color="#6366f1" />
          <Text style={[styles.actionBtnText, { color: '#6366f1' }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSuggestionCard = (suggestion, index) => (
    <TouchableOpacity
      key={index}
      style={styles.suggestionCard}
      onPress={() => addSuggestionAsAchievement(suggestion)}
    >
      <Text style={styles.suggestionIcon}>{suggestion.icon}</Text>
      <View style={styles.suggestionInfo}>
        <Text style={styles.suggestionName}>{suggestion.name}</Text>
        <Text style={styles.suggestionDesc}>{suggestion.description}</Text>
      </View>
      <Ionicons name="add-circle" size={24} color="#10b981" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AnimatedBackground />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Parent Management</Text>
          <Text style={styles.headerSubtitle}>Manage achievements, badges & goals</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'achievements' && { backgroundColor: primaryColor }]}
          onPress={() => setActiveTab('achievements')}
        >
          <Ionicons name="trophy" size={18} color={activeTab === 'achievements' ? '#fff' : '#9ca3af'} />
          <Text style={[styles.tabText, activeTab === 'achievements' && styles.tabTextActive]}>
            Achievements
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'goals' && { backgroundColor: primaryColor }]}
          onPress={() => setActiveTab('goals')}
        >
          <Ionicons name="flag" size={18} color={activeTab === 'goals' ? '#fff' : '#9ca3af'} />
          <Text style={[styles.tabText, activeTab === 'goals' && styles.tabTextActive]}>
            Goals
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.primaryActionBtn}
          onPress={() => openEditor('add')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.primaryActionText}>
            Add {activeTab === 'achievements' ? 'Achievement' : 'Goal'}
          </Text>
        </TouchableOpacity>
        
        {activeTab === 'achievements' && (
          <TouchableOpacity
            style={styles.secondaryActionBtn}
            onPress={fetchAiSuggestions}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#a5b4fc" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#a5b4fc" />
                <Text style={styles.secondaryActionText}>AI Ideas</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && activeTab === 'achievements' && (
        <View style={styles.suggestionsSection}>
          <View style={styles.suggestionHeader}>
            <Text style={styles.sectionTitle}>✨ AI Suggestions</Text>
            <TouchableOpacity onPress={() => setAiSuggestions([])}>
              <Ionicons name="close" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {aiSuggestions.map(renderSuggestionCard)}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      <FlatList
        data={activeTab === 'achievements' ? customAchievements : familyGoals}
        renderItem={activeTab === 'achievements' ? renderAchievementCard : renderGoalCard}
        keyExtractor={(item) => item.achievement_id || item.goal_id || String(Math.random())}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons 
              name={activeTab === 'achievements' ? 'trophy-outline' : 'flag-outline'} 
              size={64} 
              color="#374151" 
            />
            <Text style={styles.emptyText}>
              No custom {activeTab} yet
            </Text>
            <Text style={styles.emptySubtext}>
              Tap "Add {activeTab === 'achievements' ? 'Achievement' : 'Goal'}" to create one!
            </Text>
          </View>
        }
      />

      {/* Editor Modal */}
      <Modal visible={showEditor} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editorMode === 'edit' ? 'Edit' : 'Create'} {activeTab === 'achievements' ? 'Achievement' : 'Goal'}
              </Text>
              <TouchableOpacity onPress={closeEditor}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter name..."
                placeholderTextColor="#6b7280"
                value={itemName}
                onChangeText={setItemName}
              />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, { height: 80 }]}
                placeholder="Enter description..."
                placeholderTextColor="#6b7280"
                value={itemDescription}
                onChangeText={setItemDescription}
                multiline
              />

              {activeTab === 'achievements' && (
                <>
                  <Text style={styles.fieldLabel}>Icon</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPicker}>
                    {ACHIEVEMENT_ICONS.map((icon) => (
                      <TouchableOpacity
                        key={icon}
                        style={[styles.iconOption, itemIcon === icon && styles.iconOptionSelected]}
                        onPress={() => setItemIcon(icon)}
                      >
                        <Text style={styles.iconOptionText}>{icon}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.fieldLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
                    {BADGE_CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.categoryOption, itemCategory === cat && styles.categoryOptionSelected]}
                        onPress={() => setItemCategory(cat)}
                      >
                        <Text style={[styles.categoryText, itemCategory === cat && styles.categoryTextSelected]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.fieldLabel}>Points Value</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="50"
                    placeholderTextColor="#6b7280"
                    value={itemPoints}
                    onChangeText={setItemPoints}
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>
                {activeTab === 'achievements' ? 'Times Required' : 'Target'}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="1"
                placeholderTextColor="#6b7280"
                value={itemRequirement}
                onChangeText={setItemRequirement}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.saveButton, processing && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>
                      {editorMode === 'edit' ? 'Update' : 'Create'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Award Modal */}
      <Modal visible={showAwardModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.awardModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Award Achievement</Text>
              <TouchableOpacity onPress={() => setShowAwardModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {awardingItem && (
              <View style={styles.awardingItem}>
                <Text style={styles.awardingIcon}>{awardingItem.icon}</Text>
                <Text style={styles.awardingName}>{awardingItem.name}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Select Family Member</Text>
            <ScrollView style={styles.memberList}>
              {familyMembers
                .filter(m => m.role !== 'parent')
                .map((member) => (
                  <TouchableOpacity
                    key={member.user_id}
                    style={[
                      styles.memberCard,
                      selectedMember?.user_id === member.user_id && styles.memberCardSelected
                    ]}
                    onPress={() => setSelectedMember(member)}
                  >
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {(member.name || member.nickname || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.memberName}>{member.nickname || member.name}</Text>
                    {selectedMember?.user_id === member.user_id && (
                      <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                    )}
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.awardButton, !selectedMember && styles.awardButtonDisabled]}
              onPress={handleAward}
              disabled={!selectedMember || processing}
            >
              {processing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="gift" size={20} color="#fff" />
                  <Text style={styles.awardButtonText}>Award Achievement</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    color: '#9ca3af',
    marginTop: 2,
    fontSize: 13,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 27, 75, 0.6)',
  },
  tabText: {
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#fff',
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#10b981',
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  secondaryActionText: {
    color: '#a5b4fc',
    fontWeight: '600',
    fontSize: 14,
  },
  suggestionsSection: {
    paddingLeft: 16,
    marginBottom: 16,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    padding: 12,
    borderRadius: 12,
    marginRight: 10,
    minWidth: 200,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  suggestionIcon: {
    fontSize: 28,
    marginRight: 10,
  },
  suggestionInfo: {
    flex: 1,
    marginRight: 8,
  },
  suggestionName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  suggestionDesc: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
  },
  cardIcon: {
    fontSize: 36,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  cardDescription: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaText: {
    color: '#d1d5db',
    fontSize: 11,
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
  goalProgress: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  goalProgressText: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 12,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalForm: {
    padding: 20,
  },
  fieldLabel: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  iconPicker: {
    flexDirection: 'row',
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconOptionSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  iconOptionText: {
    fontSize: 24,
  },
  categoryPicker: {
    flexDirection: 'row',
  },
  categoryOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryOptionSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    borderColor: '#6366f1',
  },
  categoryText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  categoryTextSelected: {
    color: '#fff',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Award Modal
  awardModalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
  },
  awardingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    padding: 16,
    borderRadius: 16,
    marginVertical: 16,
  },
  awardingIcon: {
    fontSize: 36,
  },
  awardingName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  memberList: {
    maxHeight: 250,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  memberCardSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  awardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  awardButtonDisabled: {
    backgroundColor: '#4b5563',
  },
  awardButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
