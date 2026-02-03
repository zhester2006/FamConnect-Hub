import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Smile, Check, CheckCheck } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Sidebar from '@/components/Sidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function LiveChat({ user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 flex flex-col lg:ml-72" data-testid="live-chat">
        <div className="sticky top-0 z-10 glass-card border-b border-white/10 backdrop-blur-2xl bg-slate-950/90 p-4">
          <h1 className="text-xl lg:text-2xl font-black text-white">Family Chat</h1>
          <p className="text-xs lg:text-sm text-slate-400">Stay connected with your family</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4">
          {messages.map((message) => {
            const isOwn = message.user_id === user?.user_id;
            return (
              <div
                key={message.message_id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                data-testid="chat-message"
              >
                <div className={`flex items-end space-x-2 max-w-[85%] lg:max-w-[75%] ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {!isOwn && (
                    <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                      {message.user_name.charAt(0)}
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
          <div ref={messagesEndRef} />
        </div>

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
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-900/50 border border-slate-800 rounded-full px-4 py-3 text-white placeholder:text-slate-600 focus:border-primary focus:outline-none text-sm lg:text-base"
              data-testid="message-input"
            />
            <button
              type="submit"
              className="p-2.5 lg:p-3 bg-primary hover:bg-primary/80 active:scale-95 rounded-full transition-all neon-glow flex-shrink-0"
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