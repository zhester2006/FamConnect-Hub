import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, RefreshControl, ActivityIndicator, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';

// Common pantry categories
const PANTRY_CATEGORIES = [
  { id: 'produce', name: 'Produce', icon: 'nutrition', color: '#22c55e' },
  { id: 'dairy', name: 'Dairy', icon: 'water', color: '#60a5fa' },
  { id: 'meat', name: 'Meat & Protein', icon: 'fitness', color: '#ef4444' },
  { id: 'grains', name: 'Grains & Bread', icon: 'cube', color: '#f59e0b' },
  { id: 'canned', name: 'Canned Goods', icon: 'file-tray-stacked', color: '#8b5cf6' },
  { id: 'frozen', name: 'Frozen', icon: 'snow', color: '#06b6d4' },
  { id: 'seasonings', name: 'Seasonings & Spices', icon: 'leaf', color: '#84cc16' },
  { id: 'snacks', name: 'Snacks', icon: 'fast-food', color: '#f472b6' },
  { id: 'beverages', name: 'Beverages', icon: 'cafe', color: '#a78bfa' },
  { id: 'other', name: 'Other', icon: 'ellipsis-horizontal', color: '#6b7280' },
];

// Quick select common items
const QUICK_SELECT_ITEMS = [
  { name: 'Milk', category: 'dairy' },
  { name: 'Eggs', category: 'dairy' },
  { name: 'Butter', category: 'dairy' },
  { name: 'Cheese', category: 'dairy' },
  { name: 'Bread', category: 'grains' },
  { name: 'Rice', category: 'grains' },
  { name: 'Pasta', category: 'grains' },
  { name: 'Chicken', category: 'meat' },
  { name: 'Ground Beef', category: 'meat' },
  { name: 'Bacon', category: 'meat' },
  { name: 'Apples', category: 'produce' },
  { name: 'Bananas', category: 'produce' },
  { name: 'Onions', category: 'produce' },
  { name: 'Potatoes', category: 'produce' },
  { name: 'Tomatoes', category: 'produce' },
  { name: 'Lettuce', category: 'produce' },
  { name: 'Salt', category: 'seasonings' },
  { name: 'Pepper', category: 'seasonings' },
  { name: 'Olive Oil', category: 'seasonings' },
  { name: 'Garlic', category: 'seasonings' },
  { name: 'Chips', category: 'snacks' },
  { name: 'Cereal', category: 'grains' },
  { name: 'Juice', category: 'beverages' },
  { name: 'Coffee', category: 'beverages' },
];

export default function PantryScreen({ navigation }) {
  const { user } = useAuth();
  const theme = useTheme();
  const primaryColor = theme?.primary || '#6366f1';
  
  const [pantryItems, setPantryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const [showAiAssist, setShowAiAssist] = useState(false);
  
  // New item form
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('other');
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  
  // AI assist
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const fetchPantryItems = useCallback(async () => {
    try {
      const data = await apiService.getPantryItems();
      setPantryItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch pantry items:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPantryItems();
  }, [fetchPantryItems]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPantryItems();
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const newItem = {
        name: newItemName.trim(),
        category: newItemCategory,
        quantity: parseInt(newItemQuantity) || 1,
      };
      
      await apiService.addPantryItem(newItem);
      
      // Ask if user wants to remove from shopping list
      const existsInShopping = await checkShoppingList(newItemName);
      if (existsInShopping) {
        Alert.alert(
          'Remove from Shopping List?',
          `"${newItemName}" is on your shopping list. Would you like to remove it since it's now in your pantry?`,
          [
            { text: 'Keep in List', style: 'cancel' },
            { 
              text: 'Remove', 
              onPress: () => removeFromShoppingList(newItemName),
              style: 'destructive'
            },
          ]
        );
      }
      
      setShowAddModal(false);
      resetForm();
      fetchPantryItems();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const handleRemoveItem = async (item) => {
    Alert.alert(
      'Remove Item',
      `Remove "${item.name}" from pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove & Add to Shopping', 
          onPress: async () => {
            await removeItem(item);
            await addToShoppingList(item.name);
          }
        },
        { 
          text: 'Just Remove', 
          style: 'destructive',
          onPress: () => removeItem(item)
        },
      ]
    );
  };

  const removeItem = async (item) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await apiService.removePantryItem(item.item_id);
      fetchPantryItems();
    } catch (error) {
      Alert.alert('Error', 'Failed to remove item');
    }
  };

  const checkShoppingList = async (itemName) => {
    try {
      const data = await apiService.getShoppingList();
      return (data.items || []).some(
        item => item.name.toLowerCase() === itemName.toLowerCase()
      );
    } catch (error) {
      return false;
    }
  };

  const removeFromShoppingList = async (itemName) => {
    try {
      const data = await apiService.getShoppingList();
      const item = (data.items || []).find(
        i => i.name.toLowerCase() === itemName.toLowerCase()
      );
      if (item) {
        await apiService.deleteShoppingItem(item.item_id);
      }
    } catch (error) {
      console.error('Failed to remove from shopping list:', error);
    }
  };

  const addToShoppingList = async (itemName) => {
    try {
      await apiService.addShoppingItem({ name: itemName, category: 'pantry' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Added', `"${itemName}" added to shopping list`);
    } catch (error) {
      console.error('Failed to add to shopping list:', error);
    }
  };

  const handleQuickSelect = async (item) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      await apiService.addPantryItem({
        name: item.name,
        category: item.category,
        quantity: 1,
      });
      
      fetchPantryItems();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const handleAiAssist = async () => {
    setAiLoading(true);
    try {
      const data = await apiService.getAiPantrySuggestions(pantryItems);
      setAiSuggestions(data.suggestions || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to get AI suggestions');
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateMealsFromPantry = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const pantryNames = pantryItems.map(i => i.name).join(', ');
      navigation.navigate('DinnerPlanner', { pantryItems: pantryNames });
    } catch (error) {
      Alert.alert('Error', 'Failed to navigate');
    }
  };

  const handleGenerateShoppingFromPantry = async () => {
    setAiLoading(true);
    try {
      const data = await apiService.getAiShoppingSuggestions(pantryItems);
      const suggestions = data.suggestions || [];
      
      if (suggestions.length > 0) {
        Alert.alert(
          'AI Shopping Suggestions',
          `Based on your pantry, you might need:\n\n${suggestions.map(s => `• ${s}`).join('\n')}`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Add All to List',
              onPress: async () => {
                for (const item of suggestions) {
                  await apiService.addShoppingItem({ name: item, category: 'ai-suggested' });
                }
                Alert.alert('Added!', 'Items added to shopping list');
              }
            },
          ]
        );
      } else {
        Alert.alert('All Stocked!', 'Your pantry looks well-stocked!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get suggestions');
    } finally {
      setAiLoading(false);
    }
  };

  const resetForm = () => {
    setNewItemName('');
    setNewItemCategory('other');
    setNewItemQuantity('1');
  };

  const getCategory = (id) => PANTRY_CATEGORIES.find(c => c.id === id) || PANTRY_CATEGORIES[9];

  const filteredItems = pantryItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedItems = PANTRY_CATEGORIES.map(cat => ({
    ...cat,
    items: filteredItems.filter(item => item.category === cat.id),
  })).filter(cat => cat.items.length > 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <AnimatedBackground page="shopping">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Pantry</Text>
        <TouchableOpacity onPress={() => setShowQuickSelect(true)} style={styles.quickAddBtn}>
          <Ionicons name="flash" size={20} color={primaryColor} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search pantry..."
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
        <TouchableOpacity
          style={[styles.categoryChip, selectedCategory === 'all' && { backgroundColor: primaryColor }]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text style={[styles.categoryChipText, selectedCategory === 'all' && { color: '#fff' }]}>All</Text>
        </TouchableOpacity>
        {PANTRY_CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryChip, selectedCategory === cat.id && { backgroundColor: cat.color }]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Ionicons name={cat.icon} size={14} color={selectedCategory === cat.id ? '#fff' : cat.color} />
            <Text style={[styles.categoryChipText, selectedCategory === cat.id && { color: '#fff' }]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{pantryItems.length}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{new Set(pantryItems.map(i => i.category)).size}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
        <TouchableOpacity style={[styles.aiBtn, { borderColor: primaryColor }]} onPress={handleGenerateMealsFromPantry}>
          <Ionicons name="restaurant" size={16} color={primaryColor} />
          <Text style={[styles.aiBtnText, { color: primaryColor }]}>Plan Meals</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.aiBtn, { borderColor: '#f59e0b' }]} onPress={handleGenerateShoppingFromPantry} disabled={aiLoading}>
          {aiLoading ? (
            <ActivityIndicator size="small" color="#f59e0b" />
          ) : (
            <>
              <Ionicons name="cart" size={16} color="#f59e0b" />
              <Text style={[styles.aiBtnText, { color: '#f59e0b' }]}>Need List</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Pantry Items */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        {groupedItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color="#4b5563" />
            <Text style={styles.emptyTitle}>Pantry is Empty</Text>
            <Text style={styles.emptyText}>Add items to track what's in your kitchen</Text>
            <TouchableOpacity style={[styles.addFirstBtn, { backgroundColor: primaryColor }]} onPress={() => setShowAddModal(true)}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addFirstBtnText}>Add First Item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          groupedItems.map(category => (
            <View key={category.id} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
                  <Ionicons name={category.icon} size={18} color={category.color} />
                </View>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryCount}>{category.items.length}</Text>
              </View>
              {category.items.map(item => (
                <TouchableOpacity
                  key={item.item_id}
                  style={styles.pantryItem}
                  onLongPress={() => handleRemoveItem(item)}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.quantity > 1 && (
                      <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                    )}
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity onPress={() => addToShoppingList(item.name)} style={styles.itemAction}>
                      <Ionicons name="cart-outline" size={18} color="#6b7280" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemoveItem(item)} style={styles.itemAction}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: primaryColor }]}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Pantry Item</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Item Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Chicken Breast"
              placeholderTextColor="#6b7280"
              value={newItemName}
              onChangeText={setNewItemName}
            />

            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
              {PANTRY_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryOption, newItemCategory === cat.id && { backgroundColor: cat.color }]}
                  onPress={() => setNewItemCategory(cat.id)}
                >
                  <Ionicons name={cat.icon} size={16} color={newItemCategory === cat.id ? '#fff' : cat.color} />
                  <Text style={[styles.categoryOptionText, newItemCategory === cat.id && { color: '#fff' }]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Quantity</Text>
            <View style={styles.quantityRow}>
              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={() => setNewItemQuantity(String(Math.max(1, parseInt(newItemQuantity) - 1)))}
              >
                <Ionicons name="remove" size={20} color="#fff" />
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                value={newItemQuantity}
                onChangeText={setNewItemQuantity}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={() => setNewItemQuantity(String(parseInt(newItemQuantity) + 1))}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: primaryColor }]} onPress={handleAddItem}>
              <Text style={styles.saveBtnText}>Add to Pantry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quick Select Modal */}
      <Modal visible={showQuickSelect} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quick Add Items</Text>
              <TouchableOpacity onPress={() => setShowQuickSelect(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <Text style={styles.quickSelectHint}>Tap items to add to pantry</Text>
            <FlatList
              data={QUICK_SELECT_ITEMS}
              keyExtractor={(item) => item.name}
              numColumns={2}
              renderItem={({ item }) => {
                const cat = getCategory(item.category);
                const isInPantry = pantryItems.some(p => p.name.toLowerCase() === item.name.toLowerCase());
                return (
                  <TouchableOpacity
                    style={[styles.quickItem, isInPantry && styles.quickItemAdded]}
                    onPress={() => !isInPantry && handleQuickSelect(item)}
                    disabled={isInPantry}
                  >
                    <Ionicons name={cat.icon} size={16} color={isInPantry ? '#10b981' : cat.color} />
                    <Text style={[styles.quickItemText, isInPantry && { color: '#10b981' }]}>{item.name}</Text>
                    {isInPantry && <Ionicons name="checkmark-circle" size={14} color="#10b981" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16 },
  backBtn: { padding: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff' },
  quickAddBtn: { padding: 8, backgroundColor: 'rgba(99, 102, 241, 0.15)', borderRadius: 8 },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.8)', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 12, paddingLeft: 8, color: '#fff', fontSize: 14 },
  
  categoryFilter: { paddingHorizontal: 16, marginBottom: 12 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 20, marginRight: 8, gap: 6 },
  categoryChipText: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  
  statsBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, gap: 12 },
  stat: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: '#6b7280' },
  aiBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1, gap: 4 },
  aiBtnText: { fontSize: 11, fontWeight: '600' },
  
  content: { flex: 1, paddingHorizontal: 16 },
  
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#6b7280', marginTop: 8 },
  addFirstBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, marginTop: 20, gap: 8 },
  addFirstBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  
  categorySection: { marginBottom: 20 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  categoryIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  categoryName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#fff' },
  categoryCount: { fontSize: 12, color: '#6b7280', backgroundColor: 'rgba(30, 41, 59, 0.8)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  
  pantryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 12, padding: 14, marginBottom: 8 },
  itemInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { fontSize: 14, color: '#fff', fontWeight: '500' },
  itemQuantity: { fontSize: 12, color: '#6b7280', backgroundColor: 'rgba(107, 114, 128, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  itemActions: { flexDirection: 'row', gap: 12 },
  itemAction: { padding: 4 },
  
  fab: { position: 'absolute', right: 20, bottom: 90, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#9ca3af', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 12, padding: 14, color: '#fff', fontSize: 14 },
  
  categoryPicker: { flexDirection: 'row', marginBottom: 8 },
  categoryOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 12, marginRight: 8, gap: 6 },
  categoryOptionText: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quantityBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(99, 102, 241, 0.3)', justifyContent: 'center', alignItems: 'center' },
  quantityInput: { flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, textAlign: 'center' },
  
  saveBtn: { marginTop: 20, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  quickSelectHint: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  quickItem: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 10, padding: 10, margin: 4, gap: 6 },
  quickItemAdded: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: '#10b981' },
  quickItemText: { fontSize: 12, color: '#fff', flex: 1 },
});
