// Firebase Chat Service for FamFocus Hub
// Uses Firebase Realtime Database for reliable messaging

import { 
  ref, 
  push, 
  set, 
  onValue, 
  off, 
  query, 
  orderByChild, 
  limitToLast,
  serverTimestamp,
  onDisconnect,
  update
} from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getFirebaseApp, getFirebaseDatabase, initializeFirebase } from './firebase.init';

class FirebaseChatService {
  constructor() {
    this.app = null;
    this.db = null;
    this.familyId = null;
    this.userId = null;
    this.userName = null;
    this.userPicture = null;
    this.messagesRef = null;
    this.typingRef = null;
    this.presenceRef = null;
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
      // Check if already initialized
      if (this.isInitialized && this.db) {
        console.log('Firebase already initialized');
        return true;
      }

      // Use centralized Firebase initialization
      initializeFirebase();
      this.app = getFirebaseApp();
      this.db = getFirebaseDatabase();
      
      if (!this.db) {
        console.error('Firebase Database not available');
        return false;
      }
      
      this.isInitialized = true;
      
      // Setup network listener for auto-reconnect
      this.setupNetworkListener();
      
      console.log('Firebase chat service initialized');
      return true;
    } catch (error) {
      console.error('Firebase initialization error:', error);
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
          console.log('Network reconnected, re-establishing Firebase connection');
          this.reconnect();
        } else if (!state.isConnected && wasConnected) {
          console.log('Network disconnected');
          this.isConnected = false;
          if (this.connectionCallback) {
            this.connectionCallback(false);
          }
        }
      });
    } catch (error) {
      console.warn('Failed to setup network listener:', error);
    }
  }

  // Set user info for chat
  setUser(userId, userName, userPicture, familyId) {
    this.userId = userId;
    this.userName = userName;
    this.userPicture = userPicture;
    this.familyId = familyId;
    
    if (this.isInitialized && familyId && this.db) {
      this.messagesRef = ref(this.db, `chats/${familyId}/messages`);
      this.typingRef = ref(this.db, `chats/${familyId}/typing`);
      this.presenceRef = ref(this.db, `chats/${familyId}/presence/${userId}`);
    }
  }

  // Set online presence with disconnect handling
  setOnlinePresence() {
    if (!this.presenceRef || !this.db) return;
    
    try {
      set(this.presenceRef, {
        online: true,
        lastSeen: serverTimestamp(),
        name: this.userName,
        picture: this.userPicture
      });
      
      // Set offline when disconnected
      onDisconnect(this.presenceRef).set({
        online: false,
        lastSeen: serverTimestamp(),
        name: this.userName
      });
    } catch (error) {
      console.warn('Failed to set online presence:', error);
    }
  }

  // Connect to chat and listen for messages
  connect(onMessage, onTyping, onConnection) {
    if (!this.isInitialized || !this.messagesRef || !this.db) {
      console.log('Firebase not initialized or no family set');
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
      const connectedRef = ref(this.db, '.info/connected');
      const connectedUnsub = onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val() === true;
        this.isConnected = connected;
        this.reconnectAttempts = 0; // Reset on successful connection
        
        if (connected) {
          console.log('Firebase connected');
          this.setOnlinePresence();
        } else {
          console.log('Firebase disconnected');
        }
        
        if (this.connectionCallback) {
          this.connectionCallback(connected);
        }
      });
      this.unsubscribers.push(() => off(connectedRef));

      // Listen for new messages (last 100)
      const messagesQuery = query(
        this.messagesRef,
        orderByChild('timestamp'),
        limitToLast(100)
      );

      const messagesUnsub = onValue(messagesQuery, (snapshot) => {
        const messages = [];
        snapshot.forEach((childSnapshot) => {
          const message = childSnapshot.val();
          messages.push({
            ...message,
            message_id: childSnapshot.key,
          });
        });
        
        // Sort by timestamp
        messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        if (this.messageCallback) {
          this.messageCallback(messages);
        }
      }, (error) => {
        console.error('Error listening to messages:', error);
        this.handleConnectionError(error);
      });

      this.unsubscribers.push(() => off(messagesQuery));

      // Listen for typing indicators
      if (this.typingRef && onTyping) {
        const typingUnsub = onValue(this.typingRef, (snapshot) => {
          const typingUsers = [];
          snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            if (data.isTyping && childSnapshot.key !== this.userId) {
              typingUsers.push(data.name || 'Someone');
            }
          });
          
          if (this.typingCallback) {
            this.typingCallback(typingUsers);
          }
        }, (error) => {
          console.warn('Error listening to typing:', error);
        });

        this.unsubscribers.push(() => off(this.typingRef));
      }

      console.log('Firebase chat listeners established');
      return true;
    } catch (error) {
      console.error('Error connecting to Firebase chat:', error);
      this.handleConnectionError(error);
      return false;
    }
  }

  // Handle connection errors with retry logic
  handleConnectionError(error) {
    console.error('Firebase connection error:', error);
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.reconnect(), delay);
    } else {
      console.error('Max reconnect attempts reached');
      if (this.connectionCallback) {
        this.connectionCallback(false);
      }
    }
  }

  // Reconnect to chat
  reconnect() {
    if (this.messageCallback || this.typingCallback) {
      console.log('Reconnecting to Firebase chat...');
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
    if (!this.messagesRef || !this.userId || !this.db) {
      console.error('Cannot send message: not connected');
      // Queue for offline sending
      await this.queueOfflineMessage(content, type, mediaUrl);
      return null;
    }

    try {
      const messageRef = push(this.messagesRef);
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

      await set(messageRef, message);
      
      // Clear typing indicator after sending
      this.setTyping(false);
      
      return {
        ...message,
        message_id: messageRef.key,
      };
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Queue message for later if offline
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
    if (!this.db || !this.userId || !this.familyId) return;

    try {
      const reactionRef = ref(this.db, `chats/${this.familyId}/messages/${messageId}/reactions/${this.userId}`);
      await set(reactionRef, emoji);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  }

  // Remove reaction from a message
  async removeReaction(messageId) {
    if (!this.db || !this.userId || !this.familyId) return;

    try {
      const reactionRef = ref(this.db, `chats/${this.familyId}/messages/${messageId}/reactions/${this.userId}`);
      await set(reactionRef, null);
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  }

  // Mark messages as read
  async markAsRead(messageIds) {
    if (!this.db || !this.userId || !this.familyId) return;

    try {
      const updates = {};
      for (const messageId of messageIds) {
        updates[`chats/${this.familyId}/messages/${messageId}/read_by/${this.userId}`] = true;
      }
      await update(ref(this.db), updates);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  // Set typing indicator
  setTyping(isTyping) {
    if (!this.db || !this.userId || !this.familyId) return;

    try {
      const userTypingRef = ref(this.db, `chats/${this.familyId}/typing/${this.userId}`);
      set(userTypingRef, {
        isTyping,
        name: this.userName,
        timestamp: Date.now()
      });

      // Auto-clear typing after 3 seconds
      if (isTyping) {
        setTimeout(() => {
          if (this.db && this.userId && this.familyId) {
            set(userTypingRef, {
              isTyping: false,
              name: this.userName,
              timestamp: Date.now()
            });
          }
        }, 3000);
      }
    } catch (error) {
      console.warn('Error setting typing indicator:', error);
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
      console.log('Message queued for offline sending');
    } catch (error) {
      console.error('Error queueing offline message:', error);
    }
  }

  // Sync offline messages when back online
  async syncOfflineMessages() {
    try {
      const queueKey = 'offlineMessageQueue';
      const queue = JSON.parse(await AsyncStorage.getItem(queueKey) || '[]');
      
      if (queue.length === 0) return;
      
      console.log(`Syncing ${queue.length} offline messages`);
      
      for (const msg of queue) {
        if (msg.familyId === this.familyId) {
          await this.sendMessage(msg.content, msg.type, msg.mediaUrl);
        }
      }
      
      // Clear queue for this family
      const remaining = queue.filter(msg => msg.familyId !== this.familyId);
      await AsyncStorage.setItem(queueKey, JSON.stringify(remaining));
    } catch (error) {
      console.error('Error syncing offline messages:', error);
    }
  }

  // Get message history (for initial load)
  async getMessageHistory(limit = 50) {
    if (!this.messagesRef || !this.db) return [];

    try {
      const messagesQuery = query(
        this.messagesRef,
        orderByChild('timestamp'),
        limitToLast(limit)
      );

      return new Promise((resolve) => {
        onValue(messagesQuery, (snapshot) => {
          const messages = [];
          snapshot.forEach((childSnapshot) => {
            messages.push({
              ...childSnapshot.val(),
              message_id: childSnapshot.key,
            });
          });
          messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          resolve(messages);
        }, { onlyOnce: true });
      });
    } catch (error) {
      console.error('Error getting message history:', error);
      return [];
    }
  }

  // Disconnect and cleanup
  disconnect() {
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Remove all listeners
    this.clearListeners();

    // Set offline presence
    if (this.presenceRef && this.db) {
      try {
        set(this.presenceRef, {
          online: false,
          lastSeen: serverTimestamp(),
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
    console.log('Firebase chat disconnected');
  }

  // Reset service completely
  reset() {
    this.disconnect();
    
    // Remove network listener
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
    this.messagesRef = null;
    this.typingRef = null;
    this.presenceRef = null;
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
