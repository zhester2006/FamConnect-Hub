const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const isPushSupported = () => {
  return 'Notification' in window;
};

export const requestPermission = async () => {
  if (!isPushSupported()) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

export const getPermissionStatus = () => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

export const showLocalNotification = (title, body, options = {}) => {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  
  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: options.tag || 'famfocus-notification',
      ...options
    });
  } catch (e) {
    console.log('Notification failed:', e);
  }
};

// Save subscription status to backend
export const subscribeToPush = async () => {
  const granted = await requestPermission();
  if (!granted) throw new Error('Notification permission denied');
  
  const token = localStorage.getItem('dev_session_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  await fetch(`${BACKEND_URL}/api/push/subscribe`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ subscription: { type: 'browser', endpoint: window.location.origin } })
  });
  
  return true;
};

export const unsubscribeFromPush = async () => {
  const token = localStorage.getItem('dev_session_token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  await fetch(`${BACKEND_URL}/api/push/unsubscribe`, {
    method: 'DELETE',
    headers,
    credentials: 'include'
  });
};

export const isSubscribed = async () => {
  return isPushSupported() && Notification.permission === 'granted';
};
