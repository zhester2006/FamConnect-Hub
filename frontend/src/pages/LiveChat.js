import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Smile, Check, CheckCheck } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function LiveChat({ user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/messages`, { credentials: 'include' });
      const data = await res.json();
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

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
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-32" data-testid="live-chat">
      <div className="sticky top-0 z-10 glass-card border-b border-white/10 backdrop-blur-2xl bg-slate-950/90 p-4">
        <h1 className="text-2xl font-black text-white">Family Chat</h1>
        <p className="text-sm text-slate-400">Stay connected with your family</p>
      </div>

      <div className="p-4 space-y-4 pb-6">
        {messages.map((message) => {
          const isOwn = message.user_id === user?.user_id;
          return (
            <div
              key={message.message_id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              data-testid="chat-message"
            >
              <div className={`max-w-[80%] ${isOwn ? 'order-2' : 'order-1'}`}>
                {!isOwn && (
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-black text-white">
                      {message.user_name.charAt(0)}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{message.user_name}</span>
                  </div>
                )}
                <div
                  className={`rounded-2xl p-4 ${
                    isOwn
                      ? 'bg-primary text-white'
                      : 'glass-card text-white'
                  }`}
                >
                  <p className="text-sm break-words">{message.content}</p>
                  <div className="flex items-center justify-end space-x-1 mt-2">
                    <span className="text-xs opacity-70">
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isOwn && (
                      <div className="text-xs">
                        {message.read_by?.length > 1 ? (
                          <CheckCheck className="w-3 h-3" />
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
        <div ref={messagesEndRef} />
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-20 p-4 glass-card border-t border-white/10 backdrop-blur-2xl bg-slate-950/90">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2" data-testid="message-form">
          <button
            type="button"
            className="p-3 hover:bg-white/5 rounded-full transition-all"
            data-testid="emoji-button"
          >
            <Smile className="w-5 h-5 text-slate-400" />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-slate-900/50 border border-slate-800 rounded-full px-4 py-3 text-white placeholder:text-slate-600 focus:border-primary focus:outline-none"
            data-testid="message-input"
          />
          <button
            type="submit"
            className="p-3 bg-primary hover:bg-primary/80 rounded-full transition-all neon-glow"
            data-testid="send-button"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </form>
      </div>
      
      <BottomNav userRole={user?.role} />
    </div>
  );
}