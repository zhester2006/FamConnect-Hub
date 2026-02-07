// Firebase Central Service for FamFocus Hub
// Initializes all Firebase services in one place

import { initializeApp, getApps, getApp } from 'firebase/app';
import firebaseConfig from './firebase.config';
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

  // Initialize all Firebase services (except auth - that's handled separately in AuthContext)
  async initialize() {
    if (this.isInitialized) {
      console.log('Firebase services already initialized');
      return true;
    }

    try {
      // Initialize Firebase app
      if (!getApps().length) {
        this.app = initializeApp(firebaseConfig);
      } else {
        this.app = getApp();
      }

      // Initialize services (auth is initialized separately via firebase.init.js)
      const results = await Promise.allSettled([
        firebaseChatService.initialize(),
        firebaseStorageService.initialize(),
        // Auth is initialized in AuthContext first, but we can call it here as a no-op if already done
        firebaseAuthService.initialize(),
        firebaseNotificationService.initialize(),
        firebaseFamilyWallService.initialize(),
      ]);

      // Check results
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== false).length;
      this.isInitialized = successCount > 0;
      
      if (this.isInitialized) {
        console.log(`Firebase services initialized: ${successCount}/${results.length}`);
      } else {
        console.warn('Some Firebase services failed to initialize');
      }

      return this.isInitialized;
    } catch (error) {
      console.error('Firebase initialization error:', error);
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
