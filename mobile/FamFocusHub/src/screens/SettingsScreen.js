import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Switch, Alert, Linking, ActivityIndicator, TextInput, Modal,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AnimatedBackground from '../components/AnimatedBackground';
import apiService from '../services/api.service';

// Store recent logs for bug reports
const logBuffer = [];
const MAX_LOGS = 100;

// Override console methods to capture logs
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

console.log = (...args) => {
  logBuffer.push({ type: 'LOG', timestamp: new Date().toISOString(), message: args.map(a => String(a)).join(' ') });
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  originalConsole.log(...args);
};

console.warn = (...args) => {
  logBuffer.push({ type: 'WARN', timestamp: new Date().toISOString(), message: args.map(a => String(a)).join(' ') });
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  originalConsole.warn(...args);
};

console.error = (...args) => {
  logBuffer.push({ type: 'ERROR', timestamp: new Date().toISOString(), message: args.map(a => String(a)).join(' ') });
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  originalConsole.error(...args);
};

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [bugSteps, setBugSteps] = useState('');
  const [submittingBug, setSubmittingBug] = useState(false);

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationsEnabled(status === 'granted');
    } catch (error) {
      console.error('Failed to check notification status:', error);
    }
  };

  const getDeviceInfo = async () => {
    try {
      return {
        deviceName: Device.deviceName || 'Unknown',
        brand: Device.brand || 'Unknown',
        modelName: Device.modelName || 'Unknown',
        osName: Device.osName || Platform.OS,
        osVersion: Device.osVersion || Platform.Version,
        appVersion: Application.nativeApplicationVersion || '1.0.0',
        buildVersion: Application.nativeBuildVersion || '1',
      };
    } catch (e) {
      return { error: 'Could not get device info' };
    }
  };

  const handleSubmitBugReport = async () => {
    if (!bugDescription.trim()) {
      Alert.alert('Error', 'Please describe the bug or issue');
      return;
    }

    setSubmittingBug(true);
    try {
      const deviceInfo = await getDeviceInfo();
      const recentLogs = logBuffer.slice(-50); // Get last 50 logs
      
      const report = {
        description: bugDescription.trim(),
        steps_to_reproduce: bugSteps.trim(),
        device_info: deviceInfo,
        user_id: user?.user_id,
        user_role: user?.role,
        timestamp: new Date().toISOString(),
        logs: recentLogs,
      };

      await apiService.post('/bug-reports', report);
      
      Alert.alert(
        'Report Submitted',
        'Thank you for helping us improve FamFocus Hub! Our team will review your report.',
        [{ text: 'OK', onPress: () => {
          setShowBugReport(false);
          setBugDescription('');
          setBugSteps('');
        }}]
      );
    } catch (error) {
      console.error('Failed to submit bug report:', error);
      Alert.alert('Error', 'Failed to submit bug report. Please try again later.');
    } finally {
      setSubmittingBug(false);
    }
  };

  const handleShowTutorial = async () => {
    try {
      await apiService.resetTutorial();
      Alert.alert(
        'Tutorial Reset',
        'The tutorial will show on your next app restart. Would you like to restart now?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Restart', onPress: () => {
            // Force a re-render by navigating
            navigation.reset({
              index: 0,
              routes: [{ name: 'ParentMain' }],
            });
          }}
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to reset tutorial');
    }
  };

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          setNotificationsEnabled(true);
          Alert.alert('Success', 'Notifications enabled!');
        } else {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to receive family updates.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to enable notifications');
      }
    } else {
      Alert.alert(
        'Disable Notifications',
        'To disable notifications, please go to your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await logout();
            setLoading(false);
          }
        },
      ]
    );
  };

  const menuSections = [
    {
      title: 'Account',
      items: [
        { icon: 'person', label: 'Profile', screen: 'Profile', color: '#6366f1' },
        ...(user?.role === 'parent' ? [
          { icon: 'people', label: 'Family', screen: 'Family', color: '#06b6d4' },
          { icon: 'settings', label: 'Manage Family', screen: 'FamilyManagement', color: '#a855f7' },
        ] : []),
      ],
    },
    {
      title: 'Features',
      items: [
        { icon: 'home', label: 'Home Hub', screen: 'HomeHub', color: '#818cf8' },
        { icon: 'calendar', label: 'Calendar', screen: 'Calendar', color: '#fbbf24' },
        ...(user?.role === 'parent' ? [{ icon: 'checkbox', label: 'Chores', screen: 'Chores', color: '#10b981' }] : []),
        { icon: 'gift', label: 'Rewards', screen: 'Rewards', color: '#a855f7' },
        { icon: 'book', label: 'Reading Logs', screen: 'ReadingLogs', color: '#3b82f6' },
        { icon: 'restaurant', label: 'Dinner Planner', screen: 'DinnerPlanner', color: '#f97316' },
        { icon: 'bookmark', label: 'Family Recipes', screen: 'Recipes', color: '#ef4444' },
        { icon: 'cube', label: 'Pantry', screen: 'Pantry', color: '#84cc16' },
        { icon: 'cart', label: 'Shopping List', screen: 'Shopping', color: '#14b8a6' },
        { icon: 'trophy', label: 'Leaderboard', screen: 'Leaderboard', color: '#eab308' },
        { icon: 'chatbubbles', label: 'Family Wall', screen: 'FamilyWall', color: '#ec4899' },
        { icon: 'location', label: 'Location', screen: 'Location', color: '#ef4444' },
        ...(user?.role === 'parent' ? [{ icon: 'time', label: 'Check-in Log', screen: 'CheckinLog', color: '#06b6d4' }] : []),
      ],
    },
    {
      title: 'App Settings',
      items: [
        { icon: 'grid', label: 'Home Screen Widgets', screen: 'WidgetSettings', color: '#8b5cf6' },
        { icon: 'bug', label: 'Report Bug/Glitch', action: 'bugReport', color: '#ef4444' },
        { icon: 'trash-bin', label: 'Clear Cache', action: 'clearCache', color: '#f59e0b' },
      ],
    },
  ];

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear temporary data and cached files. Your login and settings will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const errorHandler = require('../utils/errorHandler').default;
              await errorHandler.clearAppCache();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMenuAction = (item) => {
    if (item.action === 'clearCache') {
      handleClearCache();
    } else if (item.action === 'bugReport') {
      setShowBugReport(true);
    } else if (item.screen) {
      navigation.navigate(item.screen);
    }
  };

  return (
    <AnimatedBackground page="settings">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <TouchableOpacity 
          style={styles.userCard}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user?.name?.charAt(0) || 'U'}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userRole}>{user?.role || 'Member'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
        </TouchableOpacity>

        {/* Theme Presets Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <Text style={styles.settingHint}>Choose a color scheme for your app</Text>
          
          {/* Theme Presets */}
          <View style={styles.themePresetsGrid}>
            {theme.presets && Object.entries(theme.presets).map(([key, preset]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.themePresetCard,
                  { borderColor: preset.primary },
                  theme.selectedPreset === key && !theme.isCustomMode && styles.themePresetActive
                ]}
                onPress={() => theme.selectPreset(key)}
                activeOpacity={0.7}
              >
                <View style={[styles.themePresetPreview, { backgroundColor: preset.background }]}>
                  <View style={[styles.themePresetDot, { backgroundColor: preset.primary }]} />
                  <View style={[styles.themePresetDotSmall, { backgroundColor: preset.accent }]} />
                </View>
                <Text style={[
                  styles.themePresetName,
                  theme.selectedPreset === key && !theme.isCustomMode && { color: preset.primary }
                ]}>
                  {preset.name}
                </Text>
                {theme.selectedPreset === key && !theme.isCustomMode && (
                  <View style={[styles.themeCheckmark, { backgroundColor: preset.primary }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Colors Section */}
        <View style={styles.section}>
          <View style={styles.customModeHeader}>
            <Text style={styles.sectionTitle}>Custom Colors</Text>
            <TouchableOpacity
              style={[
                styles.customModeToggle,
                theme.isCustomMode && { backgroundColor: theme.primary }
              ]}
              onPress={() => theme.isCustomMode ? theme.disableCustomMode() : theme.enableCustomMode()}
              activeOpacity={0.7}
            >
              <Text style={[styles.customModeToggleText, theme.isCustomMode && { color: '#fff' }]}>
                {theme.isCustomMode ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {theme.isCustomMode && (
            <>
              <Text style={[styles.sectionTitle, { fontSize: 14, marginTop: 12 }]}>Primary Color</Text>
              <View style={styles.colorGrid}>
                {theme.availablePrimaryColors?.map((color, index) => (
                  <TouchableOpacity
                    key={`primary-${index}-${color}`}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      theme.primary === color && styles.colorOptionActive
                    ]}
                    onPress={() => theme.setPrimaryColor(color)}
                    activeOpacity={0.7}
                  >
                    {theme.primary === color && (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={[styles.sectionTitle, { fontSize: 14, marginTop: 16 }]}>Accent Color</Text>
              <View style={styles.colorGrid}>
                {theme.availableAccentColors?.map((color, index) => (
                  <TouchableOpacity
                    key={`accent-${index}-${color}`}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      theme.accent === color && styles.colorOptionActive
                    ]}
                    onPress={() => theme.setAccentColor(color)}
                    activeOpacity={0.7}
                  >
                    {theme.accent === color && (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
                <Ionicons name="notifications" size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDesc}>Get alerts for family activities</Text>
              </View>
            </View>
            <Switch
              value={!!notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#4b5563', true: theme.primary }}
              thumbColor={notificationsEnabled ? '#fff' : '#9ca3af'}
            />
          </View>
        </View>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.menuItem,
                  index === section.items.length - 1 && styles.menuItemLast
                ]}
                onPress={() => handleMenuAction(item)}
              >
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}20` }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color="#6b7280" />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <>
              <Ionicons name="log-out" size={20} color="#ef4444" />
              <Text style={styles.logoutText}>Logout</Text>
            </>
          )}
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.versionText}>FamFocus Hub v1.0.0</Text>

        <View style={{ height: 100 }} />
      </ScrollView>
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  scrollView: { flex: 1, padding: 16 },
  
  // User Card
  userCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  userAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  userInfo: { flex: 1, marginLeft: 16 },
  userName: { color: '#fff', fontSize: 18, fontWeight: '600' },
  userRole: { color: '#a5b4fc', fontSize: 14, marginTop: 2, textTransform: 'capitalize' },
  
  // Section
  section: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 20, padding: 16, marginBottom: 16 },
  sectionTitle: { color: '#6b7280', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  
  // Theme Mode
  themeModeRow: { flexDirection: 'row', gap: 10 },
  themeModeOption: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: 'rgba(15, 13, 26, 0.5)', gap: 8 },
  themeModeOptionActive: { backgroundColor: '#6366f1' },
  themeModeText: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
  themeModeHint: { color: '#6b7280', fontSize: 12, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  themeModeTextActive: { color: '#fff' },
  themeModeHint: { color: '#9ca3af', fontSize: 12, marginTop: 12, textAlign: 'center', fontStyle: 'italic' },
  
  // Theme Colors
  themesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeOption: { width: '30%', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 2, borderColor: 'transparent', position: 'relative' },
  themeOptionActive: { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  themePreview: { width: 44, height: 44, borderRadius: 22 },
  themeName: { color: '#fff', fontSize: 10, marginTop: 6, textAlign: 'center' },
  themeCheck: { position: 'absolute', top: 4, right: 4 },
  
  // Setting Row
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  settingLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  settingDesc: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  settingHint: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  
  // Toggle Switch
  toggleSwitch: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#374151', justifyContent: 'center', paddingHorizontal: 3 },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2 },
  
  // Menu Items
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuLabel: { flex: 1, color: '#fff', fontSize: 15 },
  
  // Color Grid
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorOption: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorOptionActive: { borderColor: '#fff' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, padding: 12 },
  resetBtnText: { color: '#6b7280', fontSize: 13 },
  
  // Theme Presets Grid
  themePresetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  themePresetCard: { width: '30%', alignItems: 'center', padding: 10, borderRadius: 14, backgroundColor: 'rgba(15, 13, 26, 0.5)', borderWidth: 2, borderColor: 'transparent', position: 'relative' },
  themePresetActive: { borderWidth: 2 },
  themePresetPreview: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  themePresetDot: { width: 24, height: 24, borderRadius: 12, position: 'absolute' },
  themePresetDotSmall: { width: 14, height: 14, borderRadius: 7, position: 'absolute', bottom: 4, right: 4 },
  themePresetName: { color: '#9ca3af', fontSize: 11, fontWeight: '600', marginTop: 8 },
  themeCheckmark: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  
  // Custom Mode Header
  customModeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  customModeToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(15, 13, 26, 0.5)' },
  customModeToggleText: { color: '#6b7280', fontSize: 12, fontWeight: '700' },
  
  // Logout
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 16, padding: 16, marginBottom: 16 },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
  
  // Version
  versionText: { color: '#4b5563', fontSize: 12, textAlign: 'center' },
});
