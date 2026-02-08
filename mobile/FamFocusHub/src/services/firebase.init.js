// Centralized Firebase initialization
// This module ensures Firebase is initialized properly with Auth persistence

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getReactNativePersistence } from '@firebase/auth/react-native';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseConfig from './firebase.config';

let app = null;
let auth = null;
let database = null;
let storage = null;
let isInitialized = false;
let authInitialized = false;

// Initialize Firebase App and Auth synchronously at startup
function initializeAll() {
  if (isInitialized && app && auth) {
    return { app, auth, database, storage };
  }

  try {
    // Initialize Firebase app
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log('Firebase app initialized successfully');
    } else {
      app = getApp();
      console.log('Using existing Firebase app');
    }

    // Initialize Auth with persistence - MUST be done before any auth operations
    if (!auth) {
      try {
        auth = initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage)
        });
        console.log('Firebase Auth initialized with persistence');
        authInitialized = true;
      } catch (authError) {
        // If initializeAuth fails (already initialized), try getAuth
        if (authError.code === 'auth/already-initialized') {
          auth = getAuth(app);
          console.log('Firebase Auth retrieved with getAuth');
          authInitialized = true;
        } else {
          console.error('Firebase Auth init error:', authError.message);
          // Last resort fallback
          try {
            auth = getAuth(app);
            console.log('Firebase Auth fallback to getAuth');
            authInitialized = true;
          } catch (fallbackError) {
            console.error('Firebase Auth fallback failed:', fallbackError.message);
          }
        }
      }
    }

    // Initialize database and storage
    try {
      database = getDatabase(app);
      console.log('Firebase Database initialized');
    } catch (e) {
      console.warn('Database init error:', e.message);
    }

    try {
      storage = getStorage(app);
      console.log('Firebase Storage initialized');
    } catch (e) {
      console.warn('Storage init error:', e.message);
    }

    isInitialized = true;
    return { app, auth, database, storage };
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return { app: null, auth: null, database: null, storage: null };
  }
}

// Initialize Firebase App synchronously
export function initializeFirebase() {
  return initializeAll();
}

// Initialize auth - now synchronous since we init everything together
export async function initializeFirebaseAuth() {
  if (!authInitialized || !auth) {
    initializeAll();
  }
  return auth;
}

export function getFirebaseApp() {
  if (!isInitialized) {
    initializeFirebase();
  }
  return app;
}

export function getFirebaseAuth() {
  return auth;
}

export function getFirebaseDatabase() {
  if (!isInitialized) {
    initializeFirebase();
  }
  return database;
}

export function getFirebaseStorage() {
  if (!isInitialized) {
    initializeFirebase();
  }
  return storage;
}

// Reset function for testing/logout
export function resetFirebase() {
  auth = null;
  authInitialized = false;
  authInitializing = false;
}

// Initialize basic Firebase immediately (not auth - that must be async)
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
