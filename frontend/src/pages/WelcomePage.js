import React from 'react';
import { Sparkles, Calendar, MessageCircle, Award, Users, TrendingUp } from 'lucide-react';

const REDIRECT_URL_BASE = typeof window !== 'undefined' ? window.location.origin : '';

export default function WelcomePage() {
  const handleLogin = () => {
    const redirectUrl = `${REDIRECT_URL_BASE}/dashboard`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden" data-testid="welcome-page">
      <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent"></div>
      
      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="p-6">
          <div className="flex items-center space-x-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/2ku9mapg_app_logo.png.png"
              alt="FamFocus Hub"
              className="w-10 h-10 rounded-lg object-contain"
            />
            <h1 className="text-2xl font-black gradient-text tracking-tight">FamFocus Hub</h1>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 pb-20">
          <div className="max-w-md w-full space-y-8 text-center">
            <div className="space-y-4">
              <div className="inline-block">
                <img 
                  src="https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/tqccfghc_startup.gif.gif" 
                  alt="FamFocus Hub"
                  className="w-64 h-64 object-contain mx-auto"
                />
              </div>
              <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                Welcome to Your
                <span className="gradient-text block">Family Space</span>
              </h2>
              <p className="text-lg text-slate-400 max-w-sm mx-auto">
                Where chores become adventures, and every family member shines
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 py-8">
              <div className="glass-card rounded-2xl p-4 space-y-2">
                <Calendar className="w-8 h-8 text-secondary mx-auto" />
                <p className="text-sm text-slate-300 font-medium">Smart Scheduling</p>
              </div>
              <div className="glass-card rounded-2xl p-4 space-y-2">
                <Award className="w-8 h-8 text-accent mx-auto" />
                <p className="text-sm text-slate-300 font-medium">Rewards System</p>
              </div>
              <div className="glass-card rounded-2xl p-4 space-y-2">
                <MessageCircle className="w-8 h-8 text-green-400 mx-auto" />
                <p className="text-sm text-slate-300 font-medium">Family Chat</p>
              </div>
              <div className="glass-card rounded-2xl p-4 space-y-2">
                <TrendingUp className="w-8 h-8 text-pink-400 mx-auto" />
                <p className="text-sm text-slate-300 font-medium">Leaderboards</p>
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

            <p className="text-xs text-slate-500 mt-4">
              Secure authentication powered by Google
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}