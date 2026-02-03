import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, Clock, AlertCircle, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import RoleManager from '@/components/RoleManager';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ParentDashboard({ user }) {
  const [stats, setStats] = useState({
    pendingApprovals: 0,
    choresCompleted: 0,
    totalChores: 0,
    upcomingEvents: 0
  });
  const [pendingItems, setPendingItems] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [choresRes, shoppingRes, eventsRes, membersRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/chores`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/shopping`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/events`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/family/members`, { credentials: 'include' })
      ]);

      const chores = await choresRes.json();
      const shopping = await shoppingRes.json();
      const events = await eventsRes.json();
      const members = await membersRes.json();

      const today = new Date().toISOString().split('T')[0];
      const completedChores = chores.chores.filter(c => c.status === 'approved').length;
      const pendingChores = chores.chores.filter(c => c.status === 'completed');
      const pendingShopping = shopping.items.filter(i => i.status === 'pending');
      const todaysEvents = events.events.filter(e => e.event_date === today);

      setStats({
        pendingApprovals: pendingChores.length + pendingShopping.length,
        choresCompleted: completedChores,
        totalChores: chores.chores.length,
        upcomingEvents: todaysEvents.length
      });

      setPendingItems([...pendingChores, ...pendingShopping]);
      setFamilyMembers(members.members);
      setTodayEvents(todaysEvents);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const handleApproval = async (item, approved) => {
    try {
      const endpoint = item.chore_id 
        ? `${BACKEND_URL}/api/chores/${item.chore_id}/approve`
        : `${BACKEND_URL}/api/shopping/${item.item_id}`;
      
      await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(approved ? { approved: true, status: 'approved' } : { status: 'approved' })
      });

      fetchDashboardData();
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-24" data-testid="parent-dashboard">
      <div className="p-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-black text-white">Hello, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-slate-400">Here's what's happening with your family today</p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card rounded-2xl p-4 space-y-2" data-testid="stat-pending">
            <div className="flex items-center justify-between">
              <AlertCircle className="w-5 h-5 text-accent" />
              <span className="text-2xl font-black text-white">{stats.pendingApprovals}</span>
            </div>
            <p className="text-sm text-slate-400">Pending Approvals</p>
          </div>

          <div className="glass-card rounded-2xl p-4 space-y-2" data-testid="stat-completed">
            <div className="flex items-center justify-between">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-2xl font-black text-white">{stats.choresCompleted}</span>
            </div>
            <p className="text-sm text-slate-400">Chores Done</p>
          </div>

          <div className="glass-card rounded-2xl p-4 space-y-2" data-testid="stat-events">
            <div className="flex items-center justify-between">
              <CalendarIcon className="w-5 h-5 text-secondary" />
              <span className="text-2xl font-black text-white">{stats.upcomingEvents}</span>
            </div>
            <p className="text-sm text-slate-400">Today's Events</p>
          </div>

          <div className="glass-card rounded-2xl p-4 space-y-2" data-testid="stat-progress">
            <div className="flex items-center justify-between">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-2xl font-black text-white">
                {stats.totalChores > 0 ? Math.round((stats.choresCompleted / stats.totalChores) * 100) : 0}%
              </span>
            </div>
            <p className="text-sm text-slate-400">Progress</p>
          </div>
        </div>

        {pendingItems.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <Clock className="w-5 h-5 text-accent" />
              <span>Pending Approvals</span>
            </h2>
            <div className="space-y-3">
              {pendingItems.map((item) => (
                <div key={item.chore_id || item.item_id} className="glass-card rounded-2xl p-4" data-testid="pending-item">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-white">{item.title || item.name}</h3>
                      <p className="text-sm text-slate-400 mt-1">
                        {item.chore_id ? `Completed by ${item.completed_by}` : `Requested by ${item.requested_by}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleApproval(item, true)}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full transition-all"
                      data-testid="approve-button"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleApproval(item, false)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full transition-all"
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

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-primary" />
            <span>Family Members</span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {familyMembers.map((member) => (
              <div key={member.user_id} className="glass-card rounded-2xl p-4 text-center" data-testid="family-member">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary mx-auto mb-2 flex items-center justify-center text-2xl font-black text-white">
                  {member.name.charAt(0)}
                </div>
                <h3 className="font-bold text-white text-sm">{member.name}</h3>
                <p className="text-xs text-slate-400 capitalize">{member.role}</p>
                {member.role === 'child' && (
                  <p className="text-accent font-bold mt-1">{member.points || 0} pts</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <BottomNav userRole="parent" />
    </div>
  );
}