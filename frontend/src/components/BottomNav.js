import React from 'react';
import { Home, Calendar, MessageCircle, Users, ShoppingCart, Award, Settings, LogOut, Utensils } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function BottomNav({ userRole = 'parent' }) {
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

  const parentNavItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { icon: Users, label: 'Family', path: '/family' },
    { icon: MessageCircle, label: 'Chat', path: '/chat' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const childNavItems = [
    { icon: Home, label: 'My Space', path: '/space' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { icon: MessageCircle, label: 'Chat', path: '/chat' },
    { icon: Award, label: 'Rewards', path: '/rewards' },
  ];

  const navItems = userRole === 'parent' ? parentNavItems : childNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50" data-testid="bottom-navigation">
      <div className="glass-card border-t border-white/10 backdrop-blur-2xl bg-slate-950/90">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${
                  isActive
                    ? 'text-primary'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center flex-1 h-full text-red-400 hover:text-red-300 transition-all"
            data-testid="nav-logout"
          >
            <LogOut className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}