import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Calendar, MessageCircle, Award, TrendingUp } from 'lucide-react';

const REDIRECT_URL_BASE = typeof window !== 'undefined' ? window.location.origin : '';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PixieAssistant = () => {
  const [currentTip, setCurrentTip] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [ripple, setRipple] = useState(false);

  const tips = [
    { text: "Hi! I'm Pixie, your family AI companion!", sub: "Tap me to learn more" },
    { text: "I help schedule chores & plan meals", sub: "Smart suggestions based on your family" },
    { text: "I keep everyone connected with live chat", sub: "Plus polls, photos & family wall" },
    { text: "Kids earn points for completing tasks!", sub: "Redeem rewards & climb the leaderboard" },
    { text: "I learn your family's patterns over time", sub: "Proactive tips & activity ideas daily" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isExpanded) {
        setCurrentTip(prev => (prev + 1) % tips.length);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isExpanded, tips.length]);

  const handleTap = () => {
    setRipple(true);
    setTimeout(() => setRipple(false), 600);
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="relative mb-6" data-testid="pixie-assistant">
      {/* Pixie Orb */}
      <div className="flex flex-col items-center">
        <button
          onClick={handleTap}
          className="relative group focus:outline-none"
          data-testid="pixie-orb"
        >
          {/* Outer glow rings */}
          <div className="absolute inset-0 -m-4 rounded-full bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 blur-xl animate-spin" style={{ animationDuration: '8s' }} />
          <div className="absolute inset-0 -m-2 rounded-full bg-gradient-to-r from-blue-400/30 to-violet-400/30 blur-lg animate-pulse" />
          
          {/* Ripple effect */}
          {ripple && (
            <div className="absolute inset-0 -m-6 rounded-full border-2 border-cyan-400/50 animate-ping" />
          )}

          {/* Main orb */}
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 p-[2px] shadow-[0_0_30px_rgba(56,189,248,0.4)] group-hover:shadow-[0_0_40px_rgba(56,189,248,0.6)] transition-shadow duration-500">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-900/90 to-slate-800/90 flex items-center justify-center overflow-hidden backdrop-blur-sm">
              {/* Inner glow */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-t from-cyan-500/10 to-transparent" />
              {/* Eye / Core */}
              <div className="relative">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 shadow-[0_0_15px_rgba(56,189,248,0.8)] animate-pulse" style={{ animationDuration: '2s' }} />
                <div className="absolute top-1 left-1.5 w-2 h-2 rounded-full bg-white/80" />
              </div>
            </div>
          </div>

          {/* Floating particles */}
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '2s' }} />
          <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0.8s', animationDuration: '2.5s' }} />
          <div className="absolute top-1/2 -right-2 w-1 h-1 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '1.2s', animationDuration: '3s' }} />
        </button>

        {/* Name label */}
        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-xs font-bold tracking-widest uppercase bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            Pixie
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>
      </div>

      {/* Speech bubble */}
      <div className={`mt-3 transition-all duration-500 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-20 opacity-100'}`}>
        <div className="relative bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl px-5 py-3.5 shadow-lg">
          {/* Arrow */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-800/80 border-l border-t border-slate-700/50 rotate-45" />
          
          <div className="relative z-10">
            <p className="text-white text-sm font-medium text-center leading-relaxed" data-testid="pixie-tip-text">
              {tips[currentTip].text}
            </p>
            <p className="text-slate-400 text-xs text-center mt-1">
              {tips[currentTip].sub}
            </p>

            {isExpanded && (
              <div className="mt-4 space-y-2 border-t border-slate-700/50 pt-3" data-testid="pixie-expanded">
                <p className="text-xs text-cyan-400 font-semibold text-center mb-2">What I can do for your family:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { icon: '🧹', text: 'AI Chore Scheduling' },
                    { icon: '🍕', text: 'Meal Planning' },
                    { icon: '💬', text: 'Family Chat' },
                    { icon: '🏆', text: 'Points & Rewards' },
                    { icon: '📅', text: 'Smart Calendar' },
                    { icon: '💡', text: 'Daily Suggestions' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-slate-700/30 rounded-lg px-2 py-1.5">
                      <span>{item.icon}</span>
                      <span className="text-slate-300">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tip indicator dots */}
          {!isExpanded && (
            <div className="flex justify-center gap-1 mt-2">
              {tips.map((_, i) => (
                <div
                  key={i}
                  className={`w-1 h-1 rounded-full transition-all duration-300 ${
                    i === currentTip ? 'bg-cyan-400 w-3' : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function WelcomePage() {
  const handleLogin = () => {
    const redirectUrl = `${REDIRECT_URL_BASE}/dashboard`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden" data-testid="welcome-page">
      <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent" />
      
      <div className="relative z-10 min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center px-4 lg:px-6 pb-10 pt-10">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="space-y-4">
              <div className="inline-block relative">
                <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl animate-pulse" />
                <img 
                  src="https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/tqccfghc_startup.gif.gif" 
                  alt="FamFocus Hub"
                  className="relative w-44 h-44 lg:w-52 lg:h-52 object-contain mx-auto drop-shadow-[0_0_25px_rgba(99,102,241,0.4)]"
                  data-testid="app-logo"
                />
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
                Welcome to Your
                <span className="gradient-text block">Family Space</span>
              </h2>
              <p className="text-base lg:text-lg text-slate-400 max-w-sm mx-auto">
                A place where keeping up with the day-to-day is no longer a chore within itself
              </p>
            </div>

            {/* Bixby-style Pixie AI Assistant */}
            <PixieAssistant />

            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="glass-card rounded-xl p-3 space-y-1.5">
                <Calendar className="w-6 h-6 text-secondary mx-auto" />
                <p className="text-xs text-slate-300 font-medium">Smart Scheduling</p>
              </div>
              <div className="glass-card rounded-xl p-3 space-y-1.5">
                <Award className="w-6 h-6 text-accent mx-auto" />
                <p className="text-xs text-slate-300 font-medium">Rewards System</p>
              </div>
              <div className="glass-card rounded-xl p-3 space-y-1.5">
                <MessageCircle className="w-6 h-6 text-green-400 mx-auto" />
                <p className="text-xs text-slate-300 font-medium">Family Chat</p>
              </div>
              <div className="glass-card rounded-xl p-3 space-y-1.5">
                <TrendingUp className="w-6 h-6 text-pink-400 mx-auto" />
                <p className="text-xs text-slate-300 font-medium">Leaderboards</p>
              </div>
            </div>

            <button
              onClick={handleLogin}
              className="w-full bg-primary text-white font-bold py-4 px-8 rounded-full neon-glow hover:neon-glow-hover transition-all hover:scale-105 active:scale-95"
              data-testid="google-login-button"
            >
              <span className="flex items-center justify-center space-x-2">
                <span>Sign In with Google</span>
                <Sparkles className="w-5 h-5" />
              </span>
            </button>

            {/* Kid's Login Link */}
            <a 
              href="/child-login"
              className="block text-center mt-4 py-3 px-6 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white font-bold rounded-full transition-all hover:scale-105"
              data-testid="child-login-link"
            >
              Kid's Login
            </a>

            <p className="text-xs text-slate-500">
              Secure authentication powered by Google
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
