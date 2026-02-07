// Centralized Firebase initialization
// This module ensures Firebase is initialized properly with Auth persistence

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth, 
  getAuth,
  getReactNativePersistence 
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseConfig from './firebase.config';

let app = null;
let auth = null;
let database = null;
let storage = null;
let isInitialized = false;

export function initializeFirebase() {
  if (isInitialized) {
    return { app, auth, database, storage };
  }

  try {
    // Initialize Firebase app
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log('Firebase app initialized');
      
      // Initialize Auth with AsyncStorage persistence IMMEDIATELY after app init
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
          console.error('Firebase Auth initialization error:', authError);
          auth = getAuth(app);
        }
      }
    } else {
      app = getApp();
      try {
        auth = getAuth(app);
      } catch (e) {
        console.warn('Could not get auth:', e);
      }
    }

    // Initialize other services
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

export function getFirebaseApp() {
  if (!isInitialized) {
    initializeFirebase();
  }
  return app;
}

export function getFirebaseAuth() {
  if (!isInitialized) {
    initializeFirebase();
  }
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

// Initialize immediately when this module is imported
initializeFirebase();

export default { 
  initializeFirebase, 
  getFirebaseApp, 
  getFirebaseAuth, 
  getFirebaseDatabase, 
  getFirebaseStorage 
};
