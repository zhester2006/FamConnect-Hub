import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, Alert, Switch 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';

const CATEGORIES = [
  { key: 'all', label: 'All', icon: 'list' },
  { key: 'groceries', label: 'Groceries', icon: 'basket' },
  { key: 'household', label: 'Household', icon: 'home' },
  { key: 'requested', label: 'Requests', icon: 'hand-left' },
];

export default function ShoppingListScreen({ navigation }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newCategory, setNewCategory] = useState('groceries');
  const [isUrgent, setIsUrgent] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const data = await apiService.getShoppingList();
      setItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch shopping list:', error);
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
    if (!newItem.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    setAdding(true);
    try {
      await apiService.addShoppingItem({
        name: newItem,
        category: newCategory,
        urgent: isUrgent,
        requested_by: user?.user_id,
      });
      
      setNewItem('');
      setIsUrgent(false);
      setShowAddModal(false);
      fetchItems();
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleItem = async (itemId, completed) => {
    try {
      await apiService.updateShoppingItem(itemId, { completed: !completed });
      fetchItems();
    } catch (error) {
      console.error('Failed to toggle item:', error);
    }
  };

  const handleDeleteItem = async (itemId) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteShoppingItem(itemId);
              fetchItems();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const filteredItems = items.filter(item => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'requested') return item.is_request;
    return item.category === activeCategory;
  });

  const pendingItems = filteredItems.filter(i => !i.completed);
  const completedItems = filteredItems.filter(i => i.completed);

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.itemCard, item.completed && styles.itemCompleted]}
      onPress={() => handleToggleItem(item.item_id, item.completed)}
      onLongPress={() => handleDeleteItem(item.item_id)}
    >
      <View style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
        {item.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
      
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={[styles.itemName, item.completed && styles.itemNameCompleted]}>
            {item.name}
          </Text>
          {item.urgent && (
            <View style={styles.urgentBadge}>
              <Ionicons name="alert-circle" size={14} color="#ef4444" />
            </View>
          )}
          {item.is_request && (
            <View style={styles.requestBadge}>
              <Ionicons name="hand-left" size={12} color="#818cf8" />
            </View>
          )}
        </View>
        <View style={styles.itemMeta}>
          <Text style={styles.itemCategory}>{item.category}</Text>
          {item.requested_by_name && (
            <Text style={styles.requestedBy}>by {item.requested_by_name}</Text>
          )}
        </View>
      </View>

      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => handleDeleteItem(item.item_id)}
      >
        <Ionicons name="trash-outline" size={18} color="#6b7280" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#1e1b4b']}
        style={styles.gradient}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Shopping List</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <View style={styles.categories}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.categoryButton, activeCategory === cat.key && styles.categoryActive]}
            onPress={() => setActiveCategory(cat.key)}
          >
            <Ionicons 
              name={cat.icon} 
              size={18} 
              color={activeCategory === cat.key ? '#818cf8' : '#9ca3af'} 
            />
            <Text style={[styles.categoryText, activeCategory === cat.key && styles.categoryTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pendingItems.length}</Text>
          <Text style={styles.statLabel}>To Buy</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#10b981' }]}>{completedItems.length}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#ef4444' }]}>
            {pendingItems.filter(i => i.urgent).length}
          </Text>
          <Text style={styles.statLabel}>Urgent</Text>
        </View>
      </View>

      {/* Items List */}
      <FlatList
        data={[...pendingItems, ...completedItems]}
        keyExtractor={item => item.item_id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={60} color="#6b7280" />
            <Text style={styles.emptyText}>Shopping list is empty</Text>
            <Text style={styles.emptySubtext}>Add items to get started</Text>
          </View>
        }
      />

      {/* Add Item Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
      >
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
              value={newItem}
              onChangeText={setNewItem}
              autoFocus
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.categorySelector}>
              {[
                { key: 'groceries', label: 'Groceries' },
                { key: 'household', label: 'Household' },
                { key: 'other', label: 'Other' },
              ].map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.catOption, newCategory === cat.key && styles.catOptionActive]}
                  onPress={() => setNewCategory(cat.key)}
                >
                  <Text style={[styles.catOptionText, newCategory === cat.key && styles.catOptionTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.urgentRow}>
              <Text style={styles.urgentLabel}>Mark as urgent</Text>
              <Switch
                value={isUrgent}
                onValueChange={setIsUrgent}
                trackColor={{ false: '#374151', true: '#818cf8' }}
                thumbColor={isUrgent ? '#fff' : '#9ca3af'}
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, adding && styles.submitButtonDisabled]}
              onPress={handleAddItem}
              disabled={adding}
            >
              {adding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Add to List</Text>
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
    flex: 1,
    backgroundColor: '#0f0d1a',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0d1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#818cf8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categories: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    gap: 6,
  },
  categoryActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#818cf8',
  },
  categoryText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  categoryTextActive: {
    color: '#818cf8',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#818cf8',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 100,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.6)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  itemCompleted: {
    opacity: 0.6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#818cf8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#818cf8',
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  itemNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  urgentBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 4,
    borderRadius: 6,
  },
  requestBadge: {
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    padding: 4,
    borderRadius: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 8,
  },
  itemCategory: {
    color: '#6b7280',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  requestedBy: {
    color: '#818cf8',
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  label: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  categorySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  catOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  catOptionActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#818cf8',
  },
  catOptionText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  catOptionTextActive: {
    color: '#818cf8',
  },
  urgentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  urgentLabel: {
    color: '#fff',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#818cf8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
