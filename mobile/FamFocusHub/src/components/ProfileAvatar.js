// ProfileAvatar.js - Reusable profile avatar component with medal support
import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import MedalEmblem from './MedalEmblem';

const SIZES = {
  tiny: { container: 24, text: 10, medal: 'micro' },
  small: { container: 32, text: 12, medal: 'tiny' },
  medium: { container: 40, text: 16, medal: 'tiny' },
  large: { container: 56, text: 22, medal: 'small' },
  xlarge: { container: 80, text: 32, medal: 'medium' },
};

const COLORS = [
  '#6366f1', '#ec4899', '#10b981', '#f59e0b', 
  '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4'
];

export default function ProfileAvatar({ 
  picture, 
  name, 
  size = 'medium', 
  rank,
  showMedal = true,
  style,
  textStyle,
}) {
  const dimensions = SIZES[size] || SIZES.medium;
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  
  // Generate consistent color based on name
  const colorIndex = name ? name.charCodeAt(0) % COLORS.length : 0;
  const backgroundColor = COLORS[colorIndex];
  
  const containerStyle = {
    width: dimensions.container,
    height: dimensions.container,
    borderRadius: dimensions.container / 2,
  };

  return (
    <View style={[styles.container, style]}>
      {picture ? (
        <Image 
          source={{ uri: picture }} 
          style={[styles.image, containerStyle]}
        />
      ) : (
        <View style={[styles.placeholder, containerStyle, { backgroundColor }]}>
          <Text style={[styles.initial, { fontSize: dimensions.text }, textStyle]}>
            {initial}
          </Text>
        </View>
      )}
      
      {showMedal && rank && rank <= 3 && (
        <View style={styles.medalContainer}>
          <MedalEmblem rank={rank} size={dimensions.medal} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    color: '#fff',
    fontWeight: 'bold',
  },
  medalContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
});
