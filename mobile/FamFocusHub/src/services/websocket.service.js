import { Platform } from 'react-native';

const BACKEND_URL = 'https://family-pantry-hub-2.preview.emergentagent.com';
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// NOTE: WebSocket is DEPRECATED in favor of Firebase Realtime Database
// This service is kept for backward compatibility but should not be used
// Use firebase.chat.service.js instead for chat functionality

class WebSocketService {
  constructor() {
    this.ws = null;
    this.sessionToken = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3; // Reduced since we're not using this
    this.reconnectDelay = 3000;
    this.isEnabled = false; // DISABLED by default - using Firebase instead
    this.listeners = {
      message: [],
      typing: [],
      status: [],
      connect: [],
      disconnect: [],
      error: [],
      reaction: [],
      presence: [],
      members_online: [],
    };
    this.pingInterval = null;
    this.isConnecting = false;
    this.onlineMembers = new Set();
  }

  // Set session token for authentication
  setSessionToken(token) {
    this.sessionToken = token;
  }

  // Enable WebSocket service (for backward compatibility only)
  // NOTE: This is deprecated - use Firebase Chat instead
  enable() {
    console.warn('WebSocket service is deprecated. Please use Firebase Chat service instead.');
    this.isEnabled = true;
  }

  // Disable WebSocket service
  disable() {
    this.isEnabled = false;
    this.disconnect();
  }

  // NOTE: This method is deprecated - use Firebase Chat instead
  // Connect to WebSocket
  async connect() {
    if (!this.isEnabled) {
      console.log('WebSocket is disabled - using Firebase Chat instead');
      return;
    }

    if (this.isConnecting) {
      console.log('WebSocket already connecting, skipping');
      return;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      this.emit('connect', { connected: true });
      return;
    }

    if (!this.sessionToken) {
      console.error('No session token for WebSocket');
      this.emit('error', { error: 'No session token' });
      return;
    }

    this.isConnecting = true;
    console.log('Connecting to WebSocket...');

    try {
      const wsUrl = `${WS_URL}/ws/chat/${this.sessionToken}`;
      console.log('WebSocket URL:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPingInterval();
        this.emit('connect', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopPingInterval();
        this.emit('disconnect', { code: event.code, reason: event.reason });
        
        // Only reconnect if not a normal closure
        if (event.code !== 1000) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', { error: error.message || 'WebSocket error' });
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  // Handle incoming messages
  handleMessage(data) {
    switch (data.type) {
      case 'message':
        this.emit('message', data.data);
        break;
      case 'typing':
        this.emit('typing', data.data);
        break;
      case 'status':
        // Handle user online/offline status
        if (data.data) {
          if (data.data.status === 'online') {
            this.onlineMembers.add(data.data.user_id);
          } else {
            this.onlineMembers.delete(data.data.user_id);
          }
          this.emit('status', data.data);
          this.emit('presence', { 
            user_id: data.data.user_id, 
            status: data.data.status,
            online_members: Array.from(this.onlineMembers)
          });
        }
        break;
      case 'read':
        this.emit('read', data.data);
        break;
      case 'reaction':
        this.emit('reaction', data.data);
        break;
      case 'members_online':
        // Update full list of online members
        if (data.data && data.data.members) {
          this.onlineMembers = new Set(data.data.members);
          this.emit('members_online', { members: data.data.members });
        }
        break;
      case 'pong':
        // Heartbeat response
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  // Attempt to reconnect
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      this.emit('error', { error: 'Max reconnect attempts reached' });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connect();
      }
    }, delay);
  }

  // Start ping interval to keep connection alive
  startPingInterval() {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }

  // Stop ping interval
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Send message through WebSocket
  // NOTE: This method is deprecated - use Firebase Chat instead
  send(data) {
    if (!this.isEnabled) {
      console.log('WebSocket is disabled - use Firebase Chat instead');
      return false;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  // Send chat message
  // NOTE: This method is deprecated - use Firebase Chat instead
  sendMessage(content) {
    if (!this.isEnabled) {
      console.log('WebSocket is disabled - use Firebase Chat instead');
      return false;
    }
    
    return this.send({
      type: 'message',
      content,
    });
  }

  // Send typing indicator
  sendTyping(isTyping) {
    return this.send({
      type: 'typing',
      is_typing: isTyping,
    });
  }

  // Mark message as read
  markRead(messageId) {
    return this.send({
      type: 'read',
      message_id: messageId,
    });
  }

  // Add event listener
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return () => this.off(event, callback);
  }

  // Remove event listener
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  // Emit event to listeners
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Check if connected
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // Get list of online members
  getOnlineMembers() {
    return Array.from(this.onlineMembers);
  }

  // Disconnect
  disconnect() {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
  }

  // Reset for new session
  reset() {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.sessionToken = null;
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
