import React, { useState, useEffect } from 'react';
import { Trophy, Star, CheckCircle, Clock, TrendingUp, Award as AwardIcon, Book } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ChildSpace({ user }) {
  const [chores, setChores] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(0);
  const [showReadingLog, setShowReadingLog] = useState(false);
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
      const [choresRes, leaderboardRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/chores`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/leaderboard`, { credentials: 'include' })
      ]);

      const choresData = await choresRes.json();
      const leaderboardData = await leaderboardRes.json();

      setChores(choresData.chores.filter(c => c.assigned_to === user.user_id));
      setLeaderboard(leaderboardData.leaderboard);
      
      const rank = leaderboardData.leaderboard.findIndex(child => child.user_id === user.user_id) + 1;
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
      fetchChildData();
    } catch (error) {
      console.error('Failed to complete chore:', error);
    }
  };

  const handleSubmitReading = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BACKEND_URL}/api/reading-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(readingData)
      });
      setShowReadingLog(false);
      setReadingData({ book_name: '', pages_read: '', summary: '', date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      console.error('Failed to submit reading log:', error);
    }
  };

  const todayChores = chores.filter(c => c.scheduled_date === new Date().toISOString().split('T')[0]);

  return (
    <div className="min-h-screen bg-slate-950 pb-24" data-testid="child-space">
      <div className="p-6 space-y-6">
        <header className="glass-card rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-black text-white">{user?.name}'s Space</h1>
                <p className="text-slate-400">Your cosmic adventure starts here!</p>
              </div>
              {userRank === 1 && (
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center animate-float" data-testid="rank-badge">
                  <span className="text-2xl font-black text-slate-950">👑</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-primary/10 backdrop-blur-sm rounded-2xl p-3 border border-primary/20">
                <TrendingUp className="w-5 h-5 text-primary mb-1" />
                <p className="text-xl font-black text-white">{user?.points || 0}</p>
                <p className="text-xs text-slate-400">Points</p>
              </div>
              <div className="bg-accent/10 backdrop-blur-sm rounded-2xl p-3 border border-accent/20">
                <Trophy className="w-5 h-5 text-accent mb-1" />
                <p className="text-xl font-black text-white">#{userRank || '-'}</p>
                <p className="text-xs text-slate-400">Rank</p>
              </div>
              <div className="bg-secondary/10 backdrop-blur-sm rounded-2xl p-3 border border-secondary/20">
                <Star className="w-5 h-5 text-secondary mb-1" />
                <p className="text-xl font-black text-white">{user?.badges?.length || 0}</p>
                <p className="text-xs text-slate-400">Badges</p>
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>Today's Missions</span>
            </h2>
            <span className="text-sm text-slate-400">{todayChores.filter(c => c.status === 'approved').length}/{todayChores.length}</span>
          </div>
          
          {todayChores.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Star className="w-12 h-12 text-accent mx-auto mb-3 animate-float" />
              <p className="text-slate-400">No missions for today! Enjoy your free time!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayChores.map((chore) => (
                <div key={chore.chore_id} className="glass-card rounded-2xl p-4" data-testid="chore-item">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-white text-lg">{chore.title}</h3>
                      {chore.description && (
                        <p className="text-sm text-slate-400 mt-1">{chore.description}</p>
                      )}
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="text-accent font-bold text-sm">+{chore.points} pts</span>
                        {chore.status === 'completed' && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">Pending Approval</span>
                        )}
                        {chore.status === 'approved' && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">Completed!</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {chore.status === 'pending' && (
                    <button
                      onClick={() => handleCompleteChore(chore.chore_id)}
                      className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-3 px-4 rounded-full transition-all neon-glow"
                      data-testid="complete-chore-button"
                    >
                      Mark as Complete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-4">
          <button
            onClick={() => setShowReadingLog(!showReadingLog)}
            className="w-full flex items-center justify-between text-left"
            data-testid="reading-log-toggle"
          >
            <div className="flex items-center space-x-3">
              <Book className="w-6 h-6 text-secondary" />
              <div>
                <h3 className="font-bold text-white">Daily Reading (30 min)</h3>
                <p className="text-sm text-slate-400">Log your reading progress</p>
              </div>
            </div>
            <Clock className="w-5 h-5 text-slate-400" />
          </button>
          
          {showReadingLog && (
            <form onSubmit={handleSubmitReading} className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="Book name"
                value={readingData.book_name}
                onChange={(e) => setReadingData({...readingData, book_name: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                required
                data-testid="book-name-input"
              />
              <input
                type="number"
                placeholder="Pages read"
                value={readingData.pages_read}
                onChange={(e) => setReadingData({...readingData, pages_read: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                required
                data-testid="pages-read-input"
              />
              <textarea
                placeholder="Brief summary of what you read"
                value={readingData.summary}
                onChange={(e) => setReadingData({...readingData, summary: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 h-24 resize-none"
                required
                data-testid="summary-input"
              />
              <button
                type="submit"
                className="w-full bg-secondary hover:bg-secondary/80 text-white font-bold py-3 px-4 rounded-full transition-all"
                data-testid="submit-reading-button"
              >
                Submit Reading Log
              </button>
            </form>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-accent" />
            <span>Leaderboard</span>
          </h2>
          <div className="space-y-2">
            {leaderboard.slice(0, 5).map((child, index) => (
              <div
                key={child.user_id}
                className={`glass-card rounded-2xl p-4 flex items-center justify-between ${
                  child.user_id === user.user_id ? 'border-2 border-primary' : ''
                }`}
                data-testid="leaderboard-item"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${
                    index === 0 ? 'bg-accent text-slate-950' :
                    index === 1 ? 'bg-slate-400 text-slate-950' :
                    index === 2 ? 'bg-orange-600 text-white' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-bold text-white">{child.name}</p>
                    <p className="text-sm text-accent font-bold">{child.points} points</p>
                  </div>
                </div>
                {index === 0 && <Trophy className="w-6 h-6 text-accent" />}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <BottomNav userRole="child" />
    </div>
  );
}