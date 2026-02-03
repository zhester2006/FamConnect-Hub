import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Settings as SettingsIcon, Palette, Bell, Moon, Sun } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Settings({ user }) {
  const [theme, setTheme] = useState(user?.settings?.theme || 'cosmic_explorer');
  const [darkMode, setDarkMode] = useState(user?.settings?.dark_mode !== false);
  const [notifications, setNotifications] = useState(user?.settings?.notifications_enabled !== false);
  const [saving, setSaving] = useState(false);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await fetch(`${BACKEND_URL}/api/users/${user.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settings: {
            theme,
            dark_mode: darkMode,
            notifications_enabled: notifications
          }
        })
      });
      
      // Apply theme immediately
      document.documentElement.classList.toggle('light-mode', !darkMode);
      document.documentElement.setAttribute('data-theme', theme);
      
      toast.success('Settings saved successfully!');
      
      // Reload to apply changes
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    // Apply current theme on mount
    document.documentElement.classList.toggle('light-mode', !darkMode);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme, darkMode]);

  const themeOptions = [
    'Cosmic Explorer',
    'Ocean Breeze',
    'Sunset Glow',
    'Forest Night',
    'Purple Dream',
    'Candy Pop',
    'Neon Nights',
    'Autumn Harvest',
    'Arctic Frost',
    'Volcano Burst',
    'Mint Fresh',
    'Royal Gold',
    'Deep Ocean',
    'Cherry Blossom',
    'Midnight Sky'
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
            {themeOptions.map((themeName, index) => (
              <button
                key={themeName}
                onClick={() => setTheme(themeName)}
                className={`glass-card rounded-xl p-4 flex items-center justify-between transition-all ${
                  theme === themeName ? 'border-2 border-primary' : 'border border-slate-800'
                }`}
                data-testid={`theme-${themeName.toLowerCase().replace(/ /g, '-')}`}
              >
                <span className="font-medium text-white">{themeName}</span>
                {theme === themeName && (
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
          <p>FamFocus Hub v1.0</p>
          <p className="mt-1">Made with love for families</p>
        </div>
      </div>
      
      <BottomNav userRole={user?.role} />
    </div>
  );
}