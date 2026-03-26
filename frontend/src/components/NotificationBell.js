import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const dropdownRef = useRef(null);
  const prevCountRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        fetch(`${API_URL}/api/notifications`, { credentials: 'include' }),
        fetch(`${API_URL}/api/notifications/unread-count`, { credentials: 'include' }),
      ]);
      if (notifRes.ok) {
        const data = await notifRes.json();
        setNotifications(data.notifications || []);
      }
      if (countRes.ok) {
        const data = await countRes.json();
        const newCount = data.unread_count || 0;
        if (newCount > prevCountRef.current && permissionGranted) {
          showBrowserNotification(newCount);
        }
        prevCountRef.current = newCount;
        setUnreadCount(newCount);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  }, [permissionGranted]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionGranted(Notification.permission === 'granted');
    }
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setPermissionGranted(perm === 'granted');
    }
  };

  const showBrowserNotification = (count) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('FamFocus Hub', {
        body: `You have ${count} new notification${count > 1 ? 's' : ''}`,
        icon: 'https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/tqccfghc_startup.gif.gif',
      });
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, { method: 'PUT', credentials: 'include' });
      setUnreadCount(0);
      prevCountRef.current = 0;
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) { console.error(e); }
  };

  const clearAll = async () => {
    try {
      await fetch(`${API_URL}/api/notifications/clear`, { method: 'DELETE', credentials: 'include' });
      setNotifications([]);
      setUnreadCount(0);
      prevCountRef.current = 0;
    } catch (e) { console.error(e); }
  };

  const toggleOpen = () => {
    if (!open && !permissionGranted) {
      requestPermission();
    }
    setOpen(!open);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'chore_reminder': return '🧹';
      case 'achievement': return '🏆';
      case 'chat': return '💬';
      case 'geofence_exit': return '📍';
      case 'wall_post': return '📝';
      case 'push': return '🔔';
      default: return '📌';
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleOpen}
        data-testid="notification-bell"
        className="relative p-2 rounded-xl hover:bg-white/10 transition-all"
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-yellow-400' : 'text-slate-400'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse" data-testid="notification-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-72 sm:w-80 max-h-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50" data-testid="notification-dropdown" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
            <h3 className="text-white font-semibold text-sm">Notifications</h3>
            <div className="flex gap-1.5">
              {notifications.length > 0 && (
                <>
                  <button onClick={markAllRead} className="p-1 text-cyan-400 hover:text-cyan-300" data-testid="mark-all-read-btn">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={clearAll} className="p-1 text-red-400 hover:text-red-300" data-testid="clear-all-btn">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto max-h-64">
            {notifications.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notification_id}
                  className={`px-3 py-2.5 border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${!n.read ? 'bg-slate-800/30' : ''}`}
                  data-testid={`notification-${n.notification_id}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">{getIcon(n.type)}</span>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className={`text-xs leading-snug break-words ${!n.read ? 'text-white' : 'text-slate-400'}`}>{n.message}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full flex-shrink-0 mt-1" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
