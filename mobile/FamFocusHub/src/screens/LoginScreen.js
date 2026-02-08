import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, 
  Alert, Image, Dimensions, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import biometricService from '../services/biometric.service';
import firebaseAuthService from '../services/firebase.auth.service';
import API_BASE_URL from '../services/api.config';

const { width, height } = Dimensions.get('window');

WebBrowser.maybeCompleteAuthSession();

// Pixie Greeting Component
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
          <Text style={{ fontSize: 20 }}>🧚‍♀️</Text>
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
    <Ionicons name={icon} size={22} color={color} />
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  
  // Auth mode state
  const [authMode, setAuthMode] = useState('main'); // 'main', 'login', 'signup', 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkBiometricSupport();
    firebaseAuthService.initialize();
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

  const switchMode = (mode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.5, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setAuthMode(mode);
    setError(null);
  };

  // Email/Password Login via Firebase
  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    
    setLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const result = await firebaseAuthService.signInWithEmail(email, password);
      
      if (result.success) {
        // Get Firebase ID token and exchange for session
        const idToken = await firebaseAuthService.getIdToken();
        
        // Call backend to create/sync user session
        const response = await fetch(`${API_BASE_URL}/auth/firebase-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            idToken,
            user: result.user 
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          await login(data.session_token, data.user);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          if (biometricAvailable && !biometricEnabled) {
            setTimeout(() => promptEnableBiometric(data.session_token), 1000);
          }
        } else {
          // Fall back to using Firebase user directly
          await login(idToken, result.user);
        }
      } else {
        setError(result.error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      console.error('Email login error:', err);
      setError(err.message || 'Login failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Signup via Firebase
  const handleEmailSignup = async () => {
    if (!email || !password || !displayName) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const result = await firebaseAuthService.signUpWithEmail(email, password, displayName);
      
      if (result.success) {
        const idToken = await firebaseAuthService.getIdToken();
        
        // Call backend to create user
        const response = await fetch(`${API_BASE}/api/auth/firebase-signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            idToken,
            user: result.user,
            displayName
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          await login(data.session_token, data.user);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          await login(idToken, result.user);
        }
        
        Alert.alert('Welcome!', 'Your account has been created successfully.');
      } else {
        setError(result.error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'Signup failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password
  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await firebaseAuthService.sendPasswordReset(email);
      
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Check Your Email',
          'We sent a password reset link to your email address.',
          [{ text: 'OK', onPress: () => switchMode('login') }]
        );
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  // Google Login
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
      console.error('Google login error:', err);
      setError('Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  // Biometric Login
  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    setError(null);
    
    try {
      const result = await biometricService.biometricLogin();
      
      if (result.success && result.sessionToken) {
        await login(result.sessionToken);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (!result.cancelled) {
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
      'Enable Quick Sign In?',
      'Use Face ID or Fingerprint for faster login next time?',
      [
        { text: 'Not Now', style: 'cancel' },
        { 
          text: 'Enable', 
          onPress: async () => {
            const result = await biometricService.enableBiometricLogin(token);
            if (result.success) {
              Alert.alert('Success', 'Quick sign-in enabled!');
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

  // Render email/password form
  const renderAuthForm = () => {
    if (authMode === 'login') {
      return (
        <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
          <Text style={styles.formTitle}>Welcome Back</Text>
          <Text style={styles.formSubtitle}>Sign in to continue</Text>
          
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#6b7280"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#6b7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity onPress={() => switchMode('forgot')} style={styles.forgotLink}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.primaryButton} onPress={handleEmailLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Sign In</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
          
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>
          
          <View style={styles.socialButtons}>
            <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin}>
              <Ionicons name="logo-google" size={22} color="#fff" />
            </TouchableOpacity>
            {biometricAvailable && biometricEnabled && (
              <TouchableOpacity style={styles.socialButton} onPress={handleBiometricLogin} disabled={biometricLoading}>
                {biometricLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name={getBiometricIcon()} size={22} color="#fff" />
                )}
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity onPress={() => switchMode('signup')} style={styles.switchLink}>
            <Text style={styles.switchText}>Don't have an account? <Text style={styles.switchTextBold}>Sign Up</Text></Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => switchMode('main')} style={styles.backLink}>
            <Ionicons name="arrow-back" size={18} color="#6b7280" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    }
    
    if (authMode === 'signup') {
      return (
        <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
          <Text style={styles.formTitle}>Create Account</Text>
          <Text style={styles.formSubtitle}>Join your family hub</Text>
          
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Display Name"
              placeholderTextColor="#6b7280"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#6b7280"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#6b7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.inputContainer}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#6b7280"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
            />
          </View>
          
          <TouchableOpacity style={styles.primaryButton} onPress={handleEmailSignup} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Create Account</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => switchMode('login')} style={styles.switchLink}>
            <Text style={styles.switchText}>Already have an account? <Text style={styles.switchTextBold}>Sign In</Text></Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => switchMode('main')} style={styles.backLink}>
            <Ionicons name="arrow-back" size={18} color="#6b7280" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    }
    
    if (authMode === 'forgot') {
      return (
        <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
          <Text style={styles.formTitle}>Reset Password</Text>
          <Text style={styles.formSubtitle}>We'll send you a reset link</Text>
          
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#6b7280"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <TouchableOpacity style={styles.primaryButton} onPress={handleForgotPassword} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                <Ionicons name="mail" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => switchMode('login')} style={styles.backLink}>
            <Ionicons name="arrow-back" size={18} color="#6b7280" />
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    }
    
    return null;
  };

  // Main view
  return (
    <LinearGradient colors={['#0f172a', '#1e1b4b', '#0f172a']} style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logoText}>🏠 FamFocus Hub</Text>
          </View>

          {authMode === 'main' ? (
            <>
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

              {/* Feature Cards */}
              <View style={styles.featuresGrid}>
                <FeatureCard icon="calendar" text="Smart Scheduling" color="#a78bfa" />
                <FeatureCard icon="trophy" text="Rewards System" color="#f472b6" />
                <FeatureCard icon="chatbubbles" text="Family Chat" color="#34d399" />
                <FeatureCard icon="trending-up" text="Leaderboards" color="#f87171" />
              </View>

              {/* Biometric Quick Login */}
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
                      <Text style={styles.biometricButtonText}>Quick Sign In</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Main Login Buttons */}
              <TouchableOpacity style={styles.primaryButton} onPress={() => switchMode('login')}>
                <Text style={styles.primaryButtonText}>Sign In with Email</Text>
                <Ionicons name="mail" size={20} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#fff" />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => switchMode('signup')} style={styles.createAccountLink}>
                <Text style={styles.createAccountText}>New here? <Text style={styles.createAccountBold}>Create Account</Text></Text>
              </TouchableOpacity>
            </>
          ) : (
            renderAuthForm()
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Footer */}
          <Text style={styles.footer}>
            Secure authentication powered by Firebase
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 10,
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
  heroImage: {
    width: width * 0.45,
    height: width * 0.45,
    alignSelf: 'center',
    marginVertical: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  titleGradient: {
    fontSize: 30,
    fontWeight: '900',
    color: '#818cf8',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  // Pixie Card
  pixieCard: {
    width: '100%',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  pixieGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 60,
    height: 60,
    backgroundColor: 'rgba(244, 114, 182, 0.3)',
    borderRadius: 30,
  },
  pixieContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pixieAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pixieTextContainer: { flex: 1 },
  pixieLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f472b6',
    marginBottom: 3,
  },
  pixieText: {
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },
  // Features Grid
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    gap: 8,
  },
  featureCard: {
    width: '48%',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    gap: 6,
  },
  featureText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  // Buttons
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 50,
    width: '100%',
    marginBottom: 10,
    gap: 10,
  },
  biometricButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 50,
    width: '100%',
    gap: 8,
    marginBottom: 10,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(51, 65, 85, 0.8)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 50,
    width: '100%',
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.5)',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  createAccountLink: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  createAccountText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  createAccountBold: {
    color: '#818cf8',
    fontWeight: '700',
  },
  // Form Styles
  formContainer: {
    width: '100%',
    marginTop: 20,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
  },
  eyeIcon: {
    padding: 4,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    color: '#818cf8',
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(100, 116, 139, 0.3)',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 12,
    marginHorizontal: 12,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(51, 65, 85, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
  switchLink: {
    paddingVertical: 10,
  },
  switchText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  switchTextBold: {
    color: '#818cf8',
    fontWeight: '700',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  backText: {
    color: '#6b7280',
    fontSize: 14,
  },
  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 12,
    borderRadius: 10,
    width: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    flex: 1,
  },
  footer: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
  },
});
