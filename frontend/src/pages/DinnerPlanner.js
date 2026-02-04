import React, { useState, useEffect } from 'react';
import { Utensils, ChefHat, Sparkles, Calendar, History, Trash2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function DinnerPlanner({ user }) {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [ingredients, setIngredients] = useState('');
  const [preferences, setPreferences] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState('');
  const [savedPlans, setSavedPlans] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [familySize, setFamilySize] = useState(4);
  const [budget, setBudget] = useState('moderate');

  useEffect(() => {
    fetchSavedPlans();
  }, []);

  const fetchSavedPlans = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/dinner/plans`, { credentials: 'include' });
      const data = await res.json();
      setSavedPlans(data.plans || []);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  };

  const handleGetSuggestion = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/dinner/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ingredients: ingredients.split(',').map(i => i.trim()).filter(i => i),
          preferences
        })
      });
      const data = await res.json();
      setSuggestion(data.suggestion);
      toast.success('Dinner suggestion ready!');
    } catch (error) {
      console.error('Failed to get suggestion:', error);
      toast.error('Failed to get suggestion');
    } finally {
      setLoading(false);
    }
  };

  const handleGetWeeklyPlan = async () => {
    setWeeklyLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/dinner/weekly-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          family_size: familySize,
          preferences,
          budget
        })
      });
      const data = await res.json();
      setWeeklyPlan(data.plan);
      fetchSavedPlans();
      toast.success('Weekly meal plan created!');
    } catch (error) {
      console.error('Failed to get weekly plan:', error);
      toast.error('Failed to create weekly plan');
    } finally {
      setWeeklyLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-6 pb-24 md:pb-6 space-y-4" data-testid="dinner-planner">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white flex items-center space-x-2">
                <Utensils className="w-6 h-6 text-primary" />
                <span>Dinner Planner</span>
              </h1>
              <p className="text-sm text-slate-400 mt-1">Let AI help you plan meals for your family</p>
            </div>
            {savedPlans.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-all"
                data-testid="show-history"
              >
                <History className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">History ({savedPlans.length})</span>
              </button>
            )}
          </header>

          {/* History Panel */}
          {showHistory && savedPlans.length > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center space-x-2">
                <History className="w-4 h-4 text-accent" />
                <span>Previous Meal Plans</span>
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedPlans.map((plan) => (
                  <button
                    key={plan.plan_id}
                    onClick={() => { setWeeklyPlan(plan.plan); setShowHistory(false); }}
                    className="w-full text-left p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all"
                  >
                    <p className="text-sm text-white font-medium">Week of {plan.week_start}</p>
                    <p className="text-xs text-slate-400 truncate">{plan.preferences || 'No specific preferences'}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Suggestion */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center space-x-2 mb-2">
              <ChefHat className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-white">Quick Dinner Idea</h2>
            </div>
            
            <form onSubmit={handleGetSuggestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Available Ingredients (comma-separated)</label>
                <input
                  type="text"
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  placeholder="e.g., chicken, rice, tomatoes, garlic"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                  data-testid="ingredients-input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Dietary Preferences</label>
                <input
                  type="text"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="e.g., vegetarian, quick meals, kid-friendly"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                  data-testid="preferences-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/80 disabled:bg-slate-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-full transition-all flex items-center justify-center space-x-2"
                data-testid="get-suggestion-button"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    <span>Thinking...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Get Dinner Idea</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {suggestion && (
            <div className="glass-card rounded-2xl p-5 space-y-3" data-testid="suggestion-result">
              <div className="flex items-center space-x-2 mb-3">
                <Sparkles className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-bold text-white">AI Suggestion</h3>
              </div>
              <div className="prose prose-invert max-w-none">
                <p className="text-white whitespace-pre-wrap leading-relaxed">{suggestion}</p>
              </div>
            </div>
          )}

          {/* Weekly Meal Plan */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="w-5 h-5 text-secondary" />
              <h2 className="text-lg font-bold text-white">Weekly Meal Plan</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Family Size</label>
                <select
                  value={familySize}
                  onChange={(e) => setFamilySize(parseInt(e.target.value))}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm"
                  data-testid="family-size"
                >
                  {[2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>{n} people</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Budget</label>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm"
                  data-testid="budget"
                >
                  <option value="budget">Budget-friendly</option>
                  <option value="moderate">Moderate</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-medium text-slate-400 mb-1">&nbsp;</label>
                <button
                  onClick={handleGetWeeklyPlan}
                  disabled={weeklyLoading}
                  className="w-full bg-secondary hover:bg-secondary/80 disabled:bg-slate-800 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center space-x-2"
                  data-testid="get-weekly-plan"
                >
                  {weeklyLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      <span>Generate Plan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {weeklyPlan && (
            <div className="glass-card rounded-2xl p-5 space-y-3" data-testid="weekly-plan-result">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-secondary" />
                  <h3 className="text-lg font-bold text-white">Your Weekly Plan</h3>
                </div>
              </div>
              <div className="prose prose-invert max-w-none">
                <p className="text-white whitespace-pre-wrap leading-relaxed text-sm">{weeklyPlan}</p>
              </div>
            </div>
          )}

          {/* Quick Meal Ideas */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white mb-4">Quick Meal Ideas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: 'Pasta Night', icon: '🍝', pref: 'Italian pasta dishes' },
                { name: 'Taco Tuesday', icon: '🌮', pref: 'Mexican tacos and sides' },
                { name: 'Pizza Party', icon: '🍕', pref: 'Homemade pizza' },
                { name: 'Stir Fry', icon: '🥘', pref: 'Asian stir fry dishes' },
                { name: 'Burger Night', icon: '🍔', pref: 'Gourmet burgers' },
                { name: 'Soup & Salad', icon: '🥗', pref: 'Light healthy soups and salads' },
                { name: 'Breakfast for Dinner', icon: '🥞', pref: 'Breakfast foods for dinner' },
                { name: 'BBQ Night', icon: '🍖', pref: 'Grilled meats and BBQ' },
              ].map((meal) => (
                <button
                  key={meal.name}
                  onClick={() => setPreferences(meal.pref)}
                  className="glass-card rounded-xl p-4 hover:border-primary/50 transition-all text-center"
                  data-testid={`quick-meal-${meal.name.toLowerCase().replace(/ /g, '-')}`}
                >
                  <span className="text-3xl mb-2 block">{meal.icon}</span>
                  <p className="text-xs font-medium text-white">{meal.name}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
