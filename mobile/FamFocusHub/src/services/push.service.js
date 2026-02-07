import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import apiService from './api.service';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class PushNotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
  }

  async registerForPushNotifications() {
    let token = null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'FamFocus Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return null;
      }
      
      try {
        token = (await Notifications.getExpoPushTokenAsync({
          projectId: 'famfocus-hub'
        })).data;
        this.expoPushToken = token;
        
        // Register token with backend
        await this.registerTokenWithBackend(token);
      } catch (error) {
        console.error('Failed to get push token:', error);
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  async registerTokenWithBackend(token) {
    try {
      await apiService.post('/notifications/register-device', {
        token,
        platform: Platform.OS,
      });
    } catch (error) {
      console.error('Failed to register push token with backend:', error);
    }
  }

  addNotificationListeners(onNotificationReceived, onNotificationResponse) {
    // Listener for when a notification is received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      notification => {
        if (onNotificationReceived) {
          onNotificationReceived(notification);
        }
      }
    );

    // Listener for when user taps on a notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      response => {
        if (onNotificationResponse) {
          onNotificationResponse(response);
        }
      }
    );
  }

  removeNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  async scheduleLocalNotification(title, body, data = {}, trigger = null) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: trigger || null,
    });
    return id;
  }

  async cancelNotification(notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count) {
    await Notifications.setBadgeCountAsync(count);
  }

  // Schedule chore reminder notification
  async scheduleChoreReminder(chore, reminderTime) {
    const trigger = new Date(reminderTime);
    return await this.scheduleLocalNotification(
      '🧹 Chore Reminder',
      `Don't forget: ${chore.title}`,
      { type: 'chore_reminder', choreId: chore.chore_id },
      { date: trigger }
    );
  }

  // Schedule event reminder
  async scheduleEventReminder(event, reminderTime) {
    const trigger = new Date(reminderTime);
    return await this.scheduleLocalNotification(
      '📅 Event Reminder',
      `Upcoming: ${event.title}`,
      { type: 'event_reminder', eventId: event.event_id },
      { date: trigger }
    );
  }

  // Send immediate notification to family
  async sendFamilyNotification(title, body, data = {}) {
    // This would typically go through your backend to send to all family members
    try {
      await apiService.post('/notifications/send-family', {
        title,
        body,
        data,
      });
    } catch (error) {
      console.error('Failed to send family notification:', error);
    }
  }
}

const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
