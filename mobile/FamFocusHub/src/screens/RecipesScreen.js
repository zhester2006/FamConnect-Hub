import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, RefreshControl, ActivityIndicator, FlatList, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';

const MEAL_CATEGORIES = [
  { id: 'breakfast', name: 'Breakfast', icon: 'sunny', color: '#f59e0b' },
  { id: 'lunch', name: 'Lunch', icon: 'restaurant', color: '#10b981' },
  { id: 'dinner', name: 'Dinner', icon: 'moon', color: '#6366f1' },
  { id: 'snack', name: 'Snacks', icon: 'cafe', color: '#ec4899' },
  { id: 'dessert', name: 'Desserts', icon: 'ice-cream', color: '#8b5cf6' },
  { id: 'side', name: 'Sides', icon: 'leaf', color: '#14b8a6' },
];

const DIFFICULTY_LEVELS = [
  { id: 'easy', name: 'Easy', color: '#10b981', time: '< 30 min' },
  { id: 'medium', name: 'Medium', color: '#f59e0b', time: '30-60 min' },
  { id: 'hard', name: 'Advanced', color: '#ef4444', time: '60+ min' },
];

export default function RecipesScreen({ navigation }) {
  const { user } = useAuth();
  const theme = useTheme();
  const primaryColor = theme?.primary || '#6366f1';
  
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  
  // New recipe form
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    category: 'dinner',
    difficulty: 'medium',
    prepTime: '30',
    servings: '4',
    description: '',
    ingredients: '',
    instructions: '',
    image: null,
    tags: [],
  });

  const fetchRecipes = useCallback(async () => {
    try {
      const data = await apiService.getRecipes();
      setRecipes(data.recipes || []);
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecipes();
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        setNewRecipe(prev => ({ ...prev, image: result.assets[0].uri }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSaveRecipe = async () => {
    if (!newRecipe.name.trim()) {
      Alert.alert('Error', 'Please enter a recipe name');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const recipeData = {
        name: newRecipe.name.trim(),
        category: newRecipe.category,
        difficulty: newRecipe.difficulty,
        prep_time: parseInt(newRecipe.prepTime) || 30,
        servings: parseInt(newRecipe.servings) || 4,
        description: newRecipe.description.trim(),
        ingredients: newRecipe.ingredients.split('\n').filter(i => i.trim()),
        instructions: newRecipe.instructions.split('\n').filter(i => i.trim()),
        image: newRecipe.image,
        tags: newRecipe.tags,
      };
      
      await apiService.createRecipe(recipeData);
      
      setShowAddModal(false);
      resetForm();
      fetchRecipes();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved!', 'Your recipe has been added to the family cookbook');
    } catch (error) {
      Alert.alert('Error', 'Failed to save recipe');
    }
  };

  const handleDeleteRecipe = async (recipe) => {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${recipe.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteRecipe(recipe.recipe_id);
              fetchRecipes();
              setShowDetailModal(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete recipe');
            }
          }
        },
      ]
    );
  };

  const handleAddToMealPlan = async (recipe) => {
    Alert.alert(
      'Add to Meal Plan',
      'Which day would you like to add this recipe?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Today', onPress: () => addToDay(recipe, 'today') },
        { text: 'Tomorrow', onPress: () => addToDay(recipe, 'tomorrow') },
        { text: 'This Week', onPress: () => navigation.navigate('DinnerPlanner', { suggestedRecipe: recipe.name }) },
      ]
    );
  };

  const addToDay = async (recipe, day) => {
    try {
      await apiService.updateDinnerPlan(day, recipe.category, recipe.name);
      Alert.alert('Added!', `${recipe.name} added to ${day}'s meal plan`);
    } catch (error) {
      Alert.alert('Error', 'Failed to add to meal plan');
    }
  };

  const handleAddIngredientsToShopping = async (recipe) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      for (const ingredient of recipe.ingredients || []) {
        await apiService.addShoppingItem({ 
          name: ingredient,
          category: 'recipe'
        });
      }
      
      Alert.alert('Added!', `${recipe.ingredients?.length || 0} ingredients added to shopping list`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Failed to add ingredients');
    }
  };

  const resetForm = () => {
    setNewRecipe({
      name: '',
      category: 'dinner',
      difficulty: 'medium',
      prepTime: '30',
      servings: '4',
      description: '',
      ingredients: '',
      instructions: '',
      image: null,
      tags: [],
    });
  };

  const getCategory = (id) => MEAL_CATEGORIES.find(c => c.id === id) || MEAL_CATEGORIES[2];
  const getDifficulty = (id) => DIFFICULTY_LEVELS.find(d => d.id === id) || DIFFICULTY_LEVELS[1];

  const filteredRecipes = recipes.filter(recipe => {
    const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory;
    const matchesSearch = recipe.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <AnimatedBackground page="dinner">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Family Recipes</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.addBtn, { backgroundColor: primaryColor }]}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes..."
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Filter - Compact Icon Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
        <TouchableOpacity
          style={[styles.categoryChip, selectedCategory === 'all' && { backgroundColor: primaryColor }]}
          onPress={() => setSelectedCategory('all')}
        >
          <Ionicons name="apps" size={18} color={selectedCategory === 'all' ? '#fff' : '#9ca3af'} />
        </TouchableOpacity>
        {MEAL_CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryChip, selectedCategory === cat.id && { backgroundColor: cat.color }]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Ionicons name={cat.icon} size={18} color={selectedCategory === cat.id ? '#fff' : cat.color} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recipes Grid */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        {filteredRecipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={64} color="#4b5563" />
            <Text style={styles.emptyTitle}>No Recipes Yet</Text>
            <Text style={styles.emptyText}>Start building your family cookbook!</Text>
            <TouchableOpacity 
              style={[styles.addFirstBtn, { backgroundColor: primaryColor }]} 
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addFirstBtnText}>Add First Recipe</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.recipesGrid}>
            {filteredRecipes.map(recipe => {
              const cat = getCategory(recipe.category);
              const diff = getDifficulty(recipe.difficulty);
              
              return (
                <TouchableOpacity
                  key={recipe.recipe_id}
                  style={styles.recipeCard}
                  onPress={() => { setSelectedRecipe(recipe); setShowDetailModal(true); }}
                  activeOpacity={0.8}
                >
                  {recipe.image ? (
                    <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
                  ) : (
                    <LinearGradient
                      colors={[cat.color, `${cat.color}80`]}
                      style={styles.recipeImagePlaceholder}
                    >
                      <Ionicons name={cat.icon} size={40} color="#fff" />
                    </LinearGradient>
                  )}
                  <View style={styles.recipeInfo}>
                    <Text style={styles.recipeName} numberOfLines={1}>{recipe.name}</Text>
                    <View style={styles.recipeMeta}>
                      <View style={[styles.categoryBadge, { backgroundColor: `${cat.color}20` }]}>
                        <Text style={[styles.categoryBadgeText, { color: cat.color }]}>{cat.name}</Text>
                      </View>
                      <View style={styles.recipeStats}>
                        <Ionicons name="time-outline" size={12} color="#6b7280" />
                        <Text style={styles.recipeStatText}>{recipe.prep_time || 30}m</Text>
                      </View>
                    </View>
                    <View style={[styles.difficultyBadge, { backgroundColor: `${diff.color}20` }]}>
                      <View style={[styles.difficultyDot, { backgroundColor: diff.color }]} />
                      <Text style={[styles.difficultyText, { color: diff.color }]}>{diff.name}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Recipe Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Recipe</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Image Picker */}
              <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
                {newRecipe.image ? (
                  <Image source={{ uri: newRecipe.image }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="camera" size={32} color="#6b7280" />
                    <Text style={styles.imagePickerText}>Add Photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Recipe Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Mom's Famous Lasagna"
                placeholderTextColor="#6b7280"
                value={newRecipe.name}
                onChangeText={(text) => setNewRecipe(prev => ({ ...prev, name: text }))}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionRow}>
                {MEAL_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.optionChip, newRecipe.category === cat.id && { backgroundColor: cat.color }]}
                    onPress={() => setNewRecipe(prev => ({ ...prev, category: cat.id }))}
                  >
                    <Ionicons name={cat.icon} size={14} color={newRecipe.category === cat.id ? '#fff' : cat.color} />
                    <Text style={[styles.optionChipText, newRecipe.category === cat.id && { color: '#fff' }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Difficulty</Text>
              <View style={styles.difficultyRow}>
                {DIFFICULTY_LEVELS.map(diff => (
                  <TouchableOpacity
                    key={diff.id}
                    style={[styles.difficultyOption, newRecipe.difficulty === diff.id && { backgroundColor: diff.color }]}
                    onPress={() => setNewRecipe(prev => ({ ...prev, difficulty: diff.id }))}
                  >
                    <Text style={[styles.difficultyOptionText, newRecipe.difficulty === diff.id && { color: '#fff' }]}>
                      {diff.name}
                    </Text>
                    <Text style={[styles.difficultyTime, newRecipe.difficulty === diff.id && { color: '#fff' }]}>
                      {diff.time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Prep Time (min)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="30"
                    placeholderTextColor="#6b7280"
                    keyboardType="number-pad"
                    value={newRecipe.prepTime}
                    onChangeText={(text) => setNewRecipe(prev => ({ ...prev, prepTime: text }))}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Servings</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="4"
                    placeholderTextColor="#6b7280"
                    keyboardType="number-pad"
                    value={newRecipe.servings}
                    onChangeText={(text) => setNewRecipe(prev => ({ ...prev, servings: text }))}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="A brief description of the dish..."
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={2}
                value={newRecipe.description}
                onChangeText={(text) => setNewRecipe(prev => ({ ...prev, description: text }))}
              />

              <Text style={styles.inputLabel}>Ingredients (one per line)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="1 cup flour&#10;2 eggs&#10;1/2 cup milk"
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={4}
                value={newRecipe.ingredients}
                onChangeText={(text) => setNewRecipe(prev => ({ ...prev, ingredients: text }))}
              />

              <Text style={styles.inputLabel}>Instructions (one step per line)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Preheat oven to 350°F&#10;Mix dry ingredients&#10;Add wet ingredients"
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={4}
                value={newRecipe.instructions}
                onChangeText={(text) => setNewRecipe(prev => ({ ...prev, instructions: text }))}
              />

              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: primaryColor }]} 
                onPress={handleSaveRecipe}
              >
                <Ionicons name="bookmark" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Save Recipe</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Recipe Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '95%' }]}>
            {selectedRecipe && (
              <>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle} numberOfLines={1}>{selectedRecipe.name}</Text>
                  <TouchableOpacity onPress={() => handleDeleteRecipe(selectedRecipe)}>
                    <Ionicons name="trash-outline" size={22} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {selectedRecipe.image ? (
                    <Image source={{ uri: selectedRecipe.image }} style={styles.detailImage} />
                  ) : (
                    <LinearGradient
                      colors={[getCategory(selectedRecipe.category).color, '#1e1b4b']}
                      style={styles.detailImagePlaceholder}
                    >
                      <Ionicons name={getCategory(selectedRecipe.category).icon} size={60} color="#fff" />
                    </LinearGradient>
                  )}

                  {/* Quick Actions */}
                  <View style={styles.quickActions}>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: primaryColor }]}
                      onPress={() => handleAddToMealPlan(selectedRecipe)}
                    >
                      <Ionicons name="calendar" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Add to Plan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
                      onPress={() => handleAddIngredientsToShopping(selectedRecipe)}
                    >
                      <Ionicons name="cart" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Shop Ingredients</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Stats */}
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Ionicons name="time" size={20} color="#f59e0b" />
                      <Text style={styles.statValue}>{selectedRecipe.prep_time || 30} min</Text>
                      <Text style={styles.statLabel}>Prep Time</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="people" size={20} color="#6366f1" />
                      <Text style={styles.statValue}>{selectedRecipe.servings || 4}</Text>
                      <Text style={styles.statLabel}>Servings</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="speedometer" size={20} color={getDifficulty(selectedRecipe.difficulty).color} />
                      <Text style={styles.statValue}>{getDifficulty(selectedRecipe.difficulty).name}</Text>
                      <Text style={styles.statLabel}>Difficulty</Text>
                    </View>
                  </View>

                  {/* Description */}
                  {selectedRecipe.description && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>About</Text>
                      <Text style={styles.descriptionText}>{selectedRecipe.description}</Text>
                    </View>
                  )}

                  {/* Ingredients */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Ingredients</Text>
                    {(selectedRecipe.ingredients || []).map((ing, i) => (
                      <View key={i} style={styles.ingredientItem}>
                        <View style={styles.checkCircle} />
                        <Text style={styles.ingredientText}>{ing}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Instructions */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Instructions</Text>
                    {(selectedRecipe.instructions || []).map((step, i) => (
                      <View key={i} style={styles.stepItem}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
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
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.8)', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 12, paddingLeft: 8, color: '#fff', fontSize: 14 },
  
  categoryFilter: { paddingHorizontal: 16, marginBottom: 12 },
  categoryChip: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40, backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 20, marginRight: 8 },
  categoryChipText: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  
  content: { flex: 1, paddingHorizontal: 16 },
  
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#6b7280', marginTop: 8 },
  addFirstBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, marginTop: 20, gap: 8 },
  addFirstBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  
  recipesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  recipeCard: { width: '48%', backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  recipeImage: { width: '100%', height: 100, backgroundColor: '#1e293b' },
  recipeImagePlaceholder: { width: '100%', height: 100, justifyContent: 'center', alignItems: 'center' },
  recipeInfo: { padding: 10 },
  recipeName: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 6 },
  recipeMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  categoryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryBadgeText: { fontSize: 10, fontWeight: '600' },
  recipeStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recipeStatText: { fontSize: 10, color: '#6b7280' },
  difficultyBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', gap: 4 },
  difficultyDot: { width: 6, height: 6, borderRadius: 3 },
  difficultyText: { fontSize: 10, fontWeight: '500' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 },
  modalTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#fff' },
  
  imagePicker: { width: '100%', height: 150, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerPlaceholder: { width: '100%', height: '100%', backgroundColor: 'rgba(30, 41, 59, 0.8)', justifyContent: 'center', alignItems: 'center' },
  imagePickerText: { color: '#6b7280', marginTop: 8 },
  
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#9ca3af', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 12, padding: 14, color: '#fff', fontSize: 14 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  
  optionRow: { marginBottom: 8 },
  optionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 12, marginRight: 8, gap: 6 },
  optionChipText: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  
  difficultyRow: { flexDirection: 'row', gap: 8 },
  difficultyOption: { flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 12, padding: 12, alignItems: 'center' },
  difficultyOptionText: { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  difficultyTime: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  detailImage: { width: '100%', height: 200, borderRadius: 16 },
  detailImagePlaceholder: { width: '100%', height: 200, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  
  quickActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, paddingVertical: 16, backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 4 },
  statLabel: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  descriptionText: { fontSize: 14, color: '#9ca3af', lineHeight: 20 },
  
  ingredientItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  checkCircle: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  ingredientText: { fontSize: 14, color: '#e2e8f0' },
  
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(99, 102, 241, 0.2)', justifyContent: 'center', alignItems: 'center' },
  stepNumberText: { fontSize: 12, fontWeight: '700', color: '#a5b4fc' },
  stepText: { flex: 1, fontSize: 14, color: '#e2e8f0', lineHeight: 20 },
});
