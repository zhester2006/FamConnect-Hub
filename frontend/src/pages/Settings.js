import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Palette, Bell, Moon, Sun, ChevronDown, Check } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Settings({ user }) {
  const [theme, setTheme] = useState(user?.settings?.theme || 'Cosmic Explorer');
  const [darkMode, setDarkMode] = useState(user?.settings?.dark_mode !== false);
  const [notifications, setNotifications] = useState(user?.settings?.notifications_enabled !== false);
  const [notificationSettings, setNotificationSettings] = useState({
    chore_updates: true,
    new_events: true,
    chat_messages: true,
    wall_posts: true,
    approvals: true,
    reading_logs: true
  });
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showThemes, setShowThemes] = useState(false);

  useEffect(() => {
    if (user?.settings?.notification_settings) {
      setNotificationSettings(user.settings.notification_settings);
    }
  }, [user]);

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
            notifications_enabled: notifications,
            notification_settings: notificationSettings
          }
        })
      });
      
      document.documentElement.classList.toggle('light-mode', !darkMode);
      document.documentElement.setAttribute('data-theme', theme);
      
      toast.success('Settings saved!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', !darkMode);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme, darkMode]);

  const themeOptions = [
    { name: 'Cosmic Explorer', colors: ['#3B82F6', '#06B6D4'] },
    { name: 'Ocean Breeze', colors: ['#0EA5E9', '#22D3EE'] },
    { name: 'Sunset Glow', colors: ['#F97316', '#FBBF24'] },
    { name: 'Forest Night', colors: ['#22C55E', '#10B981'] },
    { name: 'Purple Dream', colors: ['#A855F7', '#EC4899'] },
    { name: 'Candy Pop', colors: ['#F472B6', '#FB923C'] },
    { name: 'Neon Nights', colors: ['#8B5CF6', '#06B6D4'] },
    { name: 'Autumn Harvest', colors: ['#EA580C', '#DC2626'] },
    { name: 'Arctic Frost', colors: ['#38BDF8', '#E2E8F0'] },
    { name: 'Volcano Burst', colors: ['#EF4444', '#F97316'] },
    { name: 'Mint Fresh', colors: ['#34D399', '#A7F3D0'] },
    { name: 'Royal Gold', colors: ['#EAB308', '#FDE047'] },
    { name: 'Deep Ocean', colors: ['#1D4ED8', '#0E7490'] },
    { name: 'Cherry Blossom', colors: ['#EC4899', '#FDF2F8'] },
    { name: 'Midnight Sky', colors: ['#4338CA', '#1E1B4B'] }
  ];

  const notificationOptions = [
    { key: 'chore_updates', label: 'Chore Updates', description: 'When chores are completed or status changes' },
    { key: 'new_events', label: 'New Events', description: 'When new calendar events are added' },
    { key: 'chat_messages', label: 'Chat Messages', description: 'New messages in family chat' },
    { key: 'wall_posts', label: 'Wall Posts', description: 'New posts on the family wall' },
    { key: 'approvals', label: 'Approval Requests', description: 'When items need your approval' },
    { key: 'reading_logs', label: 'Reading Logs', description: 'When reading logs are submitted' }
  ];

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto lg:ml-72">
        <div className="p-4 lg:p-6 space-y-4 max-w-2xl mx-auto">
          <header>
            <h1 className="text-2xl font-black text-white">Settings</h1>
            <p className="text-sm text-slate-400">Customize your FamFocus Hub experience</p>
          </header>

          {/* Profile Card */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xl font-black text-white">
                {user?.name?.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-white">{user?.name}</h3>
                <p className="text-sm text-slate-400 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>

          {/* Theme Selection */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-4">
              <Palette className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-white">Theme</h2>
            </div>
            
            <button
              onClick={() => setShowThemes(!showThemes)}
              className="w-full flex items-center justify-between bg-slate-800/50 rounded-xl p-3 hover:bg-slate-800 transition-all"
            >
              <div className="flex items-center space-x-3">
                <div className="flex -space-x-1">
                  {themeOptions.find(t => t.name === theme)?.colors.map((color, i) => (
                    <div key={i} className="w-5 h-5 rounded-full border-2 border-slate-900" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <span className="text-white font-medium">{theme}</span>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showThemes ? 'rotate-180' : ''}`} />
            </button>

            {showThemes && (
              <div className="mt-3 grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                {themeOptions.map((themeOpt) => (
                  <button
                    key={themeOpt.name}
                    onClick={() => { setTheme(themeOpt.name); setShowThemes(false); }}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      theme === themeOpt.name 
                        ? 'bg-primary/20 border border-primary' 
                        : 'bg-slate-800/30 hover:bg-slate-800/50 border border-transparent'
                    }`}
                    data-testid={`theme-${themeOpt.name.toLowerCase().replace(/ /g, '-')}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex -space-x-1">
                        {themeOpt.colors.map((color, i) => (
                          <div key={i} className="w-5 h-5 rounded-full border-2 border-slate-900" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                      <span className="text-white text-sm font-medium">{themeOpt.name}</span>
                    </div>
                    {theme === themeOpt.name && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Appearance */}
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-lg font-bold text-white mb-4">Appearance</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {darkMode ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-yellow-400" />}
                <div>
                  <span className="text-white font-medium">Dark Mode</span>
                  <p className="text-xs text-slate-400">Toggle between dark and light themes</p>
                </div>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`w-12 h-6 rounded-full transition-all relative ${darkMode ? 'bg-primary' : 'bg-slate-600'}`}
                data-testid="dark-mode-toggle"
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-md ${darkMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Notifications Section - Only for parents */}
          {user?.role === 'parent' && (
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Bell className="w-5 h-5 text-secondary" />
                  <h2 className="text-lg font-bold text-white">Notifications</h2>
                </div>
                <button
                  onClick={() => setNotifications(!notifications)}
                  className={`w-12 h-6 rounded-full transition-all relative ${notifications ? 'bg-primary' : 'bg-slate-600'}`}
                  data-testid="notifications-master-toggle"
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-md ${notifications ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {notifications && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  {notificationOptions.map((option) => (
                    <div key={option.key} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <span className="text-white text-sm font-medium">{option.label}</span>
                        <p className="text-xs text-slate-500 truncate">{option.description}</p>
                      </div>
                      <button
                        onClick={() => setNotificationSettings(prev => ({ ...prev, [option.key]: !prev[option.key] }))}
                        className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${
                          notificationSettings[option.key] ? 'bg-green-500' : 'bg-slate-600'
                        }`}
                        data-testid={`notification-${option.key}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${
                          notificationSettings[option.key] ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary/80 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-full transition-all shadow-lg shadow-primary/20"
            data-testid="save-settings-button"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          <div className="text-center text-xs text-slate-500 pt-4">
            <p>FamFocus Hub v1.0</p>
            <p className="mt-1">Made with love for families</p>
          </div>
        </div>
      </main>
    </div>
  );
}
