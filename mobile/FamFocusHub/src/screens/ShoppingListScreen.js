import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';

export default function ShoppingListScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [processing, setProcessing] = useState(null);

  const fetchItems = useCallback(async () => {
    try {
      const data = await apiService.getShoppingList();
      setItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch shopping items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  }, [fetchItems]);

  const handleAddItem = async () => {
    if (!newItemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
    
    setProcessing('add');
    try {
      await apiService.addShoppingItem({ name: newItemName });
      setShowAddModal(false);
      setNewItemName('');
      fetchItems();
      Alert.alert('Added!', 'Item added to shopping list');
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setProcessing(null);
    }
  };

  const handleUpdateStatus = async (itemId, status) => {
    setProcessing(itemId);
    try {
      await apiService.updateShoppingItem(itemId, { status });
      fetchItems();
    } catch (error) {
      Alert.alert('Error', 'Failed to update item');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteItem = (item) => {
    Alert.alert(
      'Remove Item',
      `Remove "${item.name}" from the list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setProcessing(item.item_id);
            try {
              await apiService.delete(`/shopping/${item.item_id}`);
              fetchItems();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove item');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

  const pendingItems = items.filter(i => i.status === 'pending');
  const approvedItems = items.filter(i => i.status === 'approved' || !i.status);
  const purchasedItems = items.filter(i => i.status === 'purchased');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <AnimatedBackground page="shopping">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Shopping List</Text>
          <Text style={styles.subtitle}>{approvedItems.length} items to buy</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {/* Pending Approval - Parents Only */}
        {user?.role === 'parent' && pendingItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={18} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Pending Approval</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingItems.length}</Text>
              </View>
            </View>
            {pendingItems.map((item) => (
              <View key={item.item_id} style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.requested_by && (
                    <Text style={styles.itemRequester}>Requested by {item.requested_by}</Text>
                  )}
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity 
                    style={styles.approveBtn}
                    onPress={() => handleUpdateStatus(item.item_id, 'approved')}
                    disabled={processing === item.item_id}
                  >
                    {processing === item.item_id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.rejectBtn}
                    onPress={() => handleUpdateStatus(item.item_id, 'rejected')}
                    disabled={processing === item.item_id}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* To Buy */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cart" size={18} color="#3b82f6" />
            <Text style={styles.sectionTitle}>To Buy</Text>
          </View>
          {approvedItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cart-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyText}>Shopping list is empty!</Text>
              <Text style={styles.emptySubtext}>Tap + to add items</Text>
            </View>
          ) : (
            approvedItems.map((item) => (
              <View key={item.item_id} style={styles.itemCard}>
                <TouchableOpacity 
                  style={styles.checkbox}
                  onPress={() => handleUpdateStatus(item.item_id, 'purchased')}
                  disabled={processing === item.item_id}
                >
                  {processing === item.item_id ? (
                    <ActivityIndicator size="small" color="#3b82f6" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={24} color="#3b82f6" />
                  )}
                </TouchableOpacity>
                <Text style={styles.itemName}>{item.name}</Text>
                <TouchableOpacity 
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteItem(item)}
                >
                  <Ionicons name="trash-outline" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Recently Purchased */}
        {purchasedItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.sectionTitle}>Recently Purchased</Text>
            </View>
            {purchasedItems.map((item) => (
              <View key={item.item_id} style={[styles.itemCard, styles.purchasedCard]}>
                <View style={styles.checkboxDone}>
                  <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                </View>
                <Text style={styles.itemNameDone}>{item.name}</Text>
                <TouchableOpacity 
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteItem(item)}
                >
                  <Ionicons name="trash-outline" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Item Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Item</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Item name"
              placeholderTextColor="#6b7280"
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitBtn, processing === 'add' && styles.submitBtnDisabled]}
                onPress={handleAddItem}
                disabled={processing === 'add'}
              >
                {processing === 'add' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Add Item</Text>
                )}
              </TouchableOpacity>
            </View>
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
  headerContent: { flex: 1, marginLeft: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 13, color: '#a5b4fc', marginTop: 2 },
  addButton: { padding: 10, backgroundColor: '#3b82f6', borderRadius: 14 },
  scrollView: { flex: 1, padding: 16 },
  
  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', flex: 1 },
  badge: { backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { color: '#f59e0b', fontSize: 12, fontWeight: 'bold' },
  
  // Item Cards
  itemCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  purchasedCard: { opacity: 0.6 },
  itemInfo: { flex: 1 },
  itemName: { color: '#fff', fontSize: 15, fontWeight: '500', flex: 1 },
  itemNameDone: { color: '#6b7280', fontSize: 15, textDecorationLine: 'line-through', flex: 1 },
  itemRequester: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  itemActions: { flexDirection: 'row', gap: 8 },
  checkbox: { marginRight: 12 },
  checkboxDone: { marginRight: 12 },
  deleteBtn: { padding: 8 },
  approveBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },
  
  // Empty State
  emptyCard: { backgroundColor: 'rgba(30, 27, 75, 0.5)', borderRadius: 20, padding: 40, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 16, marginTop: 12 },
  emptySubtext: { color: '#4b5563', fontSize: 13, marginTop: 4 },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  input: { backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, backgroundColor: '#374151', paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  submitBtn: { flex: 1, backgroundColor: '#3b82f6', paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
