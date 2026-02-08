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

// Initialize Firebase App
function initializeApp_() {
  if (app) return app;
  
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log('[Firebase] App initialized successfully');
    } else {
      app = getApp();
      console.log('[Firebase] Using existing app');
    }
  } catch (error) {
    console.error('[Firebase] App init error:', error.message);
  }
  
  return app;
}

// Initialize Auth - simplified approach that works with Expo
async function initializeAuth_() {
  if (auth && authInitialized) {
    console.log('[Firebase] Auth already initialized');
    return auth;
  }

  if (!app) {
    initializeApp_();
  }

  if (!app) {
    console.error('[Firebase] Cannot init auth: no app');
    return null;
  }

  try {
    // Import the auth module - this registers the 'auth' component
    const firebaseAuth = require('firebase/auth');
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    
    // Try initializeAuth with React Native persistence first
    try {
      if (firebaseAuth.initializeAuth && firebaseAuth.getReactNativePersistence) {
        auth = firebaseAuth.initializeAuth(app, {
          persistence: firebaseAuth.getReactNativePersistence(AsyncStorage)
        });
        console.log('[Firebase] Auth initialized with initializeAuth + persistence');
        authInitialized = true;
        return auth;
      }
    } catch (initError) {
      // If "already initialized" error, fall back to getAuth
      if (initError.code === 'auth/already-initialized') {
        console.log('[Firebase] Auth already initialized, using getAuth');
        auth = firebaseAuth.getAuth(app);
        authInitialized = true;
        return auth;
      }
      console.log('[Firebase] initializeAuth error:', initError.message);
    }

    // Fallback: try getAuth directly
    try {
      auth = firebaseAuth.getAuth(app);
      console.log('[Firebase] Auth initialized with getAuth');
      authInitialized = true;
      return auth;
    } catch (getAuthError) {
      console.error('[Firebase] getAuth failed:', getAuthError.message);
    }

  } catch (error) {
    console.error('[Firebase] Auth module load error:', error.message);
  }

  return null;
}

// Synchronous app initialization (called at module load)
export function initializeFirebase() {
  initializeApp_();
  
  // Initialize database and storage synchronously
  if (app && !database) {
    try {
      database = getDatabase(app);
      console.log('[Firebase] Database initialized');
    } catch (e) {
      console.warn('[Firebase] Database init error:', e.message);
    }
  }
  
  if (app && !storage) {
    try {
      storage = getStorage(app);
      console.log('[Firebase] Storage initialized');
    } catch (e) {
      console.warn('[Firebase] Storage init error:', e.message);
    }
  }
  
  return { app, auth, database, storage };
}

// Async auth initialization - MUST be awaited before using auth
export async function initializeFirebaseAuth() {
  if (!authInitialized || !auth) {
    await initializeAuth_();
  }
  return auth;
}

export function getFirebaseApp() {
  if (!app) {
    initializeApp_();
  }
  return app;
}

export function getFirebaseAuth() {
  return auth;
}

export function getFirebaseDatabase() {
  if (!database && app) {
    try {
      database = getDatabase(app);
    } catch (e) {
      console.warn('[Firebase] Database get error:', e.message);
    }
  }
  return database;
}

export function getFirebaseStorage() {
  if (!storage && app) {
    try {
      storage = getStorage(app);
    } catch (e) {
      console.warn('[Firebase] Storage get error:', e.message);
    }
  }
  return storage;
}

// Reset function for testing/logout
export function resetFirebase() {
  auth = null;
  authInitialized = false;
}

// Initialize app immediately at module load
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
