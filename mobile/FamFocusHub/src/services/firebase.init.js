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
    // Wait a bit and check again
    await new Promise(resolve => setTimeout(resolve, 100));
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
    // Import AsyncStorage dynamically to ensure it's loaded
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    
    // Import Firebase Auth modules
    const firebaseAuth = await import('firebase/auth');
    const { initializeAuth, getReactNativePersistence, getAuth } = firebaseAuth;
    
    // Check if getReactNativePersistence is available (it may not be in all versions)
    if (!getReactNativePersistence) {
      console.warn('getReactNativePersistence not available, using getAuth fallback');
      auth = getAuth(app);
    } else {
      try {
        // Initialize auth with persistence
        auth = initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage)
        });
        console.log('Firebase Auth initialized with AsyncStorage persistence');
      } catch (authError) {
        // Handle "already initialized" error
        if (authError.code === 'auth/already-initialized' || 
            authError.message?.includes('already been called')) {
          console.log('Firebase Auth already initialized, getting existing instance');
          auth = getAuth(app);
        } else {
          console.warn('Auth init error, trying getAuth fallback:', authError.message);
          try {
            auth = getAuth(app);
          } catch (fallbackError) {
            console.error('Auth getAuth fallback failed:', fallbackError.message);
          }
        }
      }
    }
    
    authInitialized = !!auth;
    authInitializing = false;
    return auth;
  } catch (error) {
    console.error('Firebase Auth initialization error:', error);
    authInitializing = false;
    
    // Final fallback - try to get auth without persistence
    try {
      const { getAuth } = await import('firebase/auth');
      auth = getAuth(app);
      console.log('Using Firebase Auth without custom persistence');
      authInitialized = !!auth;
      return auth;
    } catch (fallbackError) {
      console.error('Auth final fallback failed:', fallbackError);
      return null;
    }
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
