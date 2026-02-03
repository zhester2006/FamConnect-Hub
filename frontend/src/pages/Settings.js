import React, { useState } from 'react';
import { Settings as SettingsIcon, Palette, Bell, Moon, Sun } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Settings({ user }) {
  const [theme, setTheme] = useState('cosmic_explorer');
  const [notifications, setNotifications] = useState(true);

  const themes = [
    { id: 'cosmic_explorer', name: 'Cosmic Explorer', colors: ['#020617', '#3B82F6', '#FACC15'] },
    { id: 'ocean_breeze', name: 'Ocean Breeze', colors: ['#0C1E2E', '#06B6D4', '#10B981'] },
    { id: 'sunset_glow', name: 'Sunset Glow', colors: ['#2D1B1E', '#F59E0B', '#EF4444'] },
    { id: 'forest_night', name: 'Forest Night', colors: ['#0F1F0F', '#10B981', '#34D399'] },
    { id: 'purple_dream', name: 'Purple Dream', colors: ['#1E1B2E', '#8B5CF6', '#A78BFA'] },
    { id: 'candy_pop', name: 'Candy Pop', colors: ['#2E1B1F', '#EC4899', '#F472B6'] },
    { id: 'neon_nights', name: 'Neon Nights', colors: ['#0A0E1A', '#00FFF0', '#FF00FF'] },
    { id: 'autumn_harvest', name: 'Autumn Harvest', colors: ['#1F1610', '#F97316', '#FBBF24'] },
    { id: 'arctic_frost', name: 'Arctic Frost', colors: ['#0F1619', '#67E8F9', '#F0F9FF'] },
    { id: 'volcano_burst', name: 'Volcano Burst', colors: ['#1A0F0F', '#DC2626', '#F97316'] },
    { id: 'mint_fresh', name: 'Mint Fresh', colors: ['#0F1F19', '#6EE7B7', '#34D399'] },
    { id: 'royal_gold', name: 'Royal Gold', colors: ['#1F1810', '#EAB308', '#FACC15'] },
    { id: 'deep_ocean', name: 'Deep Ocean', colors: ['#0A1628', '#1E40AF', '#3B82F6'] },
    { id: 'cherry_blossom', name: 'Cherry Blossom', colors: ['#2E1B2B', '#F9A8D4', '#FCD34D'] },
    { id: 'midnight_sky', name: 'Midnight Sky', colors: ['#0F0F1E', '#6366F1', '#818CF8'] },
  ];

  return (
    <div className="min-h-screen bg-slate-950 pb-24" data-testid="settings-page">
      <div className="p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-black text-white flex items-center space-x-2">
            <SettingsIcon className="w-7 h-7 text-primary" />
            <span>Settings</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Customize your FamilyHub experience</p>
        </header>

        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xl font-black text-white">
                {user?.name?.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-white">{user?.name}</h3>
                <p className="text-sm text-slate-400 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Palette className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-white">Appearance</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`glass-card rounded-xl p-4 flex items-center justify-between transition-all ${
                  theme === t.id ? 'border-2 border-primary' : 'border border-slate-800'
                }`}
                data-testid={`theme-${t.id}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    {t.colors.map((color, i) => (
                      <div
                        key={i}
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="font-medium text-white">{t.name}</span>
                </div>
                {theme === t.id && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-secondary" />
            <h2 className="text-lg font-bold text-white">Notifications</h2>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-white">Push Notifications</span>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`w-12 h-6 rounded-full transition-all ${
                notifications ? 'bg-primary' : 'bg-slate-700'
              }`}
              data-testid="notifications-toggle"
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                  notifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className="flex items-center justify-between opacity-50">
            <span className="text-white">Dark Mode</span>
            <Moon className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="text-center text-sm text-slate-500 pt-8">
          <p>FamilyHub v1.0</p>
          <p className="mt-1">Made with love for families</p>
        </div>
      </div>
      
      <BottomNav userRole={user?.role} />
    </div>
  );
}