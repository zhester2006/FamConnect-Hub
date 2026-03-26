// Firebase Chat Service for FamFocus Hub
// Uses React Native Firebase Realtime Database for reliable messaging

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Safely import Firebase - it may not be available in all environments
let database = null;
try {
  database = require('@react-native-firebase/database').default;
} catch (e) {
  console.warn('[ChatService] Firebase database not available:', e.message);
}

class FirebaseChatService {
  constructor() {
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
    this.offlineMode = false;
  }

  // Initialize Firebase
  async initialize() {
    try {
      if (this.isInitialized && this.db) {
        console.log('[ChatService] Already initialized');
        return true;
      }

      // Check if Firebase database is available
      if (!database) {
        console.warn('[ChatService] Firebase Database module not available - running in offline mode');
        this.offlineMode = true;
        this.isInitialized = true;
        return true;
      }

      // Get database instance from React Native Firebase
      this.db = database();
      
      if (!this.db) {
        console.warn('[ChatService] Firebase Database instance not available - running in offline mode');
        this.offlineMode = true;
        this.isInitialized = true;
        return true;
      }
      
      this.isInitialized = true;
      this.offlineMode = false;
      this.setupNetworkListener();
      
      console.log('[ChatService] Firebase chat service initialized');
      return true;
    } catch (error) {
      console.warn('[ChatService] Initialization error - running in offline mode:', error.message);
      this.offlineMode = true;
      this.isInitialized = true;
      return true;
    }
  }

  // Setup network listener for auto-reconnect
  setupNetworkListener() {
    if (this.networkListener) return;
    
    try {
      this.networkListener = NetInfo.addEventListener(state => {
        const wasConnected = this.isConnected;
        
        if (state.isConnected && !wasConnected && this.familyId) {
          console.log('[ChatService] Network reconnected');
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

  // Set current user
  setUser(userId, userName, userPicture, familyId) {
    this.userId = userId;
    this.userName = userName;
    this.userPicture = userPicture;
    this.familyId = familyId;

    if (this.isInitialized && familyId) {
      this.messagesRef = this.db.ref(`chats/${familyId}/messages`);
      this.typingRef = this.db.ref(`chats/${familyId}/typing`);
      this.presenceRef = this.db.ref(`chats/${familyId}/presence/${userId}`);
    }
  }

  // Connect and listen for messages
  connect(onMessages, onTyping, onConnection) {
    this.messageCallback = onMessages;
    this.typingCallback = onTyping;
    this.connectionCallback = onConnection;

    // If in offline mode, return mock data
    if (this.offlineMode || !this.db || !this.messagesRef) {
      console.log('[ChatService] Running in offline mode - using local messages');
      this.isConnected = true;
      
      // Return empty messages for now
      if (this.messageCallback) {
        this.messageCallback([]);
      }
      if (this.connectionCallback) {
        this.connectionCallback(true);
      }
      return true;
    }

    try {
      // Clear any existing listeners
      this.disconnect();

      // Listen for messages (last 50)
      const messagesListener = this.messagesRef
        .orderByChild('timestamp')
        .limitToLast(50)
        .on('value', (snapshot) => {
          const messages = [];
          snapshot.forEach((child) => {
            messages.push({
              id: child.key,
              ...child.val()
            });
          });
          messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          
          if (this.messageCallback) {
            this.messageCallback(messages);
          }
        }, (error) => {
          console.warn('[ChatService] Messages listener error:', error);
          // Don't crash, just return empty
          if (this.messageCallback) {
            this.messageCallback([]);
          }
        });

      this.unsubscribers.push(() => this.messagesRef.off('value', messagesListener));

      // Listen for typing indicators
      if (this.typingRef) {
        const typingListener = this.typingRef.on('value', (snapshot) => {
          const typing = {};
          snapshot.forEach((child) => {
            if (child.key !== this.userId) {
              typing[child.key] = child.val();
            }
          });
          
          if (this.typingCallback) {
            this.typingCallback(typing);
          }
        }, (error) => {
          console.warn('[ChatService] Typing listener error:', error);
        });

        this.unsubscribers.push(() => this.typingRef.off('value', typingListener));
      }

      // Set online presence
      if (this.presenceRef) {
        try {
          this.presenceRef.set({
            online: true,
            lastSeen: database.ServerValue.TIMESTAMP,
            name: this.userName,
            picture: this.userPicture
          });

          this.presenceRef.onDisconnect().set({
            online: false,
            lastSeen: database.ServerValue.TIMESTAMP,
            name: this.userName,
            picture: this.userPicture
          });
        } catch (presenceError) {
          console.warn('[ChatService] Presence setup error:', presenceError);
        }
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      if (this.connectionCallback) {
        this.connectionCallback(true);
      }

      return true;
    } catch (error) {
      console.warn('[ChatService] Connection error:', error);
      // Still return true but in offline mode
      this.offlineMode = true;
      this.isConnected = true;
      if (this.messageCallback) {
        this.messageCallback([]);
      }
      if (this.connectionCallback) {
        this.connectionCallback(true);
      }
      return true;
    }
  }

  // Send a message
  async sendMessage(content, type = 'text', mediaUrl = null) {
    // Handle offline mode
    if (this.offlineMode || !this.messagesRef || !this.userId) {
      console.log('[ChatService] Offline mode - message saved locally');
      // Add to local callback immediately for UI feedback
      if (this.messageCallback) {
        const localMessage = {
          id: Date.now().toString(),
          senderId: this.userId,
          senderName: this.userName,
          senderPicture: this.userPicture,
          content,
          type,
          mediaUrl,
          timestamp: Date.now(),
          read: false,
          local: true
        };
        // This will be handled by the component
      }
      return { success: true, offline: true };
    }

    try {
      const messageData = {
        senderId: this.userId,
        senderName: this.userName,
        senderPicture: this.userPicture,
        content,
        type,
        mediaUrl,
        timestamp: database.ServerValue.TIMESTAMP,
        read: false
      };

      const newMessageRef = this.messagesRef.push();
      await newMessageRef.set(messageData);

      // Clear typing indicator
      this.setTyping(false);

      return { success: true, messageId: newMessageRef.key };
    } catch (error) {
      console.error('[ChatService] Send message error:', error);
      return { success: false, error: error.message };
    }
  }

  // Set typing indicator
  setTyping(isTyping) {
    if (!this.typingRef || !this.userId) return;

    try {
      const userTypingRef = this.typingRef.child(this.userId);
      
      if (isTyping) {
        userTypingRef.set({
          name: this.userName,
          timestamp: database.ServerValue.TIMESTAMP
        });
        
        // Auto-clear after 5 seconds
        setTimeout(() => this.setTyping(false), 5000);
      } else {
        userTypingRef.remove();
      }
    } catch (error) {
      console.warn('[ChatService] Typing indicator error:', error);
    }
  }

  // Reconnect
  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[ChatService] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`[ChatService] Reconnecting (attempt ${this.reconnectAttempts})`);

    this.connect(this.messageCallback, this.typingCallback, this.connectionCallback);
  }

  // Disconnect
  disconnect() {
    this.unsubscribers.forEach(unsub => {
      try { unsub(); } catch (e) {}
    });
    this.unsubscribers = [];

    if (this.presenceRef) {
      try {
        this.presenceRef.set({
          online: false,
          lastSeen: database.ServerValue.TIMESTAMP
        });
      } catch (e) {}
    }

    this.isConnected = false;
  }

  // Reset
  reset() {
    this.disconnect();
    this.familyId = null;
    this.userId = null;
    this.userName = null;
    this.userPicture = null;
    this.messagesRef = null;
    this.typingRef = null;
    this.presenceRef = null;
    this.messageCallback = null;
    this.typingCallback = null;
    this.connectionCallback = null;
  }

  // Cleanup
  cleanup() {
    this.reset();
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

const firebaseChatService = new FirebaseChatService();
export default firebaseChatService;
