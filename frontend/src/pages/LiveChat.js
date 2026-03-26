import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Smile, Check, CheckCheck, Wifi, WifiOff, Circle, Mic, MicOff, X, Play, Pause, Heart, ThumbsUp, Laugh, Angry, Frown } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

// Emoji Reactions Configuration
const EMOJI_REACTIONS = [
  { emoji: '❤️', icon: Heart, name: 'love', color: 'text-red-400' },
  { emoji: '👍', icon: ThumbsUp, name: 'like', color: 'text-blue-400' },
  { emoji: '😂', icon: Laugh, name: 'laugh', color: 'text-yellow-400' },
  { emoji: '😢', icon: Frown, name: 'sad', color: 'text-sky-400' },
  { emoji: '😡', icon: Angry, name: 'angry', color: 'text-orange-400' },
];

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://') + '/api';

// Online Status Indicator Component
const OnlineIndicator = ({ isOnline, size = 'sm' }) => {
  const sizeClasses = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };
  
  return (
    <div 
      className={`${sizeClasses[size]} rounded-full ${isOnline ? 'bg-green-400' : 'bg-slate-500'} border-2 border-slate-950`}
      title={isOnline ? 'Online' : 'Offline'}
    />
  );
};

// Read Receipt Component
const ReadReceipt = ({ message, familyMembers, currentUserId }) => {
  const readBy = message.read_by || [];
  const isOwn = message.user_id === currentUserId;
  
  if (!isOwn) return null;
  
  // Get readers excluding self
  const readers = readBy.filter(id => id !== currentUserId);
  const allRead = readers.length > 0;
  
  return (
    <div className="flex items-center gap-1" data-testid="read-receipt">
      {allRead ? (
        <>
          <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] text-blue-400">Read</span>
        </>
      ) : (
        <>
          <Check className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] text-slate-500">Sent</span>
        </>
      )}
    </div>
  );
};

// Emoji Reaction Picker Component
const EmojiReactionPicker = ({ onReact, onClose, position }) => {
  return (
    <div 
      className="absolute z-50 flex items-center gap-1 bg-slate-800 rounded-full px-2 py-1.5 border border-slate-700 shadow-xl"
      style={{ 
        bottom: position === 'top' ? '100%' : 'auto', 
        top: position === 'bottom' ? '100%' : 'auto',
        marginBottom: position === 'top' ? '8px' : 0,
        marginTop: position === 'bottom' ? '8px' : 0
      }}
      data-testid="emoji-reaction-picker"
    >
      {EMOJI_REACTIONS.map(reaction => (
        <button
          key={reaction.name}
          onClick={() => onReact(reaction.name)}
          className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-full transition-all hover:scale-125 text-lg"
          title={reaction.name}
        >
          {reaction.emoji}
        </button>
      ))}
      <button
        onClick={onClose}
        className="w-6 h-6 flex items-center justify-center hover:bg-slate-700 rounded-full transition-all ml-1"
      >
        <X className="w-3 h-3 text-slate-400" />
      </button>
    </div>
  );
};

// Message Reactions Display Component
const MessageReactions = ({ reactions, onReact, currentUserId }) => {
  if (!reactions || Object.keys(reactions).length === 0) return null;
  
  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {Object.entries(reactions).map(([reactionType, userIds]) => {
        if (!userIds || userIds.length === 0) return null;
        const hasReacted = userIds.includes(currentUserId);
        const reactionConfig = EMOJI_REACTIONS.find(r => r.name === reactionType);
        if (!reactionConfig) return null;
        
        return (
          <button
            key={reactionType}
            onClick={() => onReact(reactionType)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
              hasReacted 
                ? 'bg-primary/20 border border-primary/30' 
                : 'bg-slate-800/50 border border-slate-700 hover:bg-slate-700'
            }`}
            data-testid={`reaction-${reactionType}`}
          >
            <span>{reactionConfig.emoji}</span>
            <span className={hasReacted ? 'text-primary' : 'text-slate-400'}>{userIds.length}</span>
          </button>
        );
      })}
    </div>
  );
};

// Voice Message Recorder Component
const VoiceRecorder = ({ onRecordingComplete, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob, duration);
    }
  };

  const handleCancel = () => {
    stopRecording();
    setAudioBlob(null);
    setDuration(0);
    onCancel();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-2xl border border-slate-700" data-testid="voice-recorder">
      {isRecording ? (
        <>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 font-mono text-sm">{formatDuration(duration)}</span>
          </div>
          <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 animate-pulse" style={{ width: `${Math.min(100, (duration / 60) * 100)}%` }} />
          </div>
          <button onClick={stopRecording} className="p-2 bg-red-500 rounded-full hover:bg-red-600 transition-all">
            <MicOff className="w-4 h-4 text-white" />
          </button>
        </>
      ) : audioBlob ? (
        <>
          <span className="text-slate-400 text-sm">{formatDuration(duration)}</span>
          <VoicePlayer audioBlob={audioBlob} />
          <button onClick={handleSend} className="p-2 bg-primary rounded-full hover:bg-primary/80 transition-all">
            <Send className="w-4 h-4 text-white" />
          </button>
        </>
      ) : (
        <>
          <span className="text-slate-400 text-sm">Tap to record</span>
          <button onClick={startRecording} className="p-2 bg-primary rounded-full hover:bg-primary/80 transition-all">
            <Mic className="w-4 h-4 text-white" />
          </button>
        </>
      )}
      <button onClick={handleCancel} className="p-2 hover:bg-slate-700 rounded-full transition-all">
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
};

// Voice Player Component
const VoicePlayer = ({ audioBlob, audioUrl }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  const url = audioUrl || (audioBlob ? URL.createObjectURL(audioBlob) : null);

  useEffect(() => {
    return () => {
      if (audioBlob && url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [audioBlob, url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  if (!url) return null;

  return (
    <div className="flex items-center gap-2 flex-1">
      <audio 
        ref={audioRef} 
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      <button 
        onClick={togglePlay}
        className="p-1.5 bg-slate-700 rounded-full hover:bg-slate-600 transition-all"
      >
        {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
      </button>
      <div className="flex-1 h-1.5 bg-slate-600 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all" 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

// Online Users Bar Component
const OnlineUsersBar = ({ onlineUsers, familyMembers, currentUserId }) => {
  const onlineMembers = familyMembers.filter(m => onlineUsers.includes(m.user_id) && m.user_id !== currentUserId);
  const offlineMembers = familyMembers.filter(m => !onlineUsers.includes(m.user_id) && m.user_id !== currentUserId);
  
  return (
    <div className="flex items-center gap-3 py-2 px-4 bg-slate-900/50 border-b border-slate-800 overflow-x-auto" data-testid="online-users-bar">
      {onlineMembers.length > 0 && (
        <div className="flex items-center gap-2">
          <Circle className="w-2 h-2 fill-green-400 text-green-400" />
          <span className="text-xs text-green-400 font-medium whitespace-nowrap">Online</span>
          <div className="flex -space-x-2">
            {onlineMembers.map(member => (
              <div 
                key={member.user_id}
                className="relative"
                title={member.name}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white border-2 border-slate-950">
                  {member.picture ? (
                    <img src={member.picture} alt={member.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    member.name?.charAt(0)
                  )}
                </div>
                <OnlineIndicator isOnline={true} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {offlineMembers.length > 0 && (
        <div className="flex items-center gap-2 opacity-60">
          <Circle className="w-2 h-2 fill-slate-500 text-slate-500" />
          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Offline</span>
          <div className="flex -space-x-2">
            {offlineMembers.slice(0, 5).map(member => (
              <div 
                key={member.user_id}
                className="relative"
                title={member.name}
              >
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 border-2 border-slate-950">
                  {member.picture ? (
                    <img src={member.picture} alt={member.name} className="w-full h-full rounded-full object-cover opacity-50" />
                  ) : (
                    member.name?.charAt(0)
                  )}
                </div>
              </div>
            ))}
            {offlineMembers.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 border-2 border-slate-950">
                +{offlineMembers.length - 5}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default function LiveChat({ user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState(null);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const connectWebSocketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  // Common emoji set for quick picker
  const quickEmojis = ['😀', '😂', '❤️', '👍', '🎉', '🔥', '😢', '😡', '🤔', '👏', '💯', '✨'];

  // Get session token from cookies or localStorage
  const getSessionToken = () => {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'session_token') return value;
    }
    // Fallback to localStorage for child/dev login
    return localStorage.getItem('dev_session_token') || null;
  };

  // Fetch functions defined before useEffect
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/messages`, { credentials: 'include' });
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, []);

  const fetchFamilyMembers = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/family/members`, { credentials: 'include' });
      const data = await res.json();
      setFamilyMembers(data.members || []);
    } catch (error) {
      console.error('Failed to fetch family members:', error);
    }
  }, []);

  const fetchOnlineUsers = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/family/online`, { credentials: 'include' });
      const data = await res.json();
      setOnlineUsers((data.online || []).map(u => u.user_id));
    } catch (error) {
      console.error('Failed to fetch online users:', error);
    }
  }, []);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    const token = getSessionToken();
    if (!token) {
      console.log('No session token, falling back to polling');
      return;
    }

    try {
      wsRef.current = new WebSocket(`${WS_URL}/ws/chat/${token}`);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttemptsRef.current = 0;
        toast.success('Connected to chat');
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'message') {
          setMessages(prev => [...prev, data.data]);
        } else if (data.type === 'typing') {
          if (data.data.is_typing && data.data.user_id !== user?.user_id) {
            setTypingUsers(prev => {
              if (!prev.find(u => u.user_id === data.data.user_id)) {
                return [...prev, data.data];
              }
              return prev;
            });
          } else {
            setTypingUsers(prev => prev.filter(u => u.user_id !== data.data.user_id));
          }
        } else if (data.type === 'status') {
          if (data.data.status === 'online') {
            setOnlineUsers(prev => [...new Set([...prev, data.data.user_id])]);
          } else {
            setOnlineUsers(prev => prev.filter(id => id !== data.data.user_id));
          }
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected, code:', event.code);
        setConnected(false);
        // Don't reconnect if intentionally closed (code 4001 = auth failure)
        if (event.code === 4001) return;
        // Exponential backoff: 3s, 6s, 12s, max 30s
        const delay = Math.min(3000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (connectWebSocketRef.current) {
            connectWebSocketRef.current();
          }
        }, delay);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [user?.user_id]);

  // Store the connect function in ref for reconnection
  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  // Initial load and WebSocket connection
  useEffect(() => {
    fetchMessages();
    fetchOnlineUsers();
    fetchFamilyMembers();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket, fetchMessages, fetchOnlineUsers, fetchFamilyMembers]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fallback polling when not connected
  useEffect(() => {
    if (!connected) {
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [connected, fetchMessages]);

  const markMessageAsRead = async (messageId) => {
    try {
      await fetch(`${BACKEND_URL}/api/messages/${messageId}/read`, {
        method: 'PUT',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  // Handle adding/removing emoji reaction
  const handleReaction = async (messageId, reactionType) => {
    try {
      await fetch(`${BACKEND_URL}/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reaction: reactionType })
      });
      // Update local state optimistically
      setMessages(prev => prev.map(msg => {
        if (msg.message_id === messageId) {
          const reactions = { ...msg.reactions } || {};
          const userIds = reactions[reactionType] || [];
          const hasReacted = userIds.includes(user?.user_id);
          
          if (hasReacted) {
            reactions[reactionType] = userIds.filter(id => id !== user?.user_id);
            if (reactions[reactionType].length === 0) delete reactions[reactionType];
          } else {
            reactions[reactionType] = [...userIds, user?.user_id];
          }
          return { ...msg, reactions };
        }
        return msg;
      }));
      setSelectedMessageForReaction(null);
    } catch (error) {
      console.error('Failed to react to message:', error);
      toast.error('Failed to add reaction');
    }
  };

  // Handle voice message send
  const handleVoiceSend = async (audioBlob, duration) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice_message.webm');
      formData.append('duration', duration.toString());
      
      const response = await fetch(`${BACKEND_URL}/api/messages/voice`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to send voice message');
      
      setShowVoiceRecorder(false);
      fetchMessages();
      toast.success('Voice message sent');
    } catch (error) {
      console.error('Failed to send voice message:', error);
      toast.error('Failed to send voice message');
    }
  };

  // Insert emoji into message
  const insertEmoji = (emoji) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0) {
      const unreadMessages = messages.filter(
        m => m.user_id !== user?.user_id && !m.read_by?.includes(user?.user_id)
      );
      unreadMessages.forEach(m => markMessageAsRead(m.message_id));
    }
  }, [messages, user?.user_id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    if (connected && wsRef.current?.readyState === WebSocket.OPEN) {
      // Send via WebSocket
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content: newMessage
      }));
      setNewMessage('');
      
      // Stop typing indicator
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        is_typing: false
      }));
    } else {
      // Fallback to REST API
      try {
        await fetch(`${BACKEND_URL}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: newMessage })
        });
        setNewMessage('');
        fetchMessages();
      } catch (error) {
        console.error('Failed to send message:', error);
        toast.error('Failed to send message');
      }
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (connected && wsRef.current?.readyState === WebSocket.OPEN) {
      // Send typing indicator
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        is_typing: true
      }));

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'typing',
            is_typing: false
          }));
        }
      }, 2000);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`} data-testid="live-chat">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-card border-b border-white/10 backdrop-blur-2xl bg-slate-950/90 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl lg:text-2xl font-black text-white">Family Chat</h1>
              <p className="text-xs lg:text-sm text-slate-400">
                {onlineUsers.length} family member{onlineUsers.length !== 1 ? 's' : ''} online
              </p>
            </div>
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full ${connected ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
              {connected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400 font-bold">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-yellow-400 font-bold">Reconnecting...</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Online Users Bar */}
        {familyMembers.length > 0 && (
          <OnlineUsersBar 
            onlineUsers={onlineUsers} 
            familyMembers={familyMembers} 
            currentUserId={user?.user_id} 
          />
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4">
          {messages.map((message) => {
            const isOwn = message.user_id === user?.user_id;
            const isOnline = onlineUsers.includes(message.user_id);
            const sender = familyMembers.find(m => m.user_id === message.user_id);
            const showReactionPicker = selectedMessageForReaction === message.message_id;
            
            return (
              <div
                key={message.message_id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                data-testid="chat-message"
              >
                <div className={`flex items-end space-x-2 max-w-[85%] lg:max-w-[75%] ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {!isOwn && (
                    <div className="relative flex-shrink-0">
                      <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-black text-white overflow-hidden">
                        {sender?.picture ? (
                          <img src={sender.picture} alt={message.user_name} className="w-full h-full object-cover" />
                        ) : (
                          message.user_name?.charAt(0)
                        )}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${isOnline ? 'bg-green-400' : 'bg-slate-500'}`} />
                    </div>
                  )}
                  <div className="flex flex-col relative">
                    {!isOwn && (
                      <div className="flex items-center gap-2 ml-2 mb-1">
                        <span className="text-xs text-slate-400 font-medium">{message.user_name}</span>
                        {isOnline && <span className="text-[10px] text-green-400">online</span>}
                      </div>
                    )}
                    
                    {/* Message bubble with long-press for reactions */}
                    <div
                      className={`rounded-2xl p-3 lg:p-4 cursor-pointer ${
                        isOwn
                          ? 'bg-primary text-white rounded-br-md'
                          : 'glass-card text-white rounded-bl-md'
                      }`}
                      onClick={() => setSelectedMessageForReaction(showReactionPicker ? null : message.message_id)}
                    >
                      {message.type === 'voice' && message.audio_url ? (
                        <div className="flex items-center gap-2 min-w-[150px]">
                          <VoicePlayer audioUrl={message.audio_url} />
                          <span className="text-xs opacity-70">{message.duration}s</span>
                        </div>
                      ) : (
                        <p className="text-sm break-words leading-relaxed">{message.content}</p>
                      )}
                    </div>
                    
                    {/* Reaction Picker */}
                    {showReactionPicker && (
                      <EmojiReactionPicker
                        onReact={(reaction) => handleReaction(message.message_id, reaction)}
                        onClose={() => setSelectedMessageForReaction(null)}
                        position={isOwn ? 'top' : 'bottom'}
                      />
                    )}
                    
                    {/* Message Reactions */}
                    <MessageReactions 
                      reactions={message.reactions}
                      onReact={(reaction) => handleReaction(message.message_id, reaction)}
                      currentUserId={user?.user_id}
                    />
                    
                    <div className={`flex items-center gap-2 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-xs text-slate-500">
                        {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <ReadReceipt 
                        message={message} 
                        familyMembers={familyMembers} 
                        currentUserId={user?.user_id} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center space-x-2 text-slate-400 text-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>
                {typingUsers.map(u => u.user_name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 z-20 p-3 lg:p-4 pb-20 md:pb-4 glass-card border-t border-white/10 backdrop-blur-2xl bg-slate-950/90">
          {/* Voice Recorder */}
          {showVoiceRecorder ? (
            <VoiceRecorder
              onRecordingComplete={handleVoiceSend}
              onCancel={() => setShowVoiceRecorder(false)}
            />
          ) : (
            <>
              {/* Emoji Quick Picker */}
              {showEmojiPicker && (
                <div className="mb-3 p-3 bg-slate-800/80 rounded-2xl border border-slate-700" data-testid="emoji-picker">
                  <div className="flex flex-wrap gap-2 justify-center">
                    {quickEmojis.map((emoji, i) => (
                      <button
                        key={i}
                        onClick={() => insertEmoji(emoji)}
                        className="w-10 h-10 flex items-center justify-center hover:bg-slate-700 rounded-lg transition-all text-xl hover:scale-110"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2" data-testid="message-form">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-2.5 lg:p-3 rounded-full transition-all flex-shrink-0 ${
                    showEmojiPicker ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-slate-400'
                  }`}
                  data-testid="emoji-button"
                >
                  <Smile className="w-5 h-5" />
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowVoiceRecorder(true)}
                  className="p-2.5 lg:p-3 hover:bg-white/5 rounded-full transition-all flex-shrink-0"
                  data-testid="voice-button"
                  title="Record voice message"
                >
                  <Mic className="w-5 h-5 text-slate-400" />
                </button>
                
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-900/50 border border-slate-800 rounded-full px-4 py-3 text-white placeholder:text-slate-600 focus:border-primary focus:outline-none text-sm lg:text-base"
                  data-testid="message-input"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2.5 lg:p-3 bg-primary hover:bg-primary/80 disabled:bg-slate-700 disabled:cursor-not-allowed active:scale-95 rounded-full transition-all neon-glow flex-shrink-0"
                  data-testid="send-button"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
