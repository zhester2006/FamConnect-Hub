import React, { useState, useEffect } from 'react';
import { Trophy, Star, Award, TrendingUp, CheckCircle, Clock, Book, Sparkles, Send } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ChildSpace({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chores, setChores] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(0);
  const [showReadingLog, setShowReadingLog] = useState(false);
  const [readingLogs, setReadingLogs] = useState([]);
  const [readingData, setReadingData] = useState({
    book_name: '',
    pages_read: '',
    summary: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchChildData();
  }, []);

  const fetchChildData = async () => {
    try {
      const [choresRes, leaderboardRes, logsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/chores`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/leaderboard`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/reading-logs`, { credentials: 'include' })
      ]);

      const choresData = await choresRes.json();
      const leaderboardData = await leaderboardRes.json();
      const logsData = await logsRes.json();

      // Filter chores for current user
      const userChores = (choresData.chores || []).filter(c => c.assigned_to === user?.user_id);
      setChores(userChores);
      setLeaderboard(leaderboardData.leaderboard || []);
      setReadingLogs(logsData.logs || []);
      
      const rank = (leaderboardData.leaderboard || []).findIndex(child => child.user_id === user?.user_id) + 1;
      setUserRank(rank);
    } catch (error) {
      console.error('Failed to fetch child data:', error);
    }
  };

  const handleCompleteChore = async (choreId) => {
    try {
      await fetch(`${BACKEND_URL}/api/chores/${choreId}/complete`, {
        method: 'PUT',
        credentials: 'include'
      });
      toast.success('Chore marked complete! Waiting for approval.');
      fetchChildData();
    } catch (error) {
      toast.error('Failed to complete chore');
    }
  };

  const handleSubmitReading = async (e) => {
    e.preventDefault();
    if (!readingData.book_name || !readingData.summary) {
      toast.error('Please fill in book title and summary');
      return;
    }
    
    try {
      await fetch(`${BACKEND_URL}/api/reading-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(readingData)
      });
      toast.success('Reading log submitted for approval!');
      setShowReadingLog(false);
      setReadingData({ book_name: '', pages_read: '', summary: '', date: new Date().toISOString().split('T')[0] });
      fetchChildData();
    } catch (error) {
      toast.error('Failed to submit reading log');
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const todayChores = chores.filter(c => c.scheduled_date === today);
  const pendingChores = todayChores.filter(c => c.status === 'pending');
  const completedChores = todayChores.filter(c => c.status === 'completed' || c.status === 'approved');

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto lg:ml-72">
        <div className="p-4 lg:p-6 space-y-4" data-testid="child-space">
          {/* Header with Stats */}
          <header className="glass-card rounded-2xl p-4 lg:p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-xl lg:text-2xl font-black text-white">{user?.name}'s Space</h1>
                  <p className="text-sm text-slate-400">Keep up the great work!</p>
                </div>
                {userRank === 1 && (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-yellow-400 flex items-center justify-center animate-float shadow-lg shadow-accent/30" data-testid="rank-badge">
                    <span className="text-2xl">👑</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-primary/10 backdrop-blur-sm rounded-xl p-3 border border-primary/20">
                  <TrendingUp className="w-5 h-5 text-primary mb-1" />
                  <p className="text-xl font-black text-white">{user?.points || 0}</p>
                  <p className="text-xs text-slate-400">Points</p>
                </div>
                <div className="bg-accent/10 backdrop-blur-sm rounded-xl p-3 border border-accent/20">
                  <Trophy className="w-5 h-5 text-accent mb-1" />
                  <p className="text-xl font-black text-white">#{userRank || '-'}</p>
                  <p className="text-xs text-slate-400">Rank</p>
                </div>
                <div className="bg-secondary/10 backdrop-blur-sm rounded-xl p-3 border border-secondary/20">
                  <Star className="w-5 h-5 text-secondary mb-1" />
                  <p className="text-xl font-black text-white">{user?.badges?.length || 0}</p>
                  <p className="text-xs text-slate-400">Badges</p>
                </div>
              </div>
            </div>
          </header>

          {/* Today's Chores */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Award className="w-5 h-5 text-green-400" />
                <span>Today's Missions</span>
              </h2>
              <span className="text-sm text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full">
                {completedChores.length}/{todayChores.length} done
              </span>
            </div>
            
            {todayChores.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-center">
                <Sparkles className="w-12 h-12 text-accent mx-auto mb-3 animate-float" />
                <p className="text-slate-400">No missions today! Enjoy your free time!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayChores.map((chore) => (
                  <div 
                    key={chore.chore_id} 
                    className={`glass-card rounded-xl p-4 transition-all ${
                      chore.status === 'approved' ? 'opacity-75' : ''
                    } ${chore.is_penalty ? 'border-l-4 border-red-500' : ''}`}
                    data-testid="chore-item"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-white">{chore.title}</h3>
                          {chore.is_penalty && (
                            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">MAKEUP</span>
                          )}
                        </div>
                        {chore.description && (
                          <p className="text-sm text-slate-400 mt-1">{chore.description}</p>
                        )}
                        <div className="flex items-center space-x-3 mt-2">
                          <span className="text-accent font-bold text-sm flex items-center space-x-1">
                            <Star className="w-3 h-3" />
                            <span>+{chore.points} pts</span>
                          </span>
                          {chore.status === 'completed' && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>Pending Review</span>
                            </span>
                          )}
                          {chore.status === 'approved' && (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full flex items-center space-x-1">
                              <CheckCircle className="w-3 h-3" />
                              <span>Complete!</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {chore.status === 'pending' && (
                      <button
                        onClick={() => handleCompleteChore(chore.chore_id)}
                        className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 active:scale-[0.98] text-white font-bold py-3 px-4 rounded-full transition-all shadow-lg shadow-primary/20"
                        data-testid="complete-chore-button"
                      >
                        ✓ Mark as Complete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reading Log Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Book className="w-5 h-5 text-cyan-400" />
                <span>Reading Log</span>
              </h2>
              <button
                onClick={() => setShowReadingLog(true)}
                className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-full text-sm font-bold transition-all"
                data-testid="add-reading-log-btn"
              >
                + Log Reading
              </button>
            </div>
            
            {readingLogs.length === 0 ? (
              <div className="glass-card rounded-2xl p-5 text-center">
                <Book className="w-10 h-10 text-cyan-400 mx-auto mb-2 opacity-50" />
                <p className="text-slate-400 text-sm">No reading logs yet. Start logging your reading!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {readingLogs.slice(0, 3).map((log) => (
                  <div key={log.log_id} className="glass-card rounded-xl p-3" data-testid="reading-log-item">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white text-sm truncate">{log.book_name}</h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{log.summary}</p>
                        <p className="text-xs text-slate-500 mt-1">{new Date(log.date).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ml-2 flex-shrink-0 ${
                        log.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        log.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-accent" />
              <span>Leaderboard</span>
            </h2>
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((child, index) => (
                <div
                  key={child.user_id}
                  className={`glass-card rounded-xl p-3 flex items-center justify-between transition-all ${
                    child.user_id === user?.user_id ? 'border-2 border-primary shadow-lg shadow-primary/20' : ''
                  }`}
                  data-testid="leaderboard-item"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${
                      index === 0 ? 'bg-gradient-to-br from-accent to-yellow-400 text-slate-950' :
                      index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-950' :
                      index === 2 ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">{child.name}</p>
                      <p className="text-xs text-accent font-bold">{child.points} points</p>
                    </div>
                  </div>
                  {index === 0 && <span className="text-xl">👑</span>}
                  {index === 1 && <span className="text-xl">🥈</span>}
                  {index === 2 && <span className="text-xl">🥉</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Reading Log Modal */}
      {showReadingLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-black text-white mb-4 flex items-center space-x-2">
              <Book className="w-5 h-5 text-cyan-400" />
              <span>Log Your Reading</span>
            </h2>
            <form onSubmit={handleSubmitReading} className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Book Title *</label>
                <input
                  type="text"
                  placeholder="What are you reading?"
                  value={readingData.book_name}
                  onChange={(e) => setReadingData({...readingData, book_name: e.target.value})}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                  required
                  data-testid="book-title-input"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Pages Read</label>
                <input
                  type="number"
                  placeholder="How many pages?"
                  value={readingData.pages_read}
                  onChange={(e) => setReadingData({...readingData, pages_read: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                  data-testid="pages-read-input"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Brief Summary *</label>
                <textarea
                  placeholder="What happened in your reading today?"
                  value={readingData.summary}
                  onChange={(e) => setReadingData({...readingData, summary: e.target.value})}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 h-24 resize-none"
                  required
                  data-testid="summary-input"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 rounded-full transition-all flex items-center justify-center space-x-2"
                  data-testid="submit-reading-btn"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit for Review</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowReadingLog(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-full transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
