import { Platform } from 'react-native';

const BACKEND_URL = 'https://famhub-app.preview.emergentagent.com';
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

class WebSocketService {
  constructor() {
    this.ws = null;
    this.sessionToken = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = {
      message: [],
      typing: [],
      status: [],
      connect: [],
      disconnect: [],
      error: [],
    };
    this.pingInterval = null;
    this.isConnecting = false;
  }

  // Set session token for authentication
  setSessionToken(token) {
    this.sessionToken = token;
  }

  // Connect to WebSocket
  async connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    if (!this.sessionToken) {
      console.error('No session token for WebSocket');
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = `${WS_URL}/ws/chat/${this.sessionToken}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
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
        this.attemptReconnect();
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
        this.emit('status', data.data);
        break;
      case 'read':
        this.emit('read', data.data);
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
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  // Send chat message
  sendMessage(content) {
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
