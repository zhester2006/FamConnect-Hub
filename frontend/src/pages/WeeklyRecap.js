import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Star, Calendar, ShoppingCart, TrendingUp, Crown, Flame, Award } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function StatCard({ icon, value, label }) {
  const Icon = icon;
  return (
    <div className="glass-card rounded-xl p-4 text-center">
      <Icon className="w-6 h-6 text-green-400 mx-auto mb-1" />
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function MemberRow({ member, index }) {
  const isTop = index === 0 && member.points_earned > 0;
  const rankColor = index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : 'text-slate-500';
  
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${isTop ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-slate-800/50'}`}>
      <span className={`text-lg font-black w-8 ${rankColor}`}>#{index + 1}</span>
      <div className="flex-1">
        <p className="text-white font-bold">{member.name}</p>
        <p className="text-xs text-slate-400">{member.chores_completed} chores | {member.total_points} total pts</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-black text-accent">+{member.points_earned}</p>
        <p className="text-[10px] text-slate-500">this week</p>
      </div>
    </div>
  );
}

function StreakRow({ streak }) {
  const hasStreak = streak.current_streak > 0;
  const badge = streak.badge;
  
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
      <div className="flex-1">
        <p className="text-white font-bold">{streak.name}</p>
        <p className="text-xs text-slate-400">Best: {streak.longest_streak} days | Total: {streak.total_completed}</p>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1">
          <Flame className={`w-4 h-4 ${hasStreak ? 'text-orange-400' : 'text-slate-600'}`} />
          <span className="text-lg font-black text-white">{streak.current_streak}</span>
        </div>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.color}`}>
            {badge.name}
          </span>
        )}
      </div>
    </div>
  );
}

export default function WeeklyRecap({ user }) {
  const [recap, setRecap] = useState(null);
  const [streaks, setStreaks] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('dev_session_token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(BACKEND_URL + '/api/weekly-recap', { credentials: 'include', headers: getHeaders() }),
      fetch(BACKEND_URL + '/api/streaks', { credentials: 'include', headers: getHeaders() })
    ]).then(results => Promise.all(results.map(r => r.json())))
      .then(data => { setRecap(data[0]); setStreaks(data[1].streaks || []); })
      .catch(() => {});
  }, [getHeaders]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const memberStats = recap ? (recap.member_stats || []) : [];
  const mvp = recap ? recap.mvp : null;

  return (
    <div className="flex h-screen relative">
      <div className="fixed inset-0 bg-gradient-to-br from-yellow-900/20 via-slate-950 to-orange-900/20 pointer-events-none" />
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <main className={`flex-1 overflow-y-auto transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <div className="p-4 pt-16 md:pt-4 lg:p-6 lg:pt-6 pb-24 md:pb-6 space-y-4" data-testid="weekly-recap-page">
          <header>
            <h1 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" /> Weekly Recap
            </h1>
            {recap && <p className="text-sm text-slate-400">{formatDate(recap.week_start)} - {formatDate(recap.week_end)}</p>}
          </header>

          {recap ? (
            <div className="space-y-4">
              {mvp && (
                <div className="glass-card rounded-2xl p-5 border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 text-center" data-testid="mvp-banner">
                  <Crown className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
                  <h2 className="text-lg font-black text-yellow-400">MVP of the Week</h2>
                  <p className="text-2xl font-black text-white mt-1">{mvp.name}</p>
                  <p className="text-sm text-yellow-300 mt-1">{mvp.points_earned} points | {mvp.chores_completed} chores</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={TrendingUp} value={recap.total_points_earned} label="Points Earned" />
                <StatCard icon={Star} value={recap.total_chores_completed} label="Chores Done" />
                <StatCard icon={Calendar} value={recap.total_events} label="Events" />
                <StatCard icon={ShoppingCart} value={recap.shopping_items_count} label="Shopping" />
              </div>

              <div className="glass-card rounded-2xl p-4">
                <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-accent" /> Leaderboard
                </h3>
                <div className="space-y-2">
                  {memberStats.map((m, idx) => <MemberRow key={m.user_id} member={m} index={idx} />)}
                </div>
              </div>

              {streaks.length > 0 && (
                <div className="glass-card rounded-2xl p-4">
                  <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-400" /> Chore Streaks
                  </h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {streaks.map(s => <StreakRow key={s.user_id} streak={s} />)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Loading weekly recap...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
