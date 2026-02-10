// Centralized Firebase initialization using React Native Firebase (Native)
// React Native Firebase auto-initializes from google-services.json

import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import storage from '@react-native-firebase/storage';

let isInitialized = false;

// Initialize Firebase (mostly a verification since RN Firebase auto-initializes)
export function initializeFirebase() {
  if (isInitialized) {
    console.log('[Firebase] Already initialized');
    return { app: firebase, auth: auth(), database: database(), storage: storage() };
  }

  try {
    const apps = firebase.apps;
    console.log('[Firebase] Checking Firebase apps:', apps.length);

    if (apps.length > 0) {
      console.log('[Firebase] Native Firebase initialized successfully');
      console.log('[Firebase] App name:', apps[0].name);
      isInitialized = true;
    } else {
      console.warn('[Firebase] No Firebase apps found. Check google-services.json configuration.');
    }
  } catch (error) {
    console.error('[Firebase] Initialization check error:', error.message);
  }

  return { app: firebase, auth: auth(), database: database(), storage: storage() };
}

// Initialize auth - returns auth instance directly (no async needed with native)
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
