// Push Notification Service - Stub for Expo Go
// Full push notifications require a development build
// This stub prevents errors when the package is not available

import { Platform } from 'react-native';

class PushNotificationService {
  constructor() {
    this.expoPushToken = null;
    console.log('Push notifications: Not available in Expo Go');
  }

  async registerForPushNotifications() {
    console.log('Push notifications require a development build');
    return null;
  }

  async registerTokenWithBackend(token) {
    // No-op in Expo Go
  }

  addNotificationListeners(onNotificationReceived, onNotificationResponse) {
    // No-op in Expo Go
  }

  removeNotificationListeners() {
    // No-op in Expo Go
  }

  async scheduleLocalNotification(title, body, data = {}, trigger = null) {
    console.log('Local notifications not available in Expo Go');
    return null;
  }

  async cancelNotification(notificationId) {
    // No-op
  }

  async cancelAllNotifications() {
    // No-op
  }

  async getBadgeCount() {
    return 0;
  }

  async setBadgeCount(count) {
    // No-op
  }

  async scheduleChoreReminder(chore, reminderTime) {
    return null;
  }

  async scheduleEventReminder(event, reminderTime) {
    return null;
  }

  async sendFamilyNotification(title, body, data = {}) {
    console.log('Push notifications not available in Expo Go');
  }
}

const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
