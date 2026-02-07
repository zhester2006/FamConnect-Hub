// WeeklyMealPlan.js - Interactive weekly meal plan component with shopping list integration
import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/api.service';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MEAL_EMOJIS = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '🍎',
};

const CATEGORY_COLORS = {
  Monday: '#6366f1',
  Tuesday: '#ec4899',
  Wednesday: '#10b981',
  Thursday: '#f59e0b',
  Friday: '#8b5cf6',
  Saturday: '#06b6d4',
  Sunday: '#ef4444',
};

export default function WeeklyMealPlan({ planText, onRegenerateDay }) {
  const [expandedDay, setExpandedDay] = useState(null);
  const [addingToList, setAddingToList] = useState({});
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState({});
  const [currentMealForPicker, setCurrentMealForPicker] = useState(null);

  // Parse the plain text plan into structured data
  const parsePlan = (text) => {
    if (!text) return [];
    
    const days = [];
    const lines = text.split('\n');
    let currentDay = null;
    let currentMeals = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Check if line is a day header
      const dayMatch = DAYS.find(day => 
        trimmed.toLowerCase().startsWith(day.toLowerCase()) ||
        trimmed.toLowerCase().includes(day.toLowerCase() + ':')
      );

      if (dayMatch) {
        if (currentDay) {
          days.push({ day: currentDay, meals: currentMeals });
        }
        currentDay = dayMatch;
        currentMeals = [];
      } else if (currentDay) {
        // Parse meal type and description
        const lowerLine = trimmed.toLowerCase();
        let mealType = 'dinner';
        let mealDesc = trimmed;

        if (lowerLine.includes('breakfast')) {
          mealType = 'breakfast';
          mealDesc = trimmed.replace(/breakfast[:\s]*/i, '');
        } else if (lowerLine.includes('lunch')) {
          mealType = 'lunch';
          mealDesc = trimmed.replace(/lunch[:\s]*/i, '');
        } else if (lowerLine.includes('dinner')) {
          mealType = 'dinner';
          mealDesc = trimmed.replace(/dinner[:\s]*/i, '');
        } else if (lowerLine.includes('snack')) {
          mealType = 'snack';
          mealDesc = trimmed.replace(/snack[:\s]*/i, '');
        }

        // Clean up description
        mealDesc = mealDesc.replace(/^[-•*]\s*/, '').trim();
        
        if (mealDesc && mealDesc.length > 2) {
          currentMeals.push({
            type: mealType,
            description: mealDesc,
            ingredients: extractIngredients(mealDesc)
          });
        }
      }
    });

    // Add last day
    if (currentDay && currentMeals.length > 0) {
      days.push({ day: currentDay, meals: currentMeals });
    }

    // If parsing didn't work well, create a simple structure
    if (days.length === 0 && text.length > 10) {
      return DAYS.slice(0, 7).map((day, index) => ({
        day,
        meals: [{ 
          type: 'dinner', 
          description: text.split('\n').filter(l => l.trim())[index] || 'Meal suggestion',
          ingredients: []
        }]
      }));
    }

    return days;
  };

  // Extract potential ingredients from meal description
  const extractIngredients = (desc) => {
    // Common ingredient keywords
    const ingredientWords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'tofu',
      'rice', 'pasta', 'bread', 'potato', 'potatoes', 'salad', 'vegetables', 'veggies',
      'tomato', 'onion', 'garlic', 'pepper', 'cheese', 'eggs', 'milk', 'butter',
      'broccoli', 'carrots', 'spinach', 'lettuce', 'corn', 'beans', 'mushrooms',
      'noodles', 'tortilla', 'avocado', 'bacon', 'sausage', 'ham', 'turkey',
      'lime', 'lemon', 'cilantro', 'parsley', 'basil', 'oregano', 'cumin',
      'soy sauce', 'olive oil', 'cream', 'yogurt', 'cucumber', 'zucchini'];
    
    const lowerDesc = desc.toLowerCase();
    return ingredientWords.filter(ing => lowerDesc.includes(ing));
  };

  // Open ingredient picker for individual selection
  const openIngredientPicker = (day, meal) => {
    const allIngredients = meal.ingredients.length > 0 
      ? meal.ingredients 
      : extractIngredients(meal.description);
    
    // Add the meal name itself as an option
    const mealItems = [meal.description, ...allIngredients];
    
    setCurrentMealForPicker({ day, meal, items: [...new Set(mealItems)] });
    setSelectedIngredients({});
    setShowIngredientPicker(true);
  };

  // Toggle individual ingredient selection
  const toggleIngredient = (ingredient) => {
    setSelectedIngredients(prev => ({
      ...prev,
      [ingredient]: !prev[ingredient]
    }));
  };

  // Add selected ingredients to shopping list
  const addSelectedToList = async () => {
    const selected = Object.entries(selectedIngredients)
      .filter(([_, isSelected]) => isSelected)
      .map(([item]) => item);
    
    if (selected.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item to add');
      return;
    }

    try {
      for (const item of selected) {
        await apiService.addShoppingItem({ 
          name: item,
          category: 'meal-plan'
        });
      }
      
      Alert.alert('Added!', `${selected.length} item(s) added to shopping list`);
      setShowIngredientPicker(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to add items');
    }
  };

  const handleAddMealToList = async (day, meal) => {
    const key = `${day}-${meal.type}`;
    setAddingToList(prev => ({ ...prev, [key]: true }));
    
    try {
      // Add meal ingredients to shopping list
      const itemsToAdd = meal.ingredients.length > 0 
        ? meal.ingredients 
        : [meal.description.split(' ').slice(0, 3).join(' ')];
      
      for (const item of itemsToAdd) {
        await apiService.addShoppingItem({ 
          name: `${day} ${meal.type}: ${item}`,
          category: 'meal-plan'
        });
      }
      
      Alert.alert('Added!', `Ingredients for ${day}'s ${meal.type} added to shopping list`);
      setAddingToList(prev => ({ ...prev, [key]: 'done' }));
    } catch (error) {
      Alert.alert('Error', 'Failed to add items');
      setAddingToList(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleAddDayToList = async (dayData) => {
    const key = dayData.day;
    setAddingToList(prev => ({ ...prev, [key]: true }));
    
    try {
      for (const meal of dayData.meals) {
        const items = meal.ingredients.length > 0 
          ? meal.ingredients 
          : [meal.description];
        
        for (const item of items) {
          await apiService.addShoppingItem({ 
            name: item,
            category: 'meal-plan'
          });
        }
      }
      
      Alert.alert('Added!', `All ingredients for ${dayData.day} added to shopping list`);
      setAddingToList(prev => ({ ...prev, [key]: 'done' }));
    } catch (error) {
      Alert.alert('Error', 'Failed to add items');
      setAddingToList(prev => ({ ...prev, [key]: false }));
    }
  };

  const parsedPlan = parsePlan(planText);

  if (parsedPlan.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={48} color="#4b5563" />
        <Text style={styles.emptyText}>No meal plan generated yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Weekly Plan</Text>
        <Text style={styles.subtitle}>Tap a day to see details</Text>
      </View>

      {parsedPlan.map((dayData, index) => {
        const isExpanded = expandedDay === dayData.day;
        const dayColor = CATEGORY_COLORS[dayData.day] || '#6366f1';
        const dayStatus = addingToList[dayData.day];
        
        return (
          <View key={dayData.day} style={styles.dayCard}>
            <TouchableOpacity 
              style={styles.dayHeader}
              onPress={() => setExpandedDay(isExpanded ? null : dayData.day)}
              activeOpacity={0.7}
            >
              <View style={[styles.dayBadge, { backgroundColor: dayColor }]}>
                <Text style={styles.dayNumber}>{index + 1}</Text>
              </View>
              <View style={styles.dayInfo}>
                <Text style={styles.dayName}>{dayData.day}</Text>
                <Text style={styles.mealCount}>{dayData.meals.length} meal{dayData.meals.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.dayActions}>
                <TouchableOpacity 
                  style={[styles.addDayBtn, dayStatus === 'done' && styles.addDayBtnDone]}
                  onPress={() => handleAddDayToList(dayData)}
                  disabled={dayStatus === true || dayStatus === 'done'}
                >
                  {dayStatus === true ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : dayStatus === 'done' ? (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  ) : (
                    <Ionicons name="cart-outline" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
                <Ionicons 
                  name={isExpanded ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#6b7280" 
                />
              </View>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.mealsContainer}>
                {dayData.meals.map((meal, mealIndex) => {
                  const mealKey = `${dayData.day}-${meal.type}`;
                  const mealStatus = addingToList[mealKey];
                  
                  return (
                    <View key={mealIndex} style={styles.mealItem}>
                      <View style={styles.mealHeader}>
                        <Text style={styles.mealEmoji}>{MEAL_EMOJIS[meal.type] || '🍽️'}</Text>
                        <View style={styles.mealInfo}>
                          <Text style={styles.mealType}>{meal.type.charAt(0).toUpperCase() + meal.type.slice(1)}</Text>
                          <Text style={styles.mealDesc}>{meal.description}</Text>
                        </View>
                        <TouchableOpacity 
                          style={[styles.addMealBtn, mealStatus === 'done' && styles.addMealBtnDone]}
                          onPress={() => handleAddMealToList(dayData.day, meal)}
                          disabled={mealStatus === true || mealStatus === 'done'}
                        >
                          {mealStatus === true ? (
                            <ActivityIndicator size="small" color="#6366f1" />
                          ) : mealStatus === 'done' ? (
                            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                          ) : (
                            <Ionicons name="add-circle-outline" size={20} color="#6366f1" />
                          )}
                        </TouchableOpacity>
                      </View>
                      
                      {meal.ingredients.length > 0 && (
                        <View style={styles.ingredientTags}>
                          {meal.ingredients.slice(0, 5).map((ing, i) => (
                            <View key={i} style={styles.ingredientTag}>
                              <Text style={styles.ingredientTagText}>{ing}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {/* Add All to Shopping List */}
      <TouchableOpacity 
        style={styles.addAllButton}
        onPress={() => {
          Alert.alert(
            'Add All Ingredients',
            'Add ingredients from the entire week to your shopping list?',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Add All', 
                onPress: async () => {
                  for (const dayData of parsedPlan) {
                    await handleAddDayToList(dayData);
                  }
                }
              }
            ]
          );
        }}
      >
        <Ionicons name="cart" size={20} color="#fff" />
        <Text style={styles.addAllButtonText}>Add Week to Shopping List</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#6b7280',
    marginTop: 12,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  dayCard: {
    marginBottom: 8,
    backgroundColor: 'rgba(15, 13, 26, 0.6)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumber: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  mealCount: {
    fontSize: 11,
    color: '#6b7280',
  },
  dayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addDayBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addDayBtnDone: {
    backgroundColor: '#10b981',
  },
  mealsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  mealItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mealEmoji: {
    fontSize: 24,
  },
  mealInfo: {
    flex: 1,
  },
  mealType: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealDesc: {
    fontSize: 13,
    color: '#e2e8f0',
    marginTop: 2,
  },
  addMealBtn: {
    padding: 4,
  },
  addMealBtnDone: {
    opacity: 0.8,
  },
  ingredientTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginLeft: 34,
  },
  ingredientTag: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ingredientTagText: {
    fontSize: 10,
    color: '#a5b4fc',
  },
  addAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ec4899',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  addAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
