// Push Notification Utilities for FamFocus Hub

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Check if push notifications are supported
export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

// Request notification permission
export const requestPermission = async () => {
  if (!isPushSupported()) {
    console.log('Push notifications not supported');
    return false;
  }
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

// Get current permission status
export const getPermissionStatus = () => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

// Register service worker
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported');
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    throw error;
  }
};

// Subscribe to push notifications
export const subscribeToPush = async () => {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported');
  }
  
  const permission = await requestPermission();
  if (!permission) {
    throw new Error('Notification permission denied');
  }
  
  const registration = await registerServiceWorker();
  await navigator.serviceWorker.ready;
  
  // Get VAPID public key from server
  let vapidKey;
  try {
    const keyRes = await fetch(`${BACKEND_URL}/api/push/vapid-key`);
    const keyData = await keyRes.json();
    vapidKey = keyData.publicKey;
  } catch (error) {
    console.error('Failed to get VAPID key:', error);
    throw new Error('Could not get push notification key');
  }
  
  // Convert VAPID key to Uint8Array
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };
  
  // Subscribe to push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey)
  });
  
  // Send subscription to backend
  const subJson = subscription.toJSON();
  await fetch(`${BACKEND_URL}/api/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: subJson.keys
    })
  });
  
  console.log('Push notification subscription successful');
  return subscription;
};

// Unsubscribe from push notifications
export const unsubscribeFromPush = async () => {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    await subscription.unsubscribe();
    
    // Notify backend
    await fetch(`${BACKEND_URL}/api/push/unsubscribe`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    console.log('Push notification unsubscribed');
  }
};

// Check if already subscribed
export const isSubscribed = async () => {
  if (!isPushSupported()) return false;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch (error) {
    return false;
  }
};

// Show local notification (for testing/fallback)
export const showLocalNotification = (title, body, options = {}) => {
  if (!isPushSupported()) return;
  
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options
    });
  }
};
