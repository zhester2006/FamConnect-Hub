// PixieAssistant.js - AI Assistant floating button and chat interface
// Pixie is the family's AI helper who provides suggestions, tips, and assistance

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  ScrollView, ActivityIndicator, Animated, KeyboardAvoidingView,
  Platform, Dimensions, Image, PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import apiService from '../services/api.service';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Safe bounds for draggable button
const BUTTON_SIZE = 56;
const SAFE_MARGIN = 16;
const MIN_X = SAFE_MARGIN;
const MAX_X = SCREEN_WIDTH - BUTTON_SIZE - SAFE_MARGIN;
const MIN_Y = 100; // Below status bar
const MAX_Y = SCREEN_HEIGHT - 180; // Above tab bar

// Pixie's personality and capabilities
const PIXIE_INTRO = "Hi! I'm Pixie, your family's AI helper! 🧚‍♀️ I can help with meal ideas, activities, homework tips, and more!";

const QUICK_PROMPTS = [
  { icon: '🍽️', label: 'Dinner Ideas', prompt: 'Suggest a quick family dinner' },
  { icon: '🎮', label: 'Family Activity', prompt: 'Suggest a fun family activity for tonight' },
  { icon: '📚', label: 'Homework Help', prompt: 'Help me understand my homework better' },
  { icon: '🏠', label: 'Chore Tips', prompt: 'Tips for cleaning my room quickly' },
  { icon: '☀️', label: 'Weather Plans', prompt: 'What should we do based on today\'s weather?' },
  { icon: '💡', label: 'Random Tip', prompt: 'Give me a helpful family tip' },
];

export default function PixieAssistant() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'pixie', content: PIXIE_INTRO, timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  
  // Position for draggable button - start at bottom right
  const pan = useRef(new Animated.ValueXY({ x: MAX_X, y: MAX_Y - 50 })).current;

  // Pan responder for drag functionality
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture if moving more than 5 pixels (to allow taps)
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        setIsDragging(false);
        
        // Clamp to screen bounds
        let newX = pan.x._value;
        let newY = pan.y._value;
        
        newX = Math.max(MIN_X, Math.min(MAX_X, newX));
        newY = Math.max(MIN_Y, Math.min(MAX_Y, newY));
        
        // Snap to nearest edge (left or right)
        const snapToLeft = newX < SCREEN_WIDTH / 2;
        const finalX = snapToLeft ? MIN_X : MAX_X;
        
        Animated.spring(pan, {
          toValue: { x: finalX, y: newY },
          useNativeDriver: false,
          friction: 7,
        }).start();
        
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
    })
  ).current;

  // Floating animation for the button (only when not dragging)
  useEffect(() => {
    if (!isDragging) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: -5, duration: 1500, useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      floatAnim.stopAnimation();
      floatAnim.setValue(0);
    }
  }, [isDragging]);

  // Pulse animation when there's a new response
  const triggerPulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.2, duration: 200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const handleOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(true);
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpen(false);
  };

  const handleBackToMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Reset to initial state with welcome message
    setMessages([{
      role: 'pixie',
      content: `Hi${user?.name ? ` ${user.name}` : ''}! 🧚‍♀️ I'm Pixie, your family assistant! I can help you with:\n\n• 🍽️ Meal suggestions\n• 📅 Activity ideas\n• 🧹 Chore tips\n• 📚 Homework help\n• 🎮 Fun family activities\n\nWhat can I help you with today?`,
      timestamp: new Date(),
    }]);
    setShowQuickPrompts(true);
  };

  const handleSend = async (customPrompt) => {
    const messageText = customPrompt || input.trim();
    if (!messageText || loading) return;

    // Add user message
    const userMessage = { role: 'user', content: messageText, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setShowQuickPrompts(false);
    setLoading(true);

    try {
      // Send to AI endpoint
      const response = await apiService.post('/ai/pixie', {
        message: messageText,
        user_name: user?.name || 'Friend',
        user_role: user?.role || 'child',
        context: messages.slice(-4).map(m => ({ role: m.role, content: m.content })),
      });

      const pixieResponse = {
        role: 'pixie',
        content: response.response || response.message || "I'm not sure how to help with that. Try asking me about meals, activities, or chores!",
        timestamp: new Date(),
        structured: response.structured || null,
      };

      setMessages(prev => [...prev, pixieResponse]);
      triggerPulse();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Pixie response error:', error);
      
      // Fallback response
      const fallbackResponse = {
        role: 'pixie',
        content: "Oops! I'm having trouble thinking right now. Try asking me something simple like 'What's for dinner?' 🤔",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, fallbackResponse]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleQuickPrompt = (prompt) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleSend(prompt.prompt);
  };

  const renderMessage = (message, index) => {
    const isPixie = message.role === 'pixie';
    
    return (
      <Animated.View
        key={index}
        style={[
          styles.messageContainer,
          isPixie ? styles.pixieMessage : styles.userMessage,
          index === messages.length - 1 && { transform: [{ scale: pulseAnim }] }
        ]}
      >
        {isPixie && (
          <View style={styles.pixieAvatar}>
            <Text style={styles.pixieEmoji}>🧚‍♀️</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isPixie ? styles.pixieBubble : styles.userBubble]}>
          {isPixie && <Text style={styles.pixieName}>Pixie</Text>}
          <Text style={[styles.messageText, !isPixie && styles.userMessageText]}>
            {message.content}
          </Text>
          
          {/* Structured content (like meal suggestions with ingredients) */}
          {message.structured && message.structured.ingredients && (
            <View style={styles.structuredContent}>
              <Text style={styles.structuredTitle}>Ingredients:</Text>
              {message.structured.ingredients.slice(0, 5).map((ing, i) => (
                <View key={i} style={styles.ingredientRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                  <Text style={styles.ingredientText}>{ing.amount} {ing.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <>
      {/* Floating Draggable Button */}
      <Animated.View 
        style={[
          styles.floatingButton, 
          { 
            transform: [
              { translateX: pan.x },
              { translateY: Animated.add(pan.y, floatAnim) }
            ],
            opacity: isDragging ? 0.8 : 1,
          }
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity 
          onPress={() => !isDragging && handleOpen()} 
          activeOpacity={0.9}
          delayPressIn={100}
        >
          <LinearGradient
            colors={['#ec4899', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.buttonGradient, isDragging && styles.buttonDragging]}
          >
            <Text style={styles.buttonEmoji}>🧚‍♀️</Text>
          </LinearGradient>
        </TouchableOpacity>
        <View style={styles.buttonLabel}>
          <Text style={styles.buttonLabelText}>{isDragging ? '📍 Drop' : 'Pixie'}</Text>
        </View>
      </Animated.View>

      {/* Chat Modal */}
      <Modal visible={isOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContent}
          >
            {/* Header with Back Button */}
            <LinearGradient
              colors={['#8b5cf6', '#ec4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.header}
            >
              <TouchableOpacity onPress={handleClose} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerInfo}>
                <View style={styles.pixieHeaderAvatar}>
                  <Text style={styles.pixieHeaderEmoji}>🧚‍♀️</Text>
                </View>
                <View>
                  <Text style={styles.headerTitle}>Pixie</Text>
                  <Text style={styles.headerSubtitle}>Your Family AI Assistant</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((msg, idx) => renderMessage(msg, idx))}
              
              {loading && (
                <View style={[styles.messageContainer, styles.pixieMessage]}>
                  <View style={styles.pixieAvatar}>
                    <Text style={styles.pixieEmoji}>🧚‍♀️</Text>
                  </View>
                  <View style={[styles.messageBubble, styles.pixieBubble, styles.loadingBubble]}>
                    <View style={styles.typingIndicator}>
                      {[0, 1, 2].map(i => (
                        <Animated.View key={i} style={styles.typingDot} />
                      ))}
                    </View>
                    <Text style={styles.typingText}>Pixie is thinking...</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Quick Prompts */}
            {showQuickPrompts && (
              <View style={styles.quickPromptsContainer}>
                <Text style={styles.quickPromptsTitle}>Quick Questions</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.quickPrompt}
                      onPress={() => handleQuickPrompt(prompt)}
                    >
                      <Text style={styles.quickPromptIcon}>{prompt.icon}</Text>
                      <Text style={styles.quickPromptLabel}>{prompt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Input Area */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ask Pixie anything..."
                placeholderTextColor="#9ca3af"
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={500}
                onFocus={() => setShowQuickPrompts(false)}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
                onPress={() => handleSend()}
                disabled={!input.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Floating Button - Now draggable with absolute positioning
  floatingButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  buttonGradient: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDragging: {
    shadowOpacity: 0.6,
    shadowRadius: 12,
    transform: [{ scale: 1.1 }],
  },
  buttonEmoji: {
    fontSize: 28,
  },
  buttonLabel: {
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  buttonLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f0d1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.85,
    overflow: 'hidden',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pixieHeaderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pixieHeaderEmoji: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  pixieMessage: {
    justifyContent: 'flex-start',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  pixieAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  pixieEmoji: {
    fontSize: 18,
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
  },
  pixieBubble: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  pixieName: {
    fontSize: 11,
    color: '#c4b5fd',
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#e2e8f0',
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  loadingBubble: {
    paddingVertical: 16,
  },
  typingIndicator: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c4b5fd',
  },
  typingText: {
    fontSize: 12,
    color: '#a5b4fc',
    fontStyle: 'italic',
  },
  
  // Structured content
  structuredContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  structuredTitle: {
    fontSize: 13,
    color: '#a5b4fc',
    fontWeight: '600',
    marginBottom: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ingredientText: {
    fontSize: 13,
    color: '#d1d5db',
  },
  
  // Quick Prompts
  quickPromptsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  quickPromptsTitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 10,
  },
  quickPrompt: {
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  quickPromptIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickPromptLabel: {
    fontSize: 11,
    color: '#c4b5fd',
    fontWeight: '500',
  },
  
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(15, 13, 26, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#4b5563',
  },
});
