import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'https://family-central-8.preview.emergentagent.com';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Open browser for OAuth
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_BASE}/api/auth/google`,
        AuthSession.makeRedirectUri({ useProxy: true })
      );
      
      if (result.type === 'success' && result.url) {
        // Extract session token from callback URL
        const url = new URL(result.url);
        const token = url.searchParams.get('token');
        if (token) {
          await login(token);
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // For development/testing - mock login
  const handleDemoLogin = async (role) => {
    setLoading(true);
    try {
      // Use a demo session for testing
      const demoToken = role === 'parent' ? 'demo_parent_session' : 'demo_child_session';
      await login(demoToken);
    } catch (err) {
      setError('Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#1e1b4b', '#312e81', '#1e1b4b']}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Logo/Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="home" size={48} color="#818cf8" />
          </View>
          <Text style={styles.title}>FamFocus Hub</Text>
          <Text style={styles.subtitle}>Your Family Command Center</Text>
        </View>

        {/* Features List */}
        <View style={styles.features}>
          {[
            { icon: 'checkmark-circle', text: 'Manage Chores & Tasks' },
            { icon: 'chatbubbles', text: 'Family Chat' },
            { icon: 'calendar', text: 'Shared Calendar' },
            { icon: 'trophy', text: 'Rewards & Leaderboard' },
          ].map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name={feature.icon} size={20} color="#a5b4fc" />
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>

        {/* Login Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-google" size={24} color="#fff" />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Demo buttons for testing */}
          <View style={styles.demoButtons}>
            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => handleDemoLogin('parent')}
            >
              <Text style={styles.demoButtonText}>Demo (Parent)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.demoButton, styles.demoButtonChild]}
              onPress={() => handleDemoLogin('child')}
            >
              <Text style={styles.demoButtonText}>Demo (Child)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          By continuing, you agree to our Terms of Service
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a5b4fc',
  },
  features: {
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#c7d2fe',
  },
  buttons: {
    gap: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285f4',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  demoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  demoButton: {
    flex: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  demoButtonChild: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  demoButtonText: {
    color: '#c7d2fe',
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  footer: {
    color: '#6366f1',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
  },
});
