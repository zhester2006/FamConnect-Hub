import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Palette, Bell, Moon, Sun, ChevronDown, Check } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const THEME_OPTIONS = [
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

export default function Settings({ user }) {
  const [theme, setTheme] = useState(user?.settings?.theme || 'Cosmic Explorer');
  const [darkMode, setDarkMode] = useState(user?.settings?.dark_mode !== false);
  const [notifications, setNotifications] = useState(user?.settings?.notifications_enabled !== false);
  const [notifChores, setNotifChores] = useState(true);
  const [notifEvents, setNotifEvents] = useState(true);
  const [notifChat, setNotifChat] = useState(true);
  const [notifWall, setNotifWall] = useState(true);
  const [notifApprovals, setNotifApprovals] = useState(true);
  const [notifReading, setNotifReading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showThemes, setShowThemes] = useState(false);

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
            notification_settings: {
              chore_updates: notifChores,
              new_events: notifEvents,
              chat_messages: notifChat,
              wall_posts: notifWall,
              approvals: notifApprovals,
              reading_logs: notifReading
            }
          }
        })
      });
      
      document.documentElement.classList.toggle('light-mode', !darkMode);
      toast.success('Settings saved!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', !darkMode);
  }, [darkMode]);

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto lg:ml-72">
        <div className="p-4 lg:p-6 space-y-4 max-w-2xl mx-auto">
          <header>
            <h1 className="text-2xl font-black text-white">Settings</h1>
            <p className="text-sm text-slate-400">Customize your FamFocus Hub experience</p>
          </header>

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

          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-4">
              <Palette className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-white">Theme</h2>
            </div>
            
            <button
              onClick={() => setShowThemes(!showThemes)}
              className="w-full flex items-center justify-between bg-slate-800/50 rounded-xl p-3 hover:bg-slate-800 transition-all"
            >
              <span className="text-white font-medium">{theme}</span>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showThemes ? 'rotate-180' : ''}`} />
            </button>

            {showThemes && (
              <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
                {THEME_OPTIONS.map((themeOpt) => (
                  <button
                    key={themeOpt}
                    onClick={() => { setTheme(themeOpt); setShowThemes(false); }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      theme === themeOpt 
                        ? 'bg-primary/20 border border-primary' 
                        : 'bg-slate-800/30 hover:bg-slate-800/50 border border-transparent'
                    }`}
                    data-testid={`theme-option-${themeOpt}`}
                  >
                    <span className="text-white text-sm font-medium">{themeOpt}</span>
                    {theme === themeOpt && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

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
                  <NotificationToggle label="Chore Updates" desc="When chores are completed" value={notifChores} onChange={setNotifChores} />
                  <NotificationToggle label="New Events" desc="When new events are added" value={notifEvents} onChange={setNotifEvents} />
                  <NotificationToggle label="Chat Messages" desc="New messages in chat" value={notifChat} onChange={setNotifChat} />
                  <NotificationToggle label="Wall Posts" desc="New posts on family wall" value={notifWall} onChange={setNotifWall} />
                  <NotificationToggle label="Approval Requests" desc="Items needing approval" value={notifApprovals} onChange={setNotifApprovals} />
                  <NotificationToggle label="Reading Logs" desc="When logs are submitted" value={notifReading} onChange={setNotifReading} />
                </div>
              )}
            </div>
          )}

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

function NotificationToggle({ label, desc, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0 pr-4">
        <span className="text-white text-sm font-medium">{label}</span>
        <p className="text-xs text-slate-500 truncate">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${value ? 'bg-green-500' : 'bg-slate-600'}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
