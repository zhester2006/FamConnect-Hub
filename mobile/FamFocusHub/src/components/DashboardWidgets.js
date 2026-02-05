import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api.service';

// Personal Goals Widget
export function PersonalGoalsWidget({ user, onCreateGoal }) {
  const theme = useTheme();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', target: '1', type: 'custom' });

  const fetchGoals = useCallback(async () => {
    try {
      const res = await apiService.get('/goals');
      setGoals(res?.goals || []);
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleCreateGoal = async () => {
    if (!newGoal.title.trim()) return;

    try {
      await apiService.post('/goals', {
        title: newGoal.title,
        description: newGoal.description,
        target: parseInt(newGoal.target) || 1,
        type: newGoal.type,
      });
      setShowAddModal(false);
      setNewGoal({ title: '', description: '', target: '1', type: 'custom' });
      fetchGoals();
    } catch (error) {
      console.error('Failed to create goal:', error);
    }
  };

  const handleIncrementGoal = async (goalId) => {
    try {
      await apiService.post(`/goals/${goalId}/increment`, {});
      fetchGoals();
    } catch (error) {
      console.error('Failed to increment goal:', error);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    try {
      await apiService.delete(`/goals/${goalId}`);
      fetchGoals();
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.widget}>
        <View style={styles.widgetHeader}>
          <Ionicons name="flag" size={20} color="#ec4899" />
          <Text style={styles.widgetTitle}>My Goals</Text>
        </View>
        <View style={styles.loadingPlaceholder} />
      </View>
    );
  }

  return (
    <View style={styles.widget}>
      <View style={styles.widgetHeader}>
        <View style={styles.widgetTitleRow}>
          <Ionicons name="flag" size={20} color="#ec4899" />
          <Text style={styles.widgetTitle}>My Goals</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.primary + '30' }]}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={18} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {goals.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="flag-outline" size={32} color="#6b7280" />
          <Text style={styles.emptyText}>No goals yet</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)}>
            <Text style={[styles.emptyLink, { color: theme.primary }]}>Create your first goal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.goalsList}>
          {goals.slice(0, 3).map((goal) => (
            <View
              key={goal.goal_id}
              style={[styles.goalCard, goal.completed && styles.goalCardCompleted]}
            >
              <View style={styles.goalContent}>
                <Text style={[styles.goalTitle, goal.completed && styles.goalTitleCompleted]}>
                  {goal.title}
                </Text>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(100, (goal.current / goal.target) * 100)}%` },
                        goal.completed && styles.progressBarCompleted,
                      ]}
                    />
                  </View>
                  <Text style={styles.progressLabel}>
                    {goal.current}/{goal.target}
                  </Text>
                </View>
              </View>
              <View style={styles.goalActions}>
                {!goal.completed && (
                  <TouchableOpacity
                    style={[styles.goalActionBtn, { backgroundColor: theme.primary + '30' }]}
                    onPress={() => handleIncrementGoal(goal.goal_id)}
                  >
                    <Ionicons name="add" size={16} color={theme.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.goalActionBtn, { backgroundColor: '#ef444430' }]}
                  onPress={() => handleDeleteGoal(goal.goal_id)}
                >
                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Add Goal Modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Goal</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Goal Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Read 5 books"
              placeholderTextColor="#6b7280"
              value={newGoal.title}
              onChangeText={(text) => setNewGoal({ ...newGoal, title: text })}
            />

            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Add details..."
              placeholderTextColor="#6b7280"
              value={newGoal.description}
              onChangeText={(text) => setNewGoal({ ...newGoal, description: text })}
            />

            <Text style={styles.inputLabel}>Target Amount</Text>
            <TextInput
              style={styles.input}
              placeholder="5"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={newGoal.target}
              onChangeText={(text) => setNewGoal({ ...newGoal, target: text })}
            />

            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: theme.primary }]}
              onPress={handleCreateGoal}
            >
              <Text style={styles.createBtnText}>Create Goal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Quick Shortcuts Widget
export function QuickShortcutsWidget({ user, navigation }) {
  const theme = useTheme();
  const [shortcuts, setShortcuts] = useState([]);
  const [available, setAvailable] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchShortcuts = useCallback(async () => {
    try {
      const res = await apiService.get('/shortcuts');
      setShortcuts(res?.active || []);
      setAvailable(res?.available || []);
    } catch (error) {
      console.error('Failed to fetch shortcuts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShortcuts();
  }, [fetchShortcuts]);

  const handleToggleShortcut = async (shortcutId) => {
    const isActive = shortcuts.some((s) => s.id === shortcutId);
    let newShortcuts;

    if (isActive) {
      newShortcuts = shortcuts.filter((s) => s.id !== shortcutId).map((s) => s.id);
    } else {
      if (shortcuts.length >= 6) return;
      newShortcuts = [...shortcuts.map((s) => s.id), shortcutId];
    }

    try {
      await apiService.put('/shortcuts', { shortcuts: newShortcuts });
      fetchShortcuts();
    } catch (error) {
      console.error('Failed to update shortcuts:', error);
    }
  };

  const handleNavigate = (shortcutId) => {
    const routes = {
      chat: 'Chat',
      rewards: 'Rewards',
      leaderboard: 'Leaderboard',
      calendar: 'Calendar',
      shopping: 'Shopping',
      reading: 'Reading',
      dinner: 'Dinner',
      family_wall: 'FamilyWall',
      achievements: 'Achievements',
    };
    if (routes[shortcutId] && navigation) {
      navigation.navigate(routes[shortcutId]);
    }
  };

  const getIconName = (icon) => {
    const iconMap = {
      chatbubbles: 'chatbubbles',
      gift: 'gift',
      trophy: 'trophy',
      calendar: 'calendar',
      cart: 'cart',
      book: 'book',
      restaurant: 'restaurant',
      people: 'people',
      medal: 'medal',
      apps: 'apps',
    };
    return iconMap[icon] || 'apps';
  };

  if (loading) {
    return (
      <View style={styles.widget}>
        <View style={styles.widgetHeader}>
          <Ionicons name="flash" size={20} color="#eab308" />
          <Text style={styles.widgetTitle}>Quick Access</Text>
        </View>
        <View style={styles.loadingPlaceholder} />
      </View>
    );
  }

  return (
    <View style={styles.widget}>
      <View style={styles.widgetHeader}>
        <View style={styles.widgetTitleRow}>
          <Ionicons name="flash" size={20} color="#eab308" />
          <Text style={styles.widgetTitle}>Quick Access</Text>
        </View>
        <TouchableOpacity
          style={[styles.editBtn, editing && { backgroundColor: theme.primary + '30' }]}
          onPress={() => setEditing(!editing)}
        >
          <Ionicons name="settings-outline" size={16} color={editing ? theme.primary : '#6b7280'} />
        </TouchableOpacity>
      </View>

      {editing ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcutsGrid}>
          {available.map((shortcut) => {
            const isActive = shortcuts.some((s) => s.id === shortcut.id);
            return (
              <TouchableOpacity
                key={shortcut.id}
                style={[
                  styles.shortcutEditItem,
                  isActive && { borderColor: theme.primary, backgroundColor: theme.primary + '15' },
                ]}
                onPress={() => handleToggleShortcut(shortcut.id)}
              >
                <View style={[styles.shortcutIcon, { backgroundColor: shortcut.color + '30' }]}>
                  <Ionicons name={getIconName(shortcut.icon)} size={20} color={shortcut.color} />
                </View>
                <Text style={styles.shortcutName} numberOfLines={1}>
                  {shortcut.name}
                </Text>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={14} color={theme.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.shortcutsRow}>
          {shortcuts.map((shortcut) => (
            <TouchableOpacity
              key={shortcut.id}
              style={styles.shortcutItem}
              onPress={() => handleNavigate(shortcut.id)}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: shortcut.color + '30' }]}>
                <Ionicons name={getIconName(shortcut.icon)} size={22} color={shortcut.color} />
              </View>
              <Text style={styles.shortcutLabel} numberOfLines={1}>
                {shortcut.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// Achievement Preview Widget
export function AchievementPreviewWidget({ user, onViewAll }) {
  const theme = useTheme();
  const [recentBadges, setRecentBadges] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentAchievements = async () => {
      if (!user?.user_id) return;

      try {
        const res = await apiService.get(`/achievements/user/${user.user_id}`);
        if (res) {
          const sorted = (res.achievements || [])
            .filter((a) => a.category !== 'family')
            .sort((a, b) => {
              if (a.earned && !b.earned) return -1;
              if (!a.earned && b.earned) return 1;
              return b.progress_percent - a.progress_percent;
            });
          setRecentBadges(sorted.slice(0, 3));
          setStats(res.stats || {});
        }
      } catch (error) {
        console.error('Failed to fetch achievements:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentAchievements();
  }, [user?.user_id]);

  if (loading) return null;

  return (
    <View style={styles.widget}>
      <View style={styles.widgetHeader}>
        <View style={styles.widgetTitleRow}>
          <Text style={styles.trophyEmoji}>🏆</Text>
          <Text style={styles.widgetTitle}>Achievements</Text>
        </View>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={[styles.viewAllText, { color: theme.primary }]}>View All →</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.chore_streak || 0}</Text>
          <Text style={styles.statDesc}>🔥 Streak</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.total_earned || 0}</Text>
          <Text style={styles.statDesc}>⭐ Badges</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.total_points || 0}</Text>
          <Text style={styles.statDesc}>💰 Points</Text>
        </View>
      </View>

      {/* Recent Badges */}
      {recentBadges.map((badge) => (
        <View
          key={badge.achievement_id}
          style={[styles.badgeRow, badge.earned && styles.badgeRowEarned]}
        >
          <Text style={[styles.badgeEmoji, !badge.earned && styles.badgeEmojiGray]}>
            {badge.icon}
          </Text>
          <View style={styles.badgeContent}>
            <Text style={[styles.badgeName, !badge.earned && styles.textMuted]}>
              {badge.name}
            </Text>
            {!badge.earned && (
              <View style={styles.miniProgress}>
                <View style={styles.miniProgressBg}>
                  <View
                    style={[styles.miniProgressFill, { width: `${badge.progress_percent}%` }]}
                  />
                </View>
                <Text style={styles.miniProgressText}>{badge.progress_percent}%</Text>
              </View>
            )}
          </View>
          {badge.earned && <Ionicons name="checkmark" size={16} color="#10b981" />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  widget: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  widgetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  widgetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  trophyEmoji: {
    fontSize: 18,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
  },
  loadingPlaceholder: {
    height: 80,
    backgroundColor: '#374151',
    borderRadius: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    color: '#6b7280',
    marginTop: 8,
  },
  emptyLink: {
    marginTop: 8,
    fontWeight: '600',
  },
  goalsList: {
    gap: 10,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
  },
  goalCardCompleted: {
    backgroundColor: '#10b98115',
  },
  goalContent: {
    flex: 1,
  },
  goalTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  goalTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#10b981',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#a855f7',
    borderRadius: 2,
  },
  progressBarCompleted: {
    backgroundColor: '#10b981',
  },
  progressLabel: {
    color: '#6b7280',
    fontSize: 11,
  },
  goalActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  goalActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  inputLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  createBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  shortcutsGrid: {
    flexDirection: 'row',
  },
  shortcutEditItem: {
    width: 80,
    alignItems: 'center',
    padding: 10,
    marginRight: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#0f172a',
  },
  shortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  shortcutItem: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 12,
  },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shortcutName: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
  },
  shortcutLabel: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statDesc: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    marginBottom: 8,
  },
  badgeRowEarned: {
    backgroundColor: '#a855f720',
  },
  badgeEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  badgeEmojiGray: {
    opacity: 0.5,
  },
  badgeContent: {
    flex: 1,
  },
  badgeName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  textMuted: {
    color: '#6b7280',
  },
  miniProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  miniProgressBg: {
    flex: 1,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: '#a855f7',
    borderRadius: 2,
  },
  miniProgressText: {
    fontSize: 10,
    color: '#6b7280',
  },
});
