// Centralized Firebase initialization using React Native Firebase (Native)
// This provides much more reliable Firebase integration than the JS SDK

import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import storage from '@react-native-firebase/storage';

// React Native Firebase initializes automatically from google-services.json
// No manual configuration needed!

let isInitialized = false;

// Initialize Firebase (mostly a no-op since RN Firebase auto-initializes)
export function initializeFirebase() {
  if (isInitialized) {
    return { app: firebase, auth: auth(), database: database(), storage: storage() };
  }

  try {
    // Check if Firebase is configured
    if (firebase.apps.length > 0) {
      console.log('[Firebase] Native Firebase initialized successfully');
      isInitialized = true;
    } else {
      console.log('[Firebase] Waiting for native Firebase initialization...');
    }
  } catch (error) {
    console.error('[Firebase] Initialization check error:', error.message);
  }

  return { app: firebase, auth: auth(), database: database(), storage: storage() };
}

// Get Firebase Auth instance - synchronous with native Firebase!
export function initializeFirebaseAuth() {
  return Promise.resolve(auth());
}

export function getFirebaseApp() {
  return firebase;
}

export function getFirebaseAuth() {
  return auth();
}

export function getFirebaseDatabase() {
  return database();
}

export function getFirebaseStorage() {
  return storage();
}

// Reset function for testing/logout
export function resetFirebase() {
  // Native Firebase manages its own state
  console.log('[Firebase] Reset called');
}

// Initialize immediately
initializeFirebase();

export default { 
  initializeFirebase, 
  initializeFirebaseAuth,
  getFirebaseApp, 
  getFirebaseAuth, 
  getFirebaseDatabase, 
  getFirebaseStorage,
  resetFirebase
};
