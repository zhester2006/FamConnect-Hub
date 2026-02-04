import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Calendar, MessageCircle, Users, ShoppingCart, Award, 
  Settings, LogOut, Utensils, Trophy, Book, MapPin, Menu, X,
  LayoutDashboard, Sparkles, ChevronLeft, ChevronRight, Move, GripVertical, BarChart3
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Sidebar({ user, isOpen, setIsOpen, collapsed, setCollapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(collapsed || false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const dragRef = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const dragStartTime = useRef(0);

  // Load saved position and floating state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-position');
    const savedFloating = localStorage.getItem('sidebar-floating');
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        // Validate position is within viewport
        const maxX = window.innerWidth - 64;
        const maxY = window.innerHeight - 64;
        setPosition({
          x: Math.min(Math.max(0, pos.x), maxX),
          y: Math.min(Math.max(0, pos.y), maxY)
        });
      } catch (e) {
        setPosition({ x: 0, y: 0 });
      }
    }
    if (savedFloating === 'true') {
      setIsFloating(true);
    }
  }, []);

  // Auto-float when collapsed
  useEffect(() => {
    if (isCollapsed && !isFloating) {
      // When collapsed, automatically enable floating for better UX
      setIsFloating(true);
      localStorage.setItem('sidebar-floating', 'true');
    }
  }, [isCollapsed]);

  const handleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (setCollapsed) setCollapsed(newState);
    
    // When expanding, dock the sidebar
    if (!newState) {
      setIsFloating(false);
      setPosition({ x: 0, y: 0 });
      localStorage.setItem('sidebar-floating', 'false');
      localStorage.removeItem('sidebar-position');
    }
  };

  const toggleFloating = () => {
    const newFloating = !isFloating;
    setIsFloating(newFloating);
    localStorage.setItem('sidebar-floating', newFloating.toString());
    if (!newFloating) {
      setPosition({ x: 0, y: 0 });
      localStorage.removeItem('sidebar-position');
    }
  };

  // Calculate constrained position
  const constrainPosition = useCallback((x, y) => {
    const sidebarWidth = isCollapsed ? 64 : 256;
    const sidebarHeight = isCollapsed ? (showMenu ? 400 : 64) : window.innerHeight * 0.9;
    const maxX = window.innerWidth - sidebarWidth;
    const maxY = window.innerHeight - sidebarHeight;
    
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY))
    };
  }, [isCollapsed, showMenu]);

  // Mouse/Touch event handlers
  const handleDragStart = (e) => {
    if (!isFloating) return;
    
    e.preventDefault();
    setIsDragging(true);
    dragStartTime.current = Date.now();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    startPos.current = {
      x: clientX - position.x,
      y: clientY - position.y
    };
  };

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
      
      // If it was a quick tap (not drag), toggle menu on collapsed sidebar
      const dragDuration = Date.now() - dragStartTime.current;
      if (dragDuration < 200 && isCollapsed) {
        setShowMenu(prev => !prev);
      }
    }
    setIsDragging(false);
  }, [isDragging, isFloating, position, isCollapsed]);

  // Add/remove event listeners
  useEffect(() => {
    if (isDragging) {
      const handleMove = (e) => handleDragMove(e);
      const handleEnd = () => handleDragEnd();
      
      // Mouse events
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      
      // Touch events
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

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (isFloating) {
        setPosition(prev => constrainPosition(prev.x, prev.y));
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFloating, constrainPosition]);

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
    { icon: GripVertical, label: 'Chore Scheduler', path: '/chore-scheduler', color: 'text-teal-400' },
    { icon: MessageCircle, label: 'Chat', path: '/chat', color: 'text-green-400' },
    { icon: LayoutDashboard, label: 'Wall', path: '/family-wall', color: 'text-pink-400' },
    { icon: ShoppingCart, label: 'Shopping', path: '/shopping', color: 'text-blue-400' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', color: 'text-yellow-400' },
    { icon: Utensils, label: 'Dinner', path: '/dinner', color: 'text-orange-400' },
    { icon: Award, label: 'Rewards', path: '/rewards', color: 'text-purple-400' },
    { icon: Book, label: 'Reading', path: '/reading', color: 'text-cyan-400' },
    { icon: MapPin, label: 'Location', path: '/checkins', color: 'text-red-400' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics', color: 'text-emerald-400' },
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

  // Floating collapsed menu (draggable pill)
  if (isCollapsed && isFloating) {
    return (
      <>
        {/* Mobile Menu Toggle - Hidden when floating collapsed */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-4 left-4 z-50 lg:hidden bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white p-3 rounded-full shadow-lg hover:bg-slate-800 transition-all"
          data-testid="mobile-menu-toggle"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Floating Collapsed Pill */}
        <div
          ref={dragRef}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: 60,
            touchAction: 'none',
          }}
          className={`select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          data-testid="floating-sidebar"
        >
          {/* Main Pill Button */}
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onClick={() => !isDragging && setShowMenu(prev => !prev)}
            className={`w-14 h-14 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl flex items-center justify-center transition-all hover:scale-105 hover:border-primary/50 ${
              showMenu ? 'ring-2 ring-primary' : ''
            }`}
          >
            <img 
              src="https://customer-assets.emergentagent.com/job_homebridge-5/artifacts/2ku9mapg_app_logo.png.png"
              alt="FamFocus"
              className="w-8 h-8 rounded-lg object-contain pointer-events-none"
              draggable={false}
            />
          </div>

          {/* Expanded Menu */}
          {showMenu && (
            <div 
              className="absolute left-0 top-16 w-56 bg-slate-900/98 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
              style={{ maxHeight: 'calc(100vh - 100px)' }}
            >
              {/* User Info */}
              <div className="p-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-xs font-black text-white">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-slate-400 capitalize">{user?.role || 'Member'}</p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <nav className="p-2 max-h-[50vh] overflow-y-auto scrollbar-hide">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setShowMenu(false);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-xl transition-all ${
                        isActive
                          ? 'bg-primary/20 border border-primary/50 text-primary'
                          : 'text-slate-300 hover:bg-slate-800/50 hover:text-white border border-transparent'
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
              <div className="p-2 border-t border-slate-800 flex gap-1">
                <button
                  onClick={handleCollapse}
                  className="flex-1 flex items-center justify-center space-x-1 px-2 py-2 rounded-lg text-slate-400 hover:bg-slate-800 transition-all"
                  title="Expand sidebar"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-xs">Expand</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center space-x-1 px-2 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                  data-testid="floating-logout"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-xs">Logout</span>
                </button>
              </div>
            </div>
          )}

          {/* Drag Indicator */}
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
            <div className="w-1 h-1 rounded-full bg-slate-600"></div>
            <div className="w-1 h-1 rounded-full bg-slate-600"></div>
            <div className="w-1 h-1 rounded-full bg-slate-600"></div>
          </div>
        </div>
      </>
    );
  }

  // Regular Sidebar (expanded or docked)
  const sidebarStyle = isFloating ? {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 60,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
  } : {};

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
        ref={dragRef}
        style={sidebarStyle}
        className={`${isFloating ? '' : 'fixed top-0 left-0'} h-full z-50 glass-card border-r border-white/10 backdrop-blur-2xl bg-slate-950/95 transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-64'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${
          isFloating ? 'rounded-2xl max-h-[90vh] overflow-hidden' : ''
        }`}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Header with Drag Handle */}
          <div className={`p-4 border-b border-slate-800 ${isCollapsed ? 'px-2' : ''}`}>
            {/* Drag Handle - Only visible when floating */}
            {isFloating && (
              <div 
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                className={`flex items-center justify-center mb-2 py-1 rounded-lg transition-all ${
                  isDragging ? 'bg-primary/20 cursor-grabbing' : 'hover:bg-slate-800 cursor-grab'
                }`}
              >
                <GripVertical className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-500 ml-1">Drag to move</span>
              </div>
            )}
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
              <div className="flex items-center space-x-1">
                {/* Float Toggle - visible on lg+ screens */}
                <button
                  onClick={toggleFloating}
                  className={`hidden lg:block p-1.5 rounded-lg transition-all ${isFloating ? 'bg-primary/20 text-primary' : 'hover:bg-slate-800 text-slate-400'}`}
                  title={isFloating ? 'Dock sidebar' : 'Float sidebar'}
                  data-testid="float-toggle"
                >
                  <Move className="w-4 h-4" />
                </button>
                {/* Collapse Toggle - now visible on all screen sizes */}
                <button
                  onClick={handleCollapse}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition-all"
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
