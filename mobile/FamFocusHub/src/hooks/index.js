// Custom hooks for FamFocus Hub mobile app
// Refactored from complex screen logic for reusability

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState, Keyboard } from 'react-native';
import apiService from '../services/api.service';
import webSocketService from '../services/websocket.service';
import widgetService from '../services/widget.service';

// ============================================
// DATA FETCHING HOOKS
// ============================================

/**
 * Hook for fetching and managing chores data
 */
export function useChores(userId, isParent = false) {
  const [chores, setChores] = useState([]);
  const [choreTypes, setChorTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChores = useCallback(async () => {
    try {
      setError(null);
      const [choresRes, typesRes] = await Promise.all([
        apiService.getChores(),
        apiService.get('/chore-types'),
      ]);
      
      const allChores = choresRes?.chores || [];
      const filteredChores = isParent 
        ? allChores 
        : allChores.filter(c => c.assigned_to?.includes(userId));
      
      setChores(filteredChores);
      setChorTypes(typesRes?.types || []);
      
      // Update widget
      widgetService.updateChoresWidget(filteredChores, userId);
    } catch (err) {
      setError(err.message || 'Failed to fetch chores');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, isParent]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChores();
  }, [fetchChores]);

  useEffect(() => {
    fetchChores();
  }, [fetchChores]);

  const todayChores = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return chores.filter(c => c.scheduled_date === today);
  }, [chores]);

  const pendingChores = useMemo(() => {
    return chores.filter(c => c.status === 'pending');
  }, [chores]);

  const completedChores = useMemo(() => {
    return chores.filter(c => c.status === 'completed');
  }, [chores]);

  return {
    chores,
    choreTypes,
    todayChores,
    pendingChores,
    completedChores,
    loading,
    error,
    refreshing,
    refresh,
    refetch: fetchChores,
  };
}

/**
 * Hook for fetching and managing events/calendar data
 */
export function useEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      setError(null);
      const response = await apiService.getEvents();
      const allEvents = response?.events || [];
      setEvents(allEvents);
      
      // Update widget
      widgetService.updateEventsWidget(allEvents);
    } catch (err) {
      setError(err.message || 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const todayEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return events.filter(e => e.date === today);
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    return events
      .filter(e => new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [events]);

  return {
    events,
    todayEvents,
    upcomingEvents,
    loading,
    error,
    refetch: fetchEvents,
  };
}

/**
 * Hook for fetching family members and leaderboard
 */
export function useFamilyData() {
  const [members, setMembers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [membersRes, leaderboardRes] = await Promise.all([
        apiService.getFamilyMembers(),
        apiService.getLeaderboard(),
      ]);
      
      setMembers(membersRes?.members || []);
      setLeaderboard(leaderboardRes?.leaderboard || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch family data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const children = useMemo(() => {
    return members.filter(m => m.role === 'child');
  }, [members]);

  const parents = useMemo(() => {
    return members.filter(m => m.role === 'parent');
  }, [members]);

  return {
    members,
    children,
    parents,
    leaderboard,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook for shopping list management
 */
export function useShoppingList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchItems = useCallback(async () => {
    try {
      setError(null);
      const response = await apiService.getShoppingList();
      setItems(response?.items || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch shopping list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = useCallback(async (item) => {
    try {
      const response = await apiService.addShoppingItem(item);
      if (response?.item) {
        setItems(prev => [...prev, response.item]);
      }
      return response;
    } catch (err) {
      throw err;
    }
  }, []);

  const toggleItem = useCallback(async (itemId, purchased) => {
    try {
      await apiService.updateShoppingItem(itemId, { purchased });
      setItems(prev => prev.map(item => 
        (item._id || item.id) === itemId ? { ...item, purchased } : item
      ));
    } catch (err) {
      throw err;
    }
  }, []);

  const deleteItem = useCallback(async (itemId) => {
    try {
      await apiService.deleteShoppingItem(itemId);
      setItems(prev => prev.filter(item => (item._id || item.id) !== itemId));
    } catch (err) {
      throw err;
    }
  }, []);

  const pendingItems = useMemo(() => items.filter(i => !i.purchased), [items]);
  const completedItems = useMemo(() => items.filter(i => i.purchased), [items]);

  return {
    items,
    pendingItems,
    completedItems,
    loading,
    error,
    addItem,
    toggleItem,
    deleteItem,
    refetch: fetchItems,
  };
}

// ============================================
// UI/INTERACTION HOOKS
// ============================================

/**
 * Hook for managing modal state
 */
export function useModal(initialState = false) {
  const [visible, setVisible] = useState(initialState);
  const [data, setData] = useState(null);

  const open = useCallback((modalData = null) => {
    setData(modalData);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setData(null);
  }, []);

  const toggle = useCallback(() => {
    setVisible(prev => !prev);
  }, []);

  return { visible, data, open, close, toggle };
}

/**
 * Hook for form state management
 */
export function useForm(initialValues = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback((field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [errors]);

  const setFieldTouched = useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const reset = useCallback((newValues = initialValues) => {
    setValues(newValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const validate = useCallback((validationRules) => {
    const newErrors = {};
    Object.keys(validationRules).forEach(field => {
      const error = validationRules[field](values[field], values);
      if (error) newErrors[field] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setValue,
    setFieldTouched,
    setErrors,
    setIsSubmitting,
    reset,
    validate,
  };
}

/**
 * Hook for keyboard visibility
 */
export function useKeyboard() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const dismiss = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  return { keyboardVisible, keyboardHeight, dismiss };
}

/**
 * Hook for app state (foreground/background)
 */
export function useAppState(onForeground, onBackground) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        onForeground?.();
      } else if (appState.current === 'active' && nextState.match(/inactive|background/)) {
        onBackground?.();
      }
      appState.current = nextState;
    });

    return () => subscription?.remove();
  }, [onForeground, onBackground]);

  return appState.current;
}

/**
 * Hook for debounced value
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for interval-based updates
 */
export function useInterval(callback, delay) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    
    const tick = () => savedCallback.current();
    const id = setInterval(tick, delay);
    
    return () => clearInterval(id);
  }, [delay]);
}

// ============================================
// REAL-TIME HOOKS
// ============================================

/**
 * Hook for WebSocket chat connection
 */
export function useChat(token) {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await apiService.getMessages();
        setMessages(response?.messages || []);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!token) return;

    const handleMessage = (data) => {
      setMessages(prev => [...prev, data]);
    };

    const handleTyping = (data) => {
      setTyping(data.users || []);
    };

    const handlePresence = (data) => {
      setOnlineUsers(data.online_members || []);
    };

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    webSocketService.on('message', handleMessage);
    webSocketService.on('typing', handleTyping);
    webSocketService.on('presence', handlePresence);
    webSocketService.on('members_online', (data) => setOnlineUsers(data.members || []));
    webSocketService.on('connect', handleConnect);
    webSocketService.on('disconnect', handleDisconnect);

    webSocketService.connect(token);

    return () => {
      webSocketService.off('message', handleMessage);
      webSocketService.off('typing', handleTyping);
      webSocketService.off('presence', handlePresence);
      webSocketService.off('connect', handleConnect);
      webSocketService.off('disconnect', handleDisconnect);
    };
  }, [token]);

  const sendMessage = useCallback((content, type = 'text', extra = {}) => {
    webSocketService.sendMessage({ content, type, ...extra });
  }, []);

  const sendTyping = useCallback((isTyping) => {
    webSocketService.sendTyping(isTyping);
  }, []);

  return {
    messages,
    typing,
    onlineUsers,
    connected,
    loading,
    sendMessage,
    sendTyping,
    setMessages,
  };
}

/**
 * Hook for real-time notifications
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiService.get('/notifications');
      const notifs = response?.notifications || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await apiService.put(`/notifications/${notificationId}/read`);
      setNotifications(prev => prev.map(n => 
        (n._id || n.id) === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiService.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Hook for pagination
 */
export function usePagination(items, itemsPerPage = 10) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, page, itemsPerPage]);

  const nextPage = useCallback(() => {
    setPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage(prev => Math.max(prev - 1, 1));
  }, []);

  const goToPage = useCallback((pageNum) => {
    setPage(Math.min(Math.max(1, pageNum), totalPages));
  }, [totalPages]);

  return {
    page,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    goToPage,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Hook for async operations with loading/error states
 */
export function useAsync(asyncFunction, immediate = true) {
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return { loading, error, data, execute };
}

/**
 * Hook for managing filter state
 */
export function useFilter(initialFilters = {}) {
  const [filters, setFilters] = useState(initialFilters);

  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilter = useCallback((key) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const applyFilters = useCallback((items, filterFunctions) => {
    return items.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (value === null || value === undefined || value === '') return true;
        const filterFn = filterFunctions[key];
        return filterFn ? filterFn(item, value) : true;
      });
    });
  }, [filters]);

  return {
    filters,
    setFilter,
    clearFilter,
    clearAllFilters,
    applyFilters,
  };
}

export default {
  useChores,
  useEvents,
  useFamilyData,
  useShoppingList,
  useModal,
  useForm,
  useKeyboard,
  useAppState,
  useDebounce,
  useInterval,
  useChat,
  useNotifications,
  usePagination,
  useAsync,
  useFilter,
};
