import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Alert, Modal, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import webSocketService from '../services/websocket.service';
import AnimatedBackground from '../components/AnimatedBackground';
import { formatTime } from '../utils/dateUtils';

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

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
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef(null);
  
  // Reaction modal state
  const [showReactionModal, setShowReactionModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  
  // Attachment state
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showGifModal, setShowGifModal] = useState(false);
  const [gifs, setGifs] = useState([]);
  const [gifSearch, setGifSearch] = useState('');

  // Connection status animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(connectionDot, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(connectionDot, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Initialize chat
  useEffect(() => {
    initializeChat();
    return () => cleanupChat();
  }, []);

  const initializeChat = async () => {
    await fetchMessages();
    
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
    webSocketService.on('connect', () => setConnected(true));
    webSocketService.on('disconnect', () => setConnected(false));

    webSocketService.on('message', (message) => {
      setMessages(prev => {
        if (prev.find(m => m.message_id === message.message_id)) return prev;
        return [...prev, message];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

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

    webSocketService.on('status', (data) => {
      if (data.status === 'online') {
        setOnlineUsers(prev => [...new Set([...prev, data.user_id])]);
      } else {
        setOnlineUsers(prev => prev.filter(id => id !== data.user_id));
      }
    });

    webSocketService.on('reaction', (data) => {
      setMessages(prev => prev.map(m => {
        if (m.message_id === data.message_id) {
          return { ...m, reactions: data.reactions };
        }
        return m;
      }));
    });
  };

  const cleanupChat = () => {
    webSocketService.disconnect();
    if (recordingTimer.current) clearInterval(recordingTimer.current);
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

    if (connected && webSocketService.sendMessage(content)) {
      setSending(false);
      return;
    }

    try {
      await apiService.sendMessage(content);
      await fetchMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (text) => {
    setNewMessage(text);
    
    if (connected) {
      webSocketService.sendTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        webSocketService.sendTyping(false);
      }, 2000);
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Could not start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    
    setIsRecording(false);
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      // Send voice message
      await sendVoiceMessage(uri);
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  };

  const sendVoiceMessage = async (uri) => {
    setSending(true);
    try {
      // Read file as base64
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result;
        
        try {
          await apiService.post('/messages/voice', {
            audio_data: base64data,
            duration: recordingDuration,
          });
          await fetchMessages();
        } catch (error) {
          console.error('Failed to send voice message:', error);
          Alert.alert('Error', 'Failed to send voice message');
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Failed to process voice message:', error);
    } finally {
      setSending(false);
      setRecordingDuration(0);
    }
  };

  const cancelRecording = async () => {
    if (recording) {
      await recording.stopAndUnloadAsync();
      setRecording(null);
    }
    setIsRecording(false);
    setRecordingDuration(0);
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
  };

  // Reaction functions
  const handleLongPress = (message) => {
    setSelectedMessage(message);
    setShowReactionModal(true);
  };

  const handleReaction = async (emoji) => {
    if (!selectedMessage) return;
    
    setShowReactionModal(false);
    
    try {
      await apiService.post(`/messages/${selectedMessage.message_id}/react`, { emoji });
      // Optimistically update
      setMessages(prev => prev.map(m => {
        if (m.message_id === selectedMessage.message_id) {
          const reactions = { ...(m.reactions || {}) };
          const userId = user.user_id;
          if (reactions[emoji]?.includes(userId)) {
            reactions[emoji] = reactions[emoji].filter(id => id !== userId);
            if (reactions[emoji].length === 0) delete reactions[emoji];
          } else {
            reactions[emoji] = [...(reactions[emoji] || []), userId];
          }
          return { ...m, reactions };
        }
        return m;
      }));
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
    
    setSelectedMessage(null);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Image picker
  const handlePickImage = async () => {
    setShowAttachmentMenu(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please allow access to your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image');
    }
  };

  // Send image message
  const sendImageMessage = async () => {
    if (!selectedImage) return;
    setSending(true);
    
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: selectedImage.uri,
        type: 'image/jpeg',
        name: 'chat_image.jpg',
      });

      const uploadResponse = await fetch(`${apiService.baseUrl}/upload/image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiService.sessionToken}` },
        body: formData,
      });

      let imageUrl = selectedImage.uri;
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        imageUrl = uploadData.url || selectedImage.uri;
      }

      await apiService.post('/messages', {
        content: newMessage || '📷 Image',
        type: 'image',
        image_url: imageUrl,
      });

      setSelectedImage(null);
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      Alert.alert('Error', 'Failed to send image');
    } finally {
      setSending(false);
    }
  };

  // GIF search
  const searchGifs = async (query) => {
    if (!query.trim()) return;
    try {
      const data = await apiService.searchGifs(query);
      setGifs(data.results || []);
    } catch (error) {
      console.error('GIF search failed:', error);
    }
  };

  // Send GIF message
  const sendGifMessage = async (gif) => {
    setShowGifModal(false);
    setSending(true);
    
    try {
      await apiService.post('/messages', {
        content: '📷 GIF',
        type: 'gif',
        gif_url: gif.url,
      });
      fetchMessages();
    } catch (error) {
      Alert.alert('Error', 'Failed to send GIF');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isOwn = item.user_id === user?.user_id;
    const isOnline = onlineUsers.includes(item.user_id);
    const isRead = item.read_by?.length > 1;
    const isVoice = item.type === 'voice';
    const isImage = item.type === 'image';
    const isGif = item.type === 'gif';
    const reactions = item.reactions || {};
    
    return (
      <TouchableOpacity
        onLongPress={() => handleLongPress(item)}
        delayLongPress={300}
        activeOpacity={0.9}
      >
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
            
            {/* Image message */}
            {isImage && item.image_url && (
              <Image 
                source={{ uri: item.image_url }} 
                style={styles.chatImage} 
                resizeMode="cover"
              />
            )}
            
            {/* GIF message */}
            {isGif && item.gif_url && (
              <Image 
                source={{ uri: item.gif_url }} 
                style={styles.chatGif} 
                resizeMode="cover"
              />
            )}
            
            {isVoice ? (
              <View style={styles.voiceMessage}>
                <TouchableOpacity style={styles.playButton}>
                  <Ionicons name="play" size={18} color="#fff" />
                </TouchableOpacity>
                <View style={styles.voiceWaveform}>
                  {[...Array(12)].map((_, i) => (
                    <View 
                      key={i} 
                      style={[
                        styles.waveBar, 
                        { height: 8 + Math.random() * 16 }
                      ]} 
                    />
                  ))}
                </View>
                <Text style={styles.voiceDuration}>
                  {formatDuration(item.duration || 0)}
                </Text>
              </View>
            ) : !isImage && !isGif ? (
              <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
                {item.content}
              </Text>
            )}
            
            <View style={styles.messageFooter}>
              <Text style={[styles.timestamp, isOwn && styles.ownTimestamp]}>
                {formatTime(item.created_at) || 'Now'}
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
            
            {/* Reactions */}
            {Object.keys(reactions).length > 0 && (
              <View style={styles.reactionsContainer}>
                {Object.entries(reactions).map(([emoji, users]) => (
                  <View key={emoji} style={styles.reactionBadge}>
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    <Text style={styles.reactionCount}>{users.length}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
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
              style={[styles.typingDot, { opacity: connectionDot }]}
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
    <AnimatedBackground page="chat">
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
        {selectedImage ? (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
            <TouchableOpacity 
              style={styles.removeImageBtn}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close-circle" size={28} color="#ef4444" />
            </TouchableOpacity>
            <View style={styles.imageInputRow}>
              <TextInput
                style={styles.imageInput}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Add a caption..."
                placeholderTextColor="#6b7280"
              />
              <TouchableOpacity style={styles.sendImageBtn} onPress={sendImageMessage}>
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : isRecording ? (
          <View style={styles.recordingContainer}>
            <TouchableOpacity style={styles.cancelRecordBtn} onPress={cancelRecording}>
              <Ionicons name="close" size={24} color="#ef4444" />
            </TouchableOpacity>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingPulse} />
              <Text style={styles.recordingText}>Recording {formatDuration(recordingDuration)}</Text>
            </View>
            <TouchableOpacity style={styles.sendRecordBtn} onPress={stopRecording}>
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachButton} onPress={() => setShowAttachmentMenu(true)}>
              <Ionicons name="add-circle" size={28} color="#a5b4fc" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={handleTyping}
              placeholder="Type a message..."
              placeholderTextColor="#6b7280"
              multiline
              maxLength={500}
            />
            <TouchableOpacity style={styles.micButton} onPress={startRecording}>
              <Ionicons name="mic" size={24} color="#a5b4fc" />
            </TouchableOpacity>
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
        )}
      </KeyboardAvoidingView>

      {/* Attachment Menu Modal */}
      <Modal visible={showAttachmentMenu} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.attachmentOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachmentMenu(false)}
        >
          <View style={styles.attachmentMenu}>
            <TouchableOpacity style={styles.attachmentOption} onPress={handlePickImage}>
              <View style={[styles.attachmentIcon, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
                <Ionicons name="image" size={24} color="#818cf8" />
              </View>
              <Text style={styles.attachmentLabel}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachmentOption} onPress={() => { setShowAttachmentMenu(false); setShowGifModal(true); }}>
              <View style={[styles.attachmentIcon, { backgroundColor: 'rgba(236, 72, 153, 0.2)' }]}>
                <Ionicons name="happy" size={24} color="#ec4899" />
              </View>
              <Text style={styles.attachmentLabel}>GIF</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* GIF Modal */}
      <Modal visible={showGifModal} transparent animationType="slide">
        <View style={styles.gifModalOverlay}>
          <View style={styles.gifModalContent}>
            <View style={styles.gifModalHeader}>
              <Text style={styles.gifModalTitle}>Search GIFs</Text>
              <TouchableOpacity onPress={() => setShowGifModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <View style={styles.gifSearchRow}>
              <TextInput
                style={styles.gifSearchInput}
                placeholder="Search GIFs..."
                placeholderTextColor="#6b7280"
                value={gifSearch}
                onChangeText={setGifSearch}
                onSubmitEditing={() => searchGifs(gifSearch)}
              />
              <TouchableOpacity style={styles.gifSearchBtn} onPress={() => searchGifs(gifSearch)}>
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={gifs}
              numColumns={2}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.gifItem} onPress={() => sendGifMessage(item)}>
                  <Image source={{ uri: item.preview }} style={styles.gifPreview} />
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.gifGrid}
            />
          </View>
        </View>
      </Modal>

      {/* Reaction Modal */}
      <Modal visible={showReactionModal} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.reactionModalOverlay}
          activeOpacity={1}
          onPress={() => setShowReactionModal(false)}
        >
          <View style={styles.reactionModalContent}>
            {EMOJI_REACTIONS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionOption}
                onPress={() => handleReaction(emoji)}
              >
                <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#0f0d1a' 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingTop: 48, 
    paddingBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.1)' 
  },
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
  avatar: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#6366f1', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  onlineDot: { 
    position: 'absolute', 
    bottom: 0, 
    right: 0, 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: '#10b981', 
    borderWidth: 2, 
    borderColor: '#0f0d1a' 
  },
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
  // Voice message
  voiceMessage: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10,
    paddingVertical: 4,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  waveBar: {
    width: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 2,
  },
  voiceDuration: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  // Reactions
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, color: '#fff' },
  // Typing indicator
  typingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
    paddingHorizontal: 16 
  },
  typingDots: { flexDirection: 'row', marginRight: 8 },
  typingDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: '#a5b4fc', 
    marginHorizontal: 2 
  },
  typingText: { color: '#a5b4fc', fontSize: 12, fontStyle: 'italic' },
  // Input
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    padding: 16, 
    paddingBottom: Platform.OS === 'ios' ? 32 : 16, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.1)', 
    backgroundColor: 'rgba(15, 13, 26, 0.95)',
    gap: 10,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: { 
    flex: 1, 
    backgroundColor: 'rgba(30, 27, 75, 0.8)', 
    borderRadius: 24, 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    color: '#fff', 
    fontSize: 15, 
    maxHeight: 100,
  },
  sendButton: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: '#6366f1', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  sendButtonDisabled: { backgroundColor: '#4b5563' },
  // Recording
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  cancelRecordBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordingPulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  recordingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sendRecordBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Reaction modal
  reactionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionModalContent: {
    flexDirection: 'row',
    backgroundColor: '#1e1b4b',
    borderRadius: 30,
    padding: 10,
    gap: 4,
  },
  reactionOption: {
    padding: 10,
  },
  reactionOptionEmoji: {
    fontSize: 28,
  },
});
