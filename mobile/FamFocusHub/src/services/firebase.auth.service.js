// Firebase Authentication Service for FamFocus Hub
// Provides Google Sign-In, Email/Password, and Phone authentication

import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { getApp } from 'firebase/app';
import * as Google from 'expo-auth-session/providers/google';
import AsyncStorage from '@react-native-async-storage/async-storage';

class FirebaseAuthService {
  constructor() {
    this.auth = null;
    this.isInitialized = false;
    this.currentUser = null;
    this.authStateListeners = [];
  }

  initialize() {
    try {
      const app = getApp();
      this.auth = getAuth(app);
      
      // Listen for auth state changes
      onAuthStateChanged(this.auth, (user) => {
        this.currentUser = user;
        this.notifyListeners(user);
      });
      
      this.isInitialized = true;
      console.log('Firebase Auth initialized');
      return true;
    } catch (error) {
      console.error('Firebase Auth initialization error:', error);
      return false;
    }
  }

  // Add auth state listener
  addAuthStateListener(callback) {
    this.authStateListeners.push(callback);
    // Immediately call with current state
    if (this.currentUser !== undefined) {
      callback(this.currentUser);
    }
  }

  // Remove auth state listener
  removeAuthStateListener(callback) {
    this.authStateListeners = this.authStateListeners.filter(cb => cb !== callback);
  }

  // Notify all listeners
  notifyListeners(user) {
    this.authStateListeners.forEach(callback => callback(user));
  }

  // Email/Password Sign Up
  async signUpWithEmail(email, password, displayName) {
    if (!this.isInitialized) {
      throw new Error('Firebase Auth not initialized');
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Update display name
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }
      
      return {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: displayName || userCredential.user.displayName,
        photoURL: userCredential.user.photoURL,
      };
    } catch (error) {
      console.error('Sign up error:', error);
      throw this.parseAuthError(error);
    }
  }

  // Email/Password Sign In
  async signInWithEmail(email, password) {
    if (!this.isInitialized) {
      throw new Error('Firebase Auth not initialized');
    }

    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName,
        photoURL: userCredential.user.photoURL,
      };
    } catch (error) {
      console.error('Sign in error:', error);
      throw this.parseAuthError(error);
    }
  }

  // Google Sign In (for Expo)
  async signInWithGoogle(idToken) {
    if (!this.isInitialized) {
      throw new Error('Firebase Auth not initialized');
    }

    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(this.auth, credential);
      return {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName,
        photoURL: userCredential.user.photoURL,
      };
    } catch (error) {
      console.error('Google sign in error:', error);
      throw this.parseAuthError(error);
    }
  }

  // Sign Out
  async signOut() {
    if (!this.isInitialized) return;

    try {
      await signOut(this.auth);
      await AsyncStorage.removeItem('firebaseUser');
      this.currentUser = null;
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Send Password Reset Email
  async sendPasswordReset(email) {
    if (!this.isInitialized) {
      throw new Error('Firebase Auth not initialized');
    }

    try {
      await sendPasswordResetEmail(this.auth, email);
      return true;
    } catch (error) {
      console.error('Password reset error:', error);
      throw this.parseAuthError(error);
    }
  }

  // Update User Profile
  async updateUserProfile(updates) {
    if (!this.auth.currentUser) {
      throw new Error('No user logged in');
    }

    try {
      await updateProfile(this.auth.currentUser, updates);
      return true;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is logged in
  isLoggedIn() {
    return !!this.currentUser;
  }

  // Get ID token for API calls
  async getIdToken() {
    if (!this.auth.currentUser) return null;
    
    try {
      return await this.auth.currentUser.getIdToken();
    } catch (error) {
      console.error('Get ID token error:', error);
      return null;
    }
  }

  // Parse Firebase auth errors into user-friendly messages
  parseAuthError(error) {
    const errorMessages = {
      'auth/email-already-in-use': 'This email is already registered',
      'auth/invalid-email': 'Invalid email address',
      'auth/operation-not-allowed': 'Operation not allowed',
      'auth/weak-password': 'Password is too weak (min 6 characters)',
      'auth/user-disabled': 'This account has been disabled',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/too-many-requests': 'Too many attempts. Please try again later',
      'auth/network-request-failed': 'Network error. Please check your connection',
    };

    const message = errorMessages[error.code] || error.message || 'An error occurred';
    return new Error(message);
  }
}

const firebaseAuthService = new FirebaseAuthService();
export default firebaseAuthService;
