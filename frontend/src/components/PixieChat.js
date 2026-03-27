import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Send, Mic, MicOff, Loader2, Sparkles, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function VoicePulse({ isRecording }) {
  if (!isRecording) return null;
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="w-1 bg-red-400 rounded-full animate-pulse"
          style={{
            height: `${12 + Math.random() * 16}px`,
            animationDelay: `${i * 80}ms`,
            animationDuration: '0.6s'
          }}
        />
      ))}
    </div>
  );
}

function ChatBubble({ message, isUser }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-slate-800/80 text-slate-200 border border-slate-700/50 rounded-bl-md'
        }`}
        data-testid={isUser ? 'pixie-user-msg' : 'pixie-bot-msg'}
      >
        {!isUser && message.transcription && (
          <p className="text-[10px] text-slate-500 mb-1 italic">
            You said: "{message.transcription}"
          </p>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

export default function PixieChat({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('dev_session_token');
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }, []);

  const getContext = useCallback(() => {
    return messages.slice(-6).map(m => ({
      role: m.isUser ? 'user' : 'assistant',
      content: m.content
    }));
  }, [messages]);

  const sendTextMessage = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { content: text, isUser: true }]);
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/pixie`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ message: text, context: getContext() })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { content: data.response, isUser: false }]);
    } catch (e) {
      toast.error('Pixie is taking a nap. Try again!');
    }
    setLoading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch (e) {
      toast.error('Microphone access denied');
    }
  };

  const stopRecordingAndSend = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    return new Promise((resolve) => {
      mediaRecorderRef.current.onstop = async () => {
        mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
        clearInterval(timerRef.current);
        setIsRecording(false);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) {
          toast.error('Recording too short');
          resolve();
          return;
        }

        setMessages(prev => [...prev, { content: 'Listening...', isUser: true, isVoice: true }]);
        setLoading(true);

        try {
          const token = localStorage.getItem('dev_session_token');
          const formData = new FormData();
          formData.append('audio', blob, 'voice.webm');
          formData.append('context', JSON.stringify(getContext()));

          const headers = {};
          if (token) headers['Authorization'] = 'Bearer ' + token;

          const res = await fetch(`${BACKEND_URL}/api/ai/pixie/voice`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: formData
          });

          const data = await res.json();
          if (data.success) {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                content: data.transcription || 'Voice message',
                isUser: true,
                isVoice: true
              };
              return [...updated, {
                content: data.response,
                isUser: false,
                transcription: data.transcription
              }];
            });
          } else {
            toast.error('Voice command failed');
            setMessages(prev => prev.slice(0, -1));
          }
        } catch (e) {
          toast.error('Voice command failed');
          setMessages(prev => prev.slice(0, -1));
        }
        setLoading(false);
        resolve();
      };

      mediaRecorderRef.current.stop();
    });
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const formatDuration = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 md:bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        data-testid="pixie-fab"
        title="Talk to Pixie"
      >
        <Sparkles className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 md:bottom-6 right-4 z-50 w-[340px] sm:w-[380px] max-h-[520px] flex flex-col bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden" data-testid="pixie-chat-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-gradient-to-r from-violet-900/40 to-indigo-900/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Pixie</p>
            <p className="text-[10px] text-slate-400">Family AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded-full mr-1">
            <Mic className="w-3 h-3 text-green-400" />
            <span className="text-[10px] text-green-400 font-bold">Voice</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-slate-800 rounded-lg transition-all" data-testid="pixie-close-btn">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 min-h-[280px] max-h-[360px]">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-8 h-8 text-violet-400" />
            </div>
            <p className="text-sm font-bold text-white mb-1">Hey {user?.name?.split(' ')[0] || 'there'}!</p>
            <p className="text-xs text-slate-400 max-w-[240px] mx-auto">
              Ask me anything or tap the mic to use voice commands
            </p>
            <div className="mt-4 space-y-1.5">
              {['What should we have for dinner?', 'Suggest a family activity', 'Help with homework tips'].map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(q); }}
                  className="block w-full text-left text-xs text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 rounded-lg px-3 py-2 transition-all"
                  data-testid={`pixie-suggestion-${i}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} isUser={msg.isUser} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 p-3">
        {isRecording ? (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3" data-testid="pixie-recording">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <VoicePulse isRecording={isRecording} />
            <span className="text-red-400 font-mono text-sm flex-1">{formatDuration(recordingDuration)}</span>
            <button onClick={cancelRecording} className="p-2 hover:bg-slate-800 rounded-full" data-testid="pixie-cancel-recording">
              <X className="w-4 h-4 text-slate-400" />
            </button>
            <button onClick={stopRecordingAndSend} className="p-2 bg-primary rounded-full hover:bg-primary/80" data-testid="pixie-send-recording">
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); sendTextMessage(); }} className="flex items-center gap-2">
            <button
              type="button"
              onClick={startRecording}
              disabled={loading}
              className="p-2.5 hover:bg-violet-500/20 rounded-full transition-all flex-shrink-0 disabled:opacity-50"
              data-testid="pixie-mic-btn"
              title="Voice command"
            >
              <Mic className="w-5 h-5 text-violet-400" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Pixie..."
              disabled={loading}
              className="flex-1 bg-slate-800/50 border border-slate-700 rounded-full px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none disabled:opacity-50"
              data-testid="pixie-input"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 rounded-full transition-all flex-shrink-0 disabled:cursor-not-allowed"
              data-testid="pixie-send-btn"
            >
              {loading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
