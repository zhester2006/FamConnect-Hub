import React, { useState, useEffect } from 'react';
import { Trophy, Star, Award, TrendingUp, Crown, Filter } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ChildSpace({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto lg:ml-72">
        <div className="p-4 lg:p-6 space-y-4 lg:space-y-6" data-testid="child-space">
          <header className="glass-card rounded-2xl lg:rounded-3xl p-4 lg:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 lg:w-32 lg:h-32 bg-primary/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <div>
                  <h1 className="text-xl lg:text-2xl font-black text-white">{user?.name}'s Space</h1>
                  <p className="text-sm lg:text-base text-slate-400">Your cosmic adventure starts here!</p>
                </div>
                {userRank === 1 && (
                  <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-accent flex items-center justify-center animate-float" data-testid="rank-badge">
                    <span className="text-xl lg:text-2xl font-black text-slate-950">👑</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 lg:gap-3">
                <div className="bg-primary/10 backdrop-blur-sm rounded-xl lg:rounded-2xl p-2 lg:p-3 border border-primary/20">
                  <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-primary mb-1" />
                  <p className="text-lg lg:text-xl font-black text-white">{user?.points || 0}</p>
                  <p className="text-xs text-slate-400">Points</p>
                </div>
                <div className="bg-accent/10 backdrop-blur-sm rounded-xl lg:rounded-2xl p-2 lg:p-3 border border-accent/20">
                  <Trophy className="w-4 h-4 lg:w-5 lg:h-5 text-accent mb-1" />
                  <p className="text-lg lg:text-xl font-black text-white">#{userRank || '-'}</p>
                  <p className="text-xs text-slate-400">Rank</p>
                </div>
                <div className="bg-secondary/10 backdrop-blur-sm rounded-xl lg:rounded-2xl p-2 lg:p-3 border border-secondary/20">
                  <Star className="w-4 h-4 lg:w-5 lg:h-5 text-secondary mb-1" />
                  <p className="text-lg lg:text-xl font-black text-white">{user?.badges?.length || 0}</p>
                  <p className="text-xs text-slate-400">Badges</p>
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-3 lg:space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg lg:text-xl font-bold text-white flex items-center space-x-2">
                <Award className="w-5 h-5 text-green-400" />
                <span>Today's Missions</span>
              </h2>
              <span className="text-xs lg:text-sm text-slate-400">{todayChores.filter(c => c.status === 'approved').length}/{todayChores.length}</span>
            </div>
            
            {todayChores.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 lg:p-8 text-center">
                <Star className="w-10 h-10 lg:w-12 lg:h-12 text-accent mx-auto mb-3 animate-float" />
                <p className="text-sm lg:text-base text-slate-400">No missions for today! Enjoy your free time!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayChores.map((chore) => (
                  <div key={chore.chore_id} className="glass-card rounded-xl lg:rounded-2xl p-4" data-testid="chore-item">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-white text-base lg:text-lg">{chore.title}</h3>
                        {chore.description && (
                          <p className="text-sm text-slate-400 mt-1">{chore.description}</p>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-accent font-bold text-sm">+{chore.points} pts</span>
                          {chore.status === 'completed' && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">Pending</span>
                          )}
                          {chore.status === 'approved' && (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">Done!</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {chore.status === 'pending' && (
                      <button
                        onClick={() => handleCompleteChore(chore.chore_id)}
                        className="w-full bg-primary hover:bg-primary/80 active:scale-95 text-white font-bold py-3 px-4 rounded-full transition-all neon-glow"
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

          <div className="space-y-3 lg:space-y-4">
            <h2 className="text-lg lg:text-xl font-bold text-white flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-accent" />
              <span>Leaderboard</span>
            </h2>
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((child, index) => (
                <div
                  key={child.user_id}
                  className={`glass-card rounded-xl lg:rounded-2xl p-3 lg:p-4 flex items-center justify-between ${
                    child.user_id === user.user_id ? 'border-2 border-primary' : ''
                  }`}
                  data-testid="leaderboard-item"
                >
                  <div className="flex items-center space-x-2 lg:space-x-3">
                    <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center font-black text-sm lg:text-base ${
                      index === 0 ? 'bg-accent text-slate-950' :
                      index === 1 ? 'bg-slate-400 text-slate-950' :
                      index === 2 ? 'bg-orange-600 text-white' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm lg:text-base">{child.name}</p>
                      <p className="text-xs lg:text-sm text-accent font-bold">{child.points} points</p>
                    </div>
                  </div>
                  {index === 0 && <Trophy className="w-5 h-5 lg:w-6 lg:h-6 text-accent" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}