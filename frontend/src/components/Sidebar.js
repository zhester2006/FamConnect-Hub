import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Calendar, MessageCircle, Users, ShoppingCart, Award, 
  Settings, LogOut, Utensils, Trophy, Book, MapPin, Menu, X,
  LayoutDashboard, Sparkles, ChevronLeft, ChevronRight
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Sidebar({ user, isOpen, setIsOpen, collapsed, setCollapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(collapsed || false);

  const handleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (setCollapsed) setCollapsed(newState);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const parentMenuItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard', color: 'text-primary' },
    { icon: Sparkles, label: 'Home Hub', path: '/hub', color: 'text-indigo-400' },
    { icon: Users, label: 'Family', path: '/family', color: 'text-secondary' },
    { icon: Calendar, label: 'Calendar', path: '/calendar', color: 'text-accent' },
    { icon: MessageCircle, label: 'Chat', path: '/chat', color: 'text-green-400' },
    { icon: LayoutDashboard, label: 'Wall', path: '/family-wall', color: 'text-pink-400' },
    { icon: ShoppingCart, label: 'Shopping', path: '/shopping', color: 'text-blue-400' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', color: 'text-yellow-400' },
    { icon: Utensils, label: 'Dinner', path: '/dinner', color: 'text-orange-400' },
    { icon: Award, label: 'Rewards', path: '/rewards', color: 'text-purple-400' },
    { icon: Book, label: 'Reading', path: '/reading', color: 'text-cyan-400' },
    { icon: MapPin, label: 'Location', path: '/checkins', color: 'text-red-400' },
    { icon: Settings, label: 'Settings', path: '/settings', color: 'text-slate-400' },
  ];

  const childMenuItems = [
    { icon: Home, label: 'My Space', path: '/space', color: 'text-primary' },
    { icon: Sparkles, label: 'Home Hub', path: '/hub', color: 'text-indigo-400' },
    { icon: Calendar, label: 'Calendar', path: '/calendar', color: 'text-accent' },
    { icon: MessageCircle, label: 'Chat', path: '/chat', color: 'text-green-400' },
    { icon: LayoutDashboard, label: 'Wall', path: '/family-wall', color: 'text-pink-400' },
    { icon: ShoppingCart, label: 'Shopping', path: '/shopping', color: 'text-blue-400' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', color: 'text-yellow-400' },
    { icon: Award, label: 'Rewards', path: '/rewards', color: 'text-purple-400' },
    { icon: Book, label: 'Reading', path: '/reading', color: 'text-cyan-400' },
    { icon: Settings, label: 'Settings', path: '/settings', color: 'text-slate-400' },
  ];

  const menuItems = user?.role === 'parent' ? parentMenuItems : childMenuItems;

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white p-3 rounded-full shadow-lg hover:bg-slate-800 transition-all"
        data-testid="mobile-menu-toggle"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 glass-card border-r border-white/10 backdrop-blur-2xl bg-slate-950/95 transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-64'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className={`p-4 border-b border-slate-800 ${isCollapsed ? 'px-2' : ''}`}>
            <div className="flex items-center justify-between">
              {!isCollapsed && (
                <div className="flex items-center space-x-2">
                  <img 
                    src="https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/2ku9mapg_app_logo.png.png"
                    alt="FamFocus Hub"
                    className="w-10 h-10 rounded-lg object-contain"
                  />
                  <div>
                    <h1 className="text-lg font-black gradient-text">FamFocus</h1>
                  </div>
                </div>
              )}
              {isCollapsed && (
                <img 
                  src="https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/2ku9mapg_app_logo.png.png"
                  alt="FamFocus Hub"
                  className="w-10 h-10 rounded-lg object-contain mx-auto"
                />
              )}
              {/* Collapse Toggle - Desktop Only */}
              <button
                onClick={handleCollapse}
                className="hidden lg:flex p-1.5 hover:bg-slate-800 rounded-lg transition-all"
                data-testid="collapse-toggle"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* User Info */}
          {!isCollapsed && (
            <div className="p-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-sm font-black text-white">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-slate-400 capitalize">{user?.role || 'Member'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-hide">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} space-x-2 px-3 py-2.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-primary/20 border border-primary/50 text-primary'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white border border-transparent'
                  }`}
                  title={isCollapsed ? item.label : ''}
                  data-testid={`sidebar-${item.label.toLowerCase().replace(/ /g, '-')}`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary' : item.color}`} />
                  {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-2 border-t border-slate-800">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} space-x-2 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all`}
              title={isCollapsed ? 'Logout' : ''}
              data-testid="sidebar-logout"
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
