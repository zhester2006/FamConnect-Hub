import React, { useState, useEffect } from 'react';
import { Trophy, Star, Award, TrendingUp, Crown } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Leaderboard({ user }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeframe, setTimeframe] = useState('all-time');

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/leaderboard`, { credentials: 'include' });
      const data = await res.json();
      setLeaderboard(data.leaderboard);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  };

  const getRankBadge = (index) => {
    if (index === 0) return { bg: 'bg-gradient-to-br from-yellow-400 to-yellow-600', icon: '🥇', text: 'Champion' };
    if (index === 1) return { bg: 'bg-gradient-to-br from-slate-300 to-slate-500', icon: '🥈', text: 'Runner-up' };
    if (index === 2) return { bg: 'bg-gradient-to-br from-orange-600 to-orange-800', icon: '🥉', text: 'Third Place' };
    return { bg: 'bg-slate-800', icon: `#${index + 1}`, text: `Rank ${index + 1}` };
  };

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto lg:ml-72">
        <div className="p-6 lg:p-8 space-y-6 pb-24 lg:pb-8">
          <header className="glass-card rounded-3xl p-6 lg:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-2">
                <Trophy className="w-8 h-8 text-accent" />
                <h1 className="text-3xl lg:text-4xl font-black text-white">Leaderboard</h1>
              </div>
              <p className="text-slate-400">See who's leading the pack this week!</p>
            </div>
          </header>

          <div className="flex items-center space-x-2">
            {['all-time', 'this-week', 'this-month'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  timeframe === tf
                    ? 'bg-primary text-white neon-glow'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                data-testid={`timeframe-${tf}`}
              >
                {tf.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </button>
            ))}
          </div>

          {leaderboard.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">No rankings yet</p>
              <p className="text-slate-500 text-sm mt-2">Complete chores to earn points and climb the leaderboard!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaderboard.map((child, index) => {
                const rankInfo = getRankBadge(index);
                const isCurrentUser = child.user_id === user?.user_id;
                
                return (
                  <div
                    key={child.user_id}
                    className={`glass-card rounded-2xl p-6 transition-all hover:-translate-y-1 ${
                      isCurrentUser ? 'border-2 border-primary shadow-xl' : ''
                    }`}
                    data-testid={`leaderboard-rank-${index + 1}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-16 h-16 rounded-full ${rankInfo.bg} flex items-center justify-center text-2xl font-black text-white shadow-lg flex-shrink-0`}>
                        {rankInfo.icon}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-black text-white text-xl">{child.name}</h3>
                          {isCurrentUser && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">You</span>
                          )}
                          {index === 0 && <Crown className="w-5 h-5 text-accent animate-float" />}
                        </div>
                        <p className="text-sm text-slate-400">{rankInfo.text}</p>
                        
                        <div className="flex items-center space-x-4 mt-3">
                          <div className="flex items-center space-x-2">
                            <Star className="w-5 h-5 text-accent" />
                            <span className="font-bold text-accent text-lg">{child.points}</span>
                            <span className="text-sm text-slate-400">points</span>
                          </div>
                          
                          {child.badges && child.badges.length > 0 && (
                            <div className="flex items-center space-x-2">
                              <Award className="w-5 h-5 text-secondary" />
                              <span className="font-bold text-secondary">{child.badges.length}</span>
                              <span className="text-sm text-slate-400">badges</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {index < 3 && (
                        <div className="hidden lg:block">
                          <div className="text-right">
                            <div className="text-3xl font-black text-white mb-1">#{index + 1}</div>
                            <TrendingUp className="w-6 h-6 text-green-400 mx-auto" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">How Points Work</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">5</span>
                </div>
                <div>
                  <p className="font-medium text-white">Simple Chores</p>
                  <p className="text-slate-400 text-xs">Quick tasks like feeding pets, watering plants</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-secondary font-bold">10</span>
                </div>
                <div>
                  <p className="font-medium text-white">Regular Chores</p>
                  <p className="text-slate-400 text-xs">Standard tasks like dishes, taking out trash</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent font-bold">20</span>
                </div>
                <div>
                  <p className="font-medium text-white">Big Chores</p>
                  <p className="text-slate-400 text-xs">Larger tasks like vacuuming, yard work</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}