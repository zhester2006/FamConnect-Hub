import React, { useState, useEffect, useCallback } from 'react';
import { Target, Plus, Check, Trash2, Edit2, X, GripVertical, Settings2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Personal Goals Component
export function PersonalGoals({ user }) {
  const [goals, setGoals] = useState([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', target: 1, type: 'custom' });
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/goals`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
      }
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleCreateGoal = async () => {
    if (!newGoal.title.trim()) {
      toast.error('Please enter a goal title');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newGoal),
      });

      if (res.ok) {
        toast.success('Goal created!');
        setShowAddGoal(false);
        setNewGoal({ title: '', description: '', target: 1, type: 'custom' });
        fetchGoals();
      }
    } catch (error) {
      toast.error('Failed to create goal');
    }
  };

  const handleIncrementGoal = async (goalId) => {
    try {
      const res = await fetch(`${API_URL}/api/goals/${goalId}/increment`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        const updatedGoal = await res.json();
        if (updatedGoal.completed) {
          toast.success('🎉 Goal completed!');
        } else {
          toast.success('+1 Progress!');
        }
        fetchGoals();
      }
    } catch (error) {
      toast.error('Failed to update goal');
    }
  };

  const handleDeleteGoal = async (goalId) => {
    try {
      await fetch(`${API_URL}/api/goals/${goalId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      toast.success('Goal deleted');
      fetchGoals();
    } catch (error) {
      toast.error('Failed to delete goal');
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-white/10 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-white/10 rounded"></div>
              <div className="h-4 bg-white/10 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-pink-400" />
          My Goals
        </h3>
        <button
          onClick={() => setShowAddGoal(true)}
          className="p-2 rounded-lg bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No personal goals yet!</p>
          <button
            onClick={() => setShowAddGoal(true)}
            className="mt-3 text-pink-400 hover:text-pink-300 text-sm"
          >
            Create your first goal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div
              key={goal.goal_id}
              className={`p-4 rounded-xl border transition-all ${
                goal.completed
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className={`font-medium ${goal.completed ? 'text-green-400 line-through' : 'text-white'}`}>
                    {goal.title}
                  </h4>
                  {goal.description && (
                    <p className="text-xs text-gray-400 mt-1">{goal.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!goal.completed && (
                    <button
                      onClick={() => handleIncrementGoal(goal.goal_id)}
                      className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition-colors"
                      title="Add progress"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteGoal(goal.goal_id)}
                    className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    title="Delete goal"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Progress</span>
                  <span>{goal.current} / {goal.target}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      goal.completed
                        ? 'bg-green-500'
                        : 'bg-gradient-to-r from-pink-500 to-purple-500'
                    }`}
                    style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}
                  />
                </div>
              </div>

              {goal.completed && (
                <div className="flex items-center gap-1 mt-2 text-green-400 text-xs">
                  <Check className="w-3 h-3" />
                  Completed!
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Create New Goal</h3>
              <button
                onClick={() => setShowAddGoal(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Goal Title</label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  placeholder="e.g., Read 5 books this month"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  placeholder="Add more details..."
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Target Amount</label>
                <input
                  type="number"
                  min="1"
                  value={newGoal.target}
                  onChange={(e) => setNewGoal({ ...newGoal, target: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Goal Type</label>
                <select
                  value={newGoal.type}
                  onChange={(e) => setNewGoal({ ...newGoal, type: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-pink-500"
                >
                  <option value="custom">Custom</option>
                  <option value="books">Books</option>
                  <option value="chores">Chores</option>
                  <option value="points">Points</option>
                </select>
              </div>

              <button
                onClick={handleCreateGoal}
                className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Create Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick Shortcuts Component
export function QuickShortcuts({ user, onNavigate }) {
  const [shortcuts, setShortcuts] = useState([]);
  const [available, setAvailable] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchShortcuts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/shortcuts`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setShortcuts(data.active || []);
        setAvailable(data.available || []);
      }
    } catch (error) {
      console.error('Failed to fetch shortcuts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShortcuts();
  }, [fetchShortcuts]);

  const handleToggleShortcut = async (shortcutId) => {
    const isActive = shortcuts.some((s) => s.id === shortcutId);
    let newShortcuts;

    if (isActive) {
      newShortcuts = shortcuts.filter((s) => s.id !== shortcutId).map((s) => s.id);
    } else {
      if (shortcuts.length >= 6) {
        toast.error('Maximum 6 shortcuts allowed');
        return;
      }
      newShortcuts = [...shortcuts.map((s) => s.id), shortcutId];
    }

    try {
      await fetch(`${API_URL}/api/shortcuts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ shortcuts: newShortcuts }),
      });
      fetchShortcuts();
    } catch (error) {
      toast.error('Failed to update shortcuts');
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          Quick Access
        </h3>
        <button
          onClick={() => setEditing(!editing)}
          className={`p-2 rounded-lg transition-colors ${
            editing ? 'bg-purple-500/20 text-purple-400' : 'bg-white/10 text-gray-400 hover:bg-white/20'
          }`}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {editing ? (
        <div className="grid grid-cols-3 gap-2">
          {available.map((shortcut) => {
            const isActive = shortcuts.some((s) => s.id === shortcut.id);
            return (
              <button
                key={shortcut.id}
                onClick={() => handleToggleShortcut(shortcut.id)}
                className={`p-3 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-purple-500/20 border-purple-500/50'
                    : 'bg-white/5 border-white/10 opacity-60 hover:opacity-100'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg mb-2 mx-auto flex items-center justify-center"
                  style={{ backgroundColor: shortcut.color + '30' }}
                >
                  <span style={{ color: shortcut.color }}>
                    {shortcut.icon === 'chatbubbles' && '💬'}
                    {shortcut.icon === 'gift' && '🎁'}
                    {shortcut.icon === 'trophy' && '🏆'}
                    {shortcut.icon === 'calendar' && '📅'}
                    {shortcut.icon === 'cart' && '🛒'}
                    {shortcut.icon === 'book' && '📚'}
                    {shortcut.icon === 'restaurant' && '🍽️'}
                    {shortcut.icon === 'people' && '👨‍👩‍👧‍👦'}
                    {shortcut.icon === 'medal' && '🏅'}
                    {shortcut.icon === 'apps' && '📱'}
                  </span>
                </div>
                <span className="text-xs text-gray-300 block truncate">{shortcut.name}</span>
                {isActive && (
                  <Check className="w-3 h-3 text-purple-400 mx-auto mt-1" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.id}
              onClick={() => onNavigate?.(shortcut.id)}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
            >
              <div
                className="w-10 h-10 rounded-lg mb-2 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{ backgroundColor: shortcut.color + '30' }}
              >
                <span className="text-xl">
                  {shortcut.icon === 'chatbubbles' && '💬'}
                  {shortcut.icon === 'gift' && '🎁'}
                  {shortcut.icon === 'trophy' && '🏆'}
                  {shortcut.icon === 'calendar' && '📅'}
                  {shortcut.icon === 'cart' && '🛒'}
                  {shortcut.icon === 'book' && '📚'}
                  {shortcut.icon === 'restaurant' && '🍽️'}
                  {shortcut.icon === 'people' && '👨‍👩‍👧‍👦'}
                  {shortcut.icon === 'medal' && '🏅'}
                  {shortcut.icon === 'apps' && '📱'}
                </span>
              </div>
              <span className="text-xs text-gray-300 block truncate">{shortcut.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Achievement Preview Component for Dashboard
export function AchievementPreview({ user, onViewAll }) {
  const [recentBadges, setRecentBadges] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentAchievements = async () => {
      if (!user?.user_id) return;

      try {
        const res = await fetch(`${API_URL}/api/achievements/user/${user.user_id}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          // Get 3 closest to completion or recently earned
          const sorted = (data.achievements || [])
            .filter((a) => a.category !== 'family')
            .sort((a, b) => {
              if (a.earned && !b.earned) return -1;
              if (!a.earned && b.earned) return 1;
              return b.progress_percent - a.progress_percent;
            });
          setRecentBadges(sorted.slice(0, 3));
          setStats(data.stats || {});
        }
      } catch (error) {
        console.error('Failed to fetch achievements:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentAchievements();
  }, [user?.user_id]);

  if (loading) {
    return null;
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          🏆 Achievements
        </h3>
        <button
          onClick={onViewAll}
          className="text-sm text-purple-400 hover:text-purple-300"
        >
          View All →
        </button>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/10">
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-400">{stats.chore_streak || 0}</div>
          <div className="text-xs text-gray-400">🔥 Streak</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">{stats.total_earned || 0}</div>
          <div className="text-xs text-gray-400">⭐ Badges</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.total_points || 0}</div>
          <div className="text-xs text-gray-400">💰 Points</div>
        </div>
      </div>

      {/* Recent/Close Badges */}
      <div className="space-y-2">
        {recentBadges.map((badge) => (
          <div
            key={badge.achievement_id}
            className={`flex items-center gap-3 p-3 rounded-lg ${
              badge.earned ? 'bg-purple-500/20' : 'bg-white/5'
            }`}
          >
            <div className={`text-2xl ${badge.earned ? '' : 'grayscale opacity-60'}`}>
              {badge.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium truncate ${badge.earned ? 'text-white' : 'text-gray-400'}`}>
                {badge.name}
              </div>
              {!badge.earned && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: `${badge.progress_percent}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{badge.progress_percent}%</span>
                </div>
              )}
            </div>
            {badge.earned && <Check className="w-4 h-4 text-green-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default { PersonalGoals, QuickShortcuts, AchievementPreview };
