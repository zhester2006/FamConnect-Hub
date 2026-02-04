import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, CheckCircle, Award, Download, Calendar, Target } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Analytics({ user }) {
  const [analytics, setAnalytics] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [overviewRes, trendsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/analytics/overview`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/analytics/trends?days=30`, { credentials: 'include' })
      ]);
      
      const overviewData = await overviewRes.json();
      const trendsData = await trendsRes.json();
      
      setAnalytics(overviewData);
      setTrends(trendsData.trends || []);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/export/${type}`, { credentials: 'include' });
      const data = await res.json();
      
      // Create download
      let content = data.content;
      let mimeType = data.mime_type;
      
      if (type === 'full') {
        content = JSON.stringify(data.content, null, 2);
      }
      
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Exported ${type} data!`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const maxDailyValue = analytics?.daily_activity
    ? Math.max(...analytics.daily_activity.map(d => Math.max(d.completed, d.total)), 1)
    : 1;

  if (loading) {
    return (
      <div className="flex h-screen relative">
        <div className="fixed inset-0 bg-gradient-to-br from-teal-900/30 via-cyan-900/20 to-slate-950 pointer-events-none" />
        <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
        <main className={`flex-1 flex items-center justify-center transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen relative">
      {/* Teal/Cyan gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-teal-900/30 via-cyan-900/20 to-slate-950 pointer-events-none" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-teal-500/10 animate-float-slow"
            style={{
              width: Math.random() * 100 + 40,
              height: Math.random() * 100 + 40,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 16 + 12}s`
            }}
          />
        ))}
      </div>
      
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 overflow-y-auto transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-6 pb-24 md:pb-6 space-y-4 pb-24 lg:pb-8" data-testid="analytics-dashboard">
          {/* Header */}
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white flex items-center space-x-2">
                <BarChart3 className="w-6 h-6 text-primary" />
                <span>Family Analytics</span>
              </h1>
              <p className="text-sm text-slate-400 mt-1">Track your family's progress and activity</p>
            </div>
            
            {user?.role === 'parent' && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleExport('chores')}
                  disabled={exporting}
                  className="flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm transition-all"
                  data-testid="export-chores-btn"
                >
                  <Download className="w-4 h-4" />
                  <span>Chores CSV</span>
                </button>
                <button
                  onClick={() => handleExport('events')}
                  disabled={exporting}
                  className="flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm transition-all"
                  data-testid="export-events-btn"
                >
                  <Download className="w-4 h-4" />
                  <span>Events CSV</span>
                </button>
                <button
                  onClick={() => handleExport('full')}
                  disabled={exporting}
                  className="flex items-center space-x-2 px-3 py-2 bg-primary hover:bg-primary/80 text-white rounded-xl text-sm font-bold transition-all"
                  data-testid="export-full-btn"
                >
                  <Download className="w-4 h-4" />
                  <span>Full Export</span>
                </button>
              </div>
            )}
          </header>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs text-slate-400">This Week</span>
              </div>
              <p className="text-2xl font-black text-white">{analytics?.weekly?.completed || 0}</p>
              <p className="text-xs text-slate-500">of {analytics?.weekly?.total || 0} chores</p>
              <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${analytics?.weekly?.completion_rate || 0}%` }}
                />
              </div>
            </div>

            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-secondary" />
                </div>
                <span className="text-xs text-slate-400">This Month</span>
              </div>
              <p className="text-2xl font-black text-white">{analytics?.monthly?.completed || 0}</p>
              <p className="text-xs text-slate-500">of {analytics?.monthly?.total || 0} chores</p>
              <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-secondary rounded-full transition-all"
                  style={{ width: `${analytics?.monthly?.completion_rate || 0}%` }}
                />
              </div>
            </div>

            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-accent" />
                </div>
                <span className="text-xs text-slate-400">Family</span>
              </div>
              <p className="text-2xl font-black text-white">{analytics?.total_family_members || 0}</p>
              <p className="text-xs text-slate-500">{analytics?.total_children || 0} children</p>
            </div>

            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-xs text-slate-400">Completion Rate</span>
              </div>
              <p className="text-2xl font-black text-white">{analytics?.weekly?.completion_rate || 0}%</p>
              <p className="text-xs text-slate-500">this week</p>
            </div>
          </div>

          {/* Daily Activity Chart */}
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              <span>Daily Activity (Last 7 Days)</span>
            </h2>
            <div className="flex items-end justify-between h-32 gap-2">
              {analytics?.daily_activity?.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center justify-end h-24 gap-1">
                    <div 
                      className="w-full bg-primary/30 rounded-t transition-all"
                      style={{ height: `${(day.total / maxDailyValue) * 100}%`, minHeight: day.total ? '4px' : '0' }}
                    />
                    <div 
                      className="w-full bg-primary rounded-t transition-all -mt-1"
                      style={{ height: `${(day.completed / maxDailyValue) * 100}%`, minHeight: day.completed ? '4px' : '0' }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 mt-2">{day.day}</span>
                  <span className="text-[10px] text-slate-600">{day.completed}/{day.total}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center space-x-4 mt-4 text-xs text-slate-500">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-primary rounded" />
                <span>Completed</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-primary/30 rounded" />
                <span>Total</span>
              </div>
            </div>
          </div>

          {/* Children Performance */}
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <Award className="w-5 h-5 text-secondary" />
              <span>Children Performance (This Month)</span>
            </h2>
            <div className="space-y-4">
              {analytics?.children?.map((child, i) => (
                <div key={i} className="flex items-center space-x-4" data-testid={`child-stats-${child.user_id}`}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-black text-white flex-shrink-0">
                    {child.display_name?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white">{child.display_name}</span>
                      <span className="text-sm text-accent font-bold">{child.points_earned} pts</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all"
                          style={{ width: `${child.completion_rate}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-16 text-right">
                        {child.chores_completed}/{child.chores_total}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              
              {(!analytics?.children || analytics.children.length === 0) && (
                <p className="text-slate-500 text-center py-4">No children data available</p>
              )}
            </div>
          </div>

          {/* Weekly Trends */}
          {trends && trends.length > 0 && (
            <div className="glass-card rounded-xl p-4">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <span>Weekly Trends (Last 30 Days)</span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-left">
                      <th className="pb-3 font-medium">Week</th>
                      <th className="pb-3 font-medium text-center">Completed</th>
                      <th className="pb-3 font-medium text-center">Total</th>
                      <th className="pb-3 font-medium text-center">Points</th>
                      <th className="pb-3 font-medium text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.map((week, i) => (
                      <tr key={i} className="border-t border-slate-800">
                        <td className="py-3 text-white">{week.week}</td>
                        <td className="py-3 text-center text-green-400">{week.completed}</td>
                        <td className="py-3 text-center text-slate-400">{week.total}</td>
                        <td className="py-3 text-center text-accent font-bold">{week.points}</td>
                        <td className="py-3 text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            week.total > 0 && (week.completed / week.total) >= 0.8
                              ? 'bg-green-500/20 text-green-400'
                              : week.total > 0 && (week.completed / week.total) >= 0.5
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                          }`}>
                            {week.total > 0 ? Math.round((week.completed / week.total) * 100) : 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
