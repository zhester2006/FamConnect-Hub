// Firebase Auth Service for FamFocus Hub
// Using React Native Firebase (Native implementation)

import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

class FirebaseAuthService {
  constructor() {
    this.currentUser = null;
    this.unsubscribe = null;
    this.isInitialized = false;
    this.authStateListeners = [];
    this.auth = null; // Reference to auth instance for external checks
    this.initializationAttempted = false;
  }

  // Initialize Firebase Auth
  async initialize() {
    try {
      if (this.isInitialized && this.auth) {
        console.log('[AuthService] Already initialized');
        return true;
      }

      console.log('[AuthService] Initializing Firebase Auth...');
      
      // Get the auth instance
      this.auth = auth();
      
      if (!this.auth) {
        console.error('[AuthService] Failed to get auth instance');
        return false;
      }

      console.log('[AuthService] Auth instance obtained');

      // Set up auth state listener
      this.unsubscribe = this.auth.onAuthStateChanged((user) => {
        console.log('[AuthService] Auth state changed:', user ? user.email : 'No user');
        this.currentUser = user;
        this.notifyListeners(user);
        
        if (user) {
          this.persistSession(user);
        } else {
          this.clearPersistedSession();
        }
      });

      this.isInitialized = true;
      this.initializationAttempted = true;
      console.log('[AuthService] Firebase Auth initialized successfully');
      return true;
    } catch (error) {
      console.error('[AuthService] Initialization error:', error.message, error.code);
      this.initializationAttempted = true;
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
    try {
      console.log('[AuthService] Attempting email sign in for:', email);
      
      // Ensure auth is initialized
      if (!this.auth) {
        console.log('[AuthService] Auth not initialized, initializing now...');
        await this.initialize();
      }
      
      if (!this.auth) {
        return {
          success: false,
          error: 'Authentication service not available. Please restart the app.',
        };
      }
      
      console.log('[AuthService] Calling signInWithEmailAndPassword...');
      const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
      console.log('[AuthService] Sign in successful for:', userCredential.user.email);
      
      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
    } catch (error) {
      console.error('[AuthService] Email sign in error:', error.code, error.message);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
      };
    }
  }

  // Create account with email and password
  async signUpWithEmail(email, password, displayName) {
    try {
      console.log('[AuthService] Attempting email sign up for:', email);
      
      // Ensure auth is initialized
      if (!this.auth) {
        console.log('[AuthService] Auth not initialized, initializing now...');
        await this.initialize();
      }
      
      if (!this.auth) {
        return {
          success: false,
          error: 'Authentication service not available. Please restart the app.',
        };
      }
      
      console.log('[AuthService] Calling createUserWithEmailAndPassword...');
      const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
      console.log('[AuthService] Sign up successful for:', userCredential.user.email);
      
      if (displayName) {
        await userCredential.user.updateProfile({ displayName });
      }

      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
    } catch (error) {
      console.error('[AuthService] Email sign up error:', error.code, error.message);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
      };
    }
  }

  // Sign in with Google (using credential)
  async signInWithGoogle(idToken) {
    try {
      console.log('[AuthService] Attempting Google sign in...');
      
      // Ensure auth is initialized
      if (!this.auth) {
        await this.initialize();
      }
      
      if (!this.auth) {
        return {
          success: false,
          error: 'Authentication service not available. Please restart the app.',
        };
      }
      
      const credential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await this.auth.signInWithCredential(credential);
      console.log('[AuthService] Google sign in successful for:', userCredential.user.email);
      
      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
    } catch (error) {
      console.error('[AuthService] Google sign in error:', error.code, error.message);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
      };
    }
  }

  // Sign out
  async signOut() {
    try {
      console.log('[AuthService] Signing out...');
      if (this.auth) {
        await this.auth.signOut();
      }
      await this.clearPersistedSession();
      console.log('[AuthService] Sign out successful');
      return { success: true };
    } catch (error) {
      console.error('[AuthService] Sign out error:', error.code, error.message);
      return { success: false, error: error.message };
    }
  }

  // Send password reset email
  async sendPasswordReset(email) {
    try {
      console.log('[AuthService] Sending password reset email to:', email);
      
      if (!this.auth) {
        await this.initialize();
      }
      
      if (!this.auth) {
        return { success: false, error: 'Authentication service not available.' };
      }
      
      await this.auth.sendPasswordResetEmail(email);
      console.log('[AuthService] Password reset email sent');
      return { success: true };
    } catch (error) {
      console.error('[AuthService] Password reset error:', error.code, error.message);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
      };
    }
  }

  // Change password
  async changePassword(currentPassword, newPassword) {
    const user = this.auth?.currentUser;
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const credential = auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);
      console.log('[AuthService] Password changed successfully');
      
      return { success: true };
    } catch (error) {
      console.error('[AuthService] Change password error:', error.code, error.message);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
      };
    }
  }

  // Update user profile
  async updateUserProfile(updates) {
    const user = this.auth?.currentUser;
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      await user.updateProfile(updates);
      return { success: true };
    } catch (error) {
      console.error('[AuthService] Update profile error:', error.code, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get current user
  getCurrentUser() {
    const user = this.auth?.currentUser;
    return user ? this.formatUser(user) : null;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.auth?.currentUser;
  }

  // Get ID token for backend authentication
  async getIdToken() {
    const user = this.auth?.currentUser;
    if (!user) {
      console.log('[AuthService] No user for getIdToken');
      return null;
    }

    try {
      const token = await user.getIdToken();
      console.log('[AuthService] Got ID token successfully');
      return token;
    } catch (error) {
      console.error('[AuthService] Get ID token error:', error.code, error.message);
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
      console.error('[AuthService] Persist session error:', error);
    }
  }

  // Clear persisted session
  async clearPersistedSession() {
    try {
      await AsyncStorage.removeItem('@firebase_session');
    } catch (error) {
      console.error('[AuthService] Clear session error:', error);
    }
  }

  // Check for persisted session
  async getPersistedSession() {
    try {
      const session = await AsyncStorage.getItem('@firebase_session');
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('[AuthService] Get persisted session error:', error);
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
      'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
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
