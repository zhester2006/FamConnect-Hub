import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/api.service';

export default function FamilyScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [familiesRes, invitesRes] = await Promise.all([
        apiService.getFamilies(),
        apiService.get('/families/invites/pending').catch(() => ({ invites: [] }))
      ]);
      setFamilies(familiesRes.families || []);
      setPendingInvites(invitesRes.invites || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFamily = async () => {
    if (!newFamilyName.trim()) {
      Alert.alert('Error', 'Please enter a family name');
      return;
    }
    try {
      await apiService.post('/families', { name: newFamilyName });
      setShowCreateModal(false);
      setNewFamilyName('');
      fetchData();
      Alert.alert('Success', 'Family created!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create family');
    }
  };

  const handleSwitchFamily = async (familyId) => {
    setProcessing(familyId);
    try {
      await apiService.switchFamily(familyId);
      fetchData();
      Alert.alert('Success', 'Switched to new family');
    } catch (error) {
      Alert.alert('Error', 'Failed to switch family');
    } finally {
      setProcessing(null);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !selectedFamily) return;
    try {
      await apiService.post(`/families/${selectedFamily}/invite`, { email: inviteEmail, role: 'member' });
      setShowInviteModal(false);
      setInviteEmail('');
      Alert.alert('Success', 'Invitation sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send invitation');
    }
  };

  const handleAcceptInvite = async (inviteId) => {
    setProcessing(inviteId);
    try {
      await apiService.post(`/families/invites/${inviteId}/accept`, {});
      fetchData();
      Alert.alert('Success', 'Joined family!');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept invite');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    setProcessing(inviteId);
    try {
      await apiService.post(`/families/invites/${inviteId}/decline`, {});
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to decline invite');
    } finally {
      setProcessing(null);
    }
  };

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
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Family Management</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Invitations</Text>
            {pendingInvites.map((invite) => (
              <View key={invite.invite_id} style={styles.inviteCard}>
                <View style={styles.inviteInfo}>
                  <Text style={styles.inviteFamilyName}>{invite.family_name || 'Family'}</Text>
                  <Text style={styles.inviteRole}>Invited as {invite.role}</Text>
                </View>
                <View style={styles.inviteActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
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
                    style={styles.declineButton}
                    onPress={() => handleDeclineInvite(invite.invite_id)}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Your Families */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Families</Text>
          {families.map((family) => (
            <View key={family.family_id} style={[styles.familyCard, family.is_current && styles.currentFamily]}>
              {family.is_current && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Current</Text>
                </View>
              )}
              <View style={styles.familyIcon}>
                <Ionicons name={family.role === 'parent' ? 'shield' : 'people'} size={24} color="#fff" />
              </View>
              <View style={styles.familyInfo}>
                <Text style={styles.familyName}>{family.name}</Text>
                <Text style={styles.familyMeta}>{family.member_count} members • {family.role}</Text>
              </View>
              <View style={styles.familyActions}>
                {!family.is_current && (
                  <TouchableOpacity
                    style={styles.switchButton}
                    onPress={() => handleSwitchFamily(family.family_id)}
                    disabled={processing === family.family_id}
                  >
                    {processing === family.family_id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="swap-horizontal" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                )}
                {(family.role === 'parent' || family.role === 'admin') && (
                  <TouchableOpacity
                    style={styles.inviteButton}
                    onPress={() => { setSelectedFamily(family.family_id); setShowInviteModal(true); }}
                  >
                    <Ionicons name="person-add" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create Family Modal */}
      <Modal visible={showCreateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Family</Text>
            <TextInput
              style={styles.input}
              placeholder="Family Name"
              placeholderTextColor="#6b7280"
              value={newFamilyName}
              onChangeText={setNewFamilyName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createButton} onPress={handleCreateFamily}>
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite to Family</Text>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#6b7280"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowInviteModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createButton} onPress={handleInvite}>
                <Text style={styles.createButtonText}>Send Invite</Text>
              </TouchableOpacity>
            </View>
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
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  addButton: { padding: 8, backgroundColor: 'rgba(99, 102, 241, 0.3)', borderRadius: 8 },
  scrollView: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#a5b4fc', fontSize: 13, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  inviteCard: { backgroundColor: 'rgba(251, 191, 36, 0.1)', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.3)' },
  inviteInfo: { flex: 1 },
  inviteFamilyName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  inviteRole: { color: '#fbbf24', fontSize: 13, marginTop: 2 },
  inviteActions: { flexDirection: 'row', gap: 8 },
  acceptButton: { backgroundColor: '#10b981', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  declineButton: { backgroundColor: '#6b7280', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  familyCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  currentFamily: { borderWidth: 2, borderColor: '#6366f1' },
  currentBadge: { position: 'absolute', top: -8, right: 12, backgroundColor: '#6366f1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  currentBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  familyIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(99, 102, 241, 0.3)', justifyContent: 'center', alignItems: 'center' },
  familyInfo: { flex: 1, marginLeft: 12 },
  familyName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  familyMeta: { color: '#a5b4fc', fontSize: 13, marginTop: 2 },
  familyActions: { flexDirection: 'row', gap: 8 },
  switchButton: { backgroundColor: '#6366f1', width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  inviteButton: { backgroundColor: '#10b981', width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#1e1b4b', borderRadius: 16, padding: 24, width: '100%' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, padding: 16, color: '#fff', fontSize: 15, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#4b5563', alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontWeight: '600' },
  createButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#6366f1', alignItems: 'center' },
  createButtonText: { color: '#fff', fontWeight: '600' },
});
