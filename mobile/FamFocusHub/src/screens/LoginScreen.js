import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, 
  Alert, Image, ScrollView, Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import biometricService from '../services/biometric.service';

const API_BASE = 'https://famhub-app.preview.emergentagent.com';
const { width } = Dimensions.get('window');

WebBrowser.maybeCompleteAuthSession();

// Pixie Greeting Component - Matches web app
const PixieGreeting = () => {
  const [greeting, setGreeting] = useState('');
  const greetings = [
    "Hi there! I'm Pixie, your family's digital helper! Ready to make family life easier? ✨",
    "Welcome! I'm Pixie! Let me help your family stay organized and connected! 🌟",
    "Hello, friend! Pixie here! Let's turn daily tasks into fun family adventures! 💫",
    "Hey! I'm Pixie, and I'm so excited to meet your family! Let's get started! 🎉"
  ];

  useEffect(() => {
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
  }, []);

  return (
    <View style={styles.pixieCard}>
      <View style={styles.pixieGlow} />
      <View style={styles.pixieContent}>
        <View style={styles.pixieAvatar}>
          <Ionicons name="sparkles" size={24} color="#fff" />
        </View>
        <View style={styles.pixieTextContainer}>
          <Text style={styles.pixieLabel}>Pixie - Your AI Guide</Text>
          <Text style={styles.pixieText}>{greeting}</Text>
        </View>
      </View>
    </View>
  );
};

// Feature Card Component
const FeatureCard = ({ icon, text, color }) => (
  <View style={styles.featureCard}>
    <Ionicons name={icon} size={24} color={color} />
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(null);
  const [error, setError] = useState(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const support = await biometricService.checkSupport();
      setBiometricAvailable(support.supported);
      if (support.supported) {
        setBiometricType(support.primaryType);
        const enabled = await biometricService.isBiometricLoginEnabled();
        setBiometricEnabled(enabled);
      }
    } catch (e) {
      console.log('Biometric check error:', e);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'famfocushub',
        path: 'auth/callback',
      });
      
      const result = await WebBrowser.openAuthSessionAsync(
        `https://auth.emergentagent.com/?redirect=${encodeURIComponent(API_BASE + '/dashboard')}`,
        redirectUri
      );
      
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const token = url.searchParams.get('token') || url.searchParams.get('session_token');
        
        if (token) {
          await login(token);
          if (biometricAvailable && !biometricEnabled) {
            setTimeout(() => promptEnableBiometric(token), 1000);
          }
        } else {
          throw new Error('No token received');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Dev Login - Uses the same endpoint as web app
  const handleDevLogin = async (role = 'parent') => {
    setDevLoading(role);
    setError(null);
    
    try {
      console.log(`Attempting dev login as ${role}...`);
      
      const response = await fetch(`${API_BASE}/api/auth/dev-login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ role }),
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Dev login error response:', errorText);
        throw new Error(`Login failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Dev login response:', data);
      
      if (data.session_token) {
        await login(data.session_token, data.user);
        
        if (biometricAvailable && !biometricEnabled) {
          setTimeout(() => promptEnableBiometric(data.session_token), 1000);
        }
      } else {
        throw new Error('No session token received');
      }
    } catch (err) {
      console.error('Dev login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setDevLoading(null);
    }
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    setError(null);
    
    try {
      const result = await biometricService.biometricLogin();
      
      if (result.success && result.sessionToken) {
        await login(result.sessionToken);
      } else if (result.cancelled) {
        // User cancelled
      } else {
        setError(result.error || 'Biometric login failed');
        if (result.error?.includes('Session expired')) {
          setBiometricEnabled(false);
        }
      }
    } catch (err) {
      console.error('Biometric login error:', err);
      setError('Biometric login failed');
    } finally {
      setBiometricLoading(false);
    }
  };

  const promptEnableBiometric = (token) => {
    Alert.alert(
      `Enable ${biometricType}?`,
      `Would you like to use ${biometricType} for faster login next time?`,
      [
        { text: 'Not Now', style: 'cancel' },
        { 
          text: 'Enable', 
          onPress: async () => {
            const result = await biometricService.enableBiometricLogin(token);
            if (result.success) {
              Alert.alert('Success', `${biometricType} login enabled!`);
              setBiometricEnabled(true);
            }
          }
        }
      ]
    );
  };

  const getBiometricIcon = () => {
    if (biometricType === 'Face ID') return 'scan';
    if (biometricType === 'Touch ID') return 'finger-print';
    return 'lock-closed';
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e1b4b', '#0f172a']} style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Logo */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Image 
              source={{ uri: 'https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/2ku9mapg_app_logo.png.png' }}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>FamFocus Hub</Text>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Hero Image */}
          <Image 
            source={{ uri: 'https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/tqccfghc_startup.gif.gif' }}
            style={styles.heroImage}
            resizeMode="contain"
          />

          {/* Title */}
          <Text style={styles.title}>Welcome to Your</Text>
          <Text style={styles.titleGradient}>Family Space</Text>
          <Text style={styles.subtitle}>
            A place where keeping up with the day-to-day is no longer a chore within itself
          </Text>

          {/* Pixie Greeting */}
          <PixieGreeting />

          {/* Feature Cards - 2x2 Grid */}
          <View style={styles.featuresGrid}>
            <FeatureCard icon="calendar" text="Smart Scheduling" color="#a78bfa" />
            <FeatureCard icon="trophy" text="Rewards System" color="#f472b6" />
            <FeatureCard icon="chatbubbles" text="Family Chat" color="#34d399" />
            <FeatureCard icon="trending-up" text="Leaderboards" color="#f87171" />
          </View>

          {/* Biometric Login Button */}
          {biometricAvailable && biometricEnabled && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={biometricLoading}
            >
              {biometricLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name={getBiometricIcon()} size={24} color="#fff" />
                  <Text style={styles.biometricButtonText}>Sign in with {biometricType}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Google Login Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.googleButtonText}>Sign In with Google</Text>
                <Ionicons name="sparkles" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          {/* Dev Login Buttons - Match web app style */}
          <View style={styles.devButtons}>
            <TouchableOpacity
              style={styles.devButton}
              onPress={() => handleDevLogin('parent')}
              disabled={devLoading !== null}
            >
              {devLoading === 'parent' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.devButtonText}>Dev: Parent Login</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.devButton}
              onPress={() => handleDevLogin('child')}
              disabled={devLoading !== null}
            >
              {devLoading === 'child' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.devButtonText}>Dev: Child Login</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Footer */}
          <Text style={styles.footer}>
            Secure authentication powered by Google
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroImage: {
    width: width * 0.5,
    height: width * 0.5,
    marginVertical: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  titleGradient: {
    fontSize: 32,
    fontWeight: '900',
    color: '#818cf8',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  // Pixie Card Styles
  pixieCard: {
    width: '100%',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  pixieGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    backgroundColor: 'rgba(244, 114, 182, 0.3)',
    borderRadius: 40,
  },
  pixieContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pixieAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pixieTextContainer: {
    flex: 1,
  },
  pixieLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f472b6',
    marginBottom: 4,
  },
  pixieText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  // Features Grid
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    gap: 10,
  },
  featureCard: {
    width: '48%',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    gap: 8,
  },
  featureText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  // Buttons
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 50,
    width: '100%',
    marginBottom: 12,
    gap: 10,
  },
  biometricButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 50,
    width: '100%',
    gap: 10,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  devButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 12,
  },
  devButton: {
    flex: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.5)',
  },
  devButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 12,
    borderRadius: 10,
    width: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  footer: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
});
