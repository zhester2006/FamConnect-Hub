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

export function initializeFirebase() {
  if (isInitialized) {
    return { app, auth, database, storage };
  }

  try {
    // Initialize Firebase app
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log('Firebase app initialized');
    } else {
      app = getApp();
    }

    // Initialize other services first (they don't have the same race condition)
    try {
      database = getDatabase(app);
    } catch (e) {
      console.warn('Database init error:', e);
    }

    try {
      storage = getStorage(app);
    } catch (e) {
      console.warn('Storage init error:', e);
    }

    isInitialized = true;
    return { app, auth, database, storage };
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return { app: null, auth: null, database: null, storage: null };
  }
}

// Initialize auth separately with a slight delay to ensure module registration
export async function initializeFirebaseAuth() {
  if (authInitialized && auth) {
    return auth;
  }
  
  if (!app) {
    initializeFirebase();
  }

  try {
    // Dynamic import to ensure module is fully loaded
    const { initializeAuth, getReactNativePersistence, getAuth } = await import('firebase/auth');
    
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
      console.log('Firebase Auth initialized with AsyncStorage persistence');
    } catch (authError) {
      if (authError.code === 'auth/already-initialized') {
        auth = getAuth(app);
        console.log('Firebase Auth already initialized, using existing instance');
      } else {
        console.warn('Auth init warning:', authError.message);
        try {
          auth = getAuth(app);
        } catch (e) {
          console.warn('Could not get auth:', e);
        }
      }
    }
    
    authInitialized = true;
    return auth;
  } catch (error) {
    console.error('Firebase Auth initialization error:', error);
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

// Initialize basic Firebase immediately (not auth)
initializeFirebase();

export default { 
  initializeFirebase, 
  initializeFirebaseAuth,
  getFirebaseApp, 
  getFirebaseAuth, 
  getFirebaseDatabase, 
  getFirebaseStorage 
};
