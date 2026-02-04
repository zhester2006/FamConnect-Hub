import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Smile, Check, CheckCheck, Wifi, WifiOff, Circle } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

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
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Get session token from cookies
  const getSessionToken = () => {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'session_token') return value;
    }
    return null;
  };

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

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [user?.user_id]);

  // Initial load and WebSocket connection
  useEffect(() => {
    fetchMessages();
    fetchOnlineUsers();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

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
  }, [connected]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/messages`, { credentials: 'include' });
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/family/online`, { credentials: 'include' });
      const data = await res.json();
      setOnlineUsers((data.online || []).map(u => u.user_id));
    } catch (error) {
      console.error('Failed to fetch online users:', error);
    }
  };

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
      
      <main className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`} data-testid="live-chat">
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4">
          {messages.map((message) => {
            const isOwn = message.user_id === user?.user_id;
            const isOnline = onlineUsers.includes(message.user_id);
            return (
              <div
                key={message.message_id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                data-testid="chat-message"
              >
                <div className={`flex items-end space-x-2 max-w-[85%] lg:max-w-[75%] ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {!isOwn && (
                    <div className="relative">
                      <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                        {message.user_name?.charAt(0)}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${isOnline ? 'bg-green-400' : 'bg-slate-500'}`} />
                    </div>
                  )}
                  <div>
                    {!isOwn && (
                      <span className="text-xs text-slate-400 font-medium ml-2 mb-1 block">{message.user_name}</span>
                    )}
                    <div
                      className={`rounded-2xl p-3 lg:p-4 ${
                        isOwn
                          ? 'bg-primary text-white rounded-br-md'
                          : 'glass-card text-white rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm break-words leading-relaxed">{message.content}</p>
                    </div>
                    <div className={`flex items-center space-x-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-xs text-slate-500">
                        {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOwn && (
                        <div className="text-xs text-slate-500">
                          {message.read_by?.length > 1 ? (
                            <CheckCheck className="w-3 h-3 text-primary" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </div>
                      )}
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
        <div className="sticky bottom-0 z-20 p-3 lg:p-4 glass-card border-t border-white/10 backdrop-blur-2xl bg-slate-950/90">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2" data-testid="message-form">
            <button
              type="button"
              className="p-2.5 lg:p-3 hover:bg-white/5 rounded-full transition-all flex-shrink-0"
              data-testid="emoji-button"
            >
              <Smile className="w-5 h-5 text-slate-400" />
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
        </div>
      </main>
    </div>
  );
}
