import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Calendar, MessageCircle, Users, ShoppingCart, Award, 
  Settings, LogOut, Utensils, Trophy, Book, MapPin, Menu, X,
  LayoutDashboard, Sparkles, ChevronLeft, ChevronRight, GripVertical, BarChart3, Bell, Medal,
  Sun, Flame, Package
} from 'lucide-react';

import NotificationContext from '../context/NotificationContext';
import NotificationBell from './NotificationBell';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Haptic feedback utility
const triggerHaptic = (type = 'light') => {
  if ('vibrate' in navigator) {
    switch (type) {
      case 'light': navigator.vibrate(10); break;
      case 'medium': navigator.vibrate(20); break;
      case 'heavy': navigator.vibrate([30, 10, 30]); break;
      case 'success': navigator.vibrate([10, 50, 20]); break;
      default: navigator.vibrate(10);
    }
  }
};

// Mobile Bottom Navigation Component
function MobileBottomNav({ user, currentPath, onNavigate }) {
  const navItems = useMemo(() => {
    if (user?.role === 'homehub') return [
      { icon: Sparkles, label: 'Hub', path: '/hub' },
      { icon: Calendar, label: 'Calendar', path: '/calendar' },
      { icon: MessageCircle, label: 'Chat', path: '/chat' },
      { icon: ShoppingCart, label: 'Shopping', path: '/shopping' },
      { icon: LayoutDashboard, label: 'Wall', path: '/family-wall' },
    ];
    if (user?.role === 'parent') return [
      { icon: Home, label: 'Home', path: '/dashboard' },
      { icon: Calendar, label: 'Calendar', path: '/calendar' },
      { icon: MessageCircle, label: 'Chat', path: '/chat' },
      { icon: LayoutDashboard, label: 'Wall', path: '/family-wall' },
      { icon: Settings, label: 'More', path: '/settings' },
    ];
    return [
      { icon: Home, label: 'Space', path: '/space' },
      { icon: Calendar, label: 'Calendar', path: '/calendar' },
      { icon: MessageCircle, label: 'Chat', path: '/chat' },
      { icon: Trophy, label: 'Rewards', path: '/rewards' },
      { icon: Settings, label: 'More', path: '/settings' },
    ];
  }, [user?.role]);

  const navigateWithHaptic = useCallback((path) => {
    triggerHaptic('light');
    onNavigate(path);
  }, [onNavigate]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-bottom">
      <div className="mx-3 mb-8">
        <nav className="flex items-center justify-around backdrop-blur-2xl bg-slate-900/90 border border-white/10 rounded-2xl py-2 shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigateWithHaptic(item.path)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  isActive ? 'text-primary bg-primary/10' : 'text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// Tooltip component for collapsed sidebar
function NavTooltip({ label, visible }) {
  if (!visible) return null;
  return (
    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
      {label}
    </div>
  );
}

export default function Sidebar({ user, isOpen, setIsOpen, collapsed, setCollapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(collapsed || false);
  const [hoveredItem, setHoveredItem] = useState(null);
  
  const notificationContext = useContext(NotificationContext);
  const unreadCount = notificationContext?.unreadCount || 0;
  const setShowNotificationPanel = notificationContext?.setShowNotificationPanel;

  const handleCollapse = useCallback(() => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (setCollapsed) setCollapsed(newState);
  }, [isCollapsed, setCollapsed]);

  const handleLogout = useCallback(async () => {
    try {
      localStorage.removeItem('dev_session_token');
      localStorage.removeItem('dev_user');
      await fetch(`${BACKEND_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/login');
    }
  }, [navigate]);

  const handleNavigate = useCallback((path) => {
    navigate(path);
    setIsOpen(false);
  }, [navigate, setIsOpen]);

  const parentMenuItems = useMemo(() => [
    { icon: Home, label: 'Dashboard', path: '/dashboard', color: 'text-blue-400' },
    { icon: Sparkles, label: 'Home Hub', path: '/hub', color: 'text-indigo-400' },
    { icon: Users, label: 'Family', path: '/family', color: 'text-cyan-400' },
    { icon: Calendar, label: 'Calendar', path: '/calendar', color: 'text-emerald-400' },
    { icon: GripVertical, label: 'Chores', path: '/chore-scheduler', color: 'text-teal-400' },
    { icon: Sun, label: 'Routines', path: '/routines', color: 'text-amber-300' },
    { icon: MessageCircle, label: 'Chat', path: '/chat', color: 'text-pink-400' },
    { icon: LayoutDashboard, label: 'Wall', path: '/family-wall', color: 'text-rose-400' },
    { icon: ShoppingCart, label: 'Shopping', path: '/shopping', color: 'text-orange-400' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', color: 'text-yellow-400' },
    { icon: Medal, label: 'Achievements', path: '/achievements', color: 'text-fuchsia-400' },
    { icon: Flame, label: 'Weekly Recap', path: '/weekly-recap', color: 'text-orange-400' },
    { icon: Utensils, label: 'Dinner', path: '/dinner', color: 'text-amber-400' },
    { icon: Package, label: 'Pantry', path: '/pantry', color: 'text-green-400' },
    { icon: Award, label: 'Rewards', path: '/rewards', color: 'text-purple-400' },
    { icon: Book, label: 'Reading', path: '/reading', color: 'text-sky-400' },
    { icon: MapPin, label: 'Location', path: '/checkins', color: 'text-red-400' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics', color: 'text-lime-400' },
    { icon: Settings, label: 'Settings', path: '/settings', color: 'text-slate-400' },
  ], []);

  const childMenuItems = useMemo(() => [
    { icon: Home, label: 'My Space', path: '/space', color: 'text-blue-400' },
    { icon: Sparkles, label: 'Home Hub', path: '/hub', color: 'text-indigo-400' },
    { icon: Calendar, label: 'Calendar', path: '/calendar', color: 'text-emerald-400' },
    { icon: Sun, label: 'Routines', path: '/routines', color: 'text-amber-300' },
    { icon: MessageCircle, label: 'Chat', path: '/chat', color: 'text-pink-400' },
    { icon: LayoutDashboard, label: 'Wall', path: '/family-wall', color: 'text-rose-400' },
    { icon: ShoppingCart, label: 'Shopping', path: '/shopping', color: 'text-orange-400' },
    { icon: Package, label: 'Pantry', path: '/pantry', color: 'text-green-400' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', color: 'text-yellow-400' },
    { icon: Medal, label: 'Achievements', path: '/achievements', color: 'text-fuchsia-400' },
    { icon: Award, label: 'Rewards', path: '/rewards', color: 'text-purple-400' },
    { icon: Book, label: 'Reading', path: '/reading', color: 'text-sky-400' },
    { icon: Settings, label: 'Settings', path: '/settings', color: 'text-slate-400' },
  ], []);

  // HomeHub role: restricted to only Hub + shared family screens
  const homehubMenuItems = useMemo(() => [
    { icon: Sparkles, label: 'Home Hub', path: '/hub', color: 'text-indigo-400' },
    { icon: Calendar, label: 'Calendar', path: '/calendar', color: 'text-emerald-400' },
    { icon: MessageCircle, label: 'Chat', path: '/chat', color: 'text-pink-400' },
    { icon: LayoutDashboard, label: 'Wall', path: '/family-wall', color: 'text-rose-400' },
    { icon: ShoppingCart, label: 'Shopping', path: '/shopping', color: 'text-orange-400' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', color: 'text-yellow-400' },
    { icon: Utensils, label: 'Dinner', path: '/dinner', color: 'text-amber-400' },
    { icon: Package, label: 'Pantry', path: '/pantry', color: 'text-green-400' },
    { icon: Award, label: 'Rewards', path: '/rewards', color: 'text-purple-400' },
  ], []);

  const menuItems = user?.role === 'homehub' 
    ? homehubMenuItems 
    : user?.role === 'parent' 
      ? parentMenuItems 
      : childMenuItems;

  // Sidebar width for margin calculation: 64px collapsed, 256px expanded
  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64';

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav user={user} currentPath={location.pathname} onNavigate={handleNavigate} />

      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden backdrop-blur-xl bg-slate-900/90 border border-white/10 text-white p-3 rounded-2xl shadow-lg hover:bg-slate-800 transition-all active:scale-95"
        data-testid="mobile-menu-toggle"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar - Always visible on desktop, slide on mobile */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 ${sidebarWidth} backdrop-blur-2xl bg-slate-950/95 border-r border-white/10 transition-all duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className={`p-3 border-b border-white/10 ${isCollapsed ? 'px-2' : ''}`}>
            <div className="flex items-center justify-between">
              {!isCollapsed && (
                <div className="flex items-center gap-2">
                  <img 
                    src="https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/2ku9mapg_app_logo.png.png"
                    alt="FamFocus Hub"
                    className="w-9 h-9 rounded-lg object-contain"
                  />
                  <h1 className="text-base font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">FamFocus</h1>
                </div>
              )}
              <div className={`flex items-center gap-1 ${isCollapsed ? 'w-full justify-center' : ''}`}>
                {!isCollapsed && (
                  <NotificationBell user={user} />
                )}
                <button 
                  onClick={handleCollapse} 
                  className={`p-2 hover:bg-white/5 rounded-xl transition-all ${isCollapsed ? 'mx-auto' : ''}`} 
                  data-testid="collapse-toggle"
                  title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronLeft className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
            </div>
          </div>

          {/* User Info - Only show when expanded */}
          {!isCollapsed && (
            <div className="p-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-white shadow-lg">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-slate-400 capitalize">{user?.role || 'Member'}</p>
                </div>
              </div>
            </div>
          )}

          {/* User Avatar - Collapsed mode */}
          {isCollapsed && (
            <div className="p-2 border-b border-white/10 flex justify-center">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-white shadow-lg">
                {user?.name?.charAt(0) || 'U'}
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isHovered = hoveredItem === item.path;
              
              return (
                <div key={item.path} className="relative">
                  <button
                    onClick={() => handleNavigate(item.path)}
                    onMouseEnter={() => setHoveredItem(item.path)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`w-full flex items-center gap-3 rounded-xl transition-all mb-0.5 ${
                      isCollapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'
                    } ${
                      isActive ? 'bg-primary/20 text-primary' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary' : item.color}`} />
                    {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                  </button>
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && isHovered && (
                    <NavTooltip label={item.label} visible={true} />
                  )}
                </div>
              );
            })}
          </nav>

          {/* Logout */}
          <div className={`p-2 border-t border-white/10 ${isCollapsed ? 'flex justify-center' : ''}`}>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all ${
                isCollapsed ? 'p-2.5 justify-center' : 'w-full px-3 py-2.5'
              }`}
              data-testid="logout-btn"
              title={isCollapsed ? 'Logout' : undefined}
            >
              <LogOut className="w-5 h-5" />
              {!isCollapsed && <span className="font-medium text-sm">Logout</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
