// Centralized Firebase initialization
// This module ensures Firebase is initialized properly with Auth persistence

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import firebaseConfig from './firebase.config';

let app = null;
let auth = null;
let database = null;
let storage = null;
let isInitialized = false;
let authInitialized = false;
let authInitializing = false;

// Initialize Firebase App synchronously
export function initializeFirebase() {
  if (isInitialized && app) {
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

    // Initialize database and storage (these are less problematic)
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

// Initialize auth separately - must be called explicitly
export async function initializeFirebaseAuth() {
  // Return existing auth if already initialized
  if (authInitialized && auth) {
    return auth;
  }
  
  // Prevent concurrent initialization attempts
  if (authInitializing) {
    // Wait and check again
    await new Promise(resolve => setTimeout(resolve, 200));
    if (auth) return auth;
  }
  
  authInitializing = true;
  
  // Ensure app is initialized first
  if (!app) {
    initializeFirebase();
  }
  
  if (!app) {
    console.error('Cannot initialize auth: Firebase app not available');
    authInitializing = false;
    return null;
  }

  try {
    // Import Firebase Auth
    const { initializeAuth, getAuth, getReactNativePersistence } = await import('firebase/auth');
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    
    // Try to initialize with persistence first
    if (getReactNativePersistence) {
      try {
        auth = initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage)
        });
        console.log('Firebase Auth initialized with persistence');
        authInitialized = true;
        authInitializing = false;
        return auth;
      } catch (initError) {
        console.log('initializeAuth failed, trying getAuth:', initError.message);
      }
    }
    
    // Fallback to getAuth (without persistence)
    try {
      auth = getAuth(app);
      console.log('Firebase Auth initialized (no persistence)');
      authInitialized = true;
      authInitializing = false;
      return auth;
    } catch (getAuthError) {
      console.error('getAuth failed:', getAuthError.message);
    }
    
    authInitializing = false;
    return null;
  } catch (error) {
    console.error('Firebase Auth initialization error:', error);
    authInitializing = false;
    return null;
  }
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
