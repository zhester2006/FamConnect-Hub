import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Page-specific color themes matching web app
const PAGE_THEMES = {
  dashboard: {
    gradientColors: ['#1e1b4b', '#312e81', '#1e1b4b'],
    particleColor: 'rgba(147, 51, 234, 0.15)',
  },
  homehub: {
    gradientColors: ['#0f172a', '#1e293b', '#0f172a'],
    particleColor: 'rgba(59, 130, 246, 0.12)',
  },
  chat: {
    gradientColors: ['#1e1b4b', '#312e81', '#1e1b4b'],
    particleColor: 'rgba(99, 102, 241, 0.15)',
  },
  calendar: {
    gradientColors: ['#0f172a', '#1e3a5f', '#0f172a'],
    particleColor: 'rgba(6, 182, 212, 0.12)',
  },
  chores: {
    gradientColors: ['#064e3b', '#065f46', '#064e3b'],
    particleColor: 'rgba(16, 185, 129, 0.15)',
  },
  rewards: {
    gradientColors: ['#1e1b4b', '#4c1d95', '#1e1b4b'],
    particleColor: 'rgba(251, 191, 36, 0.15)',
  },
  wall: {
    gradientColors: ['#1f2937', '#374151', '#1f2937'],
    particleColor: 'rgba(236, 72, 153, 0.12)',
  },
  shopping: {
    gradientColors: ['#0c4a6e', '#0369a1', '#0c4a6e'],
    particleColor: 'rgba(56, 189, 248, 0.15)',
  },
  dinner: {
    gradientColors: ['#7c2d12', '#9a3412', '#7c2d12'],
    particleColor: 'rgba(251, 146, 60, 0.15)',
  },
  location: {
    gradientColors: ['#14532d', '#166534', '#14532d'],
    particleColor: 'rgba(34, 197, 94, 0.15)',
  },
  settings: {
    gradientColors: ['#1e1b4b', '#312e81', '#1e1b4b'],
    particleColor: 'rgba(165, 180, 252, 0.12)',
  },
  default: {
    gradientColors: ['#1e1b4b', '#312e81', '#1e1b4b'],
    particleColor: 'rgba(147, 51, 234, 0.15)',
  },
};

const Particle = ({ delay, duration, startX, startY, size, color }) => {
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const runAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animation, {
            toValue: 1,
            duration: duration,
            delay: delay,
            useNativeDriver: true,
          }),
          Animated.timing(animation, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    runAnimation();
  }, []);

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  const opacity = animation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: startX,
          top: startY,
          width: size,
          height: size,
          backgroundColor: color,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    />
  );
};

export default function AnimatedBackground({ page = 'default', children }) {
  const theme = PAGE_THEMES[page] || PAGE_THEMES.default;
  
  // Generate random particles
  const particles = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      delay: Math.random() * 3000,
      duration: 15000 + Math.random() * 10000,
      startX: Math.random() * width,
      startY: height * 0.2 + Math.random() * height * 0.6,
      size: 40 + Math.random() * 80,
    }));
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradientColors}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={styles.particlesContainer} pointerEvents="none">
        {particles.map((p) => (
          <Particle
            key={p.id}
            delay={p.delay}
            duration={p.duration}
            startX={p.startX}
            startY={p.startY}
            size={p.size}
            color={theme.particleColor}
          />
        ))}
      </View>
      {children}
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
  particlesContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    borderRadius: 100,
  },
});
