import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Palette, Bell, Moon, Sun, ChevronDown, Check, Sparkles, BellRing, BellOff, Camera, User, Image, Battery, BatteryCharging, Shield } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { isPushSupported, getPermissionStatus, subscribeToPush, unsubscribeFromPush, isSubscribed } from '@/utils/pushNotifications';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const THEMES = {
  'Cosmic Explorer': { 
    light: { primary: '#3B82F6', secondary: '#06B6D4', accent: '#FBBF24', bg: '#F8FAFC', card: '#FFFFFF', text: '#0F172A' },
    dark: { primary: '#3B82F6', secondary: '#06B6D4', accent: '#FBBF24', bg: '#020617', card: '#0F172A', text: '#F8FAFC' }
  },
  'Ocean Breeze': { 
    light: { primary: '#0EA5E9', secondary: '#22D3EE', accent: '#14B8A6', bg: '#F0F9FF', card: '#FFFFFF', text: '#0C4A6E' },
    dark: { primary: '#0EA5E9', secondary: '#22D3EE', accent: '#14B8A6', bg: '#0C1929', card: '#0E2A43', text: '#E0F2FE' }
  },
  'Sunset Glow': { 
    light: { primary: '#F97316', secondary: '#FBBF24', accent: '#EF4444', bg: '#FFFBEB', card: '#FFFFFF', text: '#78350F' },
    dark: { primary: '#F97316', secondary: '#FBBF24', accent: '#EF4444', bg: '#1C1007', card: '#2D1A0D', text: '#FEF3C7' }
  },
  'Forest Night': { 
    light: { primary: '#22C55E', secondary: '#10B981', accent: '#84CC16', bg: '#F0FDF4', card: '#FFFFFF', text: '#14532D' },
    dark: { primary: '#22C55E', secondary: '#10B981', accent: '#84CC16', bg: '#052E16', card: '#0A3E22', text: '#DCFCE7' }
  },
  'Purple Dream': { 
    light: { primary: '#A855F7', secondary: '#EC4899', accent: '#F472B6', bg: '#FAF5FF', card: '#FFFFFF', text: '#581C87' },
    dark: { primary: '#A855F7', secondary: '#EC4899', accent: '#F472B6', bg: '#1E0A2E', card: '#2D1045', text: '#F5D0FE' }
  },
  'Candy Pop': { 
    light: { primary: '#F472B6', secondary: '#FB923C', accent: '#FBBF24', bg: '#FFF1F2', card: '#FFFFFF', text: '#831843' },
    dark: { primary: '#F472B6', secondary: '#FB923C', accent: '#FBBF24', bg: '#2E0A1E', card: '#45102D', text: '#FECDD3' }
  },
  'Neon Nights': { 
    light: { primary: '#8B5CF6', secondary: '#06B6D4', accent: '#14F195', bg: '#F5F3FF', card: '#FFFFFF', text: '#5B21B6' },
    dark: { primary: '#8B5CF6', secondary: '#06B6D4', accent: '#14F195', bg: '#0D0620', card: '#1A0B3E', text: '#DDD6FE' }
  },
  'Autumn Harvest': { 
    light: { primary: '#EA580C', secondary: '#DC2626', accent: '#B91C1C', bg: '#FFF7ED', card: '#FFFFFF', text: '#7C2D12' },
    dark: { primary: '#EA580C', secondary: '#DC2626', accent: '#FBBF24', bg: '#1C0F06', card: '#2D1A0D', text: '#FFEDD5' }
  },
  'Arctic Frost': { 
    light: { primary: '#38BDF8', secondary: '#67E8F9', accent: '#E2E8F0', bg: '#F8FAFC', card: '#FFFFFF', text: '#0C4A6E' },
    dark: { primary: '#38BDF8', secondary: '#67E8F9', accent: '#CBD5E1', bg: '#0F172A', card: '#1E293B', text: '#F1F5F9' }
  },
  'Volcano Burst': { 
    light: { primary: '#EF4444', secondary: '#F97316', accent: '#FBBF24', bg: '#FEF2F2', card: '#FFFFFF', text: '#7F1D1D' },
    dark: { primary: '#EF4444', secondary: '#F97316', accent: '#FBBF24', bg: '#1F0A0A', card: '#3B1111', text: '#FEE2E2' }
  },
  'Mint Fresh': { 
    light: { primary: '#34D399', secondary: '#A7F3D0', accent: '#10B981', bg: '#ECFDF5', card: '#FFFFFF', text: '#065F46' },
    dark: { primary: '#34D399', secondary: '#6EE7B7', accent: '#10B981', bg: '#022C22', card: '#064E3B', text: '#D1FAE5' }
  },
  'Royal Gold': { 
    light: { primary: '#EAB308', secondary: '#FDE047', accent: '#A16207', bg: '#FEFCE8', card: '#FFFFFF', text: '#713F12' },
    dark: { primary: '#EAB308', secondary: '#FDE047', accent: '#FACC15', bg: '#1A1505', card: '#2D250A', text: '#FEF9C3' }
  },
  'Deep Ocean': { 
    light: { primary: '#1D4ED8', secondary: '#0E7490', accent: '#3B82F6', bg: '#EFF6FF', card: '#FFFFFF', text: '#1E3A8A' },
    dark: { primary: '#3B82F6', secondary: '#0E7490', accent: '#60A5FA', bg: '#0A1628', card: '#0F2342', text: '#DBEAFE' }
  },
  'Cherry Blossom': { 
    light: { primary: '#EC4899', secondary: '#F9A8D4', accent: '#BE185D', bg: '#FDF2F8', card: '#FFFFFF', text: '#831843' },
    dark: { primary: '#EC4899', secondary: '#F472B6', accent: '#DB2777', bg: '#2E0A1E', card: '#4A1033', text: '#FCE7F3' }
  },
  'Midnight Sky': { 
    light: { primary: '#4338CA', secondary: '#6366F1', accent: '#818CF8', bg: '#EEF2FF', card: '#FFFFFF', text: '#312E81' },
    dark: { primary: '#6366F1', secondary: '#818CF8', accent: '#A5B4FC', bg: '#0A0A1F', card: '#131336', text: '#E0E7FF' }
  }
};

const applyTheme = (themeName, mode) => {
  const theme = THEMES[themeName];
  if (!theme) return;
  
  const colors = theme[mode];
  const root = document.documentElement;
  
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-secondary', colors.secondary);
  root.style.setProperty('--color-accent', colors.accent);
  root.style.setProperty('--color-bg', colors.bg);
  root.style.setProperty('--color-card', colors.card);
  root.style.setProperty('--color-text', colors.text);
  
  // Set body class for light/dark
  document.body.classList.remove('light-mode', 'dark-mode');
  document.body.classList.add(`${mode}-mode`);
  
  // Store in localStorage for persistence
  localStorage.setItem('famfocus-theme', themeName);
  localStorage.setItem('famfocus-mode', mode);
};

export default function Settings({ user }) {
  const [theme, setTheme] = useState(localStorage.getItem('famfocus-theme') || 'Cosmic Explorer');
  const [themeMode, setThemeMode] = useState(localStorage.getItem('famfocus-mode') || 'dark');
  const [notifications, setNotifications] = useState(true);
  const [notifChores, setNotifChores] = useState(true);
  const [notifEvents, setNotifEvents] = useState(true);
  const [notifChat, setNotifChat] = useState(true);
  const [notifWall, setNotifWall] = useState(true);
  const [notifApprovals, setNotifApprovals] = useState(true);
  const [notifReading, setNotifReading] = useState(true);
  const [notifLocation, setNotifLocation] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  
  // Push notification state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Profile picture state
  const [profilePicture, setProfilePicture] = useState(user?.picture || null);
  const [backgroundPicture, setBackgroundPicture] = useState(user?.profile_background || null);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const profileInputRef = useRef(null);
  const backgroundInputRef = useRef(null);

  // Battery permission state (for children)
  const [shareBattery, setShareBattery] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [isCharging, setIsCharging] = useState(false);

  useEffect(() => {
    applyTheme(theme, themeMode);
  }, [theme, themeMode]);

  useEffect(() => {
    // Check push notification status
    setPushSupported(isPushSupported());
    setPushPermission(getPermissionStatus());
    
    const checkPushStatus = async () => {
      const subscribed = await isSubscribed();
      setPushEnabled(subscribed);
    };
    checkPushStatus();
    
    // Fetch permissions
    fetchPermissions();
    
    // Get current battery status
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(battery.charging);
        
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
        battery.addEventListener('chargingchange', () => {
          setIsCharging(battery.charging);
        });
      });
    }
  }, []);

  const fetchPermissions = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/permissions`, { credentials: 'include' });
      const data = await res.json();
      setShareBattery(data.permissions?.share_battery || false);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const handleToggleBattery = async () => {
    const newValue = !shareBattery;
    try {
      const res = await fetch(`${BACKEND_URL}/api/permissions/battery`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ share_battery: newValue })
      });
      
      if (res.ok) {
        setShareBattery(newValue);
        toast.success(newValue ? 'Battery sharing enabled' : 'Battery sharing disabled');
        
        // If enabled, send initial battery status
        if (newValue && batteryLevel !== null) {
          await updateBatteryStatus();
        }
      }
    } catch (error) {
      console.error('Failed to toggle battery permission:', error);
      toast.error('Failed to update permission');
    }
  };

  const updateBatteryStatus = async () => {
    if (batteryLevel === null) return;
    
    try {
      await fetch(`${BACKEND_URL}/api/battery/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          level: batteryLevel,
          is_charging: isCharging
        })
      });
    } catch (error) {
      console.error('Failed to update battery:', error);
    }
  };

  // Auto-update battery status when it changes
  useEffect(() => {
    if (shareBattery && batteryLevel !== null) {
      updateBatteryStatus();
    }
  }, [batteryLevel, isCharging, shareBattery]);

  const handleTogglePush = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
        toast.success('Push notifications disabled');
      } else {
        await subscribeToPush();
        setPushEnabled(true);
        setPushPermission('granted');
        toast.success('Push notifications enabled!');
      }
    } catch (error) {
      console.error('Push toggle error:', error);
      toast.error(error.message || 'Failed to toggle push notifications');
    } finally {
      setPushLoading(false);
    }
  };

  const handleImageUpload = async (file, type) => {
    if (!file) return;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const setUploading = type === 'profile' ? setUploadingProfile : setUploadingBackground;
    setUploading(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        
        const res = await fetch(`${BACKEND_URL}/api/users/${user.user_id}/upload-picture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            image: base64,
            type: type
          })
        });

        if (res.ok) {
          if (type === 'profile') {
            setProfilePicture(base64);
          } else {
            setBackgroundPicture(base64);
          }
          toast.success(`${type === 'profile' ? 'Profile' : 'Background'} picture updated!`);
        } else {
          toast.error('Failed to upload image');
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
      setUploading(false);
    }
  };

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
            theme_mode: themeMode,
            notifications_enabled: notifications,
            notification_settings: {
              chore_updates: notifChores,
              new_events: notifEvents,
              chat_messages: notifChat,
              wall_posts: notifWall,
              approvals: notifApprovals,
              reading_logs: notifReading,
              location_alerts: notifLocation
            }
          }
        })
      });
      toast.success('Settings saved!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const themeNames = Object.keys(THEMES);

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <div className="p-4 lg:p-6 pb-24 md:pb-6 space-y-4 max-w-2xl mx-auto">
          <header>
            <h1 className="text-2xl font-black" style={{ color: 'var(--color-text)' }}>Settings</h1>
            <p className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.6 }}>Customize your FamFocus Hub experience</p>
          </header>

          {/* Profile Card with Picture Upload */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center space-x-2" style={{ color: 'var(--color-text)' }}>
                <User className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                <span>Profile</span>
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Profile Picture */}
              <div className="relative group">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black text-white overflow-hidden"
                  style={{ background: profilePicture ? 'none' : `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }}
                >
                  {profilePicture ? (
                    <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    user?.name?.charAt(0)
                  )}
                </div>
                <button
                  onClick={() => profileInputRef.current?.click()}
                  disabled={uploadingProfile}
                  className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  {uploadingProfile ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </button>
                <input
                  ref={profileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files?.[0], 'profile')}
                />
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>{user?.name}</h3>
                <p className="text-sm capitalize" style={{ color: 'var(--color-text)', opacity: 0.6 }}>{user?.role}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text)', opacity: 0.4 }}>{user?.email}</p>
              </div>
            </div>

            {/* Background Picture Upload */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-text)', opacity: 0.1 }}>
              <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text)', opacity: 0.6 }}>
                Profile Background
              </label>
              <div className="relative group">
                <div 
                  className="h-24 rounded-xl overflow-hidden flex items-center justify-center"
                  style={{ backgroundColor: backgroundPicture ? 'transparent' : 'var(--color-card)' }}
                >
                  {backgroundPicture ? (
                    <img src={backgroundPicture} alt="Background" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center space-x-2" style={{ color: 'var(--color-text)', opacity: 0.3 }}>
                      <Image className="w-5 h-5" />
                      <span className="text-sm">No background set</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => backgroundInputRef.current?.click()}
                  disabled={uploadingBackground}
                  className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  {uploadingBackground ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white" />
                  ) : (
                    <div className="flex items-center space-x-2 text-white">
                      <Camera className="w-5 h-5" />
                      <span className="text-sm font-medium">Change Background</span>
                    </div>
                  )}
                </button>
                <input
                  ref={backgroundInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files?.[0], 'background')}
                />
              </div>
            </div>
          </div>

          {/* Battery Sharing (for children only) */}
          {user?.role === 'child' && (
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" style={{ color: 'var(--color-secondary)' }} />
                  <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Privacy & Permissions</h2>
                </div>
              </div>
              
              {/* Current Battery Status */}
              {batteryLevel !== null && (
                <div className="flex items-center space-x-3 mb-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
                  {isCharging ? (
                    <BatteryCharging className="w-6 h-6 text-green-400" />
                  ) : (
                    <Battery className={`w-6 h-6 ${batteryLevel <= 20 ? 'text-red-400' : batteryLevel <= 50 ? 'text-yellow-400' : 'text-green-400'}`} />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      Current Battery: {batteryLevel}%
                      {isCharging && <span className="text-green-400 ml-2">Charging</span>}
                    </p>
                    <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-card)' }}>
                      <div 
                        className={`h-full transition-all ${batteryLevel <= 20 ? 'bg-red-500' : batteryLevel <= 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${batteryLevel}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Battery Sharing Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div className="flex-1">
                  <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>Share Battery with Parents</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text)', opacity: 0.5 }}>
                    Let your parents see your device's battery level
                  </p>
                </div>
                <button
                  onClick={handleToggleBattery}
                  className={`relative w-12 h-7 rounded-full transition-all ${shareBattery ? 'bg-green-500' : 'bg-slate-600'}`}
                  data-testid="battery-toggle"
                >
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${shareBattery ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              
              {shareBattery && (
                <p className="text-xs mt-2 px-3" style={{ color: 'var(--color-text)', opacity: 0.4 }}>
                  Your battery status will be visible to your parents. They'll be notified if your battery gets very low.
                </p>
              )}
            </div>
          )}

          {/* Theme Selection */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-4">
              <Palette className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Theme</h2>
            </div>
            
            <button
              onClick={() => setShowThemes(!showThemes)}
              className="w-full flex items-center justify-between rounded-xl p-3 transition-all border"
              style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-primary)' }}
            >
              <div className="flex items-center space-x-3">
                <div className="flex -space-x-1">
                  <div className="w-5 h-5 rounded-full border-2" style={{ backgroundColor: THEMES[theme]?.[themeMode]?.primary, borderColor: 'var(--color-bg)' }} />
                  <div className="w-5 h-5 rounded-full border-2" style={{ backgroundColor: THEMES[theme]?.[themeMode]?.secondary, borderColor: 'var(--color-bg)' }} />
                  <div className="w-5 h-5 rounded-full border-2" style={{ backgroundColor: THEMES[theme]?.[themeMode]?.accent, borderColor: 'var(--color-bg)' }} />
                </div>
                <span className="font-medium" style={{ color: 'var(--color-text)' }}>{theme}</span>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform ${showThemes ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text)', opacity: 0.6 }} />
            </button>

            {showThemes && (
              <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
                {themeNames.map((themeName) => (
                  <button
                    key={themeName}
                    onClick={() => { setTheme(themeName); setShowThemes(false); }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${
                      theme === themeName ? 'border-2' : 'border-transparent hover:opacity-80'
                    }`}
                    style={{ 
                      backgroundColor: theme === themeName ? `${THEMES[themeName][themeMode].primary}20` : 'var(--color-card)',
                      borderColor: theme === themeName ? 'var(--color-primary)' : 'transparent'
                    }}
                    data-testid={`theme-option-${themeName}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex -space-x-1">
                        <div className="w-4 h-4 rounded-full border-2" style={{ backgroundColor: THEMES[themeName][themeMode].primary, borderColor: 'var(--color-bg)' }} />
                        <div className="w-4 h-4 rounded-full border-2" style={{ backgroundColor: THEMES[themeName][themeMode].secondary, borderColor: 'var(--color-bg)' }} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{themeName}</span>
                    </div>
                    {theme === themeName && <Check className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Mode */}
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text)' }}>Theme Mode</h2>
            <div className="grid grid-cols-3 gap-2">
              {['light', 'dark', 'auto'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setThemeMode(mode === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode)}
                  className={`flex flex-col items-center space-y-2 p-3 rounded-xl border-2 transition-all ${
                    themeMode === mode ? '' : 'border-transparent'
                  }`}
                  style={{ 
                    backgroundColor: themeMode === mode ? `${THEMES[theme][themeMode].primary}20` : 'var(--color-card)',
                    borderColor: themeMode === mode ? 'var(--color-primary)' : 'transparent'
                  }}
                  data-testid={`mode-${mode}`}
                >
                  {mode === 'light' && <Sun className="w-6 h-6" style={{ color: '#FBBF24' }} />}
                  {mode === 'dark' && <Moon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />}
                  {mode === 'auto' && <Sparkles className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />}
                  <span className="text-xs font-medium capitalize" style={{ color: 'var(--color-text)' }}>{mode}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Push Notifications - Browser */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                {pushEnabled ? (
                  <BellRing className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                ) : (
                  <BellOff className="w-5 h-5" style={{ color: 'var(--color-text)', opacity: 0.5 }} />
                )}
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Browser Notifications</h2>
              </div>
            </div>
            
            {!pushSupported ? (
              <p className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.6 }}>
                Push notifications are not supported in this browser.
              </p>
            ) : pushPermission === 'denied' ? (
              <div>
                <p className="text-sm mb-2" style={{ color: '#EF4444' }}>
                  Notifications are blocked. Please enable them in your browser settings.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.6 }}>
                  Receive alerts for chores, messages, and location updates even when the app is closed.
                </p>
                <button
                  onClick={handleTogglePush}
                  disabled={pushLoading}
                  className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 ${
                    pushEnabled ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'text-white'
                  }`}
                  style={!pushEnabled ? { backgroundColor: 'var(--color-primary)' } : {}}
                  data-testid="toggle-push-btn"
                >
                  {pushLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current" />
                  ) : pushEnabled ? (
                    <>
                      <BellOff className="w-4 h-4" />
                      <span>Disable Notifications</span>
                    </>
                  ) : (
                    <>
                      <BellRing className="w-4 h-4" />
                      <span>Enable Notifications</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Notifications Section - Only for parents */}
          {user?.role === 'parent' && (
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Bell className="w-5 h-5" style={{ color: 'var(--color-secondary)' }} />
                  <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Notifications</h2>
                </div>
                <ToggleButton value={notifications} onChange={setNotifications} />
              </div>

              {notifications && (
                <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--color-text)', borderOpacity: 0.1 }}>
                  <NotificationToggle label="Chore Updates" desc="When chores are completed" value={notifChores} onChange={setNotifChores} />
                  <NotificationToggle label="New Events" desc="When new events are added" value={notifEvents} onChange={setNotifEvents} />
                  <NotificationToggle label="Chat Messages" desc="New messages in chat" value={notifChat} onChange={setNotifChat} />
                  <NotificationToggle label="Wall Posts" desc="New posts on family wall" value={notifWall} onChange={setNotifWall} />
                  <NotificationToggle label="Approval Requests" desc="Items needing approval" value={notifApprovals} onChange={setNotifApprovals} />
                  <NotificationToggle label="Reading Logs" desc="When logs are submitted" value={notifReading} onChange={setNotifReading} />
                  <NotificationToggle label="Location Alerts" desc="Geofence and GPS notifications" value={notifLocation} onChange={setNotifLocation} />
                </div>
              )}
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="w-full text-white font-bold py-4 rounded-full transition-all shadow-lg disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
            data-testid="save-settings-button"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          <div className="text-center text-xs pt-4" style={{ color: 'var(--color-text)', opacity: 0.4 }}>
            <p>FamFocus Hub v1.0</p>
            <p className="mt-1">Made with love for families</p>
          </div>
        </div>
      </main>
    </div>
  );
}

function ToggleButton({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-12 h-6 rounded-full transition-all relative"
      style={{ backgroundColor: value ? 'var(--color-primary)' : '#64748B' }}
    >
      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-md ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  );
}

function NotificationToggle({ label, desc, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0 pr-4">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{label}</span>
        <p className="text-xs truncate" style={{ color: 'var(--color-text)', opacity: 0.5 }}>{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="w-10 h-5 rounded-full transition-all relative flex-shrink-0"
        style={{ backgroundColor: value ? '#22C55E' : '#64748B' }}
      >
        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
