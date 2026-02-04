import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Calendar, MessageCircle, Users, ShoppingCart, Award, 
  Settings, LogOut, Utensils, Trophy, Book, MapPin, Menu, X,
  LayoutDashboard, Sparkles, ChevronLeft, ChevronRight, GripVertical, BarChart3, Bell
} from 'lucide-react';

import NotificationContext from '../context/NotificationContext';

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
  const navItems = useMemo(() => user?.role === 'parent' ? [
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { icon: MessageCircle, label: 'Chat', path: '/chat' },
    { icon: LayoutDashboard, label: 'Wall', path: '/family-wall' },
    { icon: Settings, label: 'More', path: '/settings' },
  ] : [
    { icon: Home, label: 'Space', path: '/space' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { icon: MessageCircle, label: 'Chat', path: '/chat' },
    { icon: Trophy, label: 'Rewards', path: '/rewards' },
    { icon: Settings, label: 'More', path: '/settings' },
  ], [user?.role]);

  const navigateWithHaptic = useCallback((path) => {
    triggerHaptic('light');
    onNavigate(path);
  }, [onNavigate]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-bottom">
      <div className="mx-3 mb-3">
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

// Dropdown Menu Content (Fixed position, no overlap)
function DropdownMenuContent({ user, menuItems, currentPath, onNavigate, onCollapse, onLogout }) {
  return (
    <div className="w-56 backdrop-blur-2xl bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
      {/* User Info */}
      <div className="p-3 border-b border-white/10 bg-gradient-to-r from-primary/10 to-secondary/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role || 'Member'}</p>
          </div>
        </div>
      </div>

      {/* Menu Items - Scrollable */}
      <nav className="p-2 max-h-[50vh] overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                isActive ? 'bg-primary/20 text-primary' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : item.color}`} />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-2 border-t border-white/10 flex gap-2">
        <button onClick={onCollapse} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-all">
          <ChevronRight className="w-4 h-4" />
          <span className="text-xs font-medium">Expand</span>
        </button>
        <button onClick={onLogout} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all">
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ user, isOpen, setIsOpen, collapsed, setCollapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(collapsed || false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  
  const notificationContext = useContext(NotificationContext);
  const unreadCount = notificationContext?.unreadCount || 0;
  const setShowNotificationPanel = notificationContext?.setShowNotificationPanel;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showMenu && 
          menuRef.current && !menuRef.current.contains(e.target) && 
          buttonRef.current && !buttonRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMenu]);

  // Close menu on route change
  useEffect(() => {
    setShowMenu(false);
  }, [location.pathname]);

  const handleCollapse = useCallback(() => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (setCollapsed) setCollapsed(newState);
    setShowMenu(false);
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
    setShowMenu(false);
    setIsOpen(false);
  }, [navigate, setIsOpen]);

  const parentMenuItems = useMemo(() => [
    { icon: Home, label: 'Dashboard', path: '/dashboard', color: 'text-blue-400' },
    { icon: Sparkles, label: 'Home Hub', path: '/hub', color: 'text-indigo-400' },
    { icon: Users, label: 'Family', path: '/family', color: 'text-cyan-400' },
    { icon: Calendar, label: 'Calendar', path: '/calendar', color: 'text-emerald-400' },
    { icon: GripVertical, label: 'Chore Scheduler', path: '/chore-scheduler', color: 'text-teal-400' },
    { icon: MessageCircle, label: 'Chat', path: '/chat', color: 'text-pink-400' },
    { icon: LayoutDashboard, label: 'Wall', path: '/family-wall', color: 'text-rose-400' },
    { icon: ShoppingCart, label: 'Shopping', path: '/shopping', color: 'text-orange-400' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', color: 'text-yellow-400' },
    { icon: Utensils, label: 'Dinner', path: '/dinner', color: 'text-amber-400' },
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
    { icon: MessageCircle, label: 'Chat', path: '/chat', color: 'text-pink-400' },
    { icon: LayoutDashboard, label: 'Wall', path: '/family-wall', color: 'text-rose-400' },
    { icon: ShoppingCart, label: 'Shopping', path: '/shopping', color: 'text-orange-400' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', color: 'text-yellow-400' },
    { icon: Award, label: 'Rewards', path: '/rewards', color: 'text-purple-400' },
    { icon: Book, label: 'Reading', path: '/reading', color: 'text-sky-400' },
    { icon: Settings, label: 'Settings', path: '/settings', color: 'text-slate-400' },
  ], []);

  const menuItems = user?.role === 'parent' ? parentMenuItems : childMenuItems;

  // Collapsed state - show fixed menu button at top-left
  if (isCollapsed) {
    return (
      <>
        {/* Mobile Bottom Navigation */}
        <MobileBottomNav user={user} currentPath={location.pathname} onNavigate={handleNavigate} />

        {/* Fixed Menu Button - Top Left, Never Moves */}
        <div className="fixed left-4 top-4 z-[100] hidden md:block" data-testid="floating-sidebar">
          {/* Menu Button */}
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setShowMenu(prev => !prev)}
            className={`w-11 h-11 rounded-xl backdrop-blur-xl bg-slate-900/95 border border-white/10 shadow-lg flex items-center justify-center transition-all hover:scale-105 hover:border-primary/30 ${
              showMenu ? 'ring-2 ring-primary/50 border-primary/30' : ''
            }`}
            data-testid="floating-pill-btn"
          >
            {showMenu ? <X className="w-5 h-5 text-slate-300" /> : <Menu className="w-5 h-5 text-slate-300" />}
          </button>

          {/* Dropdown Menu - Positioned below button with gap */}
          {showMenu && (
            <div 
              ref={menuRef}
              className="absolute left-0 top-14"
              data-testid="floating-dropdown-menu"
            >
              <DropdownMenuContent 
                user={user}
                menuItems={menuItems}
                currentPath={location.pathname}
                onNavigate={handleNavigate}
                onCollapse={handleCollapse}
                onLogout={handleLogout}
              />
            </div>
          )}
        </div>
      </>
    );
  }

  // Expanded Sidebar
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

      {/* Full Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 w-64 backdrop-blur-2xl bg-slate-950/95 border-r border-white/10 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img 
                  src="https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/2ku9mapg_app_logo.png.png"
                  alt="FamFocus Hub"
                  className="w-10 h-10 rounded-xl object-contain"
                />
                <div>
                  <h1 className="text-lg font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">FamFocus</h1>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {setShowNotificationPanel && (
                  <button
                    onClick={() => setShowNotificationPanel(prev => !prev)}
                    className="relative p-2 hover:bg-white/5 rounded-xl transition-all"
                    data-testid="notification-bell"
                    title="Notifications"
                  >
                    <Bell className="w-4 h-4 text-slate-400" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                )}
                <button onClick={handleCollapse} className="p-2 hover:bg-white/5 rounded-xl transition-all" data-testid="collapse-toggle">
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-white shadow-lg">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role || 'Member'}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all mb-0.5 ${
                    isActive ? 'bg-primary/20 text-primary' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary' : item.color}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-3 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
