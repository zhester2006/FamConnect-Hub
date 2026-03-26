import React, { useState, useEffect } from 'react';
import { Award, Star, Gift, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function RewardsShop({ user }) {
  const [rewards, setRewards] = useState([]);
  const [userPoints, setUserPoints] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddReward, setShowAddReward] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [newReward, setNewReward] = useState({ name: '', description: '', points_required: 100 });

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
      setRewards(data.rewards || []);
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
    }
  };

  const handleAddReward = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BACKEND_URL}/api/rewards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newReward)
      });
      toast.success('Reward added!');
      setShowAddReward(false);
      setNewReward({ name: '', description: '', points_required: 100 });
      fetchRewards();
    } catch (error) {
      toast.error('Failed to add reward');
    }
  };

  const handleUpdateReward = async (rewardId) => {
    try {
      await fetch(`${BACKEND_URL}/api/rewards/${rewardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editingReward.name,
          description: editingReward.description,
          points_required: editingReward.points_required
        })
      });
      toast.success('Reward updated!');
      setEditingReward(null);
      fetchRewards();
    } catch (error) {
      toast.error('Failed to update reward');
    }
  };

  const handleDeleteReward = async (rewardId) => {
    if (!window.confirm('Are you sure you want to delete this reward?')) return;
    try {
      await fetch(`${BACKEND_URL}/api/rewards/${rewardId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      toast.success('Reward deleted!');
      fetchRewards();
    } catch (error) {
      toast.error('Failed to delete reward');
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
      toast.error('Failed to redeem reward');
    }
  };

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <div className="p-4 pt-16 md:pt-4 lg:p-6 lg:pt-6 pb-24 md:pb-6 space-y-4" data-testid="rewards-shop">
          <header className="glass-card rounded-2xl p-4 lg:p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h1 className="text-xl lg:text-2xl font-black text-white">Rewards Shop</h1>
                <p className="text-sm text-slate-400">
                  {user?.role === 'parent' ? 'Manage rewards for your family' : 'Spend your points on amazing rewards!'}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5 text-accent" />
                  <span className="text-2xl font-black text-white">{userPoints}</span>
                </div>
                <p className="text-xs text-slate-400">{user?.role === 'parent' ? 'Family Points Pool' : 'Your Points'}</p>
              </div>
            </div>
          </header>

          {/* Parent Controls */}
          {user?.role === 'parent' && (
            <button
              onClick={() => setShowAddReward(true)}
              className="w-full bg-primary hover:bg-primary/80 text-white px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-2"
              data-testid="add-reward-btn"
            >
              <Plus className="w-5 h-5" />
              <span>Add New Reward</span>
            </button>
          )}

          {/* Rewards List */}
          <div className="grid grid-cols-1 gap-3">
            {rewards.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <Gift className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No rewards available yet</p>
                {user?.role === 'parent' ? (
                  <p className="text-sm text-slate-500 mt-2">Add rewards for your children to earn!</p>
                ) : (
                  <p className="text-sm text-slate-500 mt-2">Ask a parent to add rewards!</p>
                )}
              </div>
            ) : (
              rewards.map(reward => {
                const canAfford = userPoints >= reward.points_required;
                const isEditing = editingReward?.reward_id === reward.reward_id;
                
                return (
                  <div key={reward.reward_id} className="glass-card rounded-xl p-4" data-testid="reward-item">
                    {isEditing ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editingReward.name}
                          onChange={(e) => setEditingReward({...editingReward, name: e.target.value})}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm"
                          placeholder="Reward name"
                        />
                        <input
                          type="text"
                          value={editingReward.description}
                          onChange={(e) => setEditingReward({...editingReward, description: e.target.value})}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm"
                          placeholder="Description"
                        />
                        <div className="flex items-center space-x-2">
                          <label className="text-xs text-slate-400">Points:</label>
                          <input
                            type="number"
                            value={editingReward.points_required}
                            onChange={(e) => setEditingReward({...editingReward, points_required: parseInt(e.target.value)})}
                            className="w-24 bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm"
                            min="1"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUpdateReward(reward.reward_id)}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center space-x-1"
                          >
                            <Save className="w-4 h-4" />
                            <span>Save</span>
                          </button>
                          <button
                            onClick={() => setEditingReward(null)}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start space-x-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-secondary flex items-center justify-center flex-shrink-0">
                          <Gift className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white truncate">{reward.name}</h3>
                          {reward.description && (
                            <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">{reward.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center space-x-1">
                              <Star className="w-4 h-4 text-accent" />
                              <span className="font-bold text-accent text-sm">{reward.points_required} pts</span>
                            </div>
                            
                            {user?.role === 'parent' ? (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setEditingReward(reward)}
                                  className="p-2 hover:bg-slate-800 rounded-lg transition-all"
                                  data-testid="edit-reward-btn"
                                >
                                  <Edit2 className="w-4 h-4 text-slate-400" />
                                </button>
                                <button
                                  onClick={() => handleDeleteReward(reward.reward_id)}
                                  className="p-2 hover:bg-red-500/20 rounded-lg transition-all"
                                  data-testid="delete-reward-btn"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRedeem(reward.reward_id, reward.points_required)}
                                disabled={!canAfford}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                  canAfford
                                    ? 'bg-primary hover:bg-primary/80 text-white'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                                data-testid="redeem-button"
                              >
                                {canAfford ? 'Redeem' : 'Need More'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Add Reward Modal */}
      {showAddReward && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-5 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white">Add Reward</h2>
              <button onClick={() => setShowAddReward(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddReward} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Reward Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Extra Screen Time"
                  value={newReward.name}
                  onChange={(e) => setNewReward({...newReward, name: e.target.value})}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <input
                  type="text"
                  placeholder="What do they get?"
                  value={newReward.description}
                  onChange={(e) => setNewReward({...newReward, description: e.target.value})}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Points Required *</label>
                <input
                  type="number"
                  value={newReward.points_required}
                  onChange={(e) => setNewReward({...newReward, points_required: parseInt(e.target.value)})}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm"
                  min="1"
                  required
                />
              </div>
              <button type="submit" className="w-full bg-accent hover:bg-accent/80 text-slate-950 font-bold py-3 rounded-full transition-all">
                Add Reward
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
