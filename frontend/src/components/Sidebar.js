import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Calendar, MessageCircle, Users, ShoppingCart, Award, 
  Settings, LogOut, Utensils, Trophy, Book, MapPin, Menu, X,
  LayoutDashboard, Sparkles
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Sidebar({ user, isOpen, setIsOpen }) {
  const navigate = useNavigate();
  const location = useLocation();

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
    { icon: Users, label: 'Family Management', path: '/family', color: 'text-secondary' },
    { icon: Calendar, label: 'Calendar', path: '/calendar', color: 'text-accent' },
    { icon: MessageCircle, label: 'Live Chat', path: '/chat', color: 'text-green-400' },
    { icon: LayoutDashboard, label: 'Family Wall', path: '/family-wall', color: 'text-pink-400' },
    { icon: ShoppingCart, label: 'Shopping List', path: '/shopping', color: 'text-blue-400' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', color: 'text-yellow-400' },
    { icon: Utensils, label: 'Dinner Planner', path: '/dinner', color: 'text-orange-400' },
    { icon: Award, label: 'Rewards Shop', path: '/rewards', color: 'text-purple-400' },
    { icon: Book, label: 'Reading Logs', path: '/reading', color: 'text-cyan-400' },
    { icon: MapPin, label: 'Check-ins', path: '/checkins', color: 'text-red-400' },
    { icon: Sparkles, label: 'Home Hub', path: '/hub', color: 'text-indigo-400' },
    { icon: Settings, label: 'Settings', path: '/settings', color: 'text-slate-400' },
  ];

  const childMenuItems = [
    { icon: Home, label: 'My Space', path: '/space', color: 'text-primary' },
    { icon: Calendar, label: 'Calendar', path: '/calendar', color: 'text-accent' },
    { icon: MessageCircle, label: 'Live Chat', path: '/chat', color: 'text-green-400' },
    { icon: LayoutDashboard, label: 'Family Wall', path: '/family-wall', color: 'text-pink-400' },
    { icon: ShoppingCart, label: 'Shopping List', path: '/shopping', color: 'text-blue-400' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', color: 'text-yellow-400' },
    { icon: Award, label: 'Rewards Shop', path: '/rewards', color: 'text-purple-400' },
    { icon: Book, label: 'Reading Log', path: '/reading', color: 'text-cyan-400' },
    { icon: Settings, label: 'Settings', path: '/settings', color: 'text-slate-400' },
  ];

  const menuItems = user?.role === 'parent' ? parentMenuItems : childMenuItems;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white p-3 rounded-full shadow-lg hover:bg-slate-800 transition-all"
        data-testid="mobile-menu-toggle"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full z-50 glass-card border-r border-white/10 backdrop-blur-2xl bg-slate-950/95 transition-transform duration-300 w-72 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-black gradient-text">FamFocus Hub</h1>
                <p className="text-xs text-slate-400">Cosmic Explorer</p>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-lg font-black text-white">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role || 'Member'}</p>
              </div>
            </div>
            {user?.role === 'child' && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">Points:</span>
                <span className="text-accent font-bold">{user?.points || 0}</span>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
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
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-primary/20 border border-primary/50 text-primary shadow-lg'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white border border-transparent'
                  }`}
                  data-testid={`sidebar-${item.label.toLowerCase().replace(/ /g, '-')}`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : item.color}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800 space-y-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all"
              data-testid="sidebar-logout"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Logout</span>
            </button>
            <div className="text-center text-xs text-slate-500 pt-2">
              <p>FamFocus Hub v1.0</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
