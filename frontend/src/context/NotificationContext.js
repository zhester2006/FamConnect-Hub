import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Bell, AlertTriangle, MapPin, Battery, CheckCircle } from 'lucide-react';

const NotificationContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Notification types and their configurations
const NOTIFICATION_CONFIG = {
  geofence_exit: {
    icon: MapPin,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    title: 'Safe Zone Alert',
    sound: true
  },
  geofence_enter: {
    icon: MapPin,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    title: 'Safe Zone',
    sound: false
  },
  low_battery: {
    icon: Battery,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    title: 'Low Battery',
    sound: true
  },
  chore_reminder: {
    icon: Bell,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    title: 'Chore Reminder',
    sound: false
  },
  approval_needed: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    title: 'Approval Needed',
    sound: true
  },
  general: {
    icon: Bell,
    color: 'text-primary',
    bgColor: 'bg-primary/20',
    title: 'Notification',
    sound: false
  }
};

export function NotificationProvider({ children, user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const lastCheckedRef = React.useRef(null);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (error) {
      // Sound file may not exist
    }
  }, []);

  // Show in-app notification toast
  const showInAppNotification = useCallback((notification) => {
    const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.general;
    const Icon = config.icon;
    
    if (config.sound) {
      playNotificationSound();
    }
    
    // Trigger browser vibration for important notifications
    if (config.sound && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
    
    toast.custom((t) => (
      <div 
        className={`${config.bgColor} border border-white/10 rounded-2xl p-4 shadow-2xl max-w-sm backdrop-blur-xl`}
        onClick={() => toast.dismiss(t)}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl ${config.bgColor}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${config.color}`}>{config.title}</p>
            <p className="text-white text-sm mt-0.5">{notification.message}</p>
            <p className="text-slate-400 text-xs mt-1">
              {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
    ), {
      duration: 5000,
      position: 'top-right'
    });
  }, [playNotificationSound]);

  // Fetch notifications from server
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications`, {
        credentials: 'include'
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      const newNotifications = data.notifications || [];
      
      // Check for new notifications since last check
      if (lastCheckedRef.current) {
        const recentNotifications = newNotifications.filter(n => 
          new Date(n.created_at) > lastCheckedRef.current
        );
        
        // Show in-app notifications for new ones
        recentNotifications.forEach(n => {
          if (!n.read) {
            showInAppNotification(n);
          }
        });
      }
      
      lastCheckedRef.current = new Date();
      setNotifications(newNotifications);
      setUnreadCount(newNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [user, showInAppNotification]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        credentials: 'include'
      });
      
      setNotifications(prev => prev.map(n => 
        n.notification_id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/read-all`, {
        method: 'PUT',
        credentials: 'include'
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/clear`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }, []);

  // Add local notification (for immediate feedback)
  const addLocalNotification = useCallback((notification) => {
    const newNotification = {
      notification_id: `local_${Date.now()}`,
      ...notification,
      created_at: new Date().toISOString(),
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
    showInAppNotification(newNotification);
  }, [showInAppNotification]);

  // Poll for new notifications
  useEffect(() => {
    if (!user) return;
    
    fetchNotifications();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  const value = {
    notifications,
    unreadCount,
    showNotificationPanel,
    setShowNotificationPanel,
    markAsRead,
    markAllAsRead,
    clearAll,
    addLocalNotification,
    fetchNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;
