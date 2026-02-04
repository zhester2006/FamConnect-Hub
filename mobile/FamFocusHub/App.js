import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import pushNotificationService from './src/services/push.service';
import offlineService from './src/services/offline.service';
import locationService from './src/services/location.service';
import batteryService from './src/services/battery.service';
import apiService from './src/services/api.service';

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
  const [isOnline, setIsOnline] = React.useState(true);
  const [servicesInitialized, setServicesInitialized] = React.useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initializeAllServices();
    
    // Listen for network changes
    const unsubscribeNetwork = offlineService.addNetworkListener(setIsOnline);
    
    // Listen for app state changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      unsubscribeNetwork();
      appStateSubscription.remove();
      pushNotificationService.removeNotificationListeners();
    };
  }, []);

  const handleAppStateChange = async (nextAppState) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground - sync any pending actions
      console.log('App came to foreground - syncing...');
      await offlineService.syncPendingActions();
    }
    appState.current = nextAppState;
  };

  const initializeAllServices = async () => {
    try {
      console.log('Initializing FamFocus services...');
      
      // Initialize services in parallel
      await Promise.all([
        apiService.init(),
        offlineService.init(),
        locationService.init(),
        batteryService.init(),
      ]);
      
      // Initialize push notifications
      await initPushNotifications();
      
      setServicesInitialized(true);
      console.log('All services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize services:', error);
      setServicesInitialized(true); // Continue anyway
    }
  };

  const initPushNotifications = async () => {
    try {
      await pushNotificationService.registerForPushNotifications();
      
      pushNotificationService.addNotificationListeners(
        // On notification received (foreground)
        (notification) => {
          console.log('Notification received:', notification.request.content);
          const data = notification.request.content.data;
          
          // Handle geofence alerts specially
          if (data?.type === 'geofence_alert') {
            // Update location service with new alert
            locationService.notifyListeners('geofence_notification', data);
          }
        },
        // On notification response (user tapped)
        (response) => {
          console.log('Notification tapped:', response.notification.request.content.data);
          const data = response.notification.request.content.data;
          
          // Handle navigation based on notification type
          // Navigation will be handled by the navigator based on data.type
          if (data?.navigate) {
            // The navigator will handle this
          }
        }
      );
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
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
      <StatusBar style="light" />
      <AppContent />
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
