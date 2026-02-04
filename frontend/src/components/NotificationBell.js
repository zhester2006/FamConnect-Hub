import React from 'react';
import { Bell, X, Check, Trash2, MapPin, Battery, AlertTriangle, Clock } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

// Notification icon mapping
const getNotificationIcon = (type) => {
  switch (type) {
    case 'geofence_exit':
    case 'geofence_enter':
      return MapPin;
    case 'low_battery':
      return Battery;
    case 'approval_needed':
      return AlertTriangle;
    case 'chore_reminder':
      return Clock;
    default:
      return Bell;
  }
};

// Notification color mapping
const getNotificationColor = (type) => {
  switch (type) {
    case 'geofence_exit':
      return 'text-red-400 bg-red-500/20';
    case 'geofence_enter':
      return 'text-green-400 bg-green-500/20';
    case 'low_battery':
      return 'text-orange-400 bg-orange-500/20';
    case 'approval_needed':
      return 'text-yellow-400 bg-yellow-500/20';
    default:
      return 'text-primary bg-primary/20';
  }
};

export function NotificationBell() {
  const { unreadCount, showNotificationPanel, setShowNotificationPanel } = useNotifications();
  
  return (
    <button
      onClick={() => setShowNotificationPanel(!showNotificationPanel)}
      className="relative p-2 hover:bg-white/5 rounded-xl transition-all"
      data-testid="notification-bell"
    >
      <Bell className="w-5 h-5 text-slate-400" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

export function NotificationPanel() {
  const { 
    notifications, 
    showNotificationPanel, 
    setShowNotificationPanel,
    markAsRead,
    markAllAsRead,
    clearAll
  } = useNotifications();

  if (!showNotificationPanel) return null;

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={() => setShowNotificationPanel(false)}
      />
      
      {/* Panel */}
      <div 
        className="fixed right-4 top-16 z-50 w-80 max-h-[80vh] backdrop-blur-2xl bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        data-testid="notification-panel"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-bold text-white">Notifications</h3>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <>
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-all"
                  title="Mark all as read"
                >
                  <Check className="w-4 h-4 text-slate-400" />
                </button>
                <button
                  onClick={clearAll}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-all"
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4 text-slate-400" />
                </button>
              </>
            )}
            <button
              onClick={() => setShowNotificationPanel(false)}
              className="p-1.5 hover:bg-white/5 rounded-lg transition-all"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto max-h-[60vh]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map(notification => {
              const Icon = getNotificationIcon(notification.type);
              const colorClass = getNotificationColor(notification.type);
              
              return (
                <div
                  key={notification.notification_id}
                  className={`p-4 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-all ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => markAsRead(notification.notification_id)}
                  data-testid="notification-item"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl ${colorClass.split(' ')[1]}`}>
                      <Icon className={`w-4 h-4 ${colorClass.split(' ')[0]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${notification.read ? 'text-slate-300' : 'text-white font-medium'}`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

export default NotificationBell;
