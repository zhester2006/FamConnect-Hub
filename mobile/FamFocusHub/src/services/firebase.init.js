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
    console.log('[Firebase] Already initialized, returning cached instances');
    return { app: firebase, auth: auth(), database: database(), storage: storage() };
  }

  try {
    // Check if Firebase is configured
    const apps = firebase.apps;
    console.log('[Firebase] Checking Firebase apps:', apps.length);
    
    if (apps.length > 0) {
      console.log('[Firebase] Native Firebase initialized successfully');
      console.log('[Firebase] App name:', apps[0].name);
      console.log('[Firebase] App options:', JSON.stringify(apps[0].options, null, 2));
      isInitialized = true;
    } else {
      console.warn('[Firebase] No Firebase apps found. Check google-services.json configuration.');
    }
  } catch (error) {
    console.error('[Firebase] Initialization check error:', error.message);
  }

  return { app: firebase, auth: auth(), database: database(), storage: storage() };
}

// Get Firebase Auth instance - synchronous with native Firebase!
export function initializeFirebaseAuth() {
  console.log('[Firebase] initializeFirebaseAuth called');
  try {
    const authInstance = auth();
    console.log('[Firebase] Auth instance obtained');
    return Promise.resolve(authInstance);
  } catch (error) {
    console.error('[Firebase] Error getting auth instance:', error.message);
    return Promise.reject(error);
  }
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
  isInitialized = false;
}

// Initialize immediately
console.log('[Firebase] Module loaded, initializing...');
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
