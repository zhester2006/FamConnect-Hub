import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import PageBackground from '../components/PageBackground';

export default function Achievements() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState({});
  const [familyAchievements, setFamilyAchievements] = useState([]);
  const [familyStats, setFamilyStats] = useState({});
  const [seasonalChallenges, setSeasonalChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [showCelebration, setShowCelebration] = useState(null);

  const API_URL = process.env.REACT_APP_BACKEND_URL;

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
  }, [API_URL, user?.user_id]);

  useEffect(() => {
    if (user?.user_id) {
      fetchAchievements();
    }
  }, [user?.user_id, fetchAchievements]);

  const checkForNewAchievements = async () => {
    try {
      const res = await fetch(`${API_URL}/api/achievements/check`, {
        method: 'POST',
        credentials: 'include',
      });
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
  };

  // Check for new achievements on mount
  useEffect(() => {
    if (user?.user_id) {
      checkForNewAchievements();
    }
  }, [user?.user_id]);

  const getCategoryBadges = (category) => {
    return achievements.filter((a) => a.category === category);
  };

  const renderProgressBar = (progress, requirement) => {
    const percent = Math.min(100, Math.round((progress / requirement) * 100));
    return (
      <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  };

  const renderBadge = (achievement, showProgress = true) => (
    <div
      key={achievement.achievement_id}
      className={`p-4 rounded-xl border transition-all duration-300 ${
        achievement.earned
          ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50 shadow-lg shadow-purple-500/20'
          : 'bg-gray-800/50 border-gray-700/50 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`text-4xl ${achievement.earned ? 'grayscale-0' : 'grayscale'}`}
        >
          {achievement.icon}
        </div>
        <div className="flex-1">
          <h4 className={`font-semibold ${achievement.earned ? 'text-white' : 'text-gray-400'}`}>
            {achievement.name}
          </h4>
          <p className="text-xs text-gray-400">{achievement.description}</p>
          {showProgress && !achievement.earned && (
            <>
              {renderProgressBar(achievement.progress, achievement.requirement)}
              <p className="text-xs text-gray-500 mt-1">
                {achievement.progress} / {achievement.requirement}
              </p>
            </>
          )}
          {achievement.earned && achievement.earned_at && (
            <p className="text-xs text-green-400 mt-1">
              Earned {new Date(achievement.earned_at).toLocaleDateString()}
            </p>
          )}
        </div>
        {achievement.earned && (
          <div className="text-green-400">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <PageBackground page="achievements">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
        </div>
      </PageBackground>
    );
  }

  return (
    <PageBackground page="achievements">
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="text-4xl">🏆</span> Achievements
          </h1>
          <p className="text-gray-400 mt-1">Track your progress and unlock badges</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-4 border border-orange-500/30">
            <div className="text-3xl mb-1">🔥</div>
            <div className="text-2xl font-bold text-white">{stats.chore_streak || 0}</div>
            <div className="text-xs text-gray-400">Day Chore Streak</div>
          </div>
          <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-4 border border-blue-500/30">
            <div className="text-3xl mb-1">📚</div>
            <div className="text-2xl font-bold text-white">{stats.reading_streak || 0}</div>
            <div className="text-xs text-gray-400">Day Reading Streak</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/30">
            <div className="text-3xl mb-1">⭐</div>
            <div className="text-2xl font-bold text-white">{stats.total_earned || 0}</div>
            <div className="text-xs text-gray-400">Badges Earned</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl p-4 border border-yellow-500/30">
            <div className="text-3xl mb-1">💰</div>
            <div className="text-2xl font-bold text-white">{stats.total_points || 0}</div>
            <div className="text-xs text-gray-400">Total Points</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['personal', 'family', 'seasonal'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              {tab === 'personal' && '🎯 Personal'}
              {tab === 'family' && '👨‍👩‍👧‍👦 Family'}
              {tab === 'seasonal' && '🌟 Seasonal'}
            </button>
          ))}
        </div>

        {/* Personal Achievements */}
        {activeTab === 'personal' && (
          <div className="space-y-6">
            {/* Streak Badges */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                🔥 Streak Badges
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {getCategoryBadges('streak').map((a) => renderBadge(a))}
              </div>
            </div>

            {/* Milestone Badges */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                ⭐ Milestone Badges
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {getCategoryBadges('milestone').map((a) => renderBadge(a))}
              </div>
            </div>
          </div>
        )}

        {/* Family Achievements */}
        {activeTab === 'family' && (
          <div className="space-y-6">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <h4 className="text-gray-400 text-sm mb-2">Family Progress</h4>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-3xl font-bold text-white">
                    {familyStats.total_chores || 0}
                  </span>
                  <span className="text-gray-400 ml-2">chores completed together</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {familyAchievements.map((a) => renderBadge(a))}
            </div>
          </div>
        )}

        {/* Seasonal Challenges */}
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
                  <div
                    key={challenge.challenge_id}
                    className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl p-5 border border-yellow-500/30"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-4xl">{challenge.icon}</div>
                      <div>
                        <h4 className="font-semibold text-white">{challenge.name}</h4>
                        <p className="text-sm text-gray-400">{challenge.description}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">
                      Goal: {challenge.requirement} {challenge.type}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Celebration Modal */}
        {showCelebration && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-8 max-w-md w-full text-center animate-bounce-in">
              <div className="text-7xl mb-4">{showCelebration.icon}</div>
              <h2 className="text-2xl font-bold text-white mb-2">Achievement Unlocked!</h2>
              <h3 className="text-xl text-purple-300 mb-2">{showCelebration.name}</h3>
              <p className="text-gray-300 mb-6">{showCelebration.description}</p>
              <button
                onClick={() => setShowCelebration(null)}
                className="px-6 py-3 bg-white text-purple-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Awesome!
              </button>
            </div>
          </div>
        )}
      </div>
    </PageBackground>
  );
}
