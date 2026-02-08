// Centralized Firebase initialization
// This module ensures Firebase is initialized properly with Auth persistence

import { initializeApp, getApps, getApp } from 'firebase/app';
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

// Initialize Auth with multiple fallback strategies
async function initializeAuth_() {
  if (auth && authInitialized) {
    return auth;
  }

  if (!app) {
    initializeApp_();
  }

  if (!app) {
    console.error('[Firebase] Cannot init auth: no app');
    return null;
  }

  // Strategy 1: Try initializeAuth with persistence
  try {
    const firebaseAuth = await import('firebase/auth');
    const { initializeAuth, getReactNativePersistence } = firebaseAuth;
    
    if (initializeAuth && getReactNativePersistence) {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
      console.log('[Firebase] Auth initialized with persistence');
      authInitialized = true;
      return auth;
    }
  } catch (error) {
    console.log('[Firebase] initializeAuth failed:', error.message);
  }

  // Strategy 2: Try getAuth (for already initialized or fallback)
  try {
    const { getAuth } = await import('firebase/auth');
    auth = getAuth(app);
    console.log('[Firebase] Auth initialized with getAuth');
    authInitialized = true;
    return auth;
  } catch (error) {
    console.error('[Firebase] getAuth failed:', error.message);
  }

  return null;
}

// Initialize all Firebase services
async function initializeAll() {
  if (isInitialized && app && auth) {
    return { app, auth, database, storage };
  }

  // Initialize app first
  initializeApp_();
  
  // Initialize auth
  await initializeAuth_();

  // Initialize database
  if (app) {
    try {
      database = getDatabase(app);
      console.log('[Firebase] Database initialized');
    } catch (e) {
      console.warn('[Firebase] Database init error:', e.message);
    }

    try {
      storage = getStorage(app);
      console.log('[Firebase] Storage initialized');
    } catch (e) {
      console.warn('[Firebase] Storage init error:', e.message);
    }
  }

  isInitialized = true;
  return { app, auth, database, storage };
}

// Synchronous app initialization (called at module load)
export function initializeFirebase() {
  initializeApp_();
  
  // Also init database and storage synchronously
  if (app && !database) {
    try {
      database = getDatabase(app);
    } catch (e) {
      console.warn('[Firebase] Database init error:', e.message);
    }
  }
  
  if (app && !storage) {
    try {
      storage = getStorage(app);
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
