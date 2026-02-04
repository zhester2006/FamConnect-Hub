import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, 
  Modal, ActivityIndicator, Alert, FlatList 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';

const ROLES = [
  { value: 'child', label: 'Child', icon: 'person', color: '#10b981' },
  { value: 'member', label: 'Member', icon: 'people', color: '#6366f1' },
  { value: 'parent', label: 'Parent', icon: 'shield', color: '#f59e0b' },
];

export default function FamilyScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('child');
  const [newRole, setNewRole] = useState('child');
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersData, invitesData] = await Promise.all([
        apiService.get('/family/members').catch(() => ({ members: [] })),
        apiService.get('/families/invites/pending').catch(() => ({ invites: [] })),
      ]);
      
      setMembers(membersData.members || []);
      setPendingInvites(invitesData.invites || []);
    } catch (error) {
      console.error('Failed to fetch family data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setProcessing(true);
    try {
      await apiService.post(`/families/${user?.parent_id || user?.user_id}/invite`, {
        email: inviteEmail,
        role: inviteRole,
      });
      
      Alert.alert('Success', `Invitation sent as ${inviteRole}!`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('child');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send invitation');
    } finally {
      setProcessing(false);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedMember) return;

    setProcessing(true);
    try {
      await apiService.put(`/families/${user?.parent_id || user?.user_id}/members/${selectedMember.user_id}/role`, {
        role: newRole,
      });
      
      Alert.alert('Success', `Role changed to ${newRole}!`);
      setShowMemberModal(false);
      setSelectedMember(null);
      fetchData();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to change role');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveMember = () => {
    if (!selectedMember) return;

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${selectedMember.name} from the family?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await apiService.delete(`/families/${user?.parent_id || user?.user_id}/members/${selectedMember.user_id}`);
              Alert.alert('Success', 'Member removed');
              setShowMemberModal(false);
              setSelectedMember(null);
              fetchData();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to remove member');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const handleAcceptInvite = async (inviteId) => {
    try {
      await apiService.post(`/families/invites/${inviteId}/accept`);
      Alert.alert('Success', 'You have joined the family!');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept invitation');
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    try {
      await apiService.post(`/families/invites/${inviteId}/decline`);
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to decline invitation');
    }
  };

  const openMemberModal = (member) => {
    setSelectedMember(member);
    setNewRole(member.role || 'member');
    setShowMemberModal(true);
  };

  const getRoleConfig = (role) => {
    return ROLES.find(r => r.value === role) || ROLES[1];
  };

  const isParent = user?.role === 'parent';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1e1b4b', '#312e81', '#1e1b4b']} style={styles.gradient} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Family Management</Text>
        {isParent && (
          <TouchableOpacity onPress={() => setShowInviteModal(true)} style={styles.addButton}>
            <Ionicons name="person-add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Pending Invitations */}
        {pendingInvites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="mail" size={16} color="#f59e0b" /> Pending Invitations
            </Text>
            {pendingInvites.map((invite) => (
              <View key={invite.invite_id} style={styles.inviteCard}>
                <View style={styles.inviteInfo}>
                  <Text style={styles.inviteName}>{invite.family_name || 'Family'}</Text>
                  <Text style={styles.inviteRole}>as {invite.role}</Text>
                </View>
                <View style={styles.inviteActions}>
                  <TouchableOpacity 
                    style={styles.acceptBtn}
                    onPress={() => handleAcceptInvite(invite.invite_id)}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.declineBtn}
                    onPress={() => handleDeclineInvite(invite.invite_id)}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Family Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="people" size={16} color="#818cf8" /> Family Members ({members.length})
          </Text>
          
          {members.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#4b5563" />
              <Text style={styles.emptyText}>No family members yet</Text>
              {isParent && (
                <TouchableOpacity 
                  style={styles.emptyBtn}
                  onPress={() => setShowInviteModal(true)}
                >
                  <Text style={styles.emptyBtnText}>Invite Members</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            members.map((member) => {
              const roleConfig = getRoleConfig(member.role);
              const isCurrentUser = member.user_id === user?.user_id;
              
              return (
                <TouchableOpacity 
                  key={member.user_id} 
                  style={styles.memberCard}
                  onPress={() => isParent && !isCurrentUser && openMemberModal(member)}
                  disabled={!isParent || isCurrentUser}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {member.name?.charAt(0) || '?'}
                    </Text>
                    {member.online && <View style={styles.onlineDot} />}
                  </View>
                  
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      {isCurrentUser && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>You</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.memberEmail}>{member.email}</Text>
                  </View>
                  
                  <View style={[styles.roleBadge, { backgroundColor: `${roleConfig.color}20` }]}>
                    <Ionicons name={roleConfig.icon} size={14} color={roleConfig.color} />
                    <Text style={[styles.roleText, { color: roleConfig.color }]}>
                      {roleConfig.label}
                    </Text>
                  </View>
                  
                  {isParent && !isCurrentUser && (
                    <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Member</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="Enter email address"
                placeholderTextColor="#6b7280"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Role</Text>
              <View style={styles.roleSelector}>
                {ROLES.map((role) => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      styles.roleOption,
                      inviteRole === role.value && styles.roleOptionSelected,
                      inviteRole === role.value && { borderColor: role.color }
                    ]}
                    onPress={() => setInviteRole(role.value)}
                  >
                    <Ionicons 
                      name={role.icon} 
                      size={24} 
                      color={inviteRole === role.value ? role.color : '#6b7280'} 
                    />
                    <Text style={[
                      styles.roleOptionText,
                      inviteRole === role.value && { color: role.color }
                    ]}>
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={[styles.submitBtn, processing && styles.submitBtnDisabled]}
                onPress={handleInvite}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>Send Invitation</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Member Management Modal */}
      <Modal visible={showMemberModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Member</Text>
              <TouchableOpacity onPress={() => setShowMemberModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <View style={styles.modalBody}>
                {/* Member Info */}
                <View style={styles.memberInfoCard}>
                  <View style={styles.memberAvatarLarge}>
                    <Text style={styles.memberAvatarTextLarge}>
                      {selectedMember.name?.charAt(0) || '?'}
                    </Text>
                  </View>
                  <Text style={styles.memberNameLarge}>{selectedMember.name}</Text>
                  <Text style={styles.memberEmailLarge}>{selectedMember.email}</Text>
                </View>

                {/* Role Selector */}
                <Text style={styles.label}>Change Role</Text>
                <View style={styles.roleSelector}>
                  {ROLES.map((role) => (
                    <TouchableOpacity
                      key={role.value}
                      style={[
                        styles.roleOption,
                        newRole === role.value && styles.roleOptionSelected,
                        newRole === role.value && { borderColor: role.color }
                      ]}
                      onPress={() => setNewRole(role.value)}
                    >
                      <Ionicons 
                        name={role.icon} 
                        size={24} 
                        color={newRole === role.value ? role.color : '#6b7280'} 
                      />
                      <Text style={[
                        styles.roleOptionText,
                        newRole === role.value && { color: role.color }
                      ]}>
                        {role.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={[styles.submitBtn, processing && styles.submitBtnDisabled]}
                    onPress={handleChangeRole}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitBtnText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.removeBtn}
                    onPress={handleRemoveMember}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    <Text style={styles.removeBtnText}>Remove from Family</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0d1a' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d1a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  addButton: { padding: 8, backgroundColor: '#6366f1', borderRadius: 8 },
  scrollView: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  inviteCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  inviteInfo: { flex: 1 },
  inviteName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  inviteRole: { color: '#f59e0b', fontSize: 14, marginTop: 2 },
  inviteActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: '#10b981', padding: 10, borderRadius: 8 },
  declineBtn: { backgroundColor: '#6b7280', padding: 10, borderRadius: 8 },
  emptyContainer: { alignItems: 'center', padding: 40, backgroundColor: 'rgba(30, 27, 75, 0.5)', borderRadius: 16 },
  emptyText: { color: '#6b7280', fontSize: 16, marginTop: 12 },
  emptyBtn: { backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
  emptyBtnText: { color: '#fff', fontWeight: '600' },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, padding: 16, marginBottom: 8 },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  memberAvatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#1e1b4b' },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  youBadge: { backgroundColor: 'rgba(99, 102, 241, 0.3)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  youBadgeText: { color: '#818cf8', fontSize: 10, fontWeight: '600' },
  memberEmail: { color: '#6b7280', fontSize: 13, marginTop: 2 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 8 },
  roleText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  modalBody: { padding: 20 },
  label: { color: '#a5b4fc', fontSize: 14, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  roleSelector: { flexDirection: 'row', gap: 12 },
  roleOption: { flex: 1, alignItems: 'center', padding: 16, backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  roleOptionSelected: { backgroundColor: 'rgba(99, 102, 241, 0.2)' },
  roleOptionText: { color: '#6b7280', fontSize: 12, marginTop: 8, fontWeight: '600' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 12, marginTop: 24 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  memberInfoCard: { alignItems: 'center', marginBottom: 16 },
  memberAvatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  memberAvatarTextLarge: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  memberNameLarge: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 12 },
  memberEmailLarge: { color: '#a5b4fc', fontSize: 14, marginTop: 4 },
  modalActions: { marginTop: 16 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, marginTop: 12 },
  removeBtnText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
});
