import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import webSocketService from '../services/websocket.service';

export default function ChatScreen({ navigation }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const connectionDot = useRef(new Animated.Value(0)).current;

  // Connection status animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(connectionDot, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(connectionDot, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Initialize WebSocket and fetch messages
  useEffect(() => {
    initializeChat();
    
    return () => {
      cleanupChat();
    };
  }, []);

  const initializeChat = async () => {
    // Fetch initial messages
    await fetchMessages();
    
    // Setup WebSocket
    const token = await getSessionToken();
    if (token) {
      webSocketService.setSessionToken(token);
      setupWebSocketListeners();
      webSocketService.connect();
    }
    
    setLoading(false);
  };

  const getSessionToken = async () => {
    try {
      const SecureStore = require('expo-secure-store');
      return await SecureStore.getItemAsync('famfocus_session_token');
    } catch (error) {
      return null;
    }
  };

  const setupWebSocketListeners = () => {
    // Connection status
    webSocketService.on('connect', () => {
      setConnected(true);
    });

    webSocketService.on('disconnect', () => {
      setConnected(false);
    });

    // New message received
    webSocketService.on('message', (message) => {
      setMessages(prev => {
        // Avoid duplicates
        if (prev.find(m => m.message_id === message.message_id)) {
          return prev;
        }
        return [...prev, message];
      });
      
      // Auto-scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    // Typing indicators
    webSocketService.on('typing', (data) => {
      if (data.user_id === user?.user_id) return;
      
      if (data.is_typing) {
        setTypingUsers(prev => {
          if (prev.find(u => u.user_id === data.user_id)) return prev;
          return [...prev, data];
        });
      } else {
        setTypingUsers(prev => prev.filter(u => u.user_id !== data.user_id));
      }
    });

    // Online status
    webSocketService.on('status', (data) => {
      if (data.status === 'online') {
        setOnlineUsers(prev => [...new Set([...prev, data.user_id])]);
      } else {
        setOnlineUsers(prev => prev.filter(id => id !== data.user_id));
      }
    });

    // Read receipts
    webSocketService.on('read', (data) => {
      setMessages(prev => prev.map(m => {
        if (m.message_id === data.message_id) {
          return {
            ...m,
            read_by: [...(m.read_by || []), data.user_id]
          };
        }
        return m;
      }));
    });
  };

  const cleanupChat = () => {
    webSocketService.disconnect();
  };

  const fetchMessages = async () => {
    try {
      const data = await apiService.getMessages();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    // Try WebSocket first
    if (connected && webSocketService.sendMessage(content)) {
      setSending(false);
      return;
    }

    // Fall back to REST API
    try {
      await apiService.sendMessage(content);
      await fetchMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(content); // Restore message on failure
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (text) => {
    setNewMessage(text);
    
    // Send typing indicator via WebSocket
    if (connected) {
      webSocketService.sendTyping(true);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        webSocketService.sendTyping(false);
      }, 2000);
    }
  };

  const renderMessage = ({ item }) => {
    const isOwn = item.user_id === user?.user_id;
    const isOnline = onlineUsers.includes(item.user_id);
    const isRead = item.read_by?.length > 1;
    
    return (
      <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
        {!isOwn && (
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.user_name?.charAt(0)}</Text>
            </View>
            {isOnline && <View style={styles.onlineDot} />}
          </View>
        )}
        <View style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          {!isOwn && <Text style={styles.senderName}>{item.user_name}</Text>}
          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.timestamp, isOwn && styles.ownTimestamp]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOwn && (
              <View style={styles.readReceipt}>
                {isRead ? (
                  <Ionicons name="checkmark-done" size={14} color="#60a5fa" />
                ) : (
                  <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.5)" />
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;
    
    const names = typingUsers.map(u => u.user_name).join(', ');
    
    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingDots}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.typingDot,
                {
                  opacity: connectionDot,
                  transform: [{
                    translateY: connectionDot.interpolate({
                      inputRange: [0.3, 1],
                      outputRange: [0, -4],
                    })
                  }]
                }
              ]}
            />
          ))}
        </View>
        <Text style={styles.typingText}>{names} typing...</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1e1b4b', '#312e81', '#1e1b4b']} style={styles.gradient} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Family Chat</Text>
          <View style={styles.connectionStatus}>
            <Animated.View style={[
              styles.connectionDot,
              { 
                backgroundColor: connected ? '#10b981' : '#f59e0b',
                opacity: connected ? 1 : connectionDot 
              }
            ]} />
            <Text style={[styles.connectionText, { color: connected ? '#10b981' : '#f59e0b' }]}>
              {connected ? 'Live' : 'Connecting...'}
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Messages */}
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.message_id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#6b7280" />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
          ListFooterComponent={renderTypingIndicator}
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={handleTyping}
            placeholder="Type a message..."
            placeholderTextColor="#6b7280"
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0d1a' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d1a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  backButton: { padding: 8 },
  headerTitle: { alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  connectionStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  connectionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  connectionText: { fontSize: 12, fontWeight: '600' },
  chatContainer: { flex: 1 },
  messagesList: { padding: 16, flexGrow: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { color: '#6b7280', fontSize: 18, marginTop: 16 },
  emptySubtext: { color: '#4b5563', fontSize: 14, marginTop: 4 },
  messageContainer: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  ownMessageContainer: { justifyContent: 'flex-end' },
  avatarContainer: { position: 'relative', marginRight: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#0f0d1a' },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16 },
  otherBubble: { backgroundColor: 'rgba(30, 27, 75, 0.9)', borderBottomLeftRadius: 4 },
  ownBubble: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
  senderName: { fontSize: 12, color: '#a5b4fc', marginBottom: 4 },
  messageText: { fontSize: 15, color: '#fff', lineHeight: 20 },
  ownMessageText: { color: '#fff' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  timestamp: { fontSize: 10, color: '#6b7280' },
  ownTimestamp: { color: 'rgba(255,255,255,0.6)' },
  readReceipt: { marginLeft: 4 },
  typingContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  typingDots: { flexDirection: 'row', marginRight: 8 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a5b4fc', marginHorizontal: 2 },
  typingText: { color: '#a5b4fc', fontSize: 12, fontStyle: 'italic' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(15, 13, 26, 0.95)' },
  input: { flex: 1, backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, color: '#fff', fontSize: 15, maxHeight: 100, marginRight: 12 },
  sendButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: '#4b5563' },
});
