import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import biometricService from '../services/biometric.service';
import offlineService from '../services/offline.service';
import apiService from '../services/api.service';

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    // Check biometric support
    const support = await biometricService.checkSupport();
    setBiometricSupported(support.supported);
    if (support.supported) {
      setBiometricType(support.primaryType);
      const enabled = await biometricService.isBiometricLoginEnabled();
      setBiometricEnabled(enabled);
    }

    // Check pending syncs
    const pending = await apiService.getPendingSyncCount();
    setPendingSyncs(pending);
  };

  const handleBiometricToggle = async (enabled) => {
    if (enabled) {
      // Get current session token
      const SecureStore = require('expo-secure-store');
      const token = await SecureStore.getItemAsync('famfocus_session_token');
      
      if (!token) {
        Alert.alert('Error', 'Please sign in again to enable biometric login');
        return;
      }

      const result = await biometricService.enableBiometricLogin(token);
      if (result.success) {
        setBiometricEnabled(true);
        Alert.alert('Success', `${biometricType} login enabled!`);
      } else {
        Alert.alert('Failed', result.error || 'Could not enable biometric login');
      }
    } else {
      const result = await biometricService.disableBiometricLogin();
      if (result.success) {
        setBiometricEnabled(false);
      }
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiService.forceSync();
      const pending = await apiService.getPendingSyncCount();
      setPendingSyncs(pending);
      Alert.alert('Sync Complete', pending === 0 ? 'All data synced!' : `${pending} items still pending`);
    } catch (error) {
      Alert.alert('Sync Failed', 'Please try again later');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will remove all cached data. You may need to reload some screens.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            await offlineService.clearCache();
            Alert.alert('Done', 'Cache cleared');
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive', 
          onPress: async () => {
            await biometricService.clearOnLogout();
            logout();
          }
        }
      ]
    );
  };

  const getBiometricIcon = () => {
    if (biometricType === 'Face ID') return 'scan';
    if (biometricType === 'Touch ID') return 'finger-print';
    return 'lock-closed';
  };

  const settingsSections = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Profile', onPress: () => {} },
        { icon: 'people-outline', label: 'Family Management', onPress: () => navigation.navigate('Family') },
      ]
    },
    {
      title: 'Security',
      items: [
        ...(biometricSupported ? [{
          icon: getBiometricIcon(),
          label: `${biometricType} Login`,
          toggle: true,
          value: biometricEnabled,
          onToggle: handleBiometricToggle,
        }] : []),
      ]
    },
    {
      title: 'Preferences',
      items: [
        { icon: 'notifications-outline', label: 'Notifications', toggle: true, value: notifications, onToggle: setNotifications },
        { icon: 'moon-outline', label: 'Dark Mode', toggle: true, value: darkMode, onToggle: setDarkMode },
      ]
    },
    {
      title: 'Data & Storage',
      items: [
        { 
          icon: 'sync-outline', 
          label: 'Sync Now', 
          badge: pendingSyncs > 0 ? pendingSyncs : null,
          onPress: handleSync,
          loading: syncing,
        },
        { icon: 'trash-outline', label: 'Clear Cache', onPress: handleClearCache },
      ]
    },
    {
      title: 'Support',
      items: [
        { icon: 'help-circle-outline', label: 'Help & FAQ', onPress: () => {} },
        { icon: 'chatbox-outline', label: 'Contact Us', onPress: () => {} },
        { icon: 'document-text-outline', label: 'Terms of Service', onPress: () => {} },
        { icon: 'shield-outline', label: 'Privacy Policy', onPress: () => {} },
      ]
    },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1e1b4b', '#312e81', '#1e1b4b']} style={styles.gradient} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user?.name?.charAt(0) || 'U'}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role || 'Member'}</Text>
            </View>
          </View>
          {biometricEnabled && (
            <View style={styles.biometricBadge}>
              <Ionicons name={getBiometricIcon()} size={16} color="#10b981" />
            </View>
          )}
        </View>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          section.items.length > 0 && (
            <View key={sectionIndex} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionContent}>
                {section.items.map((item, itemIndex) => (
                  <TouchableOpacity
                    key={itemIndex}
                    style={[styles.settingItem, itemIndex < section.items.length - 1 && styles.settingItemBorder]}
                    onPress={item.onPress}
                    disabled={item.toggle || item.loading}
                  >
                    <View style={styles.settingLeft}>
                      <Ionicons name={item.icon} size={22} color="#a5b4fc" />
                      <Text style={styles.settingLabel}>{item.label}</Text>
                      {item.badge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    {item.loading ? (
                      <ActivityIndicator size="small" color="#818cf8" />
                    ) : item.toggle ? (
                      <Switch
                        value={item.value}
                        onValueChange={item.onToggle}
                        trackColor={{ false: '#4b5563', true: '#6366f1' }}
                        thumbColor={item.value ? '#fff' : '#9ca3af'}
                      />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )
        ))}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.version}>FamFocus Hub v1.0.0</Text>
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0d1a' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  scrollView: { flex: 1, padding: 16 },
  userCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  userAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  userInfo: { flex: 1, marginLeft: 16 },
  userName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  userEmail: { color: '#a5b4fc', fontSize: 14, marginTop: 2 },
  roleBadge: { backgroundColor: 'rgba(99, 102, 241, 0.3)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 8 },
  roleText: { color: '#818cf8', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  biometricBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: 8, borderRadius: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#a5b4fc', fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase' },
  sectionContent: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  settingItemBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { color: '#fff', fontSize: 15 },
  badge: { backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, marginTop: 8 },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
  version: { color: '#4b5563', fontSize: 12, textAlign: 'center', marginTop: 24 },
});
