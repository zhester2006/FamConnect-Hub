// Firebase Auth Service for FamFocus Hub
// Handles Firebase Authentication with email/password and Google Sign-In

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  sendPasswordResetEmail,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';
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
      if (this.isInitialized && this.auth) {
        return true;
      }

      // Initialize Firebase app
      if (!getApps().length) {
        this.app = initializeApp(firebaseConfig);
      } else {
        this.app = getApp();
      }

      // Initialize Auth with AsyncStorage persistence for React Native
      try {
        this.auth = initializeAuth(this.app, {
          persistence: getReactNativePersistence(AsyncStorage)
        });
      } catch (error) {
        // Auth might already be initialized
        if (error.code === 'auth/already-initialized') {
          this.auth = getAuth(this.app);
        } else {
          console.warn('Auth init warning:', error.message);
          this.auth = getAuth(this.app);
        }
      }
      
      this.isInitialized = true;

      // Listen for auth state changes
      this.unsubscribe = onAuthStateChanged(this.auth, (user) => {
        this.currentUser = user;
        this.notifyListeners(user);
        
        if (user) {
          this.persistSession(user);
        } else {
          this.clearPersistedSession();
        }
      });

      console.log('Firebase Auth initialized');
      return true;
    } catch (error) {
      console.error('Firebase Auth initialization error:', error);
      this.isInitialized = true;
      return false;
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

  // Sign in with email and password
  async signInWithEmail(email, password) {
    if (!this.auth) {
      await this.initialize();
    }

    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
    } catch (error) {
      console.error('Email sign in error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
      };
    }
  }

  // Create account with email and password
  async signUpWithEmail(email, password, displayName) {
    if (!this.auth) {
      await this.initialize();
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }

      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
    } catch (error) {
      console.error('Email sign up error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
      };
    }
  }

  // Sign in with Google
  async signInWithGoogle(idToken) {
    if (!this.auth) {
      await this.initialize();
    }

    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(this.auth, credential);
      
      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
    } catch (error) {
      console.error('Google sign in error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
      };
    }
  }

  // Sign out
  async signOut() {
    try {
      if (this.auth) {
        await firebaseSignOut(this.auth);
      }
      await this.clearPersistedSession();
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send password reset email
  async sendPasswordReset(email) {
    if (!this.auth) {
      await this.initialize();
    }

    try {
      await sendPasswordResetEmail(this.auth, email);
      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
      };
    }
  }

  // Change password
  async changePassword(currentPassword, newPassword) {
    if (!this.auth || !this.auth.currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const credential = EmailAuthProvider.credential(
        this.auth.currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(this.auth.currentUser, credential);
      await updatePassword(this.auth.currentUser, newPassword);
      
      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
      };
    }
  }

  // Update user profile
  async updateUserProfile(updates) {
    if (!this.auth || !this.auth.currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      await updateProfile(this.auth.currentUser, updates);
      return { success: true };
    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser ? this.formatUser(this.currentUser) : null;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }

  // Get ID token for backend authentication
  async getIdToken() {
    if (!this.currentUser) {
      return null;
    }

    try {
      return await this.currentUser.getIdToken();
    } catch (error) {
      console.error('Get ID token error:', error);
      return null;
    }
  }

  // Format Firebase user to app user format
  formatUser(firebaseUser) {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      emailVerified: firebaseUser.emailVerified,
      user_id: firebaseUser.uid,
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
      picture: firebaseUser.photoURL,
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
      console.error('Persist session error:', error);
    }
  }

  // Clear persisted session
  async clearPersistedSession() {
    try {
      await AsyncStorage.removeItem('@firebase_session');
    } catch (error) {
      console.error('Clear session error:', error);
    }
  }

  // Check for persisted session
  async getPersistedSession() {
    try {
      const session = await AsyncStorage.getItem('@firebase_session');
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('Get persisted session error:', error);
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
      'auth/operation-not-allowed': 'This sign-in method is not enabled',
      'auth/requires-recent-login': 'Please sign in again to perform this action',
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
