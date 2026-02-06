// Firebase Chat Service for FamFocus Hub
// Replaces WebSocket with Firebase Realtime Database for reliable messaging

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getDatabase, 
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
import firebaseConfig from './firebase.config';

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
    this.isInitialized = false;
  }

  // Initialize Firebase
  async initialize() {
    try {
      if (!getApps().length) {
        this.app = initializeApp(firebaseConfig);
      } else {
        this.app = getApp();
      }
      this.db = getDatabase(this.app);
      this.isInitialized = true;
      console.log('Firebase initialized successfully');
      return true;
    } catch (error) {
      console.error('Firebase initialization error:', error);
      return false;
    }
  }

  // Set user info for chat
  setUser(userId, userName, userPicture, familyId) {
    this.userId = userId;
    this.userName = userName;
    this.userPicture = userPicture;
    this.familyId = familyId;
    
    if (this.isInitialized && familyId) {
      this.messagesRef = ref(this.db, `chats/${familyId}/messages`);
      this.typingRef = ref(this.db, `chats/${familyId}/typing`);
      this.presenceRef = ref(this.db, `chats/${familyId}/presence/${userId}`);
      
      // Set online presence
      this.setOnlinePresence();
    }
  }

  // Set online presence with disconnect handling
  setOnlinePresence() {
    if (!this.presenceRef) return;
    
    set(this.presenceRef, {
      online: true,
      lastSeen: serverTimestamp(),
      name: this.userName
    });
    
    // Set offline when disconnected
    onDisconnect(this.presenceRef).set({
      online: false,
      lastSeen: serverTimestamp(),
      name: this.userName
    });
  }

  // Connect to chat and listen for messages
  connect(onMessage, onTyping) {
    if (!this.isInitialized || !this.messagesRef) {
      console.log('Firebase not initialized or no family set');
      return false;
    }

    this.messageCallback = onMessage;
    this.typingCallback = onTyping;

    // Listen for new messages (last 100)
    const messagesQuery = query(
      this.messagesRef,
      orderByChild('timestamp'),
      limitToLast(100)
    );

    const unsubMessages = onValue(messagesQuery, (snapshot) => {
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
    });

    this.unsubscribers.push(() => off(messagesQuery));

    // Listen for typing indicators
    if (this.typingRef && onTyping) {
      const unsubTyping = onValue(this.typingRef, (snapshot) => {
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
      });

      this.unsubscribers.push(() => off(this.typingRef));
    }

    console.log('Firebase chat connected');
    return true;
  }

  // Send a message
  async sendMessage(content, type = 'text', mediaUrl = null) {
    if (!this.messagesRef || !this.userId) {
      console.error('Cannot send message: not connected');
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
        read_by: [this.userId],
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
    if (!this.messagesRef || !this.userId) return;

    try {
      const reactionRef = ref(this.db, `chats/${this.familyId}/messages/${messageId}/reactions/${this.userId}`);
      await set(reactionRef, emoji);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  }

  // Remove reaction from a message
  async removeReaction(messageId) {
    if (!this.messagesRef || !this.userId) return;

    try {
      const reactionRef = ref(this.db, `chats/${this.familyId}/messages/${messageId}/reactions/${this.userId}`);
      await set(reactionRef, null);
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  }

  // Mark messages as read
  async markAsRead(messageIds) {
    if (!this.messagesRef || !this.userId) return;

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
    if (!this.typingRef || !this.userId) return;

    const userTypingRef = ref(this.db, `chats/${this.familyId}/typing/${this.userId}`);
    set(userTypingRef, {
      isTyping,
      name: this.userName,
      timestamp: Date.now()
    });

    // Auto-clear typing after 3 seconds
    if (isTyping) {
      setTimeout(() => {
        set(userTypingRef, {
          isTyping: false,
          name: this.userName,
          timestamp: Date.now()
        });
      }, 3000);
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
    } catch (error) {
      console.error('Error queueing offline message:', error);
    }
  }

  // Sync offline messages when back online
  async syncOfflineMessages() {
    try {
      const queueKey = 'offlineMessageQueue';
      const queue = JSON.parse(await AsyncStorage.getItem(queueKey) || '[]');
      
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
    if (!this.messagesRef) return [];

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
    // Remove all listeners
    for (const unsub of this.unsubscribers) {
      try {
        unsub();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    this.unsubscribers = [];

    // Set offline presence
    if (this.presenceRef) {
      set(this.presenceRef, {
        online: false,
        lastSeen: serverTimestamp(),
        name: this.userName
      });
    }

    this.messageCallback = null;
    this.typingCallback = null;
    console.log('Firebase chat disconnected');
  }

  // Reset service
  reset() {
    this.disconnect();
    this.familyId = null;
    this.userId = null;
    this.userName = null;
    this.userPicture = null;
    this.messagesRef = null;
    this.typingRef = null;
    this.presenceRef = null;
  }
}

const firebaseChatService = new FirebaseChatService();
export default firebaseChatService;
