import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';
import MedalEmblem from '../components/MedalEmblem';

export default function ParentDashboard({ navigation }) {
  const { user } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [stats, setStats] = useState({
    pendingApprovals: 0,
    choresCompleted: 0,
    totalChores: 0,
    upcomingEvents: 0,
  });
  const [children, setChildren] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [batteryStatus, setBatteryStatus] = useState([]);
  
  // Child details modal
  const [selectedChild, setSelectedChild] = useState(null);
  const [childDetails, setChildDetails] = useState(null);
  
  // AI Scheduler modal
  const [showAiScheduler, setShowAiScheduler] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSchedule, setAiSchedule] = useState('');
  const [aiDays, setAiDays] = useState(7);
  const [aiPreferences, setAiPreferences] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [choresData, shoppingData, eventsData, membersData, readingData, batteryData, leaderboardData] = await Promise.all([
        apiService.getChores(),
        apiService.getShoppingList(),
        apiService.getEvents(),
        apiService.getFamilyMembers(),
        apiService.getReadingLogs().catch(() => ({ logs: [] })),
        apiService.getFamilyBatteryStatus().catch(() => ({ battery_status: [] })),
        apiService.getLeaderboard().catch(() => ({ leaderboard: [] })),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const chores = choresData.chores || [];
      const shopping = shoppingData.items || [];
      const events = eventsData.events || [];
      const members = membersData.members || [];
      const readingLogs = readingData.logs || [];
      const leaderboard = leaderboardData.leaderboard || [];

      // Calculate stats
      const completedChores = chores.filter(c => c.status === 'approved').length;
      const pendingChores = chores.filter(c => c.status === 'completed');
      const pendingShopping = shopping.filter(i => i.status === 'pending');
      const pendingReadingLogs = readingLogs.filter(l => l.status === 'pending');
      const todaysEvents = events.filter(e => e.event_date === today);

      setStats({
        pendingApprovals: pendingChores.length + pendingShopping.length + pendingReadingLogs.length,
        choresCompleted: completedChores,
        totalChores: chores.length,
        upcomingEvents: todaysEvents.length,
      });

      // Pending items
      setPendingItems([
        ...pendingChores.map(c => ({ ...c, type: 'chore' })),
        ...pendingShopping.map(s => ({ ...s, type: 'shopping' })),
        ...pendingReadingLogs.map(l => ({ ...l, type: 'reading' })),
      ]);

      // Rank map
      const rankMap = {};
      leaderboard.forEach((child, index) => {
        rankMap[child.user_id] = index + 1;
      });

      // Children with rank and battery
      const childrenData = members.filter(m => m.role === 'child').map(child => ({
        ...child,
        rank: rankMap[child.user_id] || null,
      }));
      
      setChildren(childrenData);
      setTodayEvents(todaysEvents);
      setBatteryStatus(batteryData.battery_status || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      apiService.getFamilyBatteryStatus().then(data => {
        setBatteryStatus(data.battery_status || []);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleApproval = async (item, approved) => {
    try {
      if (item.type === 'chore') {
        await apiService.approveChore(item.chore_id, approved);
      } else if (item.type === 'shopping') {
        await apiService.put(`/shopping/${item.item_id}`, { status: approved ? 'approved' : 'rejected' });
      } else if (item.type === 'reading') {
        await apiService.put(`/reading-logs/${item.log_id}/approve`, { approved });
      }
      Alert.alert('Success', approved ? 'Approved!' : 'Denied');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Action failed');
    }
  };

  const handleGenerateAiSchedule = async () => {
    setAiLoading(true);
    try {
      const result = await apiService.generateAiSchedule({
        preferences: aiPreferences,
        days: aiDays,
      });
      setAiSchedule(result.schedule || 'No schedule generated');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate schedule');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchChildDetails = async (child) => {
    setSelectedChild(child);
    try {
      const [choresData, readingData] = await Promise.all([
        apiService.getChores(),
        apiService.getReadingLogs(child.user_id).catch(() => ({ logs: [] })),
      ]);
      
      const childChores = (choresData.chores || []).filter(c => c.assigned_to === child.user_id);
      
      setChildDetails({
        chores: childChores,
        readingLogs: readingData.logs || [],
        completedChores: childChores.filter(c => c.status === 'approved').length,
        pendingChores: childChores.filter(c => c.status === 'pending' || c.status === 'completed').length,
      });
    } catch (error) {
      console.error('Failed to fetch child details:', error);
    }
  };

  const primaryColor = theme?.primary || '#6366f1';
  const accentColor = theme?.accent || '#a5b4fc';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <AnimatedBackground page="parent">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}!</Text>
            <Text style={styles.subGreeting}>Here's what's happening with your family today</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderColor: '#f59e0b' }]}>
            <Ionicons name="alert-circle" size={20} color="#f59e0b" />
            <Text style={styles.statNumber}>{stats.pendingApprovals}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#10b981' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.statNumber}>{stats.choresCompleted}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={[styles.statCard, { borderColor: primaryColor }]}>
            <Ionicons name="calendar" size={20} color={primaryColor} />
            <Text style={styles.statNumber}>{stats.upcomingEvents}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#3b82f6' }]}>
            <Ionicons name="trending-up" size={20} color="#3b82f6" />
            <Text style={styles.statNumber}>
              {stats.totalChores > 0 ? Math.round((stats.choresCompleted / stats.totalChores) * 100) : 0}%
            </Text>
            <Text style={styles.statLabel}>Progress</Text>
          </View>
        </View>

        {/* Scheduler Buttons */}
        <View style={styles.schedulerButtons}>
          <TouchableOpacity 
            style={[styles.schedulerBtn, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}
            onPress={() => setShowAiScheduler(true)}
          >
            <View style={[styles.schedulerIcon, { backgroundColor: primaryColor }]}>
              <Ionicons name="sparkles" size={20} color="#fff" />
            </View>
            <View style={styles.schedulerInfo}>
              <Text style={styles.schedulerTitle}>AI Scheduler</Text>
              <Text style={styles.schedulerSubtitle}>Auto-generate fair schedule</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.schedulerBtn, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}
            onPress={() => navigation.navigate('Chores')}
          >
            <View style={[styles.schedulerIcon, { backgroundColor: '#10b981' }]}>
              <Ionicons name="list" size={20} color="#fff" />
            </View>
            <View style={styles.schedulerInfo}>
              <Text style={styles.schedulerTitle}>Manage Chores</Text>
              <Text style={styles.schedulerSubtitle}>Create & assign chores</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Children Section */}
        {children.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={18} color={primaryColor} />
              <Text style={styles.sectionTitle}>Children</Text>
            </View>
            <View style={styles.childrenGrid}>
              {children.map((child) => {
                const childBattery = batteryStatus.find(b => b.user_id === child.user_id);
                return (
                  <TouchableOpacity 
                    key={child.user_id} 
                    style={styles.childCard}
                    onPress={() => fetchChildDetails(child)}
                  >
                    <View style={styles.childHeader}>
                      <View style={styles.childAvatarContainer}>
                        {child.picture ? (
                          <Image source={{ uri: child.picture }} style={styles.childAvatar} />
                        ) : (
                          <View style={[styles.childAvatarPlaceholder, { backgroundColor: primaryColor }]}>
                            <Text style={styles.childAvatarText}>{child.name?.charAt(0)}</Text>
                          </View>
                        )}
                        {child.online_status && <View style={styles.onlineDot} />}
                        {child.rank && child.rank <= 3 && (
                          <View style={styles.medalPosition}>
                            <MedalEmblem rank={child.rank} size="small" />
                          </View>
                        )}
                      </View>
                      <View style={styles.childInfo}>
                        <Text style={styles.childName}>{child.nickname || child.name}</Text>
                        <Text style={[styles.childPoints, { color: '#f59e0b' }]}>{child.points || 0} pts</Text>
                      </View>
                      {childBattery && childBattery.level !== null && (
                        <View style={styles.batteryBadge}>
                          <Ionicons 
                            name={childBattery.is_charging ? 'battery-charging' : 
                                  childBattery.level <= 20 ? 'battery-dead' : 'battery-half'} 
                            size={16} 
                            color={childBattery.level <= 20 ? '#ef4444' : 
                                   childBattery.level <= 50 ? '#fbbf24' : '#10b981'} 
                          />
                          <Text style={[styles.batteryText, {
                            color: childBattery.level <= 20 ? '#ef4444' : 
                                   childBattery.level <= 50 ? '#fbbf24' : '#10b981'
                          }]}>{childBattery.level}%</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.childActions}>
                      <TouchableOpacity 
                        style={[styles.childActionBtn, { backgroundColor: primaryColor }]}
                        onPress={() => fetchChildDetails(child)}
                      >
                        <Ionicons name="eye" size={14} color="#fff" />
                        <Text style={styles.childActionText}>View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.childActionBtn, { backgroundColor: '#10b981' }]}
                        onPress={() => navigation.navigate('Location')}
                      >
                        <Ionicons name="location" size={14} color="#fff" />
                        <Text style={styles.childActionText}>Locate</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Pending Approvals */}
        {pendingItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={18} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Pending Approvals</Text>
            </View>
            {pendingItems.slice(0, 5).map((item, index) => (
              <View key={item.chore_id || item.item_id || item.log_id || index} style={styles.pendingCard}>
                <View style={styles.pendingInfo}>
                  <View style={styles.pendingTypeRow}>
                    <Ionicons 
                      name={item.type === 'chore' ? 'checkmark-circle' : 
                            item.type === 'shopping' ? 'cart' : 'book'} 
                      size={14} 
                      color={item.type === 'chore' ? '#10b981' : 
                             item.type === 'shopping' ? '#3b82f6' : '#06b6d4'} 
                    />
                    <Text style={styles.pendingType}>{item.type}</Text>
                  </View>
                  <Text style={styles.pendingTitle} numberOfLines={1}>
                    {item.title || item.name || item.book_name}
                  </Text>
                  <Text style={styles.pendingUser}>
                    {item.assignee_name || item.user_name || item.completed_by_name || 'Unknown'}
                  </Text>
                </View>
                <View style={styles.pendingActions}>
                  <TouchableOpacity 
                    style={[styles.approveBtn, { backgroundColor: '#10b981' }]}
                    onPress={() => handleApproval(item, true)}
                  >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.approveBtn, { backgroundColor: '#ef4444' }]}
                    onPress={() => handleApproval(item, false)}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Calendar')}>
            <Ionicons name="calendar" size={22} color={primaryColor} />
            <Text style={styles.quickBtnText}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Shopping')}>
            <Ionicons name="cart" size={22} color="#3b82f6" />
            <Text style={styles.quickBtnText}>Shopping</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Rewards')}>
            <Ionicons name="gift" size={22} color="#f59e0b" />
            <Text style={styles.quickBtnText}>Rewards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Leaderboard')}>
            <Ionicons name="trophy" size={22} color="#10b981" />
            <Text style={styles.quickBtnText}>Ranks</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Child Details Modal */}
      <Modal visible={!!selectedChild && !!childDetails} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalChildInfo}>
                <View style={[styles.modalAvatar, { backgroundColor: primaryColor }]}>
                  <Text style={styles.modalAvatarText}>{selectedChild?.name?.charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.modalChildName}>{selectedChild?.name}</Text>
                  <Text style={styles.modalChildPoints}>{selectedChild?.points || 0} points</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => { setSelectedChild(null); setChildDetails(null); }}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Quick Stats */}
            <View style={styles.modalStats}>
              <View style={[styles.modalStatCard, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.modalStatNumber}>{childDetails?.completedChores || 0}</Text>
                <Text style={styles.modalStatLabel}>Done</Text>
              </View>
              <View style={[styles.modalStatCard, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <Ionicons name="time" size={18} color="#fbbf24" />
                <Text style={styles.modalStatNumber}>{childDetails?.pendingChores || 0}</Text>
                <Text style={styles.modalStatLabel}>Pending</Text>
              </View>
            </View>

            {/* Recent Chores */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Recent Chores</Text>
              <ScrollView style={styles.modalList} nestedScrollEnabled>
                {(childDetails?.chores || []).slice(0, 5).map(chore => (
                  <View key={chore.chore_id} style={styles.modalListItem}>
                    <Text style={styles.modalListText} numberOfLines={1}>{chore.title}</Text>
                    <View style={[styles.statusBadge, {
                      backgroundColor: chore.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' :
                                       chore.status === 'completed' ? 'rgba(245, 158, 11, 0.2)' :
                                       'rgba(107, 114, 128, 0.2)'
                    }]}>
                      <Text style={[styles.statusText, {
                        color: chore.status === 'approved' ? '#10b981' :
                               chore.status === 'completed' ? '#fbbf24' : '#6b7280'
                      }]}>{chore.status}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity 
              style={[styles.viewFullBtn, { backgroundColor: primaryColor }]}
              onPress={() => { 
                setSelectedChild(null); 
                setChildDetails(null);
                navigation.navigate('ChildSpace', { child: selectedChild });
              }}
            >
              <Text style={styles.viewFullBtnText}>View Full Profile</Text>
            </TouchableOpacity>
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
                  <Text style={styles.aiTitle}>AI Chore Scheduler</Text>
                  <Text style={styles.aiSubtitle}>Generate a fair schedule</Text>
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
                  style={styles.input}
                  placeholder="e.g., Alex does outdoor chores, no chores on weekends..."
                  placeholderTextColor="#6b7280"
                  value={aiPreferences}
                  onChangeText={setAiPreferences}
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.aiHint}>
                  <Ionicons name="information-circle" size={16} color="#6b7280" />
                  <Text style={styles.aiHintText}>
                    AI analyzes recent chore history and preferences to create a fair schedule.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.generateBtn, { backgroundColor: primaryColor }]}
                  onPress={handleGenerateAiSchedule}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={20} color="#fff" />
                      <Text style={styles.generateBtnText}>Generate Schedule</Text>
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
                  <TouchableOpacity
                    style={styles.regenerateBtn}
                    onPress={() => setAiSchedule('')}
                  >
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
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 60 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subGreeting: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  settingsBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(30, 27, 75, 0.6)', borderRadius: 16, padding: 14, borderWidth: 1, borderLeftWidth: 3 },
  statNumber: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 6 },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  // Scheduler Buttons
  schedulerButtons: { gap: 10, marginBottom: 20 },
  schedulerBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  schedulerIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  schedulerInfo: { flex: 1 },
  schedulerTitle: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
  schedulerSubtitle: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  // Section
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },

  // Children Grid
  childrenGrid: { gap: 12 },
  childCard: { backgroundColor: 'rgba(30, 27, 75, 0.6)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  childHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  childAvatarContainer: { position: 'relative', marginRight: 12 },
  childAvatar: { width: 48, height: 48, borderRadius: 24 },
  childAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  childAvatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#1e1b4b' },
  medalPosition: { position: 'absolute', bottom: -4, right: -4 },
  childInfo: { flex: 1 },
  childName: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
  childPoints: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  batteryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  batteryText: { fontSize: 12, fontWeight: '600' },
  childActions: { flexDirection: 'row', gap: 8 },
  childActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 20 },
  childActionText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Pending Cards
  pendingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 27, 75, 0.6)', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pendingInfo: { flex: 1 },
  pendingTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  pendingType: { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' },
  pendingTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  pendingUser: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  pendingActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  // Quick Actions
  quickActions: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(30, 27, 75, 0.6)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  quickBtn: { alignItems: 'center', gap: 6 },
  quickBtnText: { fontSize: 11, color: '#9ca3af' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalChildInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  modalAvatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalChildName: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  modalChildPoints: { fontSize: 13, color: '#f59e0b', fontWeight: '600' },
  modalStats: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  modalStatCard: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center' },
  modalStatNumber: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginVertical: 4 },
  modalStatLabel: { fontSize: 11, color: '#9ca3af' },
  modalSection: { marginBottom: 16 },
  modalSectionTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 10 },
  modalList: { maxHeight: 150 },
  modalListItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(15, 13, 26, 0.5)', borderRadius: 10, padding: 10, marginBottom: 6 },
  modalListText: { flex: 1, fontSize: 13, color: '#fff', marginRight: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  viewFullBtn: { paddingVertical: 14, borderRadius: 20, alignItems: 'center', marginTop: 10 },
  viewFullBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // AI Modal
  aiHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  aiTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  aiSubtitle: { fontSize: 12, color: '#9ca3af' },
  inputLabel: { fontSize: 13, color: '#9ca3af', marginBottom: 10, marginTop: 16 },
  daysSelector: { flexDirection: 'row', gap: 8 },
  dayOption: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(30, 27, 75, 0.8)', alignItems: 'center' },
  dayOptionText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  input: { backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 14, padding: 14, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)', minHeight: 80, textAlignVertical: 'top' },
  aiHint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(30, 27, 75, 0.5)', borderRadius: 12, padding: 12, marginTop: 16 },
  aiHintText: { flex: 1, fontSize: 12, color: '#9ca3af', lineHeight: 18 },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 20, marginTop: 20 },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
