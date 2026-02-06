// Firebase Push Notification Service for FamFocus Hub
// Handles FCM push notifications for chat, chores, rewards, etc.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './api.service';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class FirebaseNotificationService {
  constructor() {
    this.expoPushToken = null;
    this.fcmToken = null;
    this.notificationListener = null;
    this.responseListener = null;
    this.onNotificationCallbacks = [];
    this.onNotificationResponseCallbacks = [];
  }

  // Initialize notifications
  async initialize() {
    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return false;
      }

      // Get Expo push token (works on physical devices)
      if (Device.isDevice) {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'family-hub-app-d9c04'
        });
        this.expoPushToken = tokenData.data;
        console.log('Expo Push Token:', this.expoPushToken);
      }

      // Set up notification listeners
      this.setupListeners();

      // Configure Android channel
      if (Platform.OS === 'android') {
        await this.setupAndroidChannel();
      }

      console.log('Firebase Notifications initialized');
      return true;
    } catch (error) {
      console.error('Notification initialization error:', error);
      return false;
    }
  }

  // Setup Android notification channel
  async setupAndroidChannel() {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'FamFocus Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Chat Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 100, 100],
      lightColor: '#10b981',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('chores', {
      name: 'Chore Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#f59e0b',
    });

    await Notifications.setNotificationChannelAsync('rewards', {
      name: 'Rewards & Points',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#a855f7',
    });
  }

  // Setup notification listeners
  setupListeners() {
    // Listen for notifications when app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      this.onNotificationCallbacks.forEach(cb => cb(notification));
    });

    // Listen for notification interactions
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      this.onNotificationResponseCallbacks.forEach(cb => cb(response));
    });
  }

  // Register push token with backend
  async registerTokenWithBackend(userId) {
    if (!this.expoPushToken) return false;

    try {
      await apiService.post('/notifications/register', {
        user_id: userId,
        push_token: this.expoPushToken,
        platform: Platform.OS,
      });
      await AsyncStorage.setItem('pushTokenRegistered', 'true');
      return true;
    } catch (error) {
      console.error('Token registration error:', error);
      return false;
    }
  }

  // Add notification received callback
  onNotification(callback) {
    this.onNotificationCallbacks.push(callback);
  }

  // Add notification response callback
  onNotificationResponse(callback) {
    this.onNotificationResponseCallbacks.push(callback);
  }

  // Schedule local notification
  async scheduleLocalNotification(title, body, data = {}, trigger = null) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: trigger || null, // null = immediate
      });
      return notificationId;
    } catch (error) {
      console.error('Schedule notification error:', error);
      return null;
    }
  }

  // Schedule chore reminder
  async scheduleChoreReminder(choreTitle, scheduledDate, choreId) {
    const triggerDate = new Date(scheduledDate);
    triggerDate.setHours(9, 0, 0, 0); // 9 AM reminder

    if (triggerDate <= new Date()) return null;

    return this.scheduleLocalNotification(
      '🧹 Chore Reminder',
      `Don't forget: ${choreTitle}`,
      { type: 'chore_reminder', choreId },
      { date: triggerDate }
    );
  }

  // Send points notification
  async notifyPointsEarned(points, reason) {
    return this.scheduleLocalNotification(
      '⭐ Points Earned!',
      `You earned ${points} points for ${reason}!`,
      { type: 'points_earned', points }
    );
  }

  // Send reward unlocked notification
  async notifyRewardUnlocked(rewardName) {
    return this.scheduleLocalNotification(
      '🎉 Reward Unlocked!',
      `You can now redeem: ${rewardName}`,
      { type: 'reward_unlocked', rewardName }
    );
  }

  // Send chat message notification
  async notifyChatMessage(senderName, messagePreview) {
    return this.scheduleLocalNotification(
      `💬 ${senderName}`,
      messagePreview.substring(0, 100),
      { type: 'chat_message' }
    );
  }

  // Send location alert notification
  async notifyLocationAlert(childName, alertType, location) {
    const messages = {
      left_safe_zone: `${childName} has left a safe zone`,
      entered_safe_zone: `${childName} has arrived at a safe zone`,
      battery_low: `${childName}'s phone battery is low`,
    };

    return this.scheduleLocalNotification(
      '📍 Location Alert',
      messages[alertType] || `Location update for ${childName}`,
      { type: 'location_alert', alertType, location }
    );
  }

  // Cancel a scheduled notification
  async cancelNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      return true;
    } catch (error) {
      console.error('Cancel notification error:', error);
      return false;
    }
  }

  // Cancel all notifications
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return true;
    } catch (error) {
      console.error('Cancel all notifications error:', error);
      return false;
    }
  }

  // Get badge count
  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
  }

  // Set badge count
  async setBadgeCount(count) {
    await Notifications.setBadgeCountAsync(count);
  }

  // Cleanup
  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
    this.onNotificationCallbacks = [];
    this.onNotificationResponseCallbacks = [];
  }
}

const firebaseNotificationService = new FirebaseNotificationService();
export default firebaseNotificationService;
