import React, { useState, useEffect } from 'react';
import { Award, Star, Gift } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function RewardsShop({ user }) {
  const [rewards, setRewards] = useState([]);
  const [userPoints, setUserPoints] = useState(0);

  useEffect(() => {
    fetchRewards();
    if (user) {
      setUserPoints(user.points || 0);
    }
  }, [user]);

  const fetchRewards = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/rewards`, { credentials: 'include' });
      const data = await res.json();
      setRewards(data.rewards);
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
    }
  };

  const handleRedeem = async (rewardId, pointsRequired) => {
    if (userPoints < pointsRequired) {
      toast.error('Not enough points!');
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/rewards/${rewardId}/redeem`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Reward redeemed successfully!');
        setUserPoints(data.remaining_points);
      }
    } catch (error) {
      console.error('Failed to redeem reward:', error);
      toast.error('Failed to redeem reward');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-24" data-testid="rewards-shop">
      <div className="p-6 space-y-6">
        <header className="glass-card rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white">Rewards Shop</h1>
              <p className="text-sm text-slate-400">Spend your points on amazing rewards!</p>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2">
                <Star className="w-6 h-6 text-accent" />
                <span className="text-3xl font-black text-white">{userPoints}</span>
              </div>
              <p className="text-xs text-slate-400">Your Points</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4">
          {rewards.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Gift className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No rewards available yet</p>
              <p className="text-sm text-slate-500 mt-2">Ask a parent to add rewards!</p>
            </div>
          ) : (
            rewards.map(reward => {
              const canAfford = userPoints >= reward.points_required;
              return (
                <div key={reward.reward_id} className="glass-card rounded-2xl p-5" data-testid="reward-item">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent to-secondary flex items-center justify-center flex-shrink-0">
                      <Gift className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-white text-lg">{reward.name}</h3>
                      {reward.description && (
                        <p className="text-sm text-slate-400 mt-1">{reward.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-2">
                          <Star className="w-5 h-5 text-accent" />
                          <span className="font-bold text-accent">{reward.points_required} points</span>
                        </div>
                        {user?.role === 'child' && (
                          <button
                            onClick={() => handleRedeem(reward.reward_id, reward.points_required)}
                            disabled={!canAfford}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                              canAfford
                                ? 'bg-primary hover:bg-primary/80 text-white neon-glow'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                            data-testid="redeem-button"
                          >
                            {canAfford ? 'Redeem' : 'Not Enough Points'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      <BottomNav userRole={user?.role} />
    </div>
  );
}