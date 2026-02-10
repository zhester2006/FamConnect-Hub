// Firebase Auth Service for FamFocus Hub
// Using React Native Firebase (Native implementation)

import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

class FirebaseAuthService {
  constructor() {
    this.currentUser = null;
    this.unsubscribe = null;
    this.isInitialized = false;
    this.authStateListeners = [];
    this.auth = null;
    this.initializationAttempted = false;
  }

  // Initialize Firebase Auth
  async initialize() {
    if (this.isInitialized && this.auth) {
      console.log('[AuthService] Already initialized');
      return true;
    }

    try {
      console.log('[AuthService] Initializing Firebase Auth...');
      this.auth = auth();

      if (!this.auth) {
        throw new Error('[AuthService] Failed to get Firebase Auth instance.');
      }

      // Listen for auth state changes
      this.unsubscribe = this.auth.onAuthStateChanged((user) => {
        console.log('[AuthService] Auth state changed:', user ? user.email : 'null');
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
      console.error('[AuthService] Initialization error:', error.message);
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

  // Notify listeners of auth state changes
  notifyListeners(user) {
    this.authStateListeners.forEach((listener) => listener(user));
  }

  // Sign in with email and password
  async signInWithEmail(email, password) {
    try {
      if (!this.auth) await this.initialize();
      
      console.log('[AuthService] Signing in with email:', email);
      const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
      console.log('[AuthService] Sign in successful');
      
      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
    } catch (error) {
      console.error('[AuthService] Email sign-in error:', error.code, error.message);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
      };
    }
  }

  // Create account with email and password
  async signUpWithEmail(email, password, displayName) {
    try {
      if (!this.auth) await this.initialize();
      
      console.log('[AuthService] Creating account for:', email);
      const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
      
      // Update display name if provided
      if (displayName && userCredential.user) {
        await userCredential.user.updateProfile({ displayName });
      }
      
      console.log('[AuthService] Account created successfully');
      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
    } catch (error) {
      console.error('[AuthService] Email sign-up error:', error.code, error.message);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
      };
    }
  }

  // Sign in with Google (using ID token from Google Sign-In)
  async signInWithGoogle(idToken) {
    try {
      if (!this.auth) await this.initialize();
      if (!idToken) throw new Error('Google ID token is required.');

      console.log('[AuthService] Signing in with Google...');
      const credential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await this.auth.signInWithCredential(credential);
      
      console.log('[AuthService] Google sign-in successful');
      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
    } catch (error) {
      console.error('[AuthService] Google sign-in error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Sign out
  async signOut() {
    try {
      if (this.auth) {
        await this.auth.signOut();
      }
      await this.clearPersistedSession();
      console.log('[AuthService] Sign out successful');
      return { success: true };
    } catch (error) {
      console.error('[AuthService] Sign out error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send password reset email
  async sendPasswordReset(email) {
    try {
      if (!this.auth) await this.initialize();
      
      await this.auth.sendPasswordResetEmail(email);
      console.log('[AuthService] Password reset email sent');
      return { success: true };
    } catch (error) {
      console.error('[AuthService] Password reset error:', error);
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
      const user = this.auth.currentUser;
      const credential = auth.EmailAuthProvider.credential(user.email, currentPassword);
      
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);
      
      console.log('[AuthService] Password changed successfully');
      return { success: true };
    } catch (error) {
      console.error('[AuthService] Change password error:', error);
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
      await this.auth.currentUser.updateProfile(updates);
      console.log('[AuthService] Profile updated successfully');
      return { success: true };
    } catch (error) {
      console.error('[AuthService] Update profile error:', error);
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
      console.error('[AuthService] Get ID token error:', error);
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
      console.error('[AuthService] Persist session error:', error.message);
    }
  }

  // Clear persisted session
  async clearPersistedSession() {
    try {
      await AsyncStorage.removeItem('@firebase_session');
    } catch (error) {
      console.error('[AuthService] Clear session error:', error.message);
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
      'auth/invalid-credential': 'Invalid email or password',
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
    this.isInitialized = false;
  }
}

const firebaseAuthService = new FirebaseAuthService();
export default firebaseAuthService;
