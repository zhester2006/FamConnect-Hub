import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { 
  Home, Calendar, MessageCircle, Users, ShoppingCart, Award, 
  Settings, LogOut, Utensils, Trophy, Book, MapPin, Menu, X,
  LayoutDashboard, Sparkles, ChevronLeft, ChevronRight, Move, GripVertical, BarChart3
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Haptic feedback utility
const triggerHaptic = (type = 'light') => {
  // Web Vibration API
  if ('vibrate' in navigator) {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate([30, 10, 30]);
        break;
      case 'success':
        navigator.vibrate([10, 50, 20]);
        break;
      default:
        navigator.vibrate(10);
    }
  }
};

// Mobile Bottom Navigation Component with swipe gestures and haptic feedback
function MobileBottomNav({ user, currentPath, onNavigate }) {
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const swipeThreshold = 50;

  const navItems = user?.role === 'parent' ? [
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
  ];

  const currentIndex = navItems.findIndex(item => item.path === currentPath);

  const navigateWithHaptic = useCallback((path) => {
    triggerHaptic('light');
    onNavigate(path);
  }, [onNavigate]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0 && currentIndex < navItems.length - 1) {
        // Swipe left - go to next tab
        triggerHaptic('medium');
        onNavigate(navItems[currentIndex + 1].path);
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - go to previous tab
        triggerHaptic('medium');
        onNavigate(navItems[currentIndex - 1].path);
      }
    }
  };

  // Add global touch listeners for swipe detection
  useEffect(() => {
    const handleGlobalTouchStart = (e) => {
      // Only track swipes that start in the bottom 150px of the screen
      if (window.innerHeight - e.touches[0].clientY < 150) {
        touchStartX.current = e.touches[0].clientX;
      }
    };
    
    const handleGlobalTouchMove = (e) => {
      if (touchStartX.current) {
        touchEndX.current = e.touches[0].clientX;
      }
    };
    
    const handleGlobalTouchEnd = () => {
      if (touchStartX.current && touchEndX.current) {
        const diff = touchStartX.current - touchEndX.current;
        
        if (Math.abs(diff) > swipeThreshold) {
          triggerHaptic('medium');
          if (diff > 0 && currentIndex < navItems.length - 1) {
            onNavigate(navItems[currentIndex + 1].path);
          } else if (diff < 0 && currentIndex > 0) {
            onNavigate(navItems[currentIndex - 1].path);
          }
        }
      }
      touchStartX.current = 0;
      touchEndX.current = 0;
    };

    document.addEventListener('touchstart', handleGlobalTouchStart, { passive: true });
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
    document.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleGlobalTouchStart);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [currentIndex, navItems, onNavigate]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="backdrop-blur-2xl bg-slate-950/90 border-t border-white/10 px-2 py-2 safe-area-bottom">
        {/* Swipe indicator dots */}
        <div className="flex justify-center gap-1 mb-1">
          {navItems.map((item, index) => (
            <div
              key={item.path}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                index === currentIndex ? 'bg-primary w-3' : 'bg-slate-600'
              }`}
            />
          ))}
        </div>
        
        <div 
          className="flex items-center justify-around max-w-lg mx-auto"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigateWithHaptic(item.path)}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                  isActive 
                    ? 'text-primary bg-primary/10' 
                    : 'text-slate-400 hover:text-white active:scale-95'
                }`}
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// Dropdown Menu Content Component - defined outside
function DropdownMenuContent({ 
  user, 
  menuItems, 
  currentPath, 
  onNavigate, 
  onCollapse, 
  onLogout
}) {
  return (
    <div 
      className="w-60 backdrop-blur-2xl bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      style={{ maxHeight: 'calc(100vh - 120px)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* User Info */}
      <div className="p-4 border-b border-white/10 bg-gradient-to-r from-primary/10 to-transparent">
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

      {/* Menu Items */}
      <nav className="p-2 max-h-[45vh] overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive
                  ? 'bg-primary/20 text-primary'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
              data-testid={`floating-menu-${item.label.toLowerCase().replace(/ /g, '-')}`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : item.color}`} />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-2 border-t border-white/10 flex gap-2">
        <button
          onClick={onCollapse}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
          <span className="text-xs font-medium">Expand</span>
        </button>
        <button
          onClick={onLogout}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
          data-testid="floating-logout"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}

// Dropdown Portal Component
function DropdownPortal({ children, isOpen, position }) {
  if (!isOpen) return null;
  
  return createPortal(
    <div 
      className="fixed z-[9999]"
      style={{ 
        left: position.x, 
        top: position.y + 60,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

export default function Sidebar({ user, isOpen, setIsOpen, collapsed, setCollapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(collapsed || false);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const dragRef = useRef(null);
  const menuRef = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const dragStartTime = useRef(0);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showMenu && menuRef.current && !menuRef.current.contains(e.target) && 
          dragRef.current && !dragRef.current.contains(e.target)) {
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

  // Load saved position and floating state on mount only
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-position');
    const savedFloating = localStorage.getItem('sidebar-floating');
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        const maxX = window.innerWidth - 64;
        const maxY = window.innerHeight - 64;
        // Use functional update to avoid triggering re-render warnings
        setPosition({
          x: Math.min(Math.max(16, pos.x), maxX),
          y: Math.min(Math.max(16, pos.y), maxY)
        });
      } catch {
        // Keep default position
      }
    }
    if (savedFloating === 'true') {
      setIsFloating(true);
    }
  }, []); // Empty deps - only run on mount

  const handleCollapse = useCallback(() => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (setCollapsed) setCollapsed(newState);
    setShowMenu(false);
    
    if (!newState) {
      setIsFloating(false);
      setPosition({ x: 16, y: 16 });
      localStorage.setItem('sidebar-floating', 'false');
      localStorage.removeItem('sidebar-position');
    } else {
      // Auto-float when collapsed on desktop
      if (window.innerWidth >= 1024) {
        setIsFloating(true);
        localStorage.setItem('sidebar-floating', 'true');
      }
    }
  }, [isCollapsed, setCollapsed]);

  const toggleFloating = useCallback(() => {
    const newFloating = !isFloating;
    setIsFloating(newFloating);
    localStorage.setItem('sidebar-floating', newFloating.toString());
    if (!newFloating) {
      setPosition({ x: 16, y: 16 });
      localStorage.removeItem('sidebar-position');
    }
  }, [isFloating]);

  const constrainPosition = useCallback((x, y) => {
    const maxX = window.innerWidth - 70;
    const maxY = window.innerHeight - 70;
    return {
      x: Math.max(8, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY))
    };
  }, []);

  const handleDragStart = useCallback((e) => {
    if (!isFloating) return;
    // Don't prevent default for click handling
    e.stopPropagation();
    setIsDragging(true);
    dragStartTime.current = Date.now();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    startPos.current = {
      x: clientX - position.x,
      y: clientY - position.y
    };
  }, [isFloating, position]);

  const handleDragMove = useCallback((e) => {
    if (!isDragging || !isFloating) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const newX = clientX - startPos.current.x;
    const newY = clientY - startPos.current.y;
    
    const constrained = constrainPosition(newX, newY);
    setPosition(constrained);
  }, [isDragging, isFloating, constrainPosition]);

  const handleDragEnd = useCallback(() => {
    if (isDragging && isFloating) {
      localStorage.setItem('sidebar-position', JSON.stringify(position));
      const dragDuration = Date.now() - dragStartTime.current;
      if (dragDuration < 200 && isCollapsed) {
        setShowMenu(prev => !prev);
      }
    }
    setIsDragging(false);
  }, [isDragging, isFloating, position, isCollapsed]);

  useEffect(() => {
    if (isDragging) {
      const handleMove = (e) => handleDragMove(e);
      const handleEnd = () => handleDragEnd();
      
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    const handleResize = () => {
      if (isFloating) {
        setPosition(prev => constrainPosition(prev.x, prev.y));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFloating, constrainPosition]);

  const handleLogout = useCallback(async () => {
    try {
      localStorage.removeItem('dev_session_token');
      localStorage.removeItem('dev_user');
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
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

  // Floating collapsed pill (desktop only when collapsed)
  if (isCollapsed && isFloating) {
    return (
      <>
        {/* Mobile Bottom Navigation */}
        <MobileBottomNav user={user} currentPath={location.pathname} onNavigate={handleNavigate} />

        {/* Floating Pill Container */}
        <div
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: 100,
          }}
          className="hidden md:block"
          data-testid="floating-sidebar"
        >
          {/* Drag Handle - visible on hover */}
          <div 
            ref={dragRef}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className={`absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-4 rounded-full bg-slate-800/80 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity ${isDragging ? 'opacity-100 cursor-grabbing' : 'cursor-grab'}`}
            style={{ touchAction: 'none' }}
          >
            <GripVertical className="w-3 h-3 text-slate-400" />
          </div>

          {/* Main Pill Button */}
          <button
            type="button"
            onClick={() => setShowMenu(prev => !prev)}
            className={`w-14 h-14 rounded-2xl backdrop-blur-xl bg-slate-900/90 border border-white/10 shadow-2xl flex items-center justify-center transition-all hover:scale-105 hover:border-primary/30 hover:shadow-primary/20 ${
              showMenu ? 'ring-2 ring-primary/50 border-primary/30' : ''
            }`}
            data-testid="floating-pill-btn"
          >
            <img 
              src="https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/2ku9mapg_app_logo.png.png"
              alt="FamFocus"
              className="w-8 h-8 rounded-lg object-contain pointer-events-none"
              draggable={false}
            />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div 
              className="absolute left-0 top-16"
              ref={menuRef}
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

  // Regular Sidebar (expanded)
  const sidebarStyle = isFloating ? {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 100,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
  } : {};

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
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={dragRef}
        style={sidebarStyle}
        className={`${isFloating ? '' : 'fixed top-0 left-0'} h-full z-50 backdrop-blur-2xl bg-slate-950/95 border-r border-white/10 transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${
          isFloating ? 'rounded-2xl max-h-[90vh] overflow-hidden shadow-2xl' : ''
        }`}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className={`p-4 border-b border-white/10 ${isCollapsed ? 'px-3' : ''}`}>
            {isFloating && (
              <div 
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                className={`flex items-center justify-center mb-3 py-1.5 rounded-lg transition-all ${
                  isDragging ? 'bg-primary/20 cursor-grabbing' : 'hover:bg-white/5 cursor-grab'
                }`}
              >
                <GripVertical className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-500 ml-1">Drag</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              {!isCollapsed && (
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
              )}
              {isCollapsed && (
                <img 
                  src="https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/2ku9mapg_app_logo.png.png"
                  alt="FamFocus Hub"
                  className="w-10 h-10 rounded-xl object-contain mx-auto"
                />
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleFloating}
                  className={`hidden md:flex p-2 rounded-xl transition-all ${isFloating ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-slate-400'}`}
                  title={isFloating ? 'Dock sidebar' : 'Float sidebar'}
                  data-testid="float-toggle"
                >
                  <Move className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCollapse}
                  className="p-2 hover:bg-white/5 rounded-xl transition-all"
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
          </div>

          {/* User Info */}
          {!isCollapsed && (
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
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-primary/20 text-primary'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
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
          <div className="p-2 border-t border-white/10">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all`}
              title={isCollapsed ? 'Logout' : ''}
              data-testid="sidebar-logout"
            >
              <LogOut className="w-5 h-5" />
              {!isCollapsed && <span className="font-medium text-sm">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Spacer for content when sidebar is docked on desktop */}
      {!isFloating && !isCollapsed && (
        <div className="hidden md:block w-64 flex-shrink-0" />
      )}
    </>
  );
}
