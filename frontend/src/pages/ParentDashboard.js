import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, Clock, AlertCircle, TrendingUp, Calendar as CalendarIcon, MapPin, Eye, Book, Award, Settings, X, ChevronRight, ToggleLeft, ToggleRight, Sparkles, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ParentDashboard({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stats, setStats] = useState({
    pendingApprovals: 0,
    choresCompleted: 0,
    totalChores: 0,
    upcomingEvents: 0
  });
  const [pendingItems, setPendingItems] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childDetails, setChildDetails] = useState(null);
  const [childChoreSettings, setChildChoreSettings] = useState(null);
  
  // AI Scheduler state
  const [showAiScheduler, setShowAiScheduler] = useState(false);
  const [aiScheduleLoading, setAiScheduleLoading] = useState(false);
  const [aiSchedule, setAiSchedule] = useState('');
  const [schedulePreferences, setSchedulePreferences] = useState('');
  const [scheduleDays, setScheduleDays] = useState(7);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [choresRes, shoppingRes, eventsRes, membersRes, readingRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/chores`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/shopping`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/events`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/family/members`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/reading-logs`, { credentials: 'include' })
      ]);

      const chores = await choresRes.json();
      const shopping = await shoppingRes.json();
      const events = await eventsRes.json();
      const members = await membersRes.json();
      const readingLogs = await readingRes.json();

      const today = new Date().toISOString().split('T')[0];
      const completedChores = (chores.chores || []).filter(c => c.status === 'approved').length;
      const pendingChores = (chores.chores || []).filter(c => c.status === 'completed');
      const pendingShopping = (shopping.items || []).filter(i => i.status === 'pending');
      const pendingReadingLogs = (readingLogs.logs || []).filter(l => l.status === 'pending');
      const todaysEvents = (events.events || []).filter(e => e.event_date === today);

      setStats({
        pendingApprovals: pendingChores.length + pendingShopping.length + pendingReadingLogs.length,
        choresCompleted: completedChores,
        totalChores: (chores.chores || []).length,
        upcomingEvents: todaysEvents.length
      });

      setPendingItems([
        ...pendingChores.map(c => ({ ...c, type: 'chore' })),
        ...pendingShopping.map(s => ({ ...s, type: 'shopping' })),
        ...pendingReadingLogs.map(l => ({ ...l, type: 'reading' }))
      ]);
      setFamilyMembers(members.members || []);
      setTodayEvents(todaysEvents);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const fetchChildDetails = async (child) => {
    setSelectedChild(child);
    try {
      const [choresRes, readingRes, settingsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/chores`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/reading-logs?child_id=${child.user_id}`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/chores/child-settings/${child.user_id}`, { credentials: 'include' })
      ]);

      const chores = await choresRes.json();
      const readingLogs = await readingRes.json();
      const settings = await settingsRes.json();

      const childChores = (chores.chores || []).filter(c => c.assigned_to === child.user_id);
      
      setChildDetails({
        chores: childChores,
        readingLogs: readingLogs.logs || [],
        completedChores: childChores.filter(c => c.status === 'approved').length,
        pendingChores: childChores.filter(c => c.status === 'pending' || c.status === 'completed').length
      });
      setChildChoreSettings(settings);
    } catch (error) {
      console.error('Failed to fetch child details:', error);
    }
  };

  const handleApproval = async (item, approved) => {
    try {
      let endpoint = '';
      let body = {};

      if (item.type === 'chore') {
        endpoint = `${BACKEND_URL}/api/chores/${item.chore_id}/approve`;
        body = { approved };
      } else if (item.type === 'shopping') {
        endpoint = `${BACKEND_URL}/api/shopping/${item.item_id}`;
        body = { status: approved ? 'approved' : 'rejected' };
      } else if (item.type === 'reading') {
        endpoint = `${BACKEND_URL}/api/reading-logs/${item.log_id}/approve`;
        body = { approved };
      }

      await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      toast.success(approved ? 'Approved!' : 'Denied');
      fetchDashboardData();
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const handleToggleChoreExclusion = async (choreName, currentlyExcluded) => {
    if (!selectedChild) return;
    
    try {
      await fetch(`${BACKEND_URL}/api/chores/exclude-child`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          child_id: selectedChild.user_id,
          chore_name: choreName,
          exclude: !currentlyExcluded
        })
      });
      
      toast.success(`${selectedChild.name} ${!currentlyExcluded ? 'excluded from' : 'included in'} ${choreName}`);
      fetchChildDetails(selectedChild);
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleRequestCheckin = (childId) => {
    toast.info('Check-in request sent!');
  };

  const children = familyMembers.filter(m => m.role === 'child');

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-6 space-y-4">
          <header>
            <h1 className="text-2xl lg:text-3xl font-black text-white">Hello, {user?.name?.split(' ')[0]}!</h1>
            <p className="text-sm text-slate-400">Here's what's happening with your family today</p>
          </header>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="glass-card rounded-xl p-4" data-testid="stat-pending">
              <div className="flex items-center justify-between mb-1">
                <AlertCircle className="w-5 h-5 text-accent" />
                <span className="text-2xl font-black text-white">{stats.pendingApprovals}</span>
              </div>
              <p className="text-xs text-slate-400">Pending Approvals</p>
            </div>

            <div className="glass-card rounded-xl p-4" data-testid="stat-completed">
              <div className="flex items-center justify-between mb-1">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-2xl font-black text-white">{stats.choresCompleted}</span>
              </div>
              <p className="text-xs text-slate-400">Chores Done</p>
            </div>

            <div className="glass-card rounded-xl p-4" data-testid="stat-events">
              <div className="flex items-center justify-between mb-1">
                <CalendarIcon className="w-5 h-5 text-secondary" />
                <span className="text-2xl font-black text-white">{stats.upcomingEvents}</span>
              </div>
              <p className="text-xs text-slate-400">Today's Events</p>
            </div>

            <div className="glass-card rounded-xl p-4" data-testid="stat-progress">
              <div className="flex items-center justify-between mb-1">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="text-2xl font-black text-white">
                  {stats.totalChores > 0 ? Math.round((stats.choresCompleted / stats.totalChores) * 100) : 0}%
                </span>
              </div>
              <p className="text-xs text-slate-400">Progress</p>
            </div>
          </div>

          {/* Children Overview */}
          {children.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary" />
                <span>Children</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {children.map((child) => (
                  <div key={child.user_id} className="glass-card rounded-xl p-4" data-testid="child-card">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg font-black text-white">
                            {child.name?.charAt(0)}
                          </div>
                          {child.online_status && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 border-2 border-slate-950 rounded-full" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-white">{child.name}</h3>
                          <p className="text-accent font-bold text-sm">{child.points || 0} pts</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => fetchChildDetails(child)}
                        className="flex-1 bg-primary hover:bg-primary/80 text-white px-3 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center space-x-1"
                        data-testid="view-space-button"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Details</span>
                      </button>
                      <button
                        onClick={() => handleRequestCheckin(child.user_id)}
                        className="flex-1 bg-secondary hover:bg-secondary/80 text-white px-3 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center space-x-1"
                        data-testid="checkin-button"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Check-in</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Approvals */}
          {pendingItems.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Clock className="w-5 h-5 text-accent" />
                <span>Pending Approvals</span>
              </h2>
              <div className="space-y-2">
                {pendingItems.slice(0, 5).map((item, index) => (
                  <div key={item.chore_id || item.item_id || item.log_id || index} className="glass-card rounded-xl p-3" data-testid="pending-item">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          {item.type === 'chore' && <CheckCircle className="w-4 h-4 text-green-400" />}
                          {item.type === 'shopping' && <AlertCircle className="w-4 h-4 text-blue-400" />}
                          {item.type === 'reading' && <Book className="w-4 h-4 text-cyan-400" />}
                          <span className="text-[10px] text-slate-500 uppercase">{item.type}</span>
                        </div>
                        <h3 className="font-bold text-white text-sm truncate">{item.title || item.name || item.book_name}</h3>
                        {item.summary && <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{item.summary}</p>}
                        <p className="text-xs text-slate-500 mt-1">
                          {item.user_name || item.completed_by || item.requested_by}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleApproval(item, true)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-full text-xs transition-all"
                        data-testid="approve-button"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproval(item, false)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-full text-xs transition-all"
                        data-testid="deny-button"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Child Details Modal */}
      {selectedChild && childDetails && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg font-black text-white">
                  {selectedChild.name?.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">{selectedChild.name}</h2>
                  <p className="text-accent text-sm font-bold">{selectedChild.points || 0} points</p>
                </div>
              </div>
              <button onClick={() => { setSelectedChild(null); setChildDetails(null); }} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <CheckCircle className="w-4 h-4 text-green-400 mb-1" />
                <p className="text-lg font-black text-white">{childDetails.completedChores}</p>
                <p className="text-xs text-slate-400">Chores Done</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                <Clock className="w-4 h-4 text-yellow-400 mb-1" />
                <p className="text-lg font-black text-white">{childDetails.pendingChores}</p>
                <p className="text-xs text-slate-400">Pending</p>
              </div>
            </div>

            {/* Recent Chores */}
            <div className="mb-4">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
                <Award className="w-4 h-4 text-green-400" />
                <span>Recent Chores</span>
              </h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {childDetails.chores.slice(0, 5).map(chore => (
                  <div key={chore.chore_id} className="bg-slate-800/50 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-white text-xs truncate flex-1">{chore.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      chore.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      chore.status === 'completed' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>{chore.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reading Logs */}
            <div className="mb-4">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
                <Book className="w-4 h-4 text-cyan-400" />
                <span>Reading Logs</span>
              </h3>
              {childDetails.readingLogs.length === 0 ? (
                <p className="text-slate-500 text-xs">No reading logs yet</p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {childDetails.readingLogs.slice(0, 5).map(log => (
                    <div key={log.log_id} className="bg-slate-800/50 rounded-lg p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-xs font-bold truncate">{log.book_name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          log.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          log.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>{log.status}</span>
                      </div>
                      <p className="text-slate-400 text-[10px] line-clamp-2">{log.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chore Settings */}
            {childChoreSettings && (
              <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Chore Settings</span>
                </h3>
                <p className="text-xs text-slate-500 mb-2">Toggle which chores this child can be assigned to:</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {childChoreSettings.available_chores?.map(chore => {
                    const isExcluded = childChoreSettings.excluded_chores?.includes(chore.name);
                    return (
                      <div key={chore.name} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-2">
                        <span className="text-white text-xs">{chore.name}</span>
                        <button
                          onClick={() => handleToggleChoreExclusion(chore.name, isExcluded)}
                          className={`flex items-center space-x-1 px-2 py-1 rounded-full text-[10px] font-bold transition-all ${
                            isExcluded 
                              ? 'bg-red-500/20 text-red-400' 
                              : 'bg-green-500/20 text-green-400'
                          }`}
                          data-testid={`toggle-${chore.name}`}
                        >
                          {isExcluded ? (
                            <>
                              <ToggleLeft className="w-3 h-3" />
                              <span>Excluded</span>
                            </>
                          ) : (
                            <>
                              <ToggleRight className="w-3 h-3" />
                              <span>Included</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
