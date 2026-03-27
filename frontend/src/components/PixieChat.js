import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Send, Mic, MicOff, Loader2, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { ChatBubble } from './pixie/ChatBubble';
import { PinModal } from './pixie/PinModal';
import { EmptyState } from './pixie/EmptyState';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function RecordingBar({ duration, onCancel, onSend }) {
  const formatted = Math.floor(duration / 60) + ':' + (duration % 60).toString().padStart(2, '0');
  return (
    <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3" data-testid="pixie-recording">
      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
      <span className="text-red-400 font-mono text-sm flex-1">{formatted}</span>
      <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full" data-testid="pixie-cancel-recording">
        <X className="w-4 h-4 text-slate-400" />
      </button>
      <button onClick={onSend} className="p-2 bg-primary rounded-full hover:bg-primary/80" data-testid="pixie-send-recording">
        <Send className="w-4 h-4 text-white" />
      </button>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" />
          <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function playAudio(base64Audio) {
  if (!base64Audio) return;
  try {
    const audio = new Audio('data:audio/mp3;base64,' + base64Audio);
    audio.play().catch(() => {});
  } catch (e) {
    // Silently fail if audio can't play
  }
}

export default function PixieChat({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [listening, setListening] = useState(false);
  const [pinModal, setPinModal] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastVoiceMode, setLastVoiceMode] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const isHomehub = user?.role === 'homehub';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load preferences and auto-enable listening on HomeHub
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const token = localStorage.getItem('dev_session_token');
        const headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;
        const res = await fetch(BACKEND_URL + '/api/pixie/preferences', { headers, credentials: 'include' });
        if (res.ok) {
          const prefs = await res.json();
          setVoiceEnabled(prefs.voice_responses !== false);
          if (prefs.always_listening || isHomehub) {
            setListening(true);
          }
        }
      } catch (e) {
        // Use defaults
      }
    };
    loadPrefs();
  }, [isHomehub]);

  // Wake word: "Pixie" / "Hey Pixie" - auto start on HomeHub or if always_listening
  useEffect(() => {
    const SpeechRecog = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecog) return;

    const recognition = new SpeechRecog();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let i = event.resultIndex;
      while (i < event.results.length) {
        const t = event.results[i][0].transcript.toLowerCase().trim();
        if (t.includes('pixie') || t.includes('hey pixie') || t.includes('pixy')) {
          if (!isOpen) setIsOpen(true);
          // Auto-start recording after wake word detected
          setTimeout(() => {
            if (!isRecording && !loading) startRecording();
          }, 500);
          break;
        }
        i++;
      }
    };

    recognition.onerror = () => {};
    recognition.onend = () => {
      if (listening && !isRecording) {
        try { recognition.start(); } catch (e) { /* ignore */ }
      }
    };

    recognitionRef.current = recognition;

    // Auto-start if listening is enabled
    if (listening) {
      navigator.mediaDevices?.getUserMedia({ audio: true }).then(() => {
        try { recognition.start(); } catch (e) { /* ignore */ }
      }).catch(() => {});
    }

    return () => { try { recognition.stop(); } catch (e) { /* ignore */ } };
  }, [listening, isOpen, isRecording, loading]);

  const toggleWakeWord = useCallback(() => {
    const newVal = !listening;
    setListening(newVal);
    if (!newVal) {
      try { recognitionRef.current?.stop(); } catch (e) { /* ignore */ }
    } else {
      navigator.mediaDevices?.getUserMedia({ audio: true }).then(() => {
        try { recognitionRef.current?.start(); } catch (e) { /* ignore */ }
      }).catch(() => {
        toast.error('Microphone access needed for wake word');
        setListening(false);
      });
    }
    // Save preference
    const token = localStorage.getItem('dev_session_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    fetch(BACKEND_URL + '/api/pixie/preferences', {
      method: 'POST', headers, credentials: 'include',
      body: JSON.stringify({ always_listening: newVal })
    }).catch(() => {});
  }, [listening]);

  const toggleVoice = useCallback(() => {
    const newVal = !voiceEnabled;
    setVoiceEnabled(newVal);
    const token = localStorage.getItem('dev_session_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    fetch(BACKEND_URL + '/api/pixie/preferences', {
      method: 'POST', headers, credentials: 'include',
      body: JSON.stringify({ voice_responses: newVal })
    }).catch(() => {});
  }, [voiceEnabled]);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('dev_session_token');
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }, []);

  const getContext = useCallback(() => {
    const recent = messages.slice(-6);
    const ctx = [];
    for (let i = 0; i < recent.length; i++) {
      ctx.push({ role: recent[i].isUser ? 'user' : 'assistant', content: recent[i].content });
    }
    return ctx;
  }, [messages]);

  const processResponse = useCallback((data, isVoice) => {
    if (data.needs_pin && data.needs_user_selection) {
      setPinModal({ members: data.family_members || [], actions_planned: data.actions_planned || [] });
      setMessages(prev => [...prev, { content: data.response, isUser: false }]);
      if (isVoice && voiceEnabled && data.audio) playAudio(data.audio);
    } else {
      const taken = data.actions_taken || [];
      setMessages(prev => [...prev, { content: data.response, isUser: false, actions: taken }]);
      let successes = 0;
      for (let i = 0; i < taken.length; i++) { if (taken[i].success) successes++; }
      if (successes > 0) toast.success('Pixie completed ' + successes + ' action' + (successes > 1 ? 's' : ''));
      // Play TTS audio if voice mode
      if (isVoice && voiceEnabled && data.audio) {
        playAudio(data.audio);
      }
    }
  }, [voiceEnabled]);

  const sendTextMessage = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { content: text, isUser: true }]);
    setLoading(true);
    setLastVoiceMode(false);

    try {
      const res = await fetch(BACKEND_URL + '/api/pixie/command', {
        method: 'POST', headers: getHeaders(), credentials: 'include',
        body: JSON.stringify({
          message: text, context: getContext(),
          mode: isHomehub ? 'homehub' : 'normal',
          voice_mode: voiceEnabled
        })
      });
      const data = await res.json();
      processResponse(data, voiceEnabled);
    } catch (e) {
      toast.error('Pixie is taking a nap. Try again!');
    }
    setLoading(false);
  };

  const handlePinSubmit = async (userId, pin) => {
    if (!pinModal) return;
    setLoading(true);
    setPinModal(null);
    const userMsgs = messages.filter(m => m.isUser);
    const lastUserMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1] : null;

    try {
      const res = await fetch(BACKEND_URL + '/api/pixie/command', {
        method: 'POST', headers: getHeaders(), credentials: 'include',
        body: JSON.stringify({
          message: lastUserMsg?.content || '', context: getContext(),
          mode: 'homehub', acting_user_id: userId, acting_user_pin: pin,
          voice_mode: lastVoiceMode && voiceEnabled
        })
      });
      const data = await res.json();
      processResponse(data, lastVoiceMode);
    } catch (e) {
      toast.error('Verification failed');
    }
    setLoading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); };
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch (e) {
      toast.error('Microphone access denied. Please allow mic permissions.');
    }
  };

  const stopRecordingAndSend = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isRecording) return;
    return new Promise((resolve) => {
      recorder.onstop = async () => {
        if (recorder.stream) recorder.stream.getTracks().forEach(t => t.stop());
        clearInterval(timerRef.current);
        setIsRecording(false);
        setLastVoiceMode(true);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) { toast.error('Recording too short'); resolve(); return; }

        setMessages(prev => [...prev, { content: 'Listening...', isUser: true, isVoice: true }]);
        setLoading(true);

        try {
          const token = localStorage.getItem('dev_session_token');
          const formData = new FormData();
          formData.append('audio', blob, 'voice.webm');
          formData.append('context', JSON.stringify(getContext()));
          formData.append('mode', isHomehub ? 'homehub' : 'normal');

          const headers = {};
          if (token) headers['Authorization'] = 'Bearer ' + token;

          const res = await fetch(BACKEND_URL + '/api/pixie/voice-command', {
            method: 'POST', headers, credentials: 'include', body: formData
          });
          const data = await res.json();

          if (data.success !== false) {
            setMessages(prev => {
              const updated = prev.slice();
              updated[updated.length - 1] = { content: data.transcription || 'Voice message', isUser: true, isVoice: true };
              return updated;
            });
            processResponse(data, true);
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
      recorder.stop();
    });
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && isRecording) {
      if (recorder.stream) recorder.stream.getTracks().forEach(t => t.stop());
      recorder.stop();
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const renderMessages = () => {
    const items = [];
    for (let i = 0; i < messages.length; i++) {
      items.push(<ChatBubble key={i} message={messages[i]} isUser={messages[i].isUser} />);
    }
    return items;
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  if (!isOpen) {
    return (
      <div className="fixed bottom-24 md:bottom-6 right-4 z-40 flex flex-col items-end gap-2">
        {listening && (
          <div className="bg-violet-600/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-full animate-pulse shadow-lg" data-testid="pixie-wake-indicator">
            {isHomehub ? 'Home Hub: "Hey Pixie" active' : 'Listening for "Hey Pixie"...'}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={toggleVoice}
            className={'w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 ' + (voiceEnabled ? 'bg-emerald-600 shadow-emerald-500/30' : 'bg-slate-800 border border-slate-700')}
            data-testid="pixie-voice-toggle"
            title={voiceEnabled ? 'Voice responses ON' : 'Voice responses OFF'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>
          <button
            onClick={toggleWakeWord}
            className={'w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 ' + (listening ? 'bg-violet-600 shadow-violet-500/30' : 'bg-slate-800 border border-slate-700')}
            data-testid="pixie-wake-toggle"
            title={listening ? 'Wake word active' : 'Enable "Hey Pixie"'}
          >
            {listening ? <Mic className="w-4 h-4 text-white" /> : <MicOff className="w-4 h-4 text-slate-400" />}
          </button>
          <button
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
            data-testid="pixie-fab"
          >
            <Sparkles className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-24 md:bottom-6 right-4 z-50 w-[340px] sm:w-[380px] max-h-[520px] flex flex-col bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden" data-testid="pixie-chat-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-gradient-to-r from-violet-900/40 to-indigo-900/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Pixie</p>
            <p className="text-[10px] text-slate-400">{isHomehub ? 'HomeHub Mode' : 'Family AI Assistant'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleVoice}
            className={'p-1.5 rounded-lg transition-all ' + (voiceEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-500')}
            data-testid="pixie-voice-header-toggle"
            title={voiceEnabled ? 'Voice ON' : 'Voice OFF'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleWakeWord}
            className={'p-1.5 rounded-lg transition-all ' + (listening ? 'bg-violet-500/20 text-violet-400' : 'hover:bg-slate-800 text-slate-500')}
            data-testid="pixie-wake-header-toggle"
          >
            {listening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-slate-800 rounded-lg" data-testid="pixie-close-btn">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 min-h-[280px] max-h-[360px]">
        {messages.length === 0 && <EmptyState userName={firstName} onSelect={setInput} />}
        {renderMessages()}
        {pinModal && <PinModal members={pinModal.members} onSubmit={handlePinSubmit} onCancel={() => setPinModal(null)} />}
        {loading && <LoadingDots />}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-800 p-3">
        {isRecording ? (
          <RecordingBar duration={recordingDuration} onCancel={cancelRecording} onSend={stopRecordingAndSend} />
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); sendTextMessage(); }} className="flex items-center gap-2">
            <button type="button" onClick={startRecording} disabled={loading}
              className="p-2.5 hover:bg-violet-500/20 rounded-full transition-all flex-shrink-0 disabled:opacity-50"
              data-testid="pixie-mic-btn">
              <Mic className="w-5 h-5 text-violet-400" />
            </button>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Pixie anything..." disabled={loading}
              className="flex-1 bg-slate-800/50 border border-slate-700 rounded-full px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none disabled:opacity-50"
              data-testid="pixie-input" />
            <button type="submit" disabled={!input.trim() || loading}
              className="p-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 rounded-full transition-all flex-shrink-0 disabled:cursor-not-allowed"
              data-testid="pixie-send-btn">
              {loading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
