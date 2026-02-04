import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';

export default function ParentDashboard({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [children, setChildren] = useState([]);
  const [chores, setChores] = useState([]);
  const [events, setEvents] = useState([]);
  const [weather, setWeather] = useState(null);
  const [pendingItems, setPendingItems] = useState([]);
  const [batteryStatus, setBatteryStatus] = useState([]);
  
  // AI Scheduler State
  const [showAiScheduler, setShowAiScheduler] = useState(false);
  const [aiScheduleLoading, setAiScheduleLoading] = useState(false);
  const [aiSchedule, setAiSchedule] = useState('');
  const [schedulePreferences, setSchedulePreferences] = useState('');
  const [scheduleDays, setScheduleDays] = useState(7);

  const fetchData = useCallback(async () => {
    try {
      const [membersData, choresData, eventsData, weatherData, batteryData] = await Promise.all([
        apiService.getFamilyMembers(),
        apiService.getChores(),
        apiService.getEvents(),
        apiService.getWeather().catch(() => null),
        apiService.getFamilyBatteryStatus().catch(() => ({ battery_status: [] })),
      ]);

      const allMembers = membersData.members || [];
      setChildren(allMembers.filter(m => m.role === 'child'));
      setChores(choresData.chores || []);
      setEvents(eventsData.events || []);
      setWeather(weatherData);
      setBatteryStatus(batteryData.battery_status || []);

      // Calculate pending approvals
      const pendingChores = (choresData.chores || []).filter(c => c.status === 'completed');
      setPendingItems(pendingChores);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh battery status every 30 seconds
    const batteryInterval = setInterval(async () => {
      try {
        const data = await apiService.getFamilyBatteryStatus();
        setBatteryStatus(data.battery_status || []);
      } catch (e) {}
    }, 30000);
    return () => clearInterval(batteryInterval);
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const getTodayChores = () => {
    const today = new Date().toISOString().split('T')[0];
    return chores.filter(c => c.scheduled_date === today);
  };

  const handleApproval = async (item, approved) => {
    try {
      await apiService.put(`/chores/${item.chore_id}/approve`, { approved });
      Alert.alert('Success', approved ? 'Chore approved!' : 'Chore denied');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update');
    }
  };

  const handleGenerateAiSchedule = async () => {
    setAiScheduleLoading(true);
    try {
      const response = await apiService.post('/chores/ai-schedule', {
        preferences: schedulePreferences,
        days: scheduleDays,
      });
      setAiSchedule(response.schedule || 'Schedule generated successfully!');
      Alert.alert('Success', 'AI schedule generated!');
    } catch (error) {
      console.error('Failed to generate schedule:', error);
      Alert.alert('Error', 'Failed to generate schedule. Please try again.');
    } finally {
      setAiScheduleLoading(false);
    }
  };

  const stats = {
    pendingApprovals: pendingItems.length,
    choresCompleted: chores.filter(c => c.status === 'approved').length,
    totalChores: chores.length,
    upcomingEvents: events.filter(e => e.event_date === new Date().toISOString().split('T')[0]).length,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <AnimatedBackground page="dashboard">
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}!</Text>
            <Text style={styles.subGreeting}>Here's what's happening with your family today</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#a5b4fc" />
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
            <Ionicons name="time-outline" size={24} color="#fbbf24" />
            <Text style={styles.statNumber}>{stats.pendingApprovals}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <Text style={styles.statNumber}>{stats.choresCompleted}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
            <Ionicons name="calendar" size={24} color="#6366f1" />
            <Text style={styles.statNumber}>{stats.upcomingEvents}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
            <Ionicons name="trending-up" size={24} color="#ec4899" />
            <Text style={styles.statNumber}>
              {stats.totalChores > 0 ? Math.round((stats.choresCompleted / stats.totalChores) * 100) : 0}%
            </Text>
            <Text style={styles.statLabel}>Progress</Text>
          </View>
        </View>

        {/* AI Scheduler & Manual Scheduler */}
        <View style={styles.schedulerRow}>
          <TouchableOpacity
            style={[styles.schedulerCard, { borderColor: 'rgba(251, 191, 36, 0.3)' }]}
            onPress={() => setShowAiScheduler(true)}
          >
            <View style={[styles.schedulerIcon, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}>
              <Ionicons name="sparkles" size={20} color="#fbbf24" />
            </View>
            <View style={styles.schedulerText}>
              <Text style={styles.schedulerTitle}>AI Scheduler</Text>
              <Text style={styles.schedulerDesc}>Auto-generate fair schedule</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.schedulerCard, { borderColor: 'rgba(16, 185, 129, 0.3)' }]}
            onPress={() => navigation.navigate('Chores')}
          >
            <View style={[styles.schedulerIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
              <Ionicons name="grid" size={20} color="#10b981" />
            </View>
            <View style={styles.schedulerText}>
              <Text style={styles.schedulerTitle}>Manual Scheduler</Text>
              <Text style={styles.schedulerDesc}>Manage chores</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Children Overview */}
        {children.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={18} color="#818cf8" />
              <Text style={styles.sectionTitle}>Children</Text>
            </View>
            {children.map((child) => {
              const childBattery = batteryStatus.find(b => b.user_id === child.user_id);
              return (
                <TouchableOpacity 
                  key={child.user_id} 
                  style={styles.childCard}
                  onPress={() => navigation.navigate('ChildSpace', { child })}
                >
                  <View style={styles.childLeft}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{child.name?.charAt(0)}</Text>
                      {child.online_status && <View style={styles.onlineBadge} />}
                    </View>
                    <View style={styles.childInfo}>
                      <Text style={styles.childName}>{child.nickname || child.name}</Text>
                      <Text style={styles.childPoints}>{child.points || 0} pts</Text>
                    </View>
                  </View>
                  <View style={styles.childRight}>
                    {childBattery && childBattery.level !== null && (
                      <View style={styles.batteryContainer}>
                        <Ionicons 
                          name={childBattery.is_charging ? 'battery-charging' : 
                                childBattery.level <= 20 ? 'battery-dead' : 'battery-half'} 
                          size={18} 
                          color={childBattery.level <= 20 ? '#ef4444' : 
                                 childBattery.level <= 50 ? '#fbbf24' : '#10b981'} 
                        />
                        <Text style={[
                          styles.batteryText,
                          { color: childBattery.level <= 20 ? '#ef4444' : 
                                   childBattery.level <= 50 ? '#fbbf24' : '#10b981' }
                        ]}>
                          {childBattery.level}%
                        </Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Pending Approvals */}
        {pendingItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={18} color="#fbbf24" />
              <Text style={styles.sectionTitle}>Pending Approvals</Text>
            </View>
            {pendingItems.slice(0, 5).map((item) => (
              <View key={item.chore_id} style={styles.pendingCard}>
                <View style={styles.pendingInfo}>
                  <View style={styles.pendingTypeRow}>
                    <Ionicons name="checkbox" size={14} color="#10b981" />
                    <Text style={styles.pendingType}>CHORE</Text>
                  </View>
                  <Text style={styles.pendingTitle}>{item.title}</Text>
                  <Text style={styles.pendingUser}>{item.assigned_to_name || 'Child'}</Text>
                </View>
                <View style={styles.pendingActions}>
                  <TouchableOpacity 
                    style={styles.approveBtn}
                    onPress={() => handleApproval(item, true)}
                  >
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.denyBtn}
                    onPress={() => handleApproval(item, false)}
                  >
                    <Text style={styles.denyBtnText}>Deny</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Chat')}
          >
            <Ionicons name="chatbubbles" size={24} color="#6366f1" />
            <Text style={styles.actionText}>Family Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('FamilyWall')}
          >
            <Ionicons name="images" size={24} color="#ec4899" />
            <Text style={styles.actionText}>Family Wall</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* AI Scheduler Modal */}
      <Modal visible={showAiScheduler} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
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

            {!aiSchedule ? (
              <View>
                <Text style={styles.inputLabel}>Schedule Duration</Text>
                <View style={styles.daysSelector}>
                  {[3, 5, 7, 14].map(days => (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.dayOption,
                        scheduleDays === days && styles.dayOptionActive
                      ]}
                      onPress={() => setScheduleDays(days)}
                    >
                      <Text style={[
                        styles.dayOptionText,
                        scheduleDays === days && styles.dayOptionTextActive
                      ]}>
                        {days} days
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Preferences (optional)</Text>
                <TextInput
                  style={styles.preferencesInput}
                  placeholder="e.g., Alex should do more outdoor chores..."
                  placeholderTextColor="#6b7280"
                  value={schedulePreferences}
                  onChangeText={setSchedulePreferences}
                  multiline
                />

                <View style={styles.aiHint}>
                  <Ionicons name="information-circle" size={16} color="#a5b4fc" />
                  <Text style={styles.aiHintText}>
                    AI analyzes chore history, points, and preferences to create a fair schedule.
                  </Text>
                </View>

                <TouchableOpacity 
                  style={[styles.generateBtn, aiScheduleLoading && styles.generateBtnDisabled]}
                  onPress={handleGenerateAiSchedule}
                  disabled={aiScheduleLoading}
                >
                  {aiScheduleLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={20} color="#fff" />
                      <Text style={styles.generateBtnText}>Generate Schedule</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.scheduleResultCard}>
                  <View style={styles.scheduleResultHeader}>
                    <Ionicons name="calendar" size={16} color="#fbbf24" />
                    <Text style={styles.scheduleResultTitle}>Your {scheduleDays}-Day Schedule</Text>
                  </View>
                  <Text style={styles.scheduleResultText}>{aiSchedule}</Text>
                </View>

                <View style={styles.scheduleActions}>
                  <TouchableOpacity 
                    style={styles.newScheduleBtn}
                    onPress={() => setAiSchedule('')}
                  >
                    <Text style={styles.newScheduleBtnText}>Generate New</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.applyScheduleBtn}
                    onPress={() => {
                      setShowAiScheduler(false);
                      Alert.alert('Success', 'Schedule saved!');
                    }}
                  >
                    <Text style={styles.applyScheduleBtnText}>Apply Schedule</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0d1a',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 48,
  },
  greeting: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  subGreeting: {
    fontSize: 13,
    color: '#a5b4fc',
    marginTop: 4,
  },
  settingsButton: {
    padding: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#a5b4fc',
    marginTop: 2,
  },
  schedulerRow: {
    gap: 10,
    marginBottom: 20,
  },
  schedulerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  schedulerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  schedulerText: {
    flex: 1,
  },
  schedulerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  schedulerDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  childLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#1e1b4b',
  },
  childInfo: {
    marginLeft: 12,
  },
  childName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  childPoints: {
    fontSize: 13,
    color: '#fbbf24',
  },
  childRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  pendingInfo: {
    marginBottom: 12,
  },
  pendingTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pendingType: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  pendingUser: {
    fontSize: 12,
    color: '#a5b4fc',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  approveBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  denyBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  denyBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 13,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e1b4b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#a5b4fc',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 13,
    color: '#a5b4fc',
    marginBottom: 10,
  },
  daysSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dayOption: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  dayOptionActive: {
    backgroundColor: '#6366f1',
  },
  dayOptionText: {
    color: '#a5b4fc',
    fontSize: 13,
    fontWeight: '600',
  },
  dayOptionTextActive: {
    color: '#fff',
  },
  preferencesInput: {
    backgroundColor: 'rgba(15, 13, 26, 0.5)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  aiHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  aiHintText: {
    flex: 1,
    fontSize: 12,
    color: '#a5b4fc',
    lineHeight: 18,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 30,
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scheduleResultCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  scheduleResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scheduleResultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  scheduleResultText: {
    fontSize: 13,
    color: '#a5b4fc',
    lineHeight: 20,
  },
  scheduleActions: {
    flexDirection: 'row',
    gap: 12,
  },
  newScheduleBtn: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
  },
  newScheduleBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  applyScheduleBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
  },
  applyScheduleBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
