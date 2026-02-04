import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import biometricService from '../services/biometric.service';

const API_BASE = 'https://family-central-8.preview.emergentagent.com';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [error, setError] = useState(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    const support = await biometricService.checkSupport();
    setBiometricAvailable(support.supported);
    if (support.supported) {
      setBiometricType(support.primaryType);
      const enabled = await biometricService.isBiometricLoginEnabled();
      setBiometricEnabled(enabled);
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
        `${API_BASE}/api/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`,
        redirectUri
      );
      
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const token = url.searchParams.get('token') || url.searchParams.get('session_token');
        
        if (token) {
          await login(token);
          
          // Offer to enable biometric if supported
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

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    setError(null);
    
    try {
      const result = await biometricService.biometricLogin();
      
      if (result.success && result.sessionToken) {
        await login(result.sessionToken);
      } else if (result.cancelled) {
        // User cancelled, do nothing
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

  const handleDemoLogin = async (role) => {
    setLoading(true);
    setError(null);
    
    try {
      const demoToken = role === 'parent' ? 'demo_parent_session' : 'demo_child_session';
      await login(demoToken);
      
      // Offer biometric setup for demo too
      if (biometricAvailable && !biometricEnabled) {
        setTimeout(() => promptEnableBiometric(demoToken), 1000);
      }
    } catch (err) {
      setError('Demo login failed');
    } finally {
      setLoading(false);
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
    <LinearGradient colors={['#1e1b4b', '#312e81', '#1e1b4b']} style={styles.container}>
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
            { icon: 'chatbubbles', text: 'Real-time Family Chat' },
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
          {/* Biometric Login (if enabled) */}
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
                  <Ionicons name={getBiometricIcon()} size={28} color="#fff" />
                  <Text style={styles.biometricButtonText}>Sign in with {biometricType}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Google Login */}
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

          {/* Demo buttons */}
          <View style={styles.demoButtons}>
            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => handleDemoLogin('parent')}
              disabled={loading}
            >
              <Ionicons name="shield" size={18} color="#a5b4fc" />
              <Text style={styles.demoButtonText}>Demo Parent</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.demoButton, styles.demoButtonChild]}
              onPress={() => handleDemoLogin('child')}
              disabled={loading}
            >
              <Ionicons name="happy" size={18} color="#6ee7b7" />
              <Text style={[styles.demoButtonText, { color: '#6ee7b7' }]}>Demo Child</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Biometric Setup Hint */}
        {biometricAvailable && !biometricEnabled && (
          <View style={styles.biometricHint}>
            <Ionicons name={getBiometricIcon()} size={16} color="#a5b4fc" />
            <Text style={styles.biometricHintText}>
              {biometricType} login available after sign in
            </Text>
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
  container: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  logoContainer: { width: 80, height: 80, borderRadius: 20, backgroundColor: 'rgba(99, 102, 241, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#a5b4fc' },
  features: { marginBottom: 40 },
  featureItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  featureText: { marginLeft: 12, fontSize: 16, color: '#c7d2fe' },
  buttons: { gap: 12 },
  biometricButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10b981', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, gap: 12 },
  biometricButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4285f4', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, gap: 12 },
  googleButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  demoButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  demoButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(99, 102, 241, 0.2)', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, gap: 8 },
  demoButtonChild: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  demoButtonText: { color: '#a5b4fc', fontSize: 14, fontWeight: '600' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8 },
  errorText: { color: '#ef4444', fontSize: 14 },
  biometricHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6 },
  biometricHintText: { color: '#a5b4fc', fontSize: 13 },
  footer: { color: '#6366f1', fontSize: 12, textAlign: 'center', marginTop: 32 },
});
