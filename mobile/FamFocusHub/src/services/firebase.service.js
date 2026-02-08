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
    this.isInitialized = false;
  }

  // Initialize all Firebase services
  async initialize() {
    if (this.isInitialized) {
      console.log('[FirebaseService] Already initialized');
      return true;
    }

    try {
      // React Native Firebase initializes automatically from google-services.json
      console.log('[FirebaseService] Firebase apps:', firebase.apps.length);

      // Initialize services
      const results = await Promise.allSettled([
        firebaseChatService.initialize(),
        firebaseStorageService.initialize(),
        firebaseAuthService.initialize(),
        firebaseNotificationService.initialize(),
        firebaseFamilyWallService.initialize(),
      ]);

      const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== false).length;
      this.isInitialized = successCount > 0;
      
      if (this.isInitialized) {
        console.log(`[FirebaseService] Services initialized: ${successCount}/${results.length}`);
      } else {
        console.warn('[FirebaseService] Some services failed to initialize');
      }

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
