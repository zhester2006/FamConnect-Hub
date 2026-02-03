import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Palette, Bell, Moon, Sun } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Settings({ user }) {
  const [theme, setTheme] = useState(user?.settings?.theme || 'cosmic_explorer');
  const [darkMode, setDarkMode] = useState(user?.settings?.dark_mode !== false);
  const [notifications, setNotifications] = useState(user?.settings?.notifications_enabled !== false);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto lg:ml-72">
        <div className="p-6 lg:p-8 space-y-6">
          <header>
            <h1 className="text-2xl font-black text-white">Settings</h1>
            <p className="text-sm text-slate-400 mt-1">Customize your FamFocus Hub experience</p>
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
            <h2 className="text-lg font-bold text-white">Preferences</h2>
          </div>
          
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-white font-medium">Dark Mode</span>
              <p className="text-xs text-slate-400 mt-1">Toggle between dark and light themes</p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`w-14 h-7 rounded-full transition-all relative ${
                darkMode ? 'bg-primary' : 'bg-slate-300'
              }`}
              data-testid="dark-mode-toggle"
            >
              <div
                className={`w-6 h-6 bg-white rounded-full shadow-md absolute top-0.5 transition-transform flex items-center justify-center ${
                  darkMode ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              >
                {darkMode ? <Moon className="w-3 h-3 text-primary" /> : <Sun className="w-3 h-3 text-slate-700" />}
              </div>
            </button>
          </div>
          
          <div className="flex items-center justify-between py-2">
            <span className="text-white font-medium">Push Notifications</span>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`w-14 h-7 rounded-full transition-all ${
                notifications ? 'bg-primary' : 'bg-slate-700'
              }`}
              data-testid="notifications-toggle"
            >
              <div
                className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${
                  notifications ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="w-full bg-primary hover:bg-primary/80 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-full transition-all neon-glow"
          data-testid="save-settings-button"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>

        <div className="text-center text-sm text-slate-500 pt-8">
          <p>FamFocus Hub v1.0</p>
          <p className="mt-1">Made with love for families</p>
        </div>
        </div>
      </main>
    </div>
  );
}