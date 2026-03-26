import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, MessageCircle, Award, TrendingUp, Bot } from 'lucide-react';

const REDIRECT_URL_BASE = typeof window !== 'undefined' ? window.location.origin : '';

const PixieGreeting = () => {
  const [greeting, setGreeting] = useState('');
  const greetings = [
    "Hi there! I'm Pixie, your family's digital helper! Ready to make family life easier? ✨",
    "Welcome! I'm Pixie! Let me help your family stay organized and connected! 🌟",
    "Hello, friend! Pixie here! Let's turn daily tasks into fun family adventures! 💫",
    "Hey! I'm Pixie, and I'm so excited to meet your family! Let's get started! 🎉"
  ];

  useEffect(() => {
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
  }, []);

  return (
    <div className="glass-card rounded-2xl p-4 mb-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-accent/20 rounded-full blur-2xl" />
      <div className="relative z-10 flex items-start space-x-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center flex-shrink-0 animate-float">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-accent text-xs font-bold mb-1">Pixie - Your AI Guide</p>
          <p className="text-white text-sm leading-relaxed">{greeting}</p>
        </div>
      </div>
    </div>
  );
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function WelcomePage() {
  const handleLogin = () => {
    const redirectUrl = `${REDIRECT_URL_BASE}/dashboard`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleDevLogin = async (role = 'parent') => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
        credentials: 'include'
      });
      const data = await response.json();
      if (data.user && data.session_token) {
        // Store token in localStorage for dev mode
        localStorage.setItem('dev_session_token', data.session_token);
        localStorage.setItem('dev_user', JSON.stringify(data.user));
        window.location.href = role === 'parent' ? '/dashboard' : '/space';
      }
    } catch (error) {
      console.error('Dev login failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden" data-testid="welcome-page">
      <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent" />
      
      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="p-4 lg:p-6">
          <div className="flex items-center space-x-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/2ku9mapg_app_logo.png.png"
              alt="FamFocus Hub"
              className="w-10 h-10 rounded-lg object-contain"
            />
            <h1 className="text-xl lg:text-2xl font-black gradient-text tracking-tight">FamFocus Hub</h1>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 lg:px-6 pb-10">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="space-y-4">
              <div className="inline-block">
                <img 
                  src="https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/tqccfghc_startup.gif.gif" 
                  alt="FamFocus Hub"
                  className="w-48 h-48 lg:w-56 lg:h-56 object-contain mx-auto"
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

            {/* Pixie AI Greeting */}
            <PixieGreeting />

            <div className="grid grid-cols-2 gap-3 py-4">
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

            {/* Dev Login Buttons */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleDevLogin('parent')}
                className="flex-1 bg-slate-800 text-white font-medium py-2 px-4 rounded-lg hover:bg-slate-700 transition-all text-sm border border-slate-600"
                data-testid="dev-login-parent"
              >
                Dev: Parent Login
              </button>
              <button
                onClick={() => handleDevLogin('child')}
                className="flex-1 bg-slate-800 text-white font-medium py-2 px-4 rounded-lg hover:bg-slate-700 transition-all text-sm border border-slate-600"
                data-testid="dev-login-child"
              >
                Dev: Child Login
              </button>
            </div>

            {/* Kid's Login Link */}
            <a 
              href="/child-login"
              className="block text-center mt-4 text-primary hover:text-accent transition-colors font-medium"
            >
              Kid's Login (with username) →
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
