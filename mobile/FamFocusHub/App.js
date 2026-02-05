import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

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
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let unsubscribeNetwork = null;
    let appStateSubscription = null;
    
    const initServices = async () => {
      try {
        // Lazy load services to avoid startup crashes
        const apiService = require('./src/services/api.service').default;
        await apiService.init();
        
        // Initialize offline service
        const offlineService = require('./src/services/offline.service').default;
        await offlineService.init();
        unsubscribeNetwork = offlineService.addNetworkListener(setIsOnline);
        
        // Initialize location service (non-blocking)
        const locationService = require('./src/services/location.service').default;
        locationService.init().catch(err => console.warn('Location init:', err));
        
        // Initialize battery service (non-blocking)
        const batteryService = require('./src/services/battery.service').default;
        batteryService.init().catch(err => console.warn('Battery init:', err));
        
        // Initialize push notifications (non-blocking)
        initPushNotifications().catch(err => console.warn('Push init:', err));
        
        console.log('Services initialized');
      } catch (error) {
        console.error('Service initialization error:', error);
      }
    };
    
    initServices();
    
    // Listen for app state changes
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      if (unsubscribeNetwork) unsubscribeNetwork();
      if (appStateSubscription) appStateSubscription.remove();
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
