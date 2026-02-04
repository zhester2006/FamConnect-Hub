import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';

// Role configurations
const ROLE_INFO = {
  parent: {
    icon: 'shield-checkmark',
    colors: ['#eab308', '#f97316'],
    description: 'Full access: manage members, approve chores, set rewards'
  },
  member: {
    icon: 'person',
    colors: ['#3b82f6', '#06b6d4'],
    description: 'Standard access: view schedules, participate in activities'
  },
  child: {
    icon: 'happy',
    colors: ['#ec4899', '#a855f7'],
    description: 'Limited access: complete chores, earn points, view rewards'
  }
};

export default function FamilyScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [processing, setProcessing] = useState(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  
  // Form data
  const [familyName, setFamilyName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('child');

  const fetchData = useCallback(async () => {
    try {
      const [familiesData, invitesData] = await Promise.all([
        apiService.getFamilies().catch(() => ({ families: [] })),
        apiService.getPendingInvites().catch(() => ({ invites: [] })),
      ]);

      const familiesList = familiesData.families || [];
      const currentFamily = familiesList.find(f => f.is_current) || familiesList[0];
      setFamily(currentFamily || null);
      setPendingInvites(invitesData.invites || []);

      if (currentFamily) {
        try {
          const membersData = await apiService.getFamilyMembers(currentFamily.family_id);
          setMembers(membersData.members || []);
        } catch (e) {
          setMembers([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch family:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleCreateFamily = async () => {
    if (!familyName.trim()) {
      Alert.alert('Error', 'Please enter a family name');
      return;
    }
    setProcessing('create');
    try {
      await apiService.createFamily({ name: familyName });
      Alert.alert('Success', 'Family created!');
      setShowCreateModal(false);
      setFamilyName('');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to create family');
    } finally {
      setProcessing(null);
    }
  };

  const handleEditFamily = async () => {
    if (!familyName.trim() || !family) return;
    setProcessing('edit');
    try {
      await apiService.put(`/families/${family.family_id}`, { name: familyName });
      Alert.alert('Success', 'Family updated!');
      setShowEditModal(false);
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update family');
    } finally {
      setProcessing(null);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !family) {
      Alert.alert('Error', 'Please enter an email');
      return;
    }
    setProcessing('invite');
    try {
      await apiService.inviteToFamily(family.family_id, { email: inviteEmail, role: inviteRole });
      Alert.alert('Success', `Invitation sent as ${inviteRole}!`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('child');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send invitation');
    } finally {
      setProcessing(null);
    }
  };

  const handleChangeRole = async (newRole) => {
    if (!selectedMember || !family) return;
    setProcessing(selectedMember.user_id);
    try {
      await apiService.put(`/families/${family.family_id}/members/${selectedMember.user_id}/role`, { role: newRole });
      Alert.alert('Success', `Role changed to ${newRole}!`);
      setShowRoleModal(false);
      setSelectedMember(null);
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to change role');
    } finally {
      setProcessing(null);
    }
  };

  const handleRemoveMember = (member) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.name} from the family?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            setProcessing(member.user_id);
            try {
              await apiService.delete(`/families/${family.family_id}/members/${member.user_id}`);
              Alert.alert('Success', 'Member removed');
              fetchData();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove member');
            } finally {
              setProcessing(null);
            }
          }
        }
      ]
    );
  };

  const handleAcceptInvite = async (inviteId) => {
    setProcessing(inviteId);
    try {
      await apiService.post(`/families/invites/${inviteId}/accept`);
      Alert.alert('Welcome!', 'You\'ve joined the family');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept invitation');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    setProcessing(inviteId);
    try {
      await apiService.post(`/families/invites/${inviteId}/decline`);
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to decline invitation');
    } finally {
      setProcessing(null);
    }
  };

  const isAdmin = family?.role === 'parent' || family?.role === 'admin';
  const parentCount = members.filter(m => m.role === 'parent').length;
  const childCount = members.filter(m => m.role === 'child').length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <AnimatedBackground page="default">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Family</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
      >
        {/* Pending Invitations */}
        {pendingInvites.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="mail" size={18} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Pending Invitations</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingInvites.length}</Text>
              </View>
            </View>
            {pendingInvites.map((invite) => (
              <View key={invite.invite_id} style={styles.inviteCard}>
                <View style={styles.inviteInfo}>
                  <View style={styles.inviteIcon}>
                    <Ionicons name="people" size={20} color="#fff" />
                  </View>
                  <View>
                    <Text style={styles.inviteName}>{invite.family_name || 'Family'}</Text>
                    <Text style={styles.inviteRole}>Join as {invite.role}</Text>
                  </View>
                </View>
                <View style={styles.inviteActions}>
                  <TouchableOpacity 
                    style={styles.acceptBtn}
                    onPress={() => handleAcceptInvite(invite.invite_id)}
                    disabled={processing === invite.invite_id}
                  >
                    {processing === invite.invite_id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.declineBtn}
                    onPress={() => handleDeclineInvite(invite.invite_id)}
                    disabled={processing === invite.invite_id}
                  >
                    <Ionicons name="close" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* No Family */}
        {!family && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people" size={48} color="#6366f1" />
            </View>
            <Text style={styles.emptyTitle}>Create Your Family</Text>
            <Text style={styles.emptyText}>
              Start by creating your family. You can then invite parents and children to join.
            </Text>
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => { setFamilyName(''); setShowCreateModal(true); }}
            >
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={styles.createButtonText}>Create Family</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Family Card */}
        {family && (
          <View style={styles.familyCard}>
            {/* Family Header */}
            <View style={styles.familyHeader}>
              <View style={styles.familyIcon}>
                <Ionicons name="home" size={28} color="#fff" />
              </View>
              <View style={styles.familyInfo}>
                <Text style={styles.familyName}>{family.name}</Text>
                <Text style={styles.familyStats}>
                  {members.length} members • {parentCount} parent{parentCount !== 1 ? 's' : ''} • {childCount} child{childCount !== 1 ? 'ren' : ''}
                </Text>
              </View>
              {isAdmin && (
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => { setFamilyName(family.name); setShowEditModal(true); }}
                >
                  <Ionicons name="create-outline" size={22} color="#a5b4fc" />
                </TouchableOpacity>
              )}
            </View>

            {/* Invite Button */}
            {isAdmin && (
              <TouchableOpacity 
                style={styles.inviteButton}
                onPress={() => { setInviteEmail(''); setInviteRole('child'); setShowInviteModal(true); }}
              >
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={styles.inviteButtonText}>Invite New Member</Text>
              </TouchableOpacity>
            )}

            {/* Members List */}
            <View style={styles.membersSection}>
              <Text style={styles.membersTitle}>Family Members</Text>
              {members.map((member) => {
                const roleInfo = ROLE_INFO[member.role] || ROLE_INFO.member;
                const isCurrentUser = member.user_id === user?.user_id;
                
                return (
                  <View 
                    key={member.user_id} 
                    style={[styles.memberCard, isCurrentUser && styles.memberCardCurrent]}
                  >
                    <View style={styles.memberInfo}>
                      <View style={[styles.memberAvatar, { backgroundColor: roleInfo.colors[0] }]}>
                        <Text style={styles.memberAvatarText}>{member.name?.charAt(0)}</Text>
                      </View>
                      <View>
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberName}>{member.name}</Text>
                          {isCurrentUser && (
                            <View style={styles.youBadge}>
                              <Text style={styles.youBadgeText}>YOU</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.memberRoleRow}>
                          <Ionicons name={roleInfo.icon} size={12} color="#6b7280" />
                          <Text style={styles.memberRole}>{member.role}</Text>
                        </View>
                      </View>
                    </View>
                    
                    {isAdmin && !isCurrentUser && (
                      <View style={styles.memberActions}>
                        <TouchableOpacity 
                          style={styles.memberActionBtn}
                          onPress={() => { setSelectedMember(member); setShowRoleModal(true); }}
                        >
                          <Ionicons name="swap-horizontal" size={18} color="#a5b4fc" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.memberActionBtn}
                          onPress={() => handleRemoveMember(member)}
                          disabled={processing === member.user_id}
                        >
                          {processing === member.user_id ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                          ) : (
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Role Info */}
        <View style={styles.roleInfoSection}>
          <Text style={styles.roleInfoTitle}>Role Permissions</Text>
          {Object.entries(ROLE_INFO).map(([role, info]) => (
            <View key={role} style={styles.roleInfoCard}>
              <View style={[styles.roleInfoIcon, { backgroundColor: info.colors[0] }]}>
                <Ionicons name={info.icon} size={18} color="#fff" />
              </View>
              <View style={styles.roleInfoContent}>
                <Text style={styles.roleInfoName}>{role}</Text>
                <Text style={styles.roleInfoDesc}>{info.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create Family Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Your Family</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Family Name (e.g., The Smiths)"
              placeholderTextColor="#6b7280"
              value={familyName}
              onChangeText={setFamilyName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitBtn, processing === 'create' && styles.submitBtnDisabled]}
                onPress={handleCreateFamily}
                disabled={processing === 'create'}
              >
                {processing === 'create' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Family Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Family Name</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Family Name"
              placeholderTextColor="#6b7280"
              value={familyName}
              onChangeText={setFamilyName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitBtn, processing === 'edit' && styles.submitBtnDisabled]}
                onPress={handleEditFamily}
                disabled={processing === 'edit'}
              >
                {processing === 'edit' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Family Member</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#6b7280"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <Text style={styles.roleLabel}>Invite as:</Text>
            <View style={styles.roleSelector}>
              {(['parent', 'member', 'child']).map((role) => {
                const info = ROLE_INFO[role];
                return (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleOption, inviteRole === role && { backgroundColor: info.colors[0] }]}
                    onPress={() => setInviteRole(role)}
                  >
                    <Ionicons name={info.icon} size={20} color={inviteRole === role ? '#fff' : '#9ca3af'} />
                    <Text style={[styles.roleOptionText, inviteRole === role && styles.roleOptionTextActive]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.roleDescription}>{ROLE_INFO[inviteRole].description}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInviteModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.inviteSubmitBtn, processing === 'invite' && styles.submitBtnDisabled]}
                onPress={handleInvite}
                disabled={processing === 'invite'}
              >
                {processing === 'invite' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Send Invite</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Role Modal */}
      <Modal visible={showRoleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Role</Text>
              <TouchableOpacity onPress={() => { setShowRoleModal(false); setSelectedMember(null); }}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            {selectedMember && (
              <>
                <View style={styles.selectedMemberCard}>
                  <View style={[styles.memberAvatar, { backgroundColor: ROLE_INFO[selectedMember.role]?.colors[0] || '#6366f1' }]}>
                    <Text style={styles.memberAvatarText}>{selectedMember.name?.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.selectedMemberName}>{selectedMember.name}</Text>
                    <Text style={styles.selectedMemberRole}>Current: {selectedMember.role}</Text>
                  </View>
                </View>
                <Text style={styles.roleLabel}>Change to:</Text>
                <View style={styles.roleSelector}>
                  {(['parent', 'member', 'child']).map((role) => {
                    const info = ROLE_INFO[role];
                    const isCurrentRole = selectedMember.role === role;
                    return (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.roleOption, 
                          isCurrentRole && { backgroundColor: info.colors[0], borderWidth: 2, borderColor: '#fff' }
                        ]}
                        onPress={() => !isCurrentRole && handleChangeRole(role)}
                        disabled={isCurrentRole || processing === selectedMember.user_id}
                      >
                        <Ionicons name={info.icon} size={20} color={isCurrentRole ? '#fff' : '#9ca3af'} />
                        <Text style={[styles.roleOptionText, isCurrentRole && styles.roleOptionTextActive]}>
                          {role}
                        </Text>
                        {isCurrentRole && <Text style={styles.currentLabel}>(current)</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={() => { setShowRoleModal(false); setSelectedMember(null); }}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d1a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  scrollView: { flex: 1, padding: 16 },
  
  // Sections
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', flex: 1 },
  badge: { backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { color: '#f59e0b', fontSize: 12, fontWeight: 'bold' },
  
  // Invite Cards
  inviteCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 16, padding: 16, marginBottom: 8 },
  inviteInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  inviteIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  inviteName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  inviteRole: { fontSize: 13, color: '#a5b4fc', marginTop: 2 },
  inviteActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' },
  declineBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  
  // Empty State
  emptyState: { alignItems: 'center', padding: 32, backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 24, marginTop: 40 },
  emptyIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(99, 102, 241, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#a5b4fc', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#6366f1', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 30 },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  // Family Card
  familyCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 24, overflow: 'hidden' },
  familyHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'rgba(99, 102, 241, 0.15)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  familyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#f59e0b', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  familyInfo: { flex: 1 },
  familyName: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  familyStats: { fontSize: 13, color: '#a5b4fc', marginTop: 4 },
  editButton: { padding: 8 },
  
  // Invite Button
  inviteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ec4899', margin: 16, paddingVertical: 14, borderRadius: 30 },
  inviteButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  
  // Members
  membersSection: { padding: 16 },
  membersTitle: { fontSize: 12, fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  memberCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(15, 13, 26, 0.5)', borderRadius: 16, padding: 14, marginBottom: 8 },
  memberCardCurrent: { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  youBadge: { backgroundColor: 'rgba(99, 102, 241, 0.3)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  youBadgeText: { color: '#818cf8', fontSize: 9, fontWeight: 'bold' },
  memberRoleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  memberRole: { fontSize: 12, color: '#6b7280', textTransform: 'capitalize' },
  memberActions: { flexDirection: 'row', gap: 4 },
  memberActionBtn: { padding: 8 },
  
  // Role Info
  roleInfoSection: { marginTop: 20, backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 20, padding: 16 },
  roleInfoTitle: { fontSize: 14, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  roleInfoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: 'rgba(15, 13, 26, 0.5)', borderRadius: 12, padding: 12, marginBottom: 8 },
  roleInfoIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  roleInfoContent: { flex: 1 },
  roleInfoName: { fontSize: 14, fontWeight: '600', color: '#fff', textTransform: 'capitalize' },
  roleInfoDesc: { fontSize: 11, color: '#9ca3af', marginTop: 2, lineHeight: 16 },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  input: { backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, backgroundColor: '#374151', paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  submitBtn: { flex: 1, backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  inviteSubmitBtn: { flex: 1, backgroundColor: '#ec4899', paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  closeBtn: { backgroundColor: '#374151', paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 12 },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  // Role Selector
  roleLabel: { fontSize: 14, color: '#a5b4fc', marginBottom: 10 },
  roleSelector: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  roleOption: { flex: 1, backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 16, padding: 14, alignItems: 'center', gap: 6 },
  roleOptionText: { color: '#9ca3af', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  roleOptionTextActive: { color: '#fff' },
  roleDescription: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginBottom: 16 },
  currentLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)' },
  
  // Selected Member
  selectedMemberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(15, 13, 26, 0.5)', borderRadius: 16, padding: 14, marginBottom: 20 },
  selectedMemberName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  selectedMemberRole: { fontSize: 12, color: '#a5b4fc', marginTop: 2 },
});
