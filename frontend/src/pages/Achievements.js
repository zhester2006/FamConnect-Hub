import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Trash2, Award, Gift, Edit2, X, Check, Loader2, Users, Target, Wand2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageBackground from '../components/PageBackground';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Achievements({ user }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState({});
  const [familyAchievements, setFamilyAchievements] = useState([]);
  const [familyStats, setFamilyStats] = useState({});
  const [seasonalChallenges, setSeasonalChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [showCelebration, setShowCelebration] = useState(null);

  // Parent management state
  const [customAchievements, setCustomAchievements] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(null);
  const [editingAchievement, setEditingAchievement] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContext, setAiContext] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', description: '', icon: '', category: 'custom',
    type: 'manual', requirement: 1, points_reward: 10
  });
  const [createLoading, setCreateLoading] = useState(false);

  const isParent = user?.role === 'parent';

  const fetchAchievements = useCallback(async () => {
    try {
      const [userRes, familyRes, seasonalRes] = await Promise.all([
        fetch(`${API_URL}/api/achievements/user/${user?.user_id}`, { credentials: 'include' }),
        fetch(`${API_URL}/api/achievements/family`, { credentials: 'include' }),
        fetch(`${API_URL}/api/achievements/seasonal`, { credentials: 'include' }),
      ]);
      if (userRes.ok) {
        const userData = await userRes.json();
        setAchievements(userData.achievements || []);
        setStats(userData.stats || {});
      }
      if (familyRes.ok) {
        const familyData = await familyRes.json();
        setFamilyAchievements(familyData.achievements || []);
        setFamilyStats(familyData.family_stats || {});
      }
      if (seasonalRes.ok) {
        const seasonalData = await seasonalRes.json();
        setSeasonalChallenges([
          ...(seasonalData.default_challenges || []),
          ...(seasonalData.custom_challenges || []),
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  const fetchCustomAchievements = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/achievements/custom`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCustomAchievements(data.achievements || []);
      }
    } catch (error) {
      console.error('Failed to fetch custom achievements:', error);
    }
  }, []);

  const fetchFamilyMembers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/family/members`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFamilyMembers((data.members || []).filter(m => m.role === 'child'));
      }
    } catch (error) {
      console.error('Failed to fetch family members:', error);
    }
  }, []);

  const checkForNewAchievements = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/achievements/check`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.newly_earned?.length > 0) {
          setShowCelebration(data.newly_earned[0]);
          fetchAchievements();
        }
      }
    } catch (error) {
      console.error('Failed to check achievements:', error);
    }
  }, [fetchAchievements]);

  useEffect(() => {
    if (user?.user_id) {
      fetchAchievements();
      checkForNewAchievements();
      if (isParent) {
        fetchCustomAchievements();
        fetchFamilyMembers();
      }
    }
  }, [user?.user_id, fetchAchievements, checkForNewAchievements, isParent, fetchCustomAchievements, fetchFamilyMembers]);

  const handleCreateAchievement = async () => {
    if (!createForm.name.trim()) { toast.error('Name is required'); return; }
    setCreateLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/achievements/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(createForm)
      });
      if (res.ok) {
        toast.success('Achievement created!');
        setShowCreateModal(false);
        setCreateForm({ name: '', description: '', icon: '', category: 'custom', type: 'manual', requirement: 1, points_reward: 10 });
        fetchCustomAchievements();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create');
      }
    } catch { toast.error('Failed to create achievement'); }
    finally { setCreateLoading(false); }
  };

  const handleDeleteAchievement = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/achievements/custom/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Achievement deleted');
        fetchCustomAchievements();
      }
    } catch { toast.error('Failed to delete'); }
  };

  const handleAwardAchievement = async (achievementId, childId) => {
    try {
      const res = await fetch(`${API_URL}/api/achievements/custom/${achievementId}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ child_id: childId })
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Achievement awarded!');
        setShowAwardModal(null);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to award');
      }
    } catch { toast.error('Failed to award achievement'); }
  };

  const handleAiSuggestions = async () => {
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const res = await fetch(`${API_URL}/api/achievements/ai-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ context: aiContext })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestions(data.suggestions || []);
        if (!data.suggestions?.length) toast.error('No suggestions generated');
      }
    } catch { toast.error('Failed to get AI suggestions'); }
    finally { setAiLoading(false); }
  };

  const handleUseSuggestion = (suggestion) => {
    setCreateForm({
      name: suggestion.name || '',
      description: suggestion.description || '',
      icon: suggestion.icon || '',
      category: 'custom',
      type: 'manual',
      requirement: 1,
      points_reward: suggestion.points || 10
    });
    setShowCreateModal(true);
  };

  const getCategoryBadges = (category) => achievements.filter((a) => a.category === category);

  const renderProgressBar = (progress, requirement) => {
    const percent = Math.min(100, Math.round((progress / requirement) * 100));
    return (
      <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
        <div className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
    );
  };

  const renderBadge = (achievement) => (
    <div key={achievement.achievement_id} className={`p-4 rounded-xl border transition-all duration-300 ${
      achievement.earned
        ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50 shadow-lg shadow-purple-500/20'
        : 'bg-gray-800/50 border-gray-700/50 opacity-60'
    }`} data-testid={`badge-${achievement.achievement_id}`}>
      <div className="flex items-center gap-3">
        <div className={`text-4xl ${achievement.earned ? 'grayscale-0' : 'grayscale'}`}>{achievement.icon}</div>
        <div className="flex-1">
          <h4 className={`font-semibold ${achievement.earned ? 'text-white' : 'text-gray-400'}`}>{achievement.name}</h4>
          <p className="text-xs text-gray-400">{achievement.description}</p>
          {!achievement.earned && (
            <>
              {renderProgressBar(achievement.progress, achievement.requirement)}
              <p className="text-xs text-gray-500 mt-1">{achievement.progress} / {achievement.requirement}</p>
            </>
          )}
          {achievement.earned && achievement.earned_at && (
            <p className="text-xs text-green-400 mt-1">Earned {new Date(achievement.earned_at).toLocaleDateString()}</p>
          )}
        </div>
        {achievement.earned && (
          <div className="text-green-400">
            <Check className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );

  const tabs = isParent
    ? ['personal', 'family', 'seasonal', 'manage']
    : ['personal', 'family', 'seasonal'];

  return (
    <div className="flex h-screen relative">
      <PageBackground page="achievements" />
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      <main className={`flex-1 overflow-auto transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'} pb-20 md:pb-6`}>
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3" data-testid="achievements-title">
              <span className="text-4xl">🏆</span> Achievements
            </h1>
            <p className="text-gray-400 mt-1">Track your progress and unlock badges</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-4 border border-orange-500/30">
                  <div className="text-3xl mb-1">🔥</div>
                  <div className="text-2xl font-bold text-white" data-testid="chore-streak">{stats.chore_streak || 0}</div>
                  <div className="text-xs text-gray-400">Day Chore Streak</div>
                </div>
                <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-4 border border-blue-500/30">
                  <div className="text-3xl mb-1">📚</div>
                  <div className="text-2xl font-bold text-white" data-testid="reading-streak">{stats.reading_streak || 0}</div>
                  <div className="text-xs text-gray-400">Day Reading Streak</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/30">
                  <div className="text-3xl mb-1">⭐</div>
                  <div className="text-2xl font-bold text-white" data-testid="badges-earned">{stats.total_earned || 0}</div>
                  <div className="text-xs text-gray-400">Badges Earned</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl p-4 border border-yellow-500/30">
                  <div className="text-3xl mb-1">💰</div>
                  <div className="text-2xl font-bold text-white" data-testid="total-points">{stats.total_points || 0}</div>
                  <div className="text-xs text-gray-400">Total Points</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    data-testid={`tab-${tab}`}
                    className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                      activeTab === tab ? 'bg-purple-500 text-white' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                    }`}
                  >
                    {tab === 'personal' && '🎯 Personal'}
                    {tab === 'family' && '👨‍👩‍👧‍👦 Family'}
                    {tab === 'seasonal' && '🌟 Seasonal'}
                    {tab === 'manage' && '⚙️ Manage'}
                  </button>
                ))}
              </div>

              {/* Personal Tab */}
              {activeTab === 'personal' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">🔥 Streak Badges</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {getCategoryBadges('streak').map((a) => renderBadge(a))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">⭐ Milestone Badges</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {getCategoryBadges('milestone').map((a) => renderBadge(a))}
                    </div>
                  </div>
                </div>
              )}

              {/* Family Tab */}
              {activeTab === 'family' && (
                <div className="space-y-6">
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                    <h4 className="text-gray-400 text-sm mb-2">Family Progress</h4>
                    <div className="flex items-center gap-4">
                      <span className="text-3xl font-bold text-white">{familyStats.total_chores || 0}</span>
                      <span className="text-gray-400">chores completed together</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {familyAchievements.map((a) => renderBadge(a))}
                  </div>
                </div>
              )}

              {/* Seasonal Tab */}
              {activeTab === 'seasonal' && (
                <div className="space-y-6">
                  {seasonalChallenges.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-5xl mb-4">🌟</div>
                      <p>No active seasonal challenges right now.</p>
                      <p className="text-sm mt-2">Check back later for new challenges!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {seasonalChallenges.map((challenge) => (
                        <div key={challenge.challenge_id} className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl p-5 border border-yellow-500/30">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="text-4xl">{challenge.icon}</div>
                            <div>
                              <h4 className="font-semibold text-white">{challenge.name}</h4>
                              <p className="text-sm text-gray-400">{challenge.description}</p>
                            </div>
                          </div>
                          <div className="text-sm text-gray-400">Goal: {challenge.requirement} {challenge.type}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Parent Manage Tab */}
              {activeTab === 'manage' && isParent && (
                <div className="space-y-6">
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowCreateModal(true)}
                      data-testid="create-achievement-btn"
                      className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all"
                    >
                      <Plus className="w-5 h-5" /> Create Achievement
                    </button>
                    <button
                      onClick={() => setShowAiPanel(!showAiPanel)}
                      data-testid="ai-suggestions-btn"
                      className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all"
                    >
                      <Wand2 className="w-5 h-5" /> AI Suggestions
                    </button>
                  </div>

                  {/* AI Suggestions Panel */}
                  {showAiPanel && (
                    <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl p-5 border border-cyan-500/30" data-testid="ai-suggestions-panel">
                      <div className="flex items-center gap-2 mb-4">
                        <Wand2 className="w-5 h-5 text-cyan-400" />
                        <h3 className="text-lg font-semibold text-white">AI Achievement Ideas</h3>
                      </div>
                      <div className="flex gap-3 mb-4">
                        <input
                          type="text"
                          value={aiContext}
                          onChange={(e) => setAiContext(e.target.value)}
                          placeholder="Theme (e.g. summer, reading, kindness)..."
                          className="flex-1 px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                          data-testid="ai-context-input"
                        />
                        <button
                          onClick={handleAiSuggestions}
                          disabled={aiLoading}
                          data-testid="generate-ai-btn"
                          className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white rounded-xl font-semibold transition-all flex items-center gap-2"
                        >
                          {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                          {aiLoading ? 'Thinking...' : 'Generate'}
                        </button>
                      </div>

                      {aiSuggestions.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {aiSuggestions.map((s, i) => (
                            <div key={i} className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 flex items-start gap-3" data-testid={`ai-suggestion-${i}`}>
                              <span className="text-3xl">{s.icon}</span>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-white font-semibold truncate">{s.name}</h4>
                                <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
                                <p className="text-xs text-cyan-400 mt-1">{s.requirement} &middot; {s.points || 10} pts</p>
                              </div>
                              <button
                                onClick={() => handleUseSuggestion(s)}
                                className="flex-shrink-0 px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 rounded-lg text-xs font-medium transition-all"
                                data-testid={`use-suggestion-${i}`}
                              >
                                Use
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Achievements List */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-400" /> Custom Goals & Badges
                    </h3>
                    {customAchievements.length === 0 ? (
                      <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <Award className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No custom achievements yet.</p>
                        <p className="text-sm text-slate-500 mt-1">Create one or use AI suggestions above!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {customAchievements.map((a) => (
                          <div key={a.achievement_id} className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-5 border border-purple-500/30 relative group" data-testid={`custom-achievement-${a.achievement_id}`}>
                            <div className="flex items-start gap-3">
                              <span className="text-4xl">{a.icon}</span>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-white font-semibold truncate">{a.name}</h4>
                                <p className="text-xs text-slate-400 mt-0.5">{a.description}</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">{a.points_reward} pts</span>
                                  <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{a.type}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <button
                                onClick={() => setShowAwardModal(a)}
                                data-testid={`award-btn-${a.achievement_id}`}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg text-sm font-medium transition-all"
                              >
                                <Gift className="w-4 h-4" /> Award
                              </button>
                              <button
                                onClick={() => handleDeleteAchievement(a.achievement_id)}
                                data-testid={`delete-btn-${a.achievement_id}`}
                                className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Celebration Modal */}
          {showCelebration && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-8 max-w-md w-full text-center">
                <div className="text-7xl mb-4">{showCelebration.icon}</div>
                <h2 className="text-2xl font-bold text-white mb-2">Achievement Unlocked!</h2>
                <h3 className="text-xl text-purple-300 mb-2">{showCelebration.name}</h3>
                <p className="text-gray-300 mb-6">{showCelebration.description}</p>
                <button onClick={() => setShowCelebration(null)} className="px-6 py-3 bg-white text-purple-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors" data-testid="celebration-dismiss">
                  Awesome!
                </button>
              </div>
            </div>
          )}

          {/* Create Achievement Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" data-testid="create-achievement-modal">
              <div className="bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-slate-700">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-purple-400" /> New Achievement
                  </h2>
                  <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Name *</label>
                    <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="e.g. Kitchen King" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500" data-testid="achievement-name-input" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Description</label>
                    <input type="text" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="e.g. Help with kitchen chores for 7 days" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500" data-testid="achievement-desc-input" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Icon (emoji)</label>
                      <input type="text" value={createForm.icon} onChange={(e) => setCreateForm({ ...createForm, icon: e.target.value })}
                        placeholder="Leave blank for AI" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500" data-testid="achievement-icon-input" />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Points Reward</label>
                      <input type="number" min={0} value={createForm.points_reward} onChange={(e) => setCreateForm({ ...createForm, points_reward: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500" data-testid="achievement-points-input" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Type</label>
                    <select value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500" data-testid="achievement-type-select">
                      <option value="manual">Manual (parent awards)</option>
                      <option value="chores">Chore-based</option>
                      <option value="points">Points-based</option>
                      <option value="reading">Reading-based</option>
                    </select>
                  </div>
                  <button onClick={handleCreateAchievement} disabled={createLoading}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all" data-testid="save-achievement-btn">
                    {createLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    {createLoading ? 'Creating...' : 'Create Achievement'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Award Achievement Modal */}
          {showAwardModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" data-testid="award-achievement-modal">
              <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full border border-slate-700">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Gift className="w-5 h-5 text-green-400" /> Award Badge
                  </h2>
                  <button onClick={() => setShowAwardModal(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="text-center mb-5">
                  <span className="text-5xl">{showAwardModal.icon}</span>
                  <h3 className="text-white font-semibold mt-2">{showAwardModal.name}</h3>
                  <p className="text-sm text-slate-400">{showAwardModal.points_reward} pts reward</p>
                </div>
                <p className="text-sm text-slate-400 mb-3">Select a child to award:</p>
                <div className="space-y-2">
                  {familyMembers.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">No children in family yet.</p>
                  ) : familyMembers.map((child) => (
                    <button
                      key={child.user_id}
                      onClick={() => handleAwardAchievement(showAwardModal.achievement_id, child.user_id)}
                      data-testid={`award-child-${child.user_id}`}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                        {(child.nickname || child.name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium">{child.nickname || child.name}</p>
                        <p className="text-xs text-slate-500">{child.points || 0} pts</p>
                      </div>
                      <Gift className="w-4 h-4 text-green-400 ml-auto" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
