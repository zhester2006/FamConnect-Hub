import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, TextInput, Alert, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api.service';
import AnimatedBackground from '../components/AnimatedBackground';
import AIMealCard from '../components/AIMealCard';
import WeeklyMealPlan from '../components/WeeklyMealPlan';

const DEFAULT_QUICK_MEALS = [
  { id: '1', name: 'Pasta Night', icon: '🍝', pref: 'Italian pasta dishes' },
  { id: '2', name: 'Taco Tuesday', icon: '🌮', pref: 'Mexican tacos and sides' },
  { id: '3', name: 'Pizza Party', icon: '🍕', pref: 'Homemade pizza' },
  { id: '4', name: 'Stir Fry', icon: '🥘', pref: 'Asian stir fry dishes' },
  { id: '5', name: 'Burger Night', icon: '🍔', pref: 'Gourmet burgers' },
  { id: '6', name: 'Soup & Salad', icon: '🥗', pref: 'Light healthy soups and salads' },
  { id: '7', name: 'Breakfast for Dinner', icon: '🥞', pref: 'Breakfast foods for dinner' },
  { id: '8', name: 'BBQ Night', icon: '🍖', pref: 'Grilled meats and BBQ' },
];

const AVAILABLE_ICONS = ['🍝', '🌮', '🍕', '🥘', '🍔', '🥗', '🥞', '🍖', '🍣', '🥪', '🍜', '🥙', '🍲', '🥩', '🍛', '🥧'];

export default function DinnerPlannerScreen({ navigation, route }) {
  const { user } = useAuth();
  const theme = useTheme();
  const primaryColor = theme?.primary || '#6366f1';
  const [loading, setLoading] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Form data
  const [ingredients, setIngredients] = useState('');
  const [preferences, setPreferences] = useState('');
  const [familySize, setFamilySize] = useState(4);
  const [budget, setBudget] = useState('moderate');
  const [usePantry, setUsePantry] = useState(true);
  
  // Pantry summary
  const [pantrySummary, setPantrySummary] = useState(null);
  const [pantryLoading, setPantryLoading] = useState(false);
  
  // Quick meals management
  const [quickMeals, setQuickMeals] = useState(DEFAULT_QUICK_MEALS);
  const [showMealEditor, setShowMealEditor] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [mealName, setMealName] = useState('');
  const [mealIcon, setMealIcon] = useState('🍽️');
  const [mealPref, setMealPref] = useState('');
  
  // Check for pantry items passed from PantryScreen
  useEffect(() => {
    if (route?.params?.pantryItems) {
      setIngredients(route.params.pantryItems);
    }
  }, [route?.params?.pantryItems]);
  
  // Load saved quick meals
  useEffect(() => {
    loadQuickMeals();
  }, []);
  
  const loadQuickMeals = async () => {
    try {
      const saved = await AsyncStorage.getItem('famfocus_quick_meals');
      if (saved) {
        setQuickMeals(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load quick meals:', error);
    }
  };
  
  const saveQuickMeals = async (meals) => {
    try {
      await AsyncStorage.setItem('famfocus_quick_meals', JSON.stringify(meals));
      setQuickMeals(meals);
    } catch (error) {
      console.error('Failed to save quick meals:', error);
    }
  };
  
  const handleAddEditMeal = () => {
    if (!mealName.trim() || !mealPref.trim()) {
      Alert.alert('Missing Info', 'Please enter a name and description for the meal');
      return;
    }
    
    let updatedMeals;
    if (editingMeal) {
      updatedMeals = quickMeals.map(m => 
        m.id === editingMeal.id 
          ? { ...m, name: mealName, icon: mealIcon, pref: mealPref }
          : m
      );
    } else {
      const newMeal = {
        id: Date.now().toString(),
        name: mealName,
        icon: mealIcon,
        pref: mealPref,
      };
      updatedMeals = [...quickMeals, newMeal];
    }
    
    saveQuickMeals(updatedMeals);
    resetMealEditor();
    Alert.alert('Success', editingMeal ? 'Meal updated!' : 'Meal added!');
  };
  
  const handleDeleteMeal = (meal) => {
    Alert.alert(
      'Delete Meal',
      `Remove "${meal.name}" from quick meals?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            const updatedMeals = quickMeals.filter(m => m.id !== meal.id);
            saveQuickMeals(updatedMeals);
          }
        }
      ]
    );
  };
  
  const openMealEditor = (meal = null) => {
    if (meal) {
      setEditingMeal(meal);
      setMealName(meal.name);
      setMealIcon(meal.icon);
      setMealPref(meal.pref);
    } else {
      setEditingMeal(null);
      setMealName('');
      setMealIcon('🍽️');
      setMealPref('');
    }
    setShowMealEditor(true);
  };
  
  const resetMealEditor = () => {
    setShowMealEditor(false);
    setEditingMeal(null);
    setMealName('');
    setMealIcon('🍽️');
    setMealPref('');
  };
  
  // Results
  const [suggestion, setSuggestion] = useState('');
  const [structuredMeal, setStructuredMeal] = useState(null);
  const [showMealModal, setShowMealModal] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState('');
  const [savedPlans, setSavedPlans] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch pantry summary for meal planning
  const fetchPantrySummary = useCallback(async () => {
    setPantryLoading(true);
    try {
      const data = await apiService.get('/dinner/pantry-summary');
      setPantrySummary(data);
    } catch (error) {
      console.error('Failed to fetch pantry summary:', error);
    } finally {
      setPantryLoading(false);
    }
  }, []);

  const fetchSavedPlans = useCallback(async () => {
    try {
      const data = await apiService.get('/dinner/plans');
      setSavedPlans(data.plans || []);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  }, []);

  useEffect(() => {
    fetchSavedPlans();
    fetchPantrySummary();
  }, [fetchSavedPlans, fetchPantrySummary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchSavedPlans(), fetchPantrySummary()]);
    setRefreshing(false);
  }, [fetchSavedPlans]);

  const handleGetSuggestion = async () => {
    if (!ingredients.trim() && !preferences.trim()) {
      Alert.alert('Tip', 'Add some ingredients or preferences for better suggestions!');
    }
    
    setLoading(true);
    try {
      const response = await apiService.post('/dinner/suggest', {
        ingredients: ingredients.split(',').map(i => i.trim()).filter(i => i),
        preferences,
      });
      setSuggestion(response.suggestion || 'No suggestion available');
      Alert.alert('Success', 'AI suggestion ready!');
    } catch (error) {
      console.error('Failed to get suggestion:', error);
      Alert.alert('Error', 'Failed to get dinner suggestion');
    } finally {
      setLoading(false);
    }
  };

  const handleGetWeeklyPlan = async () => {
    setWeeklyLoading(true);
    try {
      const response = await apiService.post('/dinner/weekly-plan', {
        family_size: familySize,
        preferences,
        budget,
        use_pantry: usePantry,
      });
      setWeeklyPlan(response.plan || 'No plan available');
      fetchSavedPlans();
      
      const pantryMsg = response.pantry_items_used?.length > 0 
        ? `\n\nUsing ${response.pantry_items_used.length} items from your pantry!` 
        : '';
      Alert.alert('Success', `Weekly meal plan created!${pantryMsg}`);
    } catch (error) {
      console.error('Failed to get weekly plan:', error);
      Alert.alert('Error', 'Failed to create weekly plan');
    } finally {
      setWeeklyLoading(false);
    }
  };

  const handleQuickMeal = async (meal) => {
    setPreferences(meal.pref);
    setLoading(true);
    try {
      // Try the structured AI endpoint first
      const response = await apiService.post('/ai/meal-plan', {
        preferences: meal.pref,
        servings: familySize,
        meal_type: 'dinner',
      });
      
      if (response.success && response.meal) {
        setStructuredMeal(response.meal);
        setShowMealModal(true);
        setSuggestion('');
      } else {
        setSuggestion(response.suggestion || 'No suggestion available');
        setStructuredMeal(null);
      }
    } catch (error) {
      console.error('Failed to get suggestion:', error);
      // Fallback to original endpoint
      try {
        const fallbackRes = await apiService.post('/dinner/suggest', {
          ingredients: [],
          preferences: meal.pref,
        });
        setSuggestion(fallbackRes.suggestion || 'No suggestion available');
        setStructuredMeal(null);
      } catch (e) {
        Alert.alert('Error', 'Failed to get dinner suggestion');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedBackground page="dinner">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Dinner Planner</Text>
        {savedPlans.length > 0 && (
          <TouchableOpacity 
            style={styles.historyButton}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Ionicons name="time" size={20} color="#a5b4fc" />
            <Text style={styles.historyCount}>{savedPlans.length}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {/* History Panel */}
        {showHistory && savedPlans.length > 0 && (
          <View style={styles.historyPanel}>
            <View style={styles.historyHeader}>
              <Ionicons name="time" size={16} color="#f59e0b" />
              <Text style={styles.historyTitle}>Previous Meal Plans</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {savedPlans.map((plan) => (
                <TouchableOpacity
                  key={plan.plan_id}
                  style={styles.historyCard}
                  onPress={() => { setWeeklyPlan(plan.plan); setShowHistory(false); }}
                >
                  <Text style={styles.historyWeek}>Week of {plan.week_start}</Text>
                  <Text style={styles.historyPref} numberOfLines={1}>
                    {plan.preferences || 'No preferences'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Quick Dinner Idea */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="restaurant" size={20} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Quick Dinner Idea</Text>
          </View>
          
          <TextInput
            style={styles.input}
            placeholder="Available ingredients (comma-separated)"
            placeholderTextColor="#6b7280"
            value={ingredients}
            onChangeText={setIngredients}
            multiline
          />
          
          <TextInput
            style={styles.input}
            placeholder="Dietary preferences (e.g., vegetarian, quick meals)"
            placeholderTextColor="#6b7280"
            value={preferences}
            onChangeText={setPreferences}
          />
          
          <TouchableOpacity 
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleGetSuggestion}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Get Dinner Idea</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* AI Suggestion Result */}
        {suggestion && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons name="sparkles" size={18} color="#f59e0b" />
              <Text style={styles.resultTitle}>AI Suggestion</Text>
            </View>
            <Text style={styles.resultText}>{suggestion}</Text>
          </View>
        )}

        {/* Weekly Meal Plan */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={20} color="#ec4899" />
            <Text style={styles.sectionTitle}>Weekly Meal Plan</Text>
          </View>
          
          <View style={styles.optionsRow}>
            <View style={styles.optionGroup}>
              <Text style={styles.optionLabel}>Family Size</Text>
              <View style={styles.sizeSelector}>
                {[2, 4, 6, 8].map(size => (
                  <TouchableOpacity
                    key={size}
                    style={[styles.sizeOption, familySize === size && styles.sizeOptionActive]}
                    onPress={() => setFamilySize(size)}
                  >
                    <Text style={[styles.sizeOptionText, familySize === size && styles.sizeOptionTextActive]}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.optionGroup}>
              <Text style={styles.optionLabel}>Budget</Text>
              <View style={styles.sizeSelector}>
                {[
                  { key: 'budget', label: '$' },
                  { key: 'moderate', label: '$$' },
                  { key: 'premium', label: '$$$' },
                ].map(item => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.sizeOption, budget === item.key && styles.sizeOptionActive]}
                    onPress={() => setBudget(item.key)}
                  >
                    <Text style={[styles.sizeOptionText, budget === item.key && styles.sizeOptionTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Pantry Sync Section */}
          <View style={styles.pantrySection}>
            <TouchableOpacity 
              style={styles.pantryToggle}
              onPress={() => setUsePantry(!usePantry)}
            >
              <View style={styles.pantryToggleLeft}>
                <Ionicons name="cube" size={20} color={usePantry ? '#10b981' : '#6b7280'} />
                <View>
                  <Text style={styles.pantryToggleTitle}>Use Pantry Items</Text>
                  <Text style={styles.pantryToggleSubtext}>
                    {usePantry ? 'AI will prioritize your available ingredients' : 'Tap to enable pantry sync'}
                  </Text>
                </View>
              </View>
              <View style={[styles.toggleSwitch, usePantry && styles.toggleSwitchActive]}>
                <View style={[styles.toggleKnob, usePantry && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>

            {usePantry && pantrySummary && (
              <View style={styles.pantrySummaryCard}>
                <View style={styles.pantrySummaryHeader}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.pantrySummaryTitle}>
                    {pantrySummary.total_items} items in pantry
                  </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Pantry')}>
                    <Text style={styles.pantrySummaryLink}>Manage</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.pantrySummaryStats}>
                  <View style={styles.pantryStat}>
                    <Ionicons name="fitness" size={14} color="#ef4444" />
                    <Text style={styles.pantryStatText}>{pantrySummary.summary?.protein || 0} protein</Text>
                  </View>
                  <View style={styles.pantryStat}>
                    <Ionicons name="nutrition" size={14} color="#22c55e" />
                    <Text style={styles.pantryStatText}>{pantrySummary.summary?.produce || 0} produce</Text>
                  </View>
                  <View style={styles.pantryStat}>
                    <Ionicons name="cube" size={14} color="#f59e0b" />
                    <Text style={styles.pantryStatText}>{pantrySummary.summary?.grains || 0} grains</Text>
                  </View>
                  <View style={styles.pantryStat}>
                    <Ionicons name="water" size={14} color="#60a5fa" />
                    <Text style={styles.pantryStatText}>{pantrySummary.summary?.dairy || 0} dairy</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
          
          <TouchableOpacity 
            style={[styles.secondaryButton, weeklyLoading && styles.buttonDisabled]}
            onPress={handleGetWeeklyPlan}
            disabled={weeklyLoading}
          >
            {weeklyLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="calendar" size={20} color="#fff" />
                <Text style={styles.secondaryButtonText}>Generate Weekly Plan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Weekly Plan Result - Now Interactive */}
        {weeklyPlan && (
          <WeeklyMealPlan 
            planText={weeklyPlan}
            onRegenerateDay={(day) => {
              Alert.alert('Coming Soon', `Regenerate ${day}'s meals feature coming soon!`);
            }}
          />
        )}

        {/* Quick Meal Ideas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Meal Ideas</Text>
          <Text style={styles.quickMealHint}>Tap for an instant AI suggestion!</Text>
          <View style={styles.quickMealsGrid}>
            {QUICK_MEALS.map((meal) => (
              <TouchableOpacity
                key={meal.name}
                style={[styles.quickMealCard, loading && styles.buttonDisabled]}
                onPress={() => handleQuickMeal(meal)}
                disabled={loading}
              >
                <Text style={styles.quickMealIcon}>{meal.icon}</Text>
                <Text style={styles.quickMealName}>{meal.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Structured AI Meal Modal */}
      <Modal visible={showMealModal} animationType="slide" transparent>
        <View style={styles.mealModalOverlay}>
          <View style={styles.mealModalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <AIMealCard 
                meal={structuredMeal} 
                onClose={() => {
                  setShowMealModal(false);
                  setStructuredMeal(null);
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1, marginLeft: 8 },
  historyButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(30, 27, 75, 0.8)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  historyCount: { color: '#a5b4fc', fontSize: 12, fontWeight: 'bold' },
  scrollView: { flex: 1, padding: 16 },
  
  // History Panel
  historyPanel: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 16, padding: 14, marginBottom: 16 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  historyTitle: { color: '#fff', fontWeight: '600', fontSize: 14 },
  historyCard: { backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 12, padding: 12, marginRight: 10, minWidth: 150 },
  historyWeek: { color: '#fff', fontWeight: '500', fontSize: 13 },
  historyPref: { color: '#6b7280', fontSize: 11, marginTop: 4 },
  
  // Section
  section: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 20, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  quickMealHint: { color: '#6b7280', fontSize: 12, marginTop: 4, marginBottom: 12 },
  
  // Inputs
  input: { backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 14, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)', marginBottom: 12 },
  
  // Buttons
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#f59e0b', paddingVertical: 16, borderRadius: 30 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#ec4899', paddingVertical: 16, borderRadius: 30 },
  secondaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  buttonDisabled: { opacity: 0.6 },
  
  // Options
  optionsRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  optionGroup: { flex: 1 },
  optionLabel: { color: '#a5b4fc', fontSize: 12, marginBottom: 8 },
  sizeSelector: { flexDirection: 'row', gap: 6 },
  sizeOption: { flex: 1, backgroundColor: 'rgba(15, 13, 26, 0.8)', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  sizeOptionActive: { backgroundColor: '#6366f1' },
  sizeOptionText: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  sizeOptionTextActive: { color: '#fff' },
  
  // Result Cards
  resultCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  resultTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  resultText: { color: '#e2e8f0', fontSize: 14, lineHeight: 22 },
  updatePlanButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(236, 72, 153, 0.5)', backgroundColor: 'rgba(236, 72, 153, 0.1)' },
  updatePlanButtonText: { color: '#ec4899', fontSize: 14, fontWeight: '500' },
  
  // Quick Meals
  quickMealsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  quickMealCard: { width: '23%', backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)' },
  quickMealIcon: { fontSize: 28, marginBottom: 6 },
  quickMealName: { color: '#fff', fontSize: 10, fontWeight: '500', textAlign: 'center' },
  
  // AI Meal Modal
  mealModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  mealModalContent: { maxHeight: '90%', backgroundColor: '#0f0d1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },

  // Pantry Sync Styles
  pantrySection: { marginTop: 16, marginBottom: 8 },
  pantryToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(15, 13, 26, 0.8)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)' },
  pantryToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  pantryToggleTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  pantryToggleSubtext: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  toggleSwitch: { width: 48, height: 28, borderRadius: 14, backgroundColor: 'rgba(107, 114, 128, 0.3)', justifyContent: 'center', padding: 2 },
  toggleSwitchActive: { backgroundColor: 'rgba(16, 185, 129, 0.3)' },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#6b7280' },
  toggleKnobActive: { backgroundColor: '#10b981', alignSelf: 'flex-end' },
  pantrySummaryCard: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  pantrySummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pantrySummaryTitle: { flex: 1, color: '#10b981', fontSize: 13, fontWeight: '600' },
  pantrySummaryLink: { color: '#6366f1', fontSize: 12, fontWeight: '600' },
  pantrySummaryStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pantryStat: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pantryStatText: { color: '#9ca3af', fontSize: 11 },
});
