import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, AppState, LogBox } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import errorHandler from './src/utils/errorHandler';

// Suppress specific warnings that are device-level issues
LogBox.ignoreLogs([
  'Native crypto module could not be used',
  'database or disk is full',
  'SQLITE_FULL',
]);

// Global error handler for unhandled errors
if (!global.__errorHandlerSet) {
  global.__errorHandlerSet = true;
  
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const errorString = args.join(' ');
    
    // Handle known device-level errors gracefully
    if (errorString.includes('crypto') || 
        errorString.includes('SQLITE') || 
        errorString.includes('disk is full')) {
      const result = errorHandler.handle(new Error(errorString));
      if (result.handled) {
        console.warn('Handled error:', result.message || errorString);
        return;
      }
    }
    
    originalConsoleError.apply(console, args);
  };
}

// Network status indicator component
function NetworkIndicator({ isOnline }) {
  if (isOnline) return null;
  
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineText}>📴 You're offline - changes will sync when connected</Text>
    </View>
  );
}

function AppContent() {
  const [isOnline, setIsOnline] = useState(true);
  const [servicesReady, setServicesReady] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let unsubscribeNetwork = null;
    let appStateSubscription = null;
    
    const initServices = async () => {
      try {
        // Initialize API service first (critical)
        try {
          const apiService = require('./src/services/api.service').default;
          await apiService.init();
        } catch (apiError) {
          console.warn('API service init warning:', apiError);
        }
        
        // Initialize offline service (non-blocking)
        try {
          const offlineService = require('./src/services/offline.service').default;
          await offlineService.init();
          unsubscribeNetwork = offlineService.addNetworkListener(setIsOnline);
        } catch (offlineError) {
          console.warn('Offline service init warning:', offlineError);
        }
        
        // Initialize location service (non-blocking)
        try {
          const locationService = require('./src/services/location.service').default;
          locationService.init().catch(err => console.warn('Location init:', err));
        } catch (locError) {
          console.warn('Location service load error:', locError);
        }
        
        // Initialize battery service (non-blocking)
        try {
          const batteryService = require('./src/services/battery.service').default;
          batteryService.init().catch(err => console.warn('Battery init:', err));
        } catch (batError) {
          console.warn('Battery service load error:', batError);
        }
        
        // Initialize push notifications (non-blocking)
        initPushNotifications().catch(err => console.warn('Push init:', err));
        
        console.log('Services initialized');
      } catch (error) {
        console.error('Service initialization error:', error);
      } finally {
        setServicesReady(true);
      }
    };
    
    initServices();
    
    // Listen for app state changes
    try {
      appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    } catch (e) {
      console.warn('AppState listener error:', e);
    }
    
    return () => {
      if (unsubscribeNetwork) {
        try { unsubscribeNetwork(); } catch (e) {}
      }
      if (appStateSubscription?.remove) {
        try { appStateSubscription.remove(); } catch (e) {}
      }
    };
  }, []);

  const handleAppStateChange = async (nextAppState) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App came to foreground');
      try {
        const offlineService = require('./src/services/offline.service').default;
        await offlineService.syncPendingActions();
      } catch (error) {
        console.warn('Sync error:', error);
      }
    }
    appState.current = nextAppState;
  };

  const initPushNotifications = async () => {
    try {
      const pushNotificationService = require('./src/services/push.service').default;
      await pushNotificationService.registerForPushNotifications();
      
      pushNotificationService.addNotificationListeners(
        (notification) => {
          console.log('Notification received:', notification.request.content);
        },
        (response) => {
          console.log('Notification tapped:', response.notification.request.content.data);
        }
      );
    } catch (error) {
      console.error('Push notification error:', error);
    }
  };

  return (
    <>
      <NetworkIndicator isOnline={isOnline} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <StatusBar style="light" />
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingTop: 48,
  },
  offlineText: {
    color: '#1e1b4b',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
});
