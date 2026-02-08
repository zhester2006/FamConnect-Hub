import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Alert, Share, Modal, TextInput, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';

const ROLE_COLORS = {
  parent: '#6366f1',
  member: '#10b981',
  child: '#f59e0b',
  homehub: '#06b6d4',
};

const ROLE_ICONS = {
  parent: 'shield-checkmark',
  member: 'person',
  child: 'happy',
  homehub: 'tv',
};

const ROLE_DESCRIPTIONS = {
  parent: 'Full control & management',
  member: 'Standard family member',
  child: 'With points & rewards',
  homehub: 'Family display device',
};

export default function FamilyManagementScreen({ navigation }) {
  const { user } = useAuth();
  const theme = useTheme();
  const [members, setMembers] = useState([]);
  const [familyInfo, setFamilyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [membersRes, familyRes] = await Promise.all([
        apiService.get('/family/members/detailed'),
        apiService.get('/family/info'),
      ]);
      setMembers(membersRes.members || []);
      setFamilyInfo(familyRes);
    } catch (error) {
      console.error('Error fetching family data:', error);
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

  const handleCopyCode = async () => {
    if (familyInfo?.family_code) {
      await Clipboard.setStringAsync(familyInfo.family_code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copied!', 'Family code copied to clipboard');
    }
  };

  const handleShareInvite = async () => {
    try {
      const response = await apiService.post('/family/invite', { message: inviteMessage });
      
      await Share.share({
        message: response.invite_text,
        title: 'Join My Family on FamFocus Hub',
      });
      
      setShowInviteModal(false);
      setInviteMessage('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error sharing invite:', error);
    }
  };

  const handleChangeRole = async (newRole) => {
    if (!selectedMember) return;
    
    try {
      await apiService.put(`/family/members/${selectedMember.user_id}/role`, { role: newRole });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRoleModal(false);
      setSelectedMember(null);
      fetchData();
      Alert.alert('Success', `Role updated to ${newRole}`);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = (member) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.nickname || member.name} from the family?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.delete(`/family/members/${member.user_id}`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              fetchData();
              Alert.alert('Success', 'Member removed from family');
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const renderMemberCard = (member) => {
    const isCurrentUser = member.is_current_user;
    const roleColor = ROLE_COLORS[member.role] || '#6b7280';
    const roleIcon = ROLE_ICONS[member.role] || 'person';
    
    return (
      <View key={member.user_id} style={[styles.memberCard, { borderColor: `${roleColor}44` }]}>
        <View style={styles.memberHeader}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: `${roleColor}22` }]}>
            {member.picture ? (
              <Ionicons name="person" size={28} color={roleColor} />
            ) : (
              <Text style={[styles.avatarText, { color: roleColor }]}>
                {(member.nickname || member.name || '?').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          
          {/* Info */}
          <View style={styles.memberInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.memberName}>{member.nickname || member.name}</Text>
              {isCurrentUser && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>You</Text>
                </View>
              )}
            </View>
            <Text style={styles.memberEmail}>{member.email}</Text>
            
            {/* Role Badge */}
            <View style={[styles.roleBadge, { backgroundColor: `${roleColor}22` }]}>
              <Ionicons name={roleIcon} size={14} color={roleColor} />
              <Text style={[styles.roleText, { color: roleColor }]}>
                {member.role?.charAt(0).toUpperCase() + member.role?.slice(1)}
              </Text>
            </View>
          </View>
          
          {/* Actions - Only show for parents managing others */}
          {user?.role === 'parent' && !isCurrentUser && (
            <View style={styles.memberActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setSelectedMember(member);
                  setShowRoleModal(true);
                }}
              >
                <Ionicons name="swap-horizontal" size={20} color="#6366f1" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.removeButton]}
                onPress={() => handleRemoveMember(member)}
              >
                <Ionicons name="person-remove" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Stats */}
        <View style={styles.memberStats}>
          <View style={styles.stat}>
            <Ionicons name="star" size={14} color="#f59e0b" />
            <Text style={styles.statValue}>{member.points || 0}</Text>
            <Text style={styles.statLabel}>points</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="ribbon" size={14} color="#a855f7" />
            <Text style={styles.statValue}>{member.badges?.length || 0}</Text>
            <Text style={styles.statLabel}>badges</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons 
              name={member.online_status ? 'ellipse' : 'ellipse-outline'} 
              size={10} 
              color={member.online_status ? '#10b981' : '#6b7280'} 
            />
            <Text style={[styles.statLabel, { marginLeft: 4 }]}>
              {member.online_status ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <AnimatedBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary || '#6366f1'} />
          <Text style={styles.loadingText}>Loading family...</Text>
        </View>
      </AnimatedBackground>
    );
  }

  return (
    <AnimatedBackground>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Family Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
      >
        {/* Family Info Card */}
        <View style={styles.familyCard}>
          <View style={styles.familyHeader}>
            <View style={styles.familyIconContainer}>
              <Ionicons name="home" size={32} color="#6366f1" />
            </View>
            <View style={styles.familyInfo}>
              <Text style={styles.familyName}>{familyInfo?.family_name || 'My Family'}</Text>
              <Text style={styles.familyStats}>{members.length} members</Text>
            </View>
          </View>
          
          {/* Family Code - Only for parents */}
          {user?.role === 'parent' && familyInfo?.family_code && (
            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>Family Invite Code</Text>
              <View style={styles.codeContainer}>
                <Text style={styles.codeText}>{familyInfo.family_code}</Text>
                <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
                  <Ionicons name="copy" size={20} color="#6366f1" />
                </TouchableOpacity>
              </View>
              <Text style={styles.codeHint}>Share this code with family members to let them join</Text>
            </View>
          )}
          
          {/* Action Buttons */}
          {user?.role === 'parent' && (
            <View style={styles.familyActions}>
              <TouchableOpacity
                style={[styles.familyActionBtn, { backgroundColor: '#6366f1' }]}
                onPress={() => setShowInviteModal(true)}
              >
                <Ionicons name="paper-plane" size={18} color="#fff" />
                <Text style={styles.familyActionText}>Send Invite</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Members List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Family Members</Text>
          {members.map(renderMemberCard)}
        </View>

        {/* Role Legend */}
        <View style={styles.legendSection}>
          <Text style={styles.legendTitle}>Role Permissions</Text>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ROLE_COLORS.parent }]} />
            <Text style={styles.legendText}>
              <Text style={styles.legendRole}>Parent:</Text> Full access - manage family, approve items, view locations
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ROLE_COLORS.member }]} />
            <Text style={styles.legendText}>
              <Text style={styles.legendRole}>Member:</Text> Standard access - chat, calendar, chores
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ROLE_COLORS.child }]} />
            <Text style={styles.legendText}>
              <Text style={styles.legendRole}>Child:</Text> Limited access - needs approval for tasks, location sharing
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Role Change Modal */}
      <Modal visible={showRoleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Role</Text>
              <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Select a new role for {selectedMember?.nickname || selectedMember?.name}
            </Text>
            
            {['parent', 'member', 'child'].map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleOption,
                  selectedMember?.role === role && styles.roleOptionActive,
                  { borderColor: ROLE_COLORS[role] }
                ]}
                onPress={() => handleChangeRole(role)}
              >
                <Ionicons name={ROLE_ICONS[role]} size={24} color={ROLE_COLORS[role]} />
                <View style={styles.roleOptionInfo}>
                  <Text style={[styles.roleOptionTitle, { color: ROLE_COLORS[role] }]}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                  <Text style={styles.roleOptionDesc}>
                    {role === 'parent' && 'Full management access'}
                    {role === 'member' && 'Standard family member'}
                    {role === 'child' && 'Limited access, needs approval'}
                  </Text>
                </View>
                {selectedMember?.role === role && (
                  <Ionicons name="checkmark-circle" size={24} color={ROLE_COLORS[role]} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Invite</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeLabel}>Your Family Code</Text>
              <Text style={styles.inviteCode}>{familyInfo?.family_code}</Text>
            </View>
            
            <Text style={styles.inputLabel}>Add a personal message (optional)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Welcome to our family!"
              placeholderTextColor="#6b7280"
              value={inviteMessage}
              onChangeText={setInviteMessage}
              multiline
              maxLength={200}
            />
            
            <TouchableOpacity style={styles.shareButton} onPress={handleShareInvite}>
              <Ionicons name="share-social" size={20} color="#fff" />
              <Text style={styles.shareButtonText}>Share Invite</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#9ca3af', marginTop: 12 },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  // Family Card
  familyCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.9)',
    borderRadius: 20, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  familyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  familyIconContainer: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  familyInfo: { marginLeft: 16, flex: 1 },
  familyName: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  familyStats: { fontSize: 14, color: '#9ca3af', marginTop: 4 },
  
  codeSection: { 
    backgroundColor: 'rgba(15, 13, 26, 0.5)', 
    borderRadius: 12, padding: 16, marginBottom: 16 
  },
  codeLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 8 },
  codeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeText: { 
    fontSize: 28, fontWeight: 'bold', color: '#6366f1', 
    letterSpacing: 4, fontFamily: 'monospace' 
  },
  copyButton: { 
    width: 44, height: 44, borderRadius: 22, 
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center', alignItems: 'center' 
  },
  codeHint: { fontSize: 12, color: '#6b7280', marginTop: 8 },
  
  familyActions: { flexDirection: 'row', gap: 12 },
  familyActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, gap: 8,
  },
  familyActionText: { color: '#fff', fontWeight: '600' },
  
  // Section
  section: { marginBottom: 20 },
  sectionTitle: { 
    fontSize: 14, fontWeight: '600', color: '#9ca3af', 
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 
  },
  
  // Member Card
  memberCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1,
  },
  memberHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: 'bold' },
  memberInfo: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  youBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  youBadgeText: { fontSize: 10, color: '#a5b4fc', fontWeight: '600' },
  memberEmail: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    alignSelf: 'flex-start', marginTop: 6,
  },
  roleText: { fontSize: 12, fontWeight: '600' },
  
  memberActions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  removeButton: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  
  memberStats: { 
    flexDirection: 'row', justifyContent: 'space-around', 
    marginTop: 12, paddingTop: 12, 
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' 
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontSize: 14, fontWeight: '600', color: '#fff' },
  statLabel: { fontSize: 12, color: '#6b7280' },
  
  // Legend
  legendSection: {
    backgroundColor: 'rgba(30, 27, 75, 0.5)',
    borderRadius: 16, padding: 16, marginTop: 8,
  },
  legendTitle: { fontSize: 14, fontWeight: '600', color: '#9ca3af', marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, marginRight: 10 },
  legendText: { flex: 1, fontSize: 13, color: '#9ca3af', lineHeight: 18 },
  legendRole: { color: '#fff', fontWeight: '600' },
  
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e1b4b', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  modalSubtitle: { fontSize: 14, color: '#9ca3af', marginBottom: 20 },
  
  roleOption: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: 12, borderWidth: 2, marginBottom: 12,
    backgroundColor: 'rgba(15, 13, 26, 0.5)',
  },
  roleOptionActive: { backgroundColor: 'rgba(99, 102, 241, 0.1)' },
  roleOptionInfo: { flex: 1, marginLeft: 12 },
  roleOptionTitle: { fontSize: 16, fontWeight: '600' },
  roleOptionDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  
  // Invite Modal
  inviteCodeBox: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20,
    borderWidth: 2, borderColor: 'rgba(99, 102, 241, 0.3)', borderStyle: 'dashed',
  },
  inviteCodeLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 8 },
  inviteCode: { 
    fontSize: 32, fontWeight: 'bold', color: '#6366f1', 
    letterSpacing: 6, fontFamily: 'monospace' 
  },
  inputLabel: { fontSize: 14, color: '#9ca3af', marginBottom: 8 },
  messageInput: {
    backgroundColor: 'rgba(15, 13, 26, 0.5)',
    borderRadius: 12, padding: 16, color: '#fff',
    fontSize: 16, height: 100, textAlignVertical: 'top',
    borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)',
    marginBottom: 20,
  },
  shareButton: {
    backgroundColor: '#6366f1', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    padding: 16, borderRadius: 14, gap: 8,
  },
  shareButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
