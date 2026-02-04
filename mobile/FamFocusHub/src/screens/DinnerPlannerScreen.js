import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Modal, Alert, TextInput 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function DinnerPlannerScreen({ navigation }) {
  const { user } = useAuth();
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedMealType, setSelectedMealType] = useState('dinner');
  const [mealInput, setMealInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchMeals = useCallback(async () => {
    try {
      const data = await apiService.getDinnerPlan();
      setMeals(data.meals || []);
    } catch (error) {
      console.error('Failed to fetch meals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMeals();
    setRefreshing(false);
  }, [fetchMeals]);

  const handleGeneratePlan = async () => {
    Alert.alert(
      'Generate Meal Plan',
      'Let AI suggest meals for the week based on your family preferences?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setGenerating(true);
            try {
              await apiService.generateDinnerPlan();
              fetchMeals();
              Alert.alert('Success', 'Meal plan generated!');
            } catch (error) {
              Alert.alert('Error', 'Failed to generate meal plan');
            } finally {
              setGenerating(false);
            }
          },
        },
      ]
    );
  };

  const handleEditMeal = (day, mealType) => {
    setSelectedDay(day);
    setSelectedMealType(mealType);
    const existingMeal = meals.find(m => m.day === day && m.meal_type === mealType);
    setMealInput(existingMeal?.meal || '');
    setShowEditModal(true);
  };

  const handleSaveMeal = async () => {
    if (!mealInput.trim()) return;
    
    setSaving(true);
    try {
      await apiService.updateDinnerPlan(selectedDay, selectedMealType, mealInput);
      setShowEditModal(false);
      setMealInput('');
      fetchMeals();
    } catch (error) {
      Alert.alert('Error', 'Failed to save meal');
    } finally {
      setSaving(false);
    }
  };

  const getMealForDay = (day, mealType) => {
    const meal = meals.find(m => m.day === day && m.meal_type === mealType);
    return meal?.meal || null;
  };

  const getMealIcon = (mealType) => {
    switch (mealType) {
      case 'breakfast': return 'sunny';
      case 'lunch': return 'restaurant';
      case 'dinner': return 'moon';
      case 'snack': return 'cafe';
      default: return 'restaurant';
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
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#1e1b4b']}
        style={styles.gradient}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Dinner Planner</Text>
        <TouchableOpacity 
          style={[styles.generateButton, generating && styles.generateButtonDisabled]}
          onPress={handleGeneratePlan}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.generateButtonText}>AI</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Meal Type Filter */}
      <View style={styles.mealTypeFilter}>
        {MEAL_TYPES.map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.mealTypeButton, selectedMealType === type && styles.mealTypeActive]}
            onPress={() => setSelectedMealType(type)}
          >
            <Ionicons 
              name={getMealIcon(type)} 
              size={16} 
              color={selectedMealType === type ? '#818cf8' : '#9ca3af'} 
            />
            <Text style={[styles.mealTypeText, selectedMealType === type && styles.mealTypeTextActive]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Weekly Plan */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
      >
        {DAYS.map((day, index) => {
          const meal = getMealForDay(day, selectedMealType);
          const isToday = new Date().getDay() === (index + 1) % 7;
          
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayCard, isToday && styles.todayCard]}
              onPress={() => handleEditMeal(day, selectedMealType)}
            >
              <View style={styles.dayHeader}>
                <Text style={[styles.dayName, isToday && styles.todayDayName]}>
                  {day}
                  {isToday && <Text style={styles.todayBadge}> (Today)</Text>}
                </Text>
                <Ionicons name="pencil" size={16} color="#6b7280" />
              </View>
              
              {meal ? (
                <View style={styles.mealContent}>
                  <Ionicons name={getMealIcon(selectedMealType)} size={20} color="#fbbf24" />
                  <Text style={styles.mealText}>{meal}</Text>
                </View>
              ) : (
                <View style={styles.emptyMeal}>
                  <Ionicons name="add-circle-outline" size={24} color="#6b7280" />
                  <Text style={styles.emptyMealText}>Tap to add meal</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDay} - {selectedMealType?.charAt(0).toUpperCase() + selectedMealType?.slice(1)}
              </Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.mealInputField}
              placeholder="What's for this meal?"
              placeholderTextColor="#6b7280"
              value={mealInput}
              onChangeText={setMealInput}
              multiline
              autoFocus
            />

            <View style={styles.suggestions}>
              <Text style={styles.suggestionsTitle}>Quick suggestions:</Text>
              <View style={styles.suggestionTags}>
                {['Pasta', 'Chicken', 'Salad', 'Soup', 'Pizza', 'Tacos'].map(suggestion => (
                  <TouchableOpacity
                    key={suggestion}
                    style={styles.suggestionTag}
                    onPress={() => setMealInput(suggestion)}
                  >
                    <Text style={styles.suggestionTagText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSaveMeal}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#818cf8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  mealTypeFilter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  mealTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    gap: 6,
  },
  mealTypeActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#818cf8',
  },
  mealTypeText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  mealTypeTextActive: {
    color: '#818cf8',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  dayCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  todayCard: {
    borderColor: '#818cf8',
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a5b4fc',
  },
  todayDayName: {
    color: '#818cf8',
  },
  todayBadge: {
    fontSize: 12,
    color: '#fbbf24',
  },
  mealContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mealText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  emptyMeal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyMealText: {
    color: '#6b7280',
    fontSize: 14,
  },
  bottomSpacer: {
    height: 100,
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
  mealInputField: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  suggestions: {
    marginBottom: 20,
  },
  suggestionsTitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 10,
  },
  suggestionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  suggestionTagText: {
    color: '#a5b4fc',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#818cf8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
