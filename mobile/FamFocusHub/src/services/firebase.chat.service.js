// Firebase Chat Service for FamFocus Hub
// Using React Native Firebase (Native implementation)

import database from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

class FirebaseChatService {
  constructor() {
    this.familyId = null;
    this.userId = null;
    this.userName = null;
    this.userPicture = null;
    this.unsubscribers = [];
    this.messageCallback = null;
    this.typingCallback = null;
    this.connectionCallback = null;
    this.isInitialized = false;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.networkListener = null;
  }

  // Initialize Firebase
  async initialize() {
    try {
      if (this.isInitialized) {
        console.log('[ChatService] Already initialized');
        return true;
      }

      this.isInitialized = true;
      this.setupNetworkListener();
      
      console.log('[ChatService] Firebase chat service initialized');
      return true;
    } catch (error) {
      console.error('[ChatService] Initialization error:', error);
      this.isInitialized = false;
      return false;
    }
  }

  // Setup network listener for auto-reconnect
  setupNetworkListener() {
    if (this.networkListener) return;
    
    try {
      this.networkListener = NetInfo.addEventListener(state => {
        const wasConnected = this.isConnected;
        
        if (state.isConnected && !wasConnected && this.familyId) {
          console.log('[ChatService] Network reconnected, re-establishing Firebase connection');
          this.reconnect();
        } else if (!state.isConnected && wasConnected) {
          console.log('[ChatService] Network disconnected');
          this.isConnected = false;
          if (this.connectionCallback) {
            this.connectionCallback(false);
          }
        }
      });
    } catch (error) {
      console.warn('[ChatService] Failed to setup network listener:', error);
    }
  }

  // Set user info for chat
  setUser(userId, userName, userPicture, familyId) {
    this.userId = userId;
    this.userName = userName;
    this.userPicture = userPicture;
    this.familyId = familyId;
  }

  // Set online presence with disconnect handling
  setOnlinePresence() {
    if (!this.familyId || !this.userId) return;
    
    try {
      const presenceRef = database().ref(`chats/${this.familyId}/presence/${this.userId}`);
      
      presenceRef.set({
        online: true,
        lastSeen: database.ServerValue.TIMESTAMP,
        name: this.userName,
        picture: this.userPicture
      });
      
      // Set offline when disconnected
      presenceRef.onDisconnect().set({
        online: false,
        lastSeen: database.ServerValue.TIMESTAMP,
        name: this.userName
      });
    } catch (error) {
      console.warn('[ChatService] Failed to set online presence:', error);
    }
  }

  // Connect to chat and listen for messages
  connect(onMessage, onTyping, onConnection) {
    if (!this.isInitialized || !this.familyId) {
      console.log('[ChatService] Not initialized or no family set');
      if (onConnection) onConnection(false);
      return false;
    }

    this.messageCallback = onMessage;
    this.typingCallback = onTyping;
    this.connectionCallback = onConnection;

    try {
      // Clear any existing listeners
      this.clearListeners();

      // Listen for connection state
      const connectedRef = database().ref('.info/connected');
      const connectedListener = connectedRef.on('value', (snapshot) => {
        const connected = snapshot.val() === true;
        this.isConnected = connected;
        this.reconnectAttempts = 0;
        
        if (connected) {
          console.log('[ChatService] Firebase connected');
          this.setOnlinePresence();
        } else {
          console.log('[ChatService] Firebase disconnected');
        }
        
        if (this.connectionCallback) {
          this.connectionCallback(connected);
        }
      });
      this.unsubscribers.push(() => connectedRef.off('value', connectedListener));

      // Listen for new messages (last 100)
      const messagesRef = database().ref(`chats/${this.familyId}/messages`);
      const messagesListener = messagesRef
        .orderByChild('timestamp')
        .limitToLast(100)
        .on('value', (snapshot) => {
          const messages = [];
          snapshot.forEach((childSnapshot) => {
            const message = childSnapshot.val();
            messages.push({
              ...message,
              message_id: childSnapshot.key,
            });
            return false; // Continue iteration
          });
          
          // Sort by timestamp
          messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          
          if (this.messageCallback) {
            this.messageCallback(messages);
          }
        }, (error) => {
          console.error('[ChatService] Error listening to messages:', error);
          this.handleConnectionError(error);
        });

      this.unsubscribers.push(() => messagesRef.off('value', messagesListener));

      // Listen for typing indicators
      if (onTyping) {
        const typingRef = database().ref(`chats/${this.familyId}/typing`);
        const typingListener = typingRef.on('value', (snapshot) => {
          const typingUsers = [];
          snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            if (data.isTyping && childSnapshot.key !== this.userId) {
              typingUsers.push(data.name || 'Someone');
            }
            return false;
          });
          
          if (this.typingCallback) {
            this.typingCallback(typingUsers);
          }
        }, (error) => {
          console.warn('[ChatService] Error listening to typing:', error);
        });

        this.unsubscribers.push(() => typingRef.off('value', typingListener));
      }

      console.log('[ChatService] Firebase chat listeners established');
      return true;
    } catch (error) {
      console.error('[ChatService] Error connecting:', error);
      this.handleConnectionError(error);
      return false;
    }
  }

  // Handle connection errors with retry logic
  handleConnectionError(error) {
    console.error('[ChatService] Connection error:', error);
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`[ChatService] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.reconnect(), delay);
    } else {
      console.error('[ChatService] Max reconnect attempts reached');
      if (this.connectionCallback) {
        this.connectionCallback(false);
      }
    }
  }

  // Reconnect to chat
  reconnect() {
    if (this.messageCallback || this.typingCallback) {
      console.log('[ChatService] Reconnecting...');
      this.connect(this.messageCallback, this.typingCallback, this.connectionCallback);
    }
  }

  // Clear all listeners
  clearListeners() {
    for (const unsub of this.unsubscribers) {
      try {
        unsub();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    this.unsubscribers = [];
  }

  // Send a message
  async sendMessage(content, type = 'text', mediaUrl = null) {
    if (!this.familyId || !this.userId) {
      console.error('[ChatService] Cannot send message: not connected');
      await this.queueOfflineMessage(content, type, mediaUrl);
      return null;
    }

    try {
      const messagesRef = database().ref(`chats/${this.familyId}/messages`);
      const newMessageRef = messagesRef.push();
      
      const message = {
        content,
        type,
        media_url: mediaUrl,
        sender_id: this.userId,
        sender_name: this.userName,
        sender_picture: this.userPicture,
        timestamp: Date.now(),
        read_by: { [this.userId]: true },
        reactions: {},
      };

      await newMessageRef.set(message);
      
      // Clear typing indicator after sending
      this.setTyping(false);
      
      return {
        ...message,
        message_id: newMessageRef.key,
      };
    } catch (error) {
      console.error('[ChatService] Error sending message:', error);
      await this.queueOfflineMessage(content, type, mediaUrl);
      return null;
    }
  }

  // Send a GIF
  async sendGif(gifUrl) {
    return this.sendMessage('', 'gif', gifUrl);
  }

  // Send an image
  async sendImage(imageUrl) {
    return this.sendMessage('', 'image', imageUrl);
  }

  // Add reaction to a message
  async addReaction(messageId, emoji) {
    if (!this.userId || !this.familyId) return;

    try {
      const reactionRef = database().ref(`chats/${this.familyId}/messages/${messageId}/reactions/${this.userId}`);
      await reactionRef.set(emoji);
    } catch (error) {
      console.error('[ChatService] Error adding reaction:', error);
    }
  }

  // Remove reaction from a message
  async removeReaction(messageId) {
    if (!this.userId || !this.familyId) return;

    try {
      const reactionRef = database().ref(`chats/${this.familyId}/messages/${messageId}/reactions/${this.userId}`);
      await reactionRef.set(null);
    } catch (error) {
      console.error('[ChatService] Error removing reaction:', error);
    }
  }

  // Mark messages as read
  async markAsRead(messageIds) {
    if (!this.userId || !this.familyId) return;

    try {
      const updates = {};
      for (const messageId of messageIds) {
        updates[`chats/${this.familyId}/messages/${messageId}/read_by/${this.userId}`] = true;
      }
      await database().ref().update(updates);
    } catch (error) {
      console.error('[ChatService] Error marking messages as read:', error);
    }
  }

  // Set typing indicator
  setTyping(isTyping) {
    if (!this.userId || !this.familyId) return;

    try {
      const userTypingRef = database().ref(`chats/${this.familyId}/typing/${this.userId}`);
      userTypingRef.set({
        isTyping,
        name: this.userName,
        timestamp: Date.now()
      });

      // Auto-clear typing after 3 seconds
      if (isTyping) {
        setTimeout(() => {
          if (this.userId && this.familyId) {
            userTypingRef.set({
              isTyping: false,
              name: this.userName,
              timestamp: Date.now()
            });
          }
        }, 3000);
      }
    } catch (error) {
      console.warn('[ChatService] Error setting typing indicator:', error);
    }
  }

  // Queue message for offline sending
  async queueOfflineMessage(content, type, mediaUrl) {
    try {
      const queueKey = 'offlineMessageQueue';
      const queue = JSON.parse(await AsyncStorage.getItem(queueKey) || '[]');
      queue.push({
        content,
        type,
        mediaUrl,
        timestamp: Date.now(),
        familyId: this.familyId
      });
      await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
      console.log('[ChatService] Message queued for offline sending');
    } catch (error) {
      console.error('[ChatService] Error queueing offline message:', error);
    }
  }

  // Sync offline messages when back online
  async syncOfflineMessages() {
    try {
      const queueKey = 'offlineMessageQueue';
      const queue = JSON.parse(await AsyncStorage.getItem(queueKey) || '[]');
      
      if (queue.length === 0) return;
      
      console.log(`[ChatService] Syncing ${queue.length} offline messages`);
      
      for (const msg of queue) {
        if (msg.familyId === this.familyId) {
          await this.sendMessage(msg.content, msg.type, msg.mediaUrl);
        }
      }
      
      const remaining = queue.filter(msg => msg.familyId !== this.familyId);
      await AsyncStorage.setItem(queueKey, JSON.stringify(remaining));
    } catch (error) {
      console.error('[ChatService] Error syncing offline messages:', error);
    }
  }

  // Get message history (for initial load)
  async getMessageHistory(limit = 50) {
    if (!this.familyId) return [];

    try {
      const messagesRef = database().ref(`chats/${this.familyId}/messages`);
      const snapshot = await messagesRef
        .orderByChild('timestamp')
        .limitToLast(limit)
        .once('value');

      const messages = [];
      snapshot.forEach((childSnapshot) => {
        messages.push({
          ...childSnapshot.val(),
          message_id: childSnapshot.key,
        });
        return false;
      });
      
      messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      return messages;
    } catch (error) {
      console.error('[ChatService] Error getting message history:', error);
      return [];
    }
  }

  // Disconnect and cleanup
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.clearListeners();

    // Set offline presence
    if (this.familyId && this.userId) {
      try {
        const presenceRef = database().ref(`chats/${this.familyId}/presence/${this.userId}`);
        presenceRef.set({
          online: false,
          lastSeen: database.ServerValue.TIMESTAMP,
          name: this.userName
        });
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    this.isConnected = false;
    this.messageCallback = null;
    this.typingCallback = null;
    this.connectionCallback = null;
    console.log('[ChatService] Firebase chat disconnected');
  }

  // Reset service completely
  reset() {
    this.disconnect();
    
    if (this.networkListener) {
      try {
        this.networkListener();
      } catch (e) {}
      this.networkListener = null;
    }
    
    this.familyId = null;
    this.userId = null;
    this.userName = null;
    this.userPicture = null;
    this.reconnectAttempts = 0;
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isInitialized: this.isInitialized,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      familyId: this.familyId,
      userId: this.userId
    };
  }
}

const firebaseChatService = new FirebaseChatService();
export default firebaseChatService;
