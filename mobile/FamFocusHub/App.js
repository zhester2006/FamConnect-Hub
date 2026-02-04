import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import pushNotificationService from './src/services/push.service';
import offlineService from './src/services/offline.service';

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

  useEffect(() => {
    // Initialize offline service
    offlineService.init();
    
    // Listen for network changes
    const unsubscribe = offlineService.addNetworkListener(setIsOnline);
    
    // Initialize push notifications
    initPushNotifications();
    
    return () => {
      unsubscribe();
      pushNotificationService.removeNotificationListeners();
    };
  }, []);

  const initPushNotifications = async () => {
    try {
      await pushNotificationService.registerForPushNotifications();
      
      pushNotificationService.addNotificationListeners(
        // On notification received
        (notification) => {
          console.log('Notification received:', notification);
        },
        // On notification response (user tapped)
        (response) => {
          console.log('Notification response:', response);
          const data = response.notification.request.content.data;
          
          // Handle navigation based on notification type
          if (data?.type === 'chore_reminder') {
            // Navigate to chores
          } else if (data?.type === 'chat_message') {
            // Navigate to chat
          } else if (data?.type === 'event_reminder') {
            // Navigate to calendar
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
