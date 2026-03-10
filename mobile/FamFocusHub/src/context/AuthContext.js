import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import apiService from '../services/api.service';
import biometricService from '../services/biometric.service';
import webSocketService from '../services/websocket.service';
import firebaseService from '../services/firebase.service';
import { initializeFirebaseAuth } from '../services/firebase.init';
import { FIREBASE_ONLY_MODE } from '../services/api.config';

const AuthContext = createContext(null);

// Request all necessary permissions
const requestAllPermissions = async () => {
  try {
    // Request location permission
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
    console.log('Location permission:', locationStatus);

    // Request background location (optional, don't block on failure)
    try {
      const { status: bgLocationStatus } = await Location.requestBackgroundPermissionsAsync();
      console.log('Background location permission:', bgLocationStatus);
    } catch (e) {
      console.log('Background location permission not available');
    }

    // Request notification permission
    const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
    console.log('Notification permission:', notificationStatus);

    // Request camera and media permission via ImagePicker
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    console.log('Camera permission:', cameraStatus);
    
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('Media library permission:', mediaStatus);

  } catch (error) {
    console.error('Permission request error:', error);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize Firebase Auth FIRST on app start (before other Firebase services)
  useEffect(() => {
    const initFirebaseAuth = async () => {
      try {
        // Initialize Firebase Auth with persistence first
        await initializeFirebaseAuth();
        console.log('Firebase Auth initialized in AuthProvider');
        
        // Then initialize remaining Firebase services
        await firebaseService.initialize();
      } catch (error) {
        console.error('Firebase init error:', error);
      }
    };
    initFirebaseAuth();
  }, []);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      await apiService.init();
      
      if (apiService.sessionToken) {
        const userData = await apiService.getCurrentUser();
        if (userData && userData.user_id) {
          setUser(userData);
          setIsAuthenticated(true);
          
          // NOTE: WebSocket is deprecated in favor of Firebase
          // Chat now uses Firebase Realtime Database for better reliability
          // webSocketService.setSessionToken(apiService.sessionToken);
          // webSocketService.connect();
          
          // Update biometric stored session if enabled
          await biometricService.updateStoredSession(apiService.sessionToken);
        } else {
          await apiService.clearSession();
        }
      }
    } catch (error) {
      console.error('Auth init failed:', error);
      await apiService.clearSession();
    } finally {
      setLoading(false);
    }
  };

  const login = async (sessionToken, userData = null) => {
    try {
      console.log('[AuthContext] Login called with token:', sessionToken ? 'present' : 'missing');
      console.log('[AuthContext] User data:', userData ? 'present' : 'missing');
      
      // In Firebase-only mode, we use the Firebase UID as session token
      await apiService.setSession(sessionToken);
      
      // Use provided userData or fetch from API
      let user = userData;
      if (!user && !FIREBASE_ONLY_MODE) {
        try {
          user = await apiService.getCurrentUser();
        } catch (apiError) {
          console.log('[AuthContext] API unavailable, using provided userData');
        }
      }
      
      // Ensure user object has required fields
      if (!user) {
        user = {
          user_id: sessionToken,
          email: 'user@example.com',
          name: 'User',
          role: 'parent',
          points: 0
        };
      }
      
      // Ensure user_id exists
      if (!user.user_id) {
        user.user_id = sessionToken;
      }
      
      console.log('[AuthContext] Setting user:', user.email || user.name);
      
      setUser(user);
      setIsAuthenticated(true);
      
      // Store userId for other services (like theme context)
      await AsyncStorage.setItem('userId', user.user_id);
      
      // Load user's saved theme preference
      if (user.settings?.theme) {
        await AsyncStorage.setItem('themeMode', user.settings.theme);
        if (user.settings.custom_theme) {
          await AsyncStorage.setItem('familyTheme', JSON.stringify(user.settings.custom_theme));
        }
      }
      
      // Initialize Firebase services with user info
      const familyId = user.current_family_id || user.parent_id || `family_${user.user_id}`;
      firebaseService.setUser(user.user_id, user.name, user.picture, familyId);
      
      // Register push token with backend
      firebaseService.notifications.registerTokenWithBackend(user.user_id);
      
      // Initialize WebSocket as fallback (Firebase is primary now)
      webSocketService.setSessionToken(sessionToken);
      // webSocketService.connect(); // Disabled - using Firebase Chat instead
      
      // Request all permissions after login
      setTimeout(() => requestAllPermissions(), 500);
      
      return user;
    } catch (error) {
      await apiService.clearSession();
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Disconnect WebSocket
      webSocketService.reset();
      
      // Cleanup Firebase services
      firebaseService.cleanup();
      
      // Clear biometric session
      await biometricService.clearOnLogout();
      
      // Clear userId
      await AsyncStorage.removeItem('userId');
      
      // Logout from API
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await apiService.getCurrentUser();
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated,
      login,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
