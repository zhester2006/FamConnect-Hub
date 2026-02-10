// Firebase Central Service for FamFocus Hub
// Using React Native Firebase (Native implementation)

import firebase from '@react-native-firebase/app';
import firebaseChatService from './firebase.chat.service';
import firebaseStorageService from './firebase.storage.service';
import firebaseAuthService from './firebase.auth.service';
import firebaseNotificationService from './firebase.notification.service';
import firebaseFamilyWallService from './firebase.familywall.service';

class FirebaseService {
  constructor() {
    this.app = null;
    this.isInitialized = false;
  }

  // Initialize all Firebase services
  async initialize() {
    if (this.isInitialized) {
      console.log('[FirebaseService] Already initialized');
      return true;
    }

    try {
      // React Native Firebase auto-initializes from google-services.json
      const apps = firebase.apps;
      
      if (apps.length > 0) {
        this.app = apps[0];
        console.log('[FirebaseService] Native Firebase app found:', this.app.name);
      } else {
        console.warn('[FirebaseService] No Firebase apps found');
        return false;
      }

      // Initialize services
      const results = await Promise.allSettled([
        firebaseChatService.initialize(),
        firebaseStorageService.initialize(),
        firebaseAuthService.initialize(),
        firebaseNotificationService.initialize(),
        firebaseFamilyWallService.initialize(),
      ]);

      // Check results
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== false).length;
      this.isInitialized = successCount > 0;
      
      console.log(`[FirebaseService] Services initialized: ${successCount}/${results.length}`);

      return this.isInitialized;
    } catch (error) {
      console.error('[FirebaseService] Initialization error:', error);
      return false;
    }
  }

  // Set user for all services that need it
  setUser(userId, userName, userPicture, familyId) {
    firebaseChatService.setUser(userId, userName, userPicture, familyId);
    firebaseFamilyWallService.setUser(userId, userName, userPicture, familyId);
  }

  // Cleanup all services
  cleanup() {
    firebaseChatService.reset();
    firebaseFamilyWallService.reset();
    firebaseNotificationService.cleanup();
    firebaseAuthService.cleanup();
  }

  // Get services
  get chat() { return firebaseChatService; }
  get storage() { return firebaseStorageService; }
  get auth() { return firebaseAuthService; }
  get notifications() { return firebaseNotificationService; }
  get familyWall() { return firebaseFamilyWallService; }
}

const firebaseService = new FirebaseService();
export default firebaseService;

// Also export individual services for direct access
export {
  firebaseChatService,
  firebaseStorageService,
  firebaseAuthService,
  firebaseNotificationService,
  firebaseFamilyWallService,
};
