// Firebase Auth Service for FamFocus Hub
// Note: Full Firebase Auth requires a development build, not Expo Go
// In Expo Go, authentication uses the backend API instead

import { initializeApp, getApps, getApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import firebaseConfig from './firebase.config';

WebBrowser.maybeCompleteAuthSession();

class FirebaseAuthService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.currentUser = null;
    this.unsubscribe = null;
    this.isInitialized = false;
    this.authStateListeners = [];
  }

  // Initialize Firebase Auth
  async initialize() {
    try {
      if (this.isInitialized) {
        return true;
      }

      // Initialize Firebase app
      if (!getApps().length) {
        this.app = initializeApp(firebaseConfig);
      } else {
        this.app = getApp();
      }

      // Skip Firebase Auth in Expo Go - use backend API instead
      // Firebase Auth with persistence requires native modules not available in Expo Go
      console.log('Firebase Auth: Using backend API for authentication (Expo Go mode)');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.log('Firebase Auth initialization skipped:', error.message);
      this.isInitialized = true;
      return true; // Don't block the app
    }
  }

  // Add auth state listener
  addAuthStateListener(listener) {
    this.authStateListeners.push(listener);
    if (this.currentUser !== undefined) {
      listener(this.currentUser);
    }
  }

  // Remove auth state listener
  removeAuthStateListener(listener) {
    this.authStateListeners = this.authStateListeners.filter(l => l !== listener);
  }

  // Notify all listeners
  notifyListeners(user) {
    this.authStateListeners.forEach(listener => listener(user));
  }

  // Sign in with email and password - Not available in Expo Go
  async signInWithEmail(email, password) {
    console.log('Firebase Auth not available in Expo Go - use backend API');
    return {
      success: false,
      error: 'Firebase Auth requires a development build. Use Dev Login instead.',
    };
  }

  // Create account with email and password - Not available in Expo Go
  async signUpWithEmail(email, password, displayName) {
    console.log('Firebase Auth not available in Expo Go - use backend API');
    return {
      success: false,
      error: 'Firebase Auth requires a development build. Use Dev Login instead.',
    };
  }

  // Sign in with Google - Not available in Expo Go
  async signInWithGoogle(idToken) {
    console.log('Firebase Auth not available in Expo Go - use backend API');
    return {
      success: false,
      error: 'Google Sign-In requires a development build.',
    };
  }

  // Sign out
  async signOut() {
    this.currentUser = null;
    await this.clearPersistedSession();
    return { success: true };
  }

  // Send password reset email - Not available in Expo Go
  async sendPasswordReset(email) {
    return {
      success: false,
      error: 'Password reset requires a development build.',
    };
  }

  // Change password - Not available in Expo Go
  async changePassword(currentPassword, newPassword) {
    return { success: false, error: 'Not available in Expo Go' };
  }

  // Update user profile - Not available in Expo Go
  async updateUserProfile(updates) {
    return { success: false, error: 'Not available in Expo Go' };
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser ? this.formatUser(this.currentUser) : null;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }

  // Get ID token - Not available in Expo Go
  async getIdToken() {
    return null;
  }

  // Format user object
  formatUser(user) {
    if (!user) return null;
    return {
      uid: user.uid || user.user_id,
      email: user.email,
      displayName: user.displayName || user.name,
      photoURL: user.photoURL || user.picture,
      user_id: user.uid || user.user_id,
      name: user.displayName || user.name,
      picture: user.photoURL || user.picture,
    };
  }

  // Persist session to AsyncStorage
  async persistSession(user) {
    try {
      const sessionData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem('@firebase_session', JSON.stringify(sessionData));
    } catch (error) {
      console.log('Persist session error:', error);
    }
  }

  // Clear persisted session
  async clearPersistedSession() {
    try {
      await AsyncStorage.removeItem('@firebase_session');
    } catch (error) {
      console.log('Clear session error:', error);
    }
  }

  // Check for persisted session
  async getPersistedSession() {
    try {
      const session = await AsyncStorage.getItem('@firebase_session');
      return session ? JSON.parse(session) : null;
    } catch (error) {
      return null;
    }
  }

  // Get user-friendly error message
  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/invalid-email': 'Invalid email address',
      'auth/user-disabled': 'This account has been disabled',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'An account already exists with this email',
      'auth/weak-password': 'Password should be at least 6 characters',
      'auth/network-request-failed': 'Network error. Please check your connection',
      'auth/too-many-requests': 'Too many attempts. Please try again later',
    };
    return errorMessages[errorCode] || 'An error occurred. Please try again.';
  }

  // Cleanup
  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.authStateListeners = [];
    this.currentUser = null;
  }
}

const firebaseAuthService = new FirebaseAuthService();
export default firebaseAuthService;
