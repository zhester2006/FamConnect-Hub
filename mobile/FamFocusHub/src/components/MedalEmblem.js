import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Medal emblem component that shows a child's leaderboard ranking
 * Can be displayed next to profile pictures throughout the app
 */
export default function MedalEmblem({ rank, size = 'small' }) {
  if (!rank || rank > 3) return null;

  const medals = {
    1: { color: '#fbbf24', icon: 'trophy', bgColor: 'rgba(251, 191, 36, 0.3)' },
    2: { color: '#9ca3af', icon: 'medal', bgColor: 'rgba(156, 163, 175, 0.3)' },
    3: { color: '#cd7f32', icon: 'ribbon', bgColor: 'rgba(205, 127, 50, 0.3)' },
  };

  const medal = medals[rank];
  const sizes = {
    tiny: { container: 14, icon: 8 },
    small: { container: 18, icon: 10 },
    medium: { container: 24, icon: 14 },
    large: { container: 32, icon: 18 },
  };
  
  const s = sizes[size] || sizes.small;

  return (
    <View style={[
      styles.container, 
      { 
        width: s.container, 
        height: s.container, 
        backgroundColor: medal.bgColor,
        borderColor: medal.color,
      }
    ]}>
      <Ionicons name={medal.icon} size={s.icon} color={medal.color} />
    </View>
  );
}

/**
 * Avatar with medal component - combines profile picture with medal emblem
 */
export function AvatarWithMedal({ name, rank, size = 'medium', backgroundColor = '#6366f1' }) {
  const sizes = {
    small: { avatar: 32, font: 12, medal: 'tiny' },
    medium: { avatar: 40, font: 14, medal: 'small' },
    large: { avatar: 56, font: 18, medal: 'medium' },
  };
  
  const s = sizes[size] || sizes.medium;

  return (
    <View style={styles.avatarContainer}>
      <View style={[styles.avatar, { width: s.avatar, height: s.avatar, borderRadius: s.avatar / 2, backgroundColor }]}>
        <Text style={[styles.avatarText, { fontSize: s.font }]}>{name?.charAt(0) || '?'}</Text>
      </View>
      {rank && rank <= 3 && (
        <View style={styles.medalPosition}>
          <MedalEmblem rank={rank} size={s.medal} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  medalPosition: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
});
