import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/api.service';

const { width, height } = Dimensions.get('window');

const ICONS = {
  home: 'home',
  'layout-dashboard': 'grid',
  'check-circle': 'checkmark-circle',
  calendar: 'calendar',
  gift: 'gift',
  'map-pin': 'location',
  'message-circle': 'chatbubbles',
  'party-popper': 'happy',
  rocket: 'rocket',
  target: 'flag',
  trophy: 'trophy',
  star: 'star',
  restaurant: 'restaurant',
  cart: 'cart',
  chatbubbles: 'chatbubbles',
  people: 'people',
  sparkles: 'sparkles',
  book: 'book',
};

const GRADIENTS = {
  welcome: ['#6366f1', '#8b5cf6', '#f59e0b'],
  dashboard: ['#3b82f6', '#6366f1', '#8b5cf6'],
  chores: ['#10b981', '#14b8a6', '#6366f1'],
  missions: ['#f97316', '#ef4444', '#ec4899'],
  calendar: ['#3b82f6', '#6366f1', '#8b5cf6'],
  rewards: ['#f59e0b', '#f97316', '#ef4444'],
  location: ['#10b981', '#059669', '#14b8a6'],
  chat: ['#ec4899', '#8b5cf6', '#6366f1'],
  points: ['#f59e0b', '#f97316', '#ef4444'],
  complete: ['#f59e0b', '#6366f1', '#06b6d4'],
  pantry: ['#84cc16', '#10b981', '#14b8a6'],
  shopping: ['#14b8a6', '#06b6d4', '#3b82f6'],
  family: ['#8b5cf6', '#6366f1', '#ec4899'],
};

export default function OnboardingScreen({ onComplete }) {
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchTutorial();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchTutorial = async () => {
    try {
      const data = await apiService.getTutorialContent();
      if (!data.completed && data.slides?.length > 0) {
        setSlides(data.slides);
      } else {
        onComplete?.();
      }
    } catch (error) {
      console.error('Failed to fetch tutorial:', error);
      onComplete?.();
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      await apiService.completeTutorial();
    } catch (error) {
      console.error('Failed to complete tutorial:', error);
    }
    onComplete?.();
  };

  const renderSlide = ({ item, index }) => {
    const gradient = GRADIENTS[item.image] || GRADIENTS.welcome;
    const iconName = ICONS[item.icon] || 'star';

    return (
      <View style={styles.slide}>
        <LinearGradient colors={gradient} style={styles.gradient}>
          {/* Decorative circles */}
          <View style={[styles.circle, styles.circle1]} />
          <View style={[styles.circle, styles.circle2]} />
          <View style={[styles.circle, styles.circle3]} />
          
          <View style={styles.content}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name={iconName} size={64} color="#fff" />
            </View>

            {/* Title */}
            <Text style={styles.title}>{item.title}</Text>

            {/* Description */}
            <Text style={styles.description}>{item.description}</Text>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  if (loading || slides.length === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
        <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item, index) => index.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        scrollEventThrottle={16}
      />

      {/* Footer */}
      <View style={styles.footer}>
        {/* Progress Dots */}
        <View style={styles.dots}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
                index < currentIndex && styles.dotCompleted,
              ]}
            />
          ))}
        </View>

        {/* Progress Text */}
        <Text style={styles.progressText}>
          {currentIndex + 1} of {slides.length}
        </Text>

        {/* Next Button */}
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentIndex === slides.length - 1 ? "Let's Go!" : 'Next'}
          </Text>
          <Ionicons 
            name={currentIndex === slides.length - 1 ? 'rocket' : 'arrow-forward'} 
            size={20} 
            color="#6366f1" 
          />
        </TouchableOpacity>
      </View>

      {/* Fun Emojis */}
      <View style={styles.emojis}>
        {['✨', '🎉', '🚀', '⭐', '💪'].map((emoji, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.emoji,
              {
                transform: [{
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
              },
            ]}
          >
            {emoji}
          </Animated.Text>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1b4b',
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  skipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  slide: {
    width,
    height,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 1000,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  circle1: {
    width: 300,
    height: 300,
    top: -50,
    right: -100,
  },
  circle2: {
    width: 200,
    height: 200,
    bottom: 100,
    left: -50,
  },
  circle3: {
    width: 150,
    height: 150,
    top: '40%',
    right: -30,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#fff',
  },
  dotCompleted: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  progressText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 16,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emojis: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 24,
    marginHorizontal: 4,
  },
});
