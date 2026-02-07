// QuickActionsWidget.js - Quick parent actions widget
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Modal, 
  TextInput, ScrollView, ActivityIndicator, Alert, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';

export default function QuickActionsWidget({ onRefresh }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pendingItems, setPendingItems] = useState({ chores: [], shopping: [], redemptions: [] });
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [points, setPoints] = useState('');
  const [isDeduction, setIsDeduction] = useState(false);
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user?.role === 'parent') {
      fetchPendingItems();
      fetchChildren();
    }
  }, [user]);

  const fetchPendingItems = async () => {
    try {
      const [choresRes, shoppingRes, redemptionsRes] = await Promise.all([
        apiService.getChores().catch(() => ({ chores: [] })),
        apiService.getShoppingList().catch(() => ({ items: [] })),
        apiService.get('/rewards/pending').catch(() => ({ redemptions: [] })),
      ]);

      setPendingItems({
        chores: (choresRes?.chores || []).filter(c => c.status === 'pending'),
        shopping: (shoppingRes?.items || []).filter(i => i.status === 'pending'),
        redemptions: redemptionsRes?.redemptions || [],
      });
    } catch (error) {
      console.log('Failed to fetch pending items:', error);
    }
  };

  const fetchChildren = async () => {
    try {
      const res = await apiService.getFamilyMembers();
      setChildren((res?.members || []).filter(m => m.role === 'child'));
    } catch (error) {
      console.log('Failed to fetch children:', error);
    }
  };

  const handleApproveChore = async (chore) => {
    setProcessing(true);
    try {
      await apiService.put(`/chores/${chore.chore_id}/approve`, { approved: true });
      Alert.alert('✅ Approved!', `${chore.title} approved`);
      fetchPendingItems();
      onRefresh?.();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve chore');
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveShoppingItem = async (item) => {
    setProcessing(true);
    try {
      await apiService.updateShoppingItem(item.item_id, { status: 'approved' });
      Alert.alert('✅ Approved!', `${item.name} added to list`);
      fetchPendingItems();
      onRefresh?.();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve item');
    } finally {
      setProcessing(false);
    }
  };

  const handleAwardPoints = async () => {
    if (!selectedChild || !points) {
      Alert.alert('Error', 'Please select a child and enter points');
      return;
    }

    setProcessing(true);
    try {
      const amount = isDeduction ? -parseInt(points) : parseInt(points);
      await apiService.post(`/users/${selectedChild.user_id}/points`, {
        amount,
        reason: isDeduction ? 'Quick deduction' : 'Quick bonus',
      });
      
      Alert.alert(
        isDeduction ? '📉 Points Deducted' : '🎉 Points Awarded!',
        `${isDeduction ? 'Deducted' : 'Awarded'} ${points} points to ${selectedChild.name}`
      );
      
      setShowAwardModal(false);
      setSelectedChild(null);
      setPoints('');
      setIsDeduction(false);
      onRefresh?.();
    } catch (error) {
      Alert.alert('Error', 'Failed to update points');
    } finally {
      setProcessing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    setProcessing(true);
    try {
      // Use the chat API or a notification API
      await apiService.post('/messages', {
        content: message,
        type: 'announcement',
      });
      
      Alert.alert('📨 Sent!', 'Message sent to family');
      setShowMessageModal(false);
      setMessage('');
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setProcessing(false);
    }
  };

  const totalPending = pendingItems.chores.length + pendingItems.shopping.length + pendingItems.redemptions.length;

  if (user?.role !== 'parent') return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="flash" size={18} color="#f59e0b" />
        <Text style={styles.title}>Quick Actions</Text>
        {totalPending > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalPending}</Text>
          </View>
        )}
      </View>

      {/* Quick Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}
          onPress={() => setShowAwardModal(true)}
        >
          <Ionicons name="star" size={20} color="#10b981" />
          <Text style={[styles.actionText, { color: '#10b981' }]}>Award</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}
          onPress={() => { setIsDeduction(true); setShowAwardModal(true); }}
        >
          <Ionicons name="remove-circle" size={20} color="#ef4444" />
          <Text style={[styles.actionText, { color: '#ef4444' }]}>Deduct</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}
          onPress={() => setShowMessageModal(true)}
        >
          <Ionicons name="chatbubble" size={20} color="#6366f1" />
          <Text style={[styles.actionText, { color: '#6366f1' }]}>Message</Text>
        </TouchableOpacity>
      </View>

      {/* Pending Approvals */}
      {totalPending > 0 && (
        <View style={styles.pendingSection}>
          <Text style={styles.pendingTitle}>Pending Approvals</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {pendingItems.chores.slice(0, 3).map((chore) => (
              <View key={chore.chore_id} style={styles.pendingCard}>
                <View style={styles.pendingIconWrapper}>
                  <Ionicons name="checkbox" size={16} color="#10b981" />
                </View>
                <Text style={styles.pendingName} numberOfLines={1}>{chore.title}</Text>
                <Text style={styles.pendingMeta}>{chore.assigned_name || 'Unassigned'}</Text>
                <TouchableOpacity 
                  style={styles.approveBtn}
                  onPress={() => handleApproveChore(chore)}
                  disabled={processing}
                >
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            
            {pendingItems.shopping.slice(0, 3).map((item) => (
              <View key={item.item_id} style={styles.pendingCard}>
                <View style={[styles.pendingIconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Ionicons name="cart" size={16} color="#3b82f6" />
                </View>
                <Text style={styles.pendingName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.pendingMeta}>Shopping</Text>
                <TouchableOpacity 
                  style={[styles.approveBtn, { backgroundColor: '#3b82f6' }]}
                  onPress={() => handleApproveShoppingItem(item)}
                  disabled={processing}
                >
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Award/Deduct Points Modal */}
      <Modal visible={showAwardModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isDeduction ? 'Deduct Points' : 'Award Points'}
              </Text>
              <TouchableOpacity onPress={() => { setShowAwardModal(false); setIsDeduction(false); }}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Select Child</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childRow}>
              {children.map((child) => (
                <TouchableOpacity
                  key={child.user_id}
                  style={[
                    styles.childChip,
                    selectedChild?.user_id === child.user_id && styles.childChipActive
                  ]}
                  onPress={() => setSelectedChild(child)}
                >
                  <View style={styles.childAvatar}>
                    {child.picture ? (
                      <Image source={{ uri: child.picture }} style={styles.childAvatarImage} />
                    ) : (
                      <Text style={styles.childAvatarText}>{child.name?.charAt(0)}</Text>
                    )}
                  </View>
                  <Text style={[
                    styles.childName,
                    selectedChild?.user_id === child.user_id && styles.childNameActive
                  ]}>
                    {child.nickname || child.name}
                  </Text>
                  <Text style={styles.childPoints}>{child.points || 0} pts</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Points</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={points}
              onChangeText={setPoints}
            />

            <TouchableOpacity 
              style={[
                styles.submitBtn,
                { backgroundColor: isDeduction ? '#ef4444' : '#10b981' }
              ]}
              onPress={handleAwardPoints}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isDeduction ? 'Deduct Points' : 'Award Points'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quick Message Modal */}
      <Modal visible={showMessageModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Family Message</Text>
              <TouchableOpacity onPress={() => setShowMessageModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, styles.messageInput]}
              placeholder="Type your message..."
              placeholderTextColor="#6b7280"
              multiline
              value={message}
              onChangeText={setMessage}
            />

            <TouchableOpacity 
              style={[styles.submitBtn, { backgroundColor: '#6366f1' }]}
              onPress={handleSendMessage}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Send to Family</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(30, 27, 75, 0.9)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  badge: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  pendingTitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  pendingCard: {
    backgroundColor: 'rgba(15, 13, 26, 0.8)',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    width: 120,
    alignItems: 'center',
  },
  pendingIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  pendingName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  pendingMeta: {
    color: '#6b7280',
    fontSize: 10,
    marginBottom: 8,
  },
  approveBtn: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e1b4b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  label: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 8,
  },
  childRow: {
    marginBottom: 16,
  },
  childChip: {
    alignItems: 'center',
    padding: 12,
    marginRight: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  childChipActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  childAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  childAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  childAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  childName: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '500',
  },
  childNameActive: {
    color: '#fff',
  },
  childPoints: {
    color: '#fbbf24',
    fontSize: 10,
    marginTop: 2,
  },
  input: {
    backgroundColor: 'rgba(15, 13, 26, 0.8)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  messageInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
