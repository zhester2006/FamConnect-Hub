// AIMealCard.js - Graphical AI meal suggestion with shopping list integration
import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  ActivityIndicator, Alert, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/api.service';

const CATEGORY_ICONS = {
  produce: 'leaf',
  meat: 'restaurant',
  dairy: 'egg',
  pantry: 'cube',
  spices: 'flask',
  frozen: 'snow',
  bakery: 'pizza',
  beverages: 'water',
  default: 'basket',
};

const CATEGORY_COLORS = {
  produce: '#10b981',
  meat: '#ef4444',
  dairy: '#fbbf24',
  pantry: '#6366f1',
  spices: '#f97316',
  frozen: '#06b6d4',
  bakery: '#ec4899',
  beverages: '#3b82f6',
  default: '#9ca3af',
};

export default function AIMealCard({ meal, onAddToShoppingList, onClose }) {
  const [addingIngredients, setAddingIngredients] = useState({});
  const [allAdded, setAllAdded] = useState(false);

  if (!meal) return null;

  const handleAddIngredient = async (ingredient) => {
    const key = ingredient.name;
    setAddingIngredients(prev => ({ ...prev, [key]: true }));
    
    try {
      await apiService.addShoppingItem({ 
        name: `${ingredient.amount} ${ingredient.name}`,
      });
      setAddingIngredients(prev => ({ ...prev, [key]: 'done' }));
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
      setAddingIngredients(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleAddAllIngredients = async () => {
    setAllAdded(true);
    
    try {
      const promises = meal.ingredients.map(ing => 
        apiService.addShoppingItem({ 
          name: `${ing.amount} ${ing.name}`,
        }).catch(() => null)
      );
      
      await Promise.all(promises);
      Alert.alert('🛒 Added!', 'All ingredients added to shopping list');
      
      // Mark all as done
      const newState = {};
      meal.ingredients.forEach(ing => {
        newState[ing.name] = 'done';
      });
      setAddingIngredients(newState);
    } catch (error) {
      Alert.alert('Error', 'Some items failed to add');
    }
  };

  const getCategoryIcon = (category) => CATEGORY_ICONS[category?.toLowerCase()] || CATEGORY_ICONS.default;
  const getCategoryColor = (category) => CATEGORY_COLORS[category?.toLowerCase()] || CATEGORY_COLORS.default;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBadge}>
            <Ionicons name="restaurant" size={24} color="#ec4899" />
          </View>
          <View>
            <Text style={styles.mealName}>{meal.meal_name}</Text>
            <Text style={styles.mealDescription}>{meal.description}</Text>
          </View>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Meta Info */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={16} color="#06b6d4" />
          <Text style={styles.metaText}>Prep: {meal.prep_time}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="flame-outline" size={16} color="#f59e0b" />
          <Text style={styles.metaText}>Cook: {meal.cook_time}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={16} color="#a5b4fc" />
          <Text style={styles.metaText}>{meal.servings} servings</Text>
        </View>
        <View style={[styles.difficultyBadge, { backgroundColor: 
          meal.difficulty === 'Easy' ? 'rgba(16, 185, 129, 0.2)' :
          meal.difficulty === 'Medium' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(239, 68, 68, 0.2)' 
        }]}>
          <Text style={[styles.difficultyText, { color:
            meal.difficulty === 'Easy' ? '#10b981' :
            meal.difficulty === 'Medium' ? '#fbbf24' : '#ef4444'
          }]}>{meal.difficulty}</Text>
        </View>
      </View>

      {/* Ingredients Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <TouchableOpacity 
            style={[styles.addAllBtn, allAdded && styles.addAllBtnDone]}
            onPress={handleAddAllIngredients}
            disabled={allAdded}
          >
            <Ionicons name={allAdded ? "checkmark" : "cart"} size={16} color="#fff" />
            <Text style={styles.addAllBtnText}>
              {allAdded ? 'Added!' : 'Add All'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.ingredientsGrid}>
          {meal.ingredients?.map((ingredient, index) => {
            const status = addingIngredients[ingredient.name];
            const isDone = status === 'done';
            const isLoading = status === true;
            
            return (
              <TouchableOpacity
                key={index}
                style={[styles.ingredientCard, isDone && styles.ingredientCardDone]}
                onPress={() => !isDone && handleAddIngredient(ingredient)}
                disabled={isDone || isLoading}
              >
                <View style={[
                  styles.ingredientIcon,
                  { backgroundColor: `${getCategoryColor(ingredient.category)}20` }
                ]}>
                  <Ionicons 
                    name={getCategoryIcon(ingredient.category)} 
                    size={18} 
                    color={getCategoryColor(ingredient.category)} 
                  />
                </View>
                <View style={styles.ingredientInfo}>
                  <Text style={styles.ingredientName} numberOfLines={1}>
                    {ingredient.name}
                  </Text>
                  <Text style={styles.ingredientAmount}>{ingredient.amount}</Text>
                </View>
                <View style={styles.ingredientAction}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#6366f1" />
                  ) : isDone ? (
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  ) : (
                    <Ionicons name="add-circle-outline" size={20} color="#6366f1" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Steps Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        <View style={styles.stepsContainer}>
          {meal.steps?.map((step, index) => (
            <View key={index} style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tips Section */}
      {meal.tips && meal.tips.length > 0 && (
        <View style={styles.tipsSection}>
          <View style={styles.tipIcon}>
            <Ionicons name="bulb" size={18} color="#fbbf24" />
          </View>
          <View style={styles.tipsContent}>
            <Text style={styles.tipsTitle}>Chef's Tips</Text>
            {meal.tips.map((tip, index) => (
              <Text key={index} style={styles.tipText}>• {tip}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Nutrition Section */}
      {meal.nutrition && (
        <View style={styles.nutritionSection}>
          <Ionicons name="fitness" size={16} color="#a5b4fc" />
          <Text style={styles.nutritionText}>
            {meal.nutrition.calories} | Protein: {meal.nutrition.protein}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(30, 27, 75, 0.95)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  mealDescription: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
    maxWidth: 250,
  },
  closeBtn: {
    padding: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  addAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addAllBtnDone: {
    backgroundColor: '#10b981',
  },
  addAllBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  ingredientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingredientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 13, 26, 0.8)',
    borderRadius: 12,
    padding: 10,
    width: '48%',
    gap: 8,
  },
  ingredientCardDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  ingredientIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  ingredientAmount: {
    fontSize: 11,
    color: '#6b7280',
  },
  ingredientAction: {
    width: 24,
    alignItems: 'center',
  },
  stepsContainer: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: '#d1d5db',
    lineHeight: 20,
  },
  tipsSection: {
    flexDirection: 'row',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fbbf24',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    color: '#d1d5db',
    lineHeight: 18,
  },
  nutritionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  nutritionText: {
    fontSize: 12,
    color: '#a5b4fc',
  },
});
