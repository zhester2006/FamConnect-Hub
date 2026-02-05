import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Switch, Alert, Linking, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AnimatedBackground from '../components/AnimatedBackground';
import apiService from '../services/api.service';

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

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
        ...(user?.role === 'parent' ? [{ icon: 'people', label: 'Family', screen: 'Family', color: '#06b6d4' }] : []),
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
        { icon: 'cart', label: 'Shopping List', screen: 'Shopping', color: '#14b8a6' },
        { icon: 'trophy', label: 'Leaderboard', screen: 'Leaderboard', color: '#eab308' },
        { icon: 'chatbubbles', label: 'Family Wall', screen: 'FamilyWall', color: '#ec4899' },
        { icon: 'location', label: 'Location', screen: 'Location', color: '#ef4444' },
      ],
    },
  ];

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

        {/* Theme Mode Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme Mode</Text>
          <View style={styles.themeModeRow}>
            <TouchableOpacity
              style={[
                styles.themeModeOption,
                !theme.isCustomMode && styles.themeModeOptionActive
              ]}
              onPress={() => {
                console.log('Standard mode pressed');
                theme.enableStandardMode();
              }}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="color-palette-outline" 
                size={24} 
                color={!theme.isCustomMode ? '#fff' : '#6b7280'} 
              />
              <Text style={[
                styles.themeModeText,
                !theme.isCustomMode && styles.themeModeTextActive
              ]}>
                Standard
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.themeModeOption,
                theme.isCustomMode && styles.themeModeOptionActive
              ]}
              onPress={() => {
                console.log('Custom mode pressed');
                theme.enableCustomMode();
              }}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="brush" 
                size={24} 
                color={theme.isCustomMode ? '#fff' : '#6b7280'} 
              />
              <Text style={[
                styles.themeModeText,
                theme.isCustomMode && styles.themeModeTextActive
              ]}>
                Custom
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.themeModeHint}>
            {!theme.isCustomMode 
              ? 'Standard mode uses default colors'
              : 'Custom mode applies your selected theme colors across the app'}
          </Text>
        </View>

        {/* Theme Colors Section - Only show when Custom mode is selected */}
        {theme.isCustomMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Primary Color</Text>
            <View style={styles.colorGrid}>
              {theme.availableColors?.primary?.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    theme.primary === color && styles.colorOptionActive
                  ]}
                  onPress={() => theme.updateColor('primary', color)}
                >
                  {theme.primary === color && (
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Accent Color</Text>
            <View style={styles.colorGrid}>
              {theme.availableColors?.accent?.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    theme.accent === color && styles.colorOptionActive
                  ]}
                  onPress={() => theme.updateColor('accent', color)}
                >
                  {theme.accent === color && (
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity style={styles.resetBtn} onPress={() => theme.resetToDefault()}>
              <Ionicons name="refresh" size={16} color="#6b7280" />
              <Text style={styles.resetBtnText}>Reset to Default</Text>
            </TouchableOpacity>
          </View>
        )}

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
              value={notificationsEnabled}
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
                onPress={() => item.screen && navigation.navigate(item.screen)}
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
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  settingLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  settingDesc: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  
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
  
  // Logout
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 16, padding: 16, marginBottom: 16 },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
  
  // Version
  versionText: { color: '#4b5563', fontSize: 12, textAlign: 'center' },
});
