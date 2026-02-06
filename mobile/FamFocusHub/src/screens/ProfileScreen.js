import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, 
  Image, Alert, ActivityIndicator, Switch 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';

const THEMES = [
  { id: 'cosmic_explorer', name: 'Cosmic Explorer', colors: ['#1e1b4b', '#312e81', '#4c1d95'] },
  { id: 'ocean_breeze', name: 'Ocean Breeze', colors: ['#164e63', '#0e7490', '#06b6d4'] },
  { id: 'forest_haven', name: 'Forest Haven', colors: ['#14532d', '#166534', '#22c55e'] },
  { id: 'sunset_glow', name: 'Sunset Glow', colors: ['#7c2d12', '#c2410c', '#f97316'] },
  { id: 'cherry_blossom', name: 'Cherry Blossom', colors: ['#831843', '#be185d', '#ec4899'] },
  { id: 'midnight_sky', name: 'Midnight Sky', colors: ['#0f172a', '#1e293b', '#334155'] },
];

export default function ProfileScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    nickname: user?.nickname || '',
    email: user?.email || '',
    bio: user?.bio || '',
  });
  const [selectedTheme, setSelectedTheme] = useState(user?.settings?.theme || 'cosmic_explorer');
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.settings?.notifications_enabled !== false);
  const [profilePicture, setProfilePicture] = useState(user?.picture || null);
  const [backgroundPicture, setBackgroundPicture] = useState(user?.background_picture || null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        nickname: user.nickname || '',
        email: user.email || '',
        bio: user.bio || '',
      });
      setSelectedTheme(user.settings?.theme || 'cosmic_explorer');
      setNotificationsEnabled(user.settings?.notifications_enabled !== false);
      setProfilePicture(user.picture || null);
      setBackgroundPicture(user.profile_background || user.background_picture || null);
    }
  }, [user]);

  const handlePickImage = async (type) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'profile' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (type === 'profile') {
        setProfilePicture(result.assets[0].uri);
        await uploadImage(result.assets[0].uri, 'profile');
      } else {
        setBackgroundPicture(result.assets[0].uri);
        await uploadImage(result.assets[0].uri, 'background');
      }
    }
  };

  const uploadImage = async (uri, type) => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: `${type}_image.jpg`,
      });
      formData.append('type', type);

      await fetch(`${apiService.baseUrl}/users/${user.user_id}/upload-picture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiService.sessionToken}`,
        },
        body: formData,
      });

      await refreshUser();
      Alert.alert('Success', `${type === 'profile' ? 'Profile' : 'Background'} picture updated!`);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiService.updateProfile(user.user_id, {
        name: formData.name,
        nickname: formData.nickname,
        bio: formData.bio,
        settings: {
          theme: selectedTheme,
          notifications_enabled: notificationsEnabled,
        }
      });

      await refreshUser();
      setEditing(false);
      Alert.alert('Success', 'Profile updated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const currentTheme = THEMES.find(t => t.id === selectedTheme) || THEMES[0];

  return (
    <View style={styles.container}>
      <LinearGradient colors={currentTheme.colors} style={styles.gradient} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)} style={styles.editButton}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.editButtonText}>{editing ? 'Save' : 'Edit'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Header Section */}
        <View style={styles.profileHeader}>
          {/* Background Image */}
          <TouchableOpacity 
            style={styles.backgroundContainer}
            onPress={() => editing && handlePickImage('background')}
            disabled={!editing}
          >
            {backgroundPicture ? (
              <Image source={{ uri: backgroundPicture }} style={styles.backgroundImage} />
            ) : (
              <LinearGradient colors={currentTheme.colors} style={styles.backgroundImage} />
            )}
            {editing && (
              <View style={styles.editOverlay}>
                <Ionicons name="camera" size={24} color="#fff" />
                <Text style={styles.editOverlayText}>Change Cover</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Profile Picture */}
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => editing && handlePickImage('profile')}
            disabled={!editing}
          >
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{formData.name?.charAt(0) || 'U'}</Text>
              </View>
            )}
            {editing && (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          {/* Role Badge */}
          <View style={styles.roleBadge}>
            <Ionicons name={user?.role === 'parent' ? 'shield' : 'person'} size={14} color="#818cf8" />
            <Text style={styles.roleText}>{user?.role || 'Member'}</Text>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({...formData, name: text})}
                placeholder="Your name"
                placeholderTextColor="#6b7280"
              />
            ) : (
              <Text style={styles.fieldValue}>{formData.name || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nickname</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.nickname}
                onChangeText={(text) => setFormData({...formData, nickname: text})}
                placeholder="Your nickname"
                placeholderTextColor="#6b7280"
              />
            ) : (
              <Text style={styles.fieldValue}>{formData.nickname || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={[styles.fieldValue, styles.emailValue]}>{formData.email || 'Not set'}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Bio</Text>
            {editing ? (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.bio}
                onChangeText={(text) => setFormData({...formData, bio: text})}
                placeholder="Tell us about yourself..."
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={3}
              />
            ) : (
              <Text style={styles.fieldValue}>{formData.bio || 'No bio yet'}</Text>
            )}
          </View>
        </View>

        {/* Theme Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <View style={styles.themesGrid}>
            {THEMES.map((theme) => (
              <TouchableOpacity
                key={theme.id}
                style={[
                  styles.themeOption,
                  selectedTheme === theme.id && styles.themeOptionSelected
                ]}
                onPress={() => editing && setSelectedTheme(theme.id)}
                disabled={!editing}
              >
                <LinearGradient colors={theme.colors} style={styles.themePreview} />
                <Text style={styles.themeName}>{theme.name}</Text>
                {selectedTheme === theme.id && (
                  <View style={styles.themeCheckmark}>
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications" size={20} color="#a5b4fc" />
              <Text style={styles.settingLabel}>Push Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#4b5563', true: '#6366f1' }}
              thumbColor={notificationsEnabled ? '#fff' : '#9ca3af'}
              disabled={!editing}
            />
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="trophy" size={24} color="#f59e0b" />
              <Text style={styles.statValue}>{user?.points || 0}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkbox" size={24} color="#10b981" />
              <Text style={styles.statValue}>{user?.chores_completed || 0}</Text>
              <Text style={styles.statLabel}>Chores Done</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="book" size={24} color="#818cf8" />
              <Text style={styles.statValue}>{user?.books_read || 0}</Text>
              <Text style={styles.statLabel}>Books Read</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0d1a' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16, zIndex: 10 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  editButton: { padding: 8 },
  editButtonText: { color: '#818cf8', fontSize: 16, fontWeight: '600' },
  scrollView: { flex: 1 },
  profileHeader: { alignItems: 'center', marginBottom: 20 },
  backgroundContainer: { width: '100%', height: 150, position: 'relative' },
  backgroundImage: { width: '100%', height: '100%' },
  editOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  editOverlayText: { color: '#fff', marginTop: 4, fontSize: 12 },
  avatarContainer: { marginTop: -50, position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#1e1b4b' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#1e1b4b' },
  avatarText: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#6366f1', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1e1b4b' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(99, 102, 241, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginTop: 12 },
  roleText: { color: '#818cf8', fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  section: { marginHorizontal: 16, marginBottom: 24, backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 16, padding: 16 },
  sectionTitle: { color: '#a5b4fc', fontSize: 14, fontWeight: '600', marginBottom: 16, textTransform: 'uppercase' },
  field: { marginBottom: 16 },
  fieldLabel: { color: '#6b7280', fontSize: 12, marginBottom: 6 },
  fieldValue: { color: '#fff', fontSize: 16 },
  emailValue: { color: '#a5b4fc' },
  input: { backgroundColor: 'rgba(15, 13, 26, 0.5)', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  themesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  themeOption: { width: '30%', alignItems: 'center', padding: 8, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  themeOptionSelected: { borderColor: '#10b981' },
  themePreview: { width: 50, height: 50, borderRadius: 25 },
  themeName: { color: '#fff', fontSize: 10, marginTop: 6, textAlign: 'center' },
  themeCheckmark: { position: 'absolute', top: 4, right: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { color: '#fff', fontSize: 16 },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: 'rgba(15, 13, 26, 0.5)', borderRadius: 12, padding: 16, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  statLabel: { color: '#6b7280', fontSize: 12, marginTop: 4 },
});
