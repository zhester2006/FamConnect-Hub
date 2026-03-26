import React, { useState, useEffect } from 'react';
import { Utensils, ChefHat, Sparkles, Calendar, History, ShoppingCart, Check, Square, CheckSquare } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function SelectableTextBlock({ text, selectedItems, onToggle }) {
  if (!text) return null;
  const lines = text.split('\n').filter(l => l.trim());
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const isHeader = trimmed.startsWith('#') || trimmed.startsWith('**') || trimmed.endsWith(':') || trimmed.length < 5;
        const key = `${i}-${trimmed}`;
        const isSelected = selectedItems.has(key);
        if (isHeader) {
          return <p key={i} className="text-white font-semibold text-sm mt-2">{trimmed.replace(/^[#*]+\s*/, '').replace(/\*+$/, '')}</p>;
        }
        return (
          <button
            key={i}
            onClick={() => onToggle(key, trimmed)}
            className={`w-full flex items-start gap-2 px-2 py-1 rounded-lg text-left transition-all ${
              isSelected ? 'bg-green-500/10 border border-green-500/30' : 'hover:bg-slate-800/50'
            }`}
            data-testid={`meal-item-${i}`}
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Square className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
            )}
            <span className={`text-xs leading-relaxed ${isSelected ? 'text-green-300' : 'text-slate-300'}`}>
              {trimmed.replace(/^[-•*]\s*/, '')}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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
  const [selectedItems, setSelectedItems] = useState(new Map());
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => { fetchSavedPlans(); }, []);

  const fetchSavedPlans = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/dinner/plans`, { credentials: 'include' });
      const data = await res.json();
      setSavedPlans(data.plans || []);
    } catch (error) { console.error('Failed to fetch plans:', error); }
  };

  const handleGetSuggestion = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuggestion('');
    setSelectedItems(new Map());
    try {
      const res = await fetch(`${BACKEND_URL}/api/dinner/suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ingredients, preferences })
      });
      const data = await res.json();
      setSuggestion(data.suggestion || '');
    } catch { toast.error('Failed to get suggestion'); }
    finally { setLoading(false); }
  };

  const handleGetWeeklyPlan = async () => {
    setWeeklyLoading(true);
    setWeeklyPlan('');
    setSelectedItems(new Map());
    try {
      const res = await fetch(`${BACKEND_URL}/api/dinner/weekly-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences, family_size: familySize, budget })
      });
      const data = await res.json();
      setWeeklyPlan(data.plan || '');
    } catch { toast.error('Failed to generate plan'); }
    finally { setWeeklyLoading(false); }
  };

  const toggleItem = (key, text) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, text.replace(/^[-•*]\s*/, '').trim());
      return next;
    });
  };

  const addToShoppingList = async () => {
    if (selectedItems.size === 0) { toast.error('Select items first'); return; }
    setAddingToCart(true);
    try {
      const items = [...selectedItems.values()];
      let added = 0;
      for (const item of items) {
        const res = await fetch(`${BACKEND_URL}/api/shopping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: item })
        });
        if (res.ok) added++;
      }
      toast.success(`Added ${added} item${added !== 1 ? 's' : ''} to shopping list!`);
      setSelectedItems(new Map());
    } catch { toast.error('Failed to add items'); }
    finally { setAddingToCart(false); }
  };

  const selectedCount = selectedItems.size;

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <div className="p-4 lg:p-6 pb-24 md:pb-6 space-y-4" data-testid="dinner-planner">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white flex items-center space-x-2">
                <Utensils className="w-6 h-6 text-primary" />
                <span>Dinner Planner</span>
              </h1>
              <p className="text-sm text-slate-400 mt-1">Let AI help you plan meals for your family</p>
            </div>
            <div className="flex gap-2">
              {savedPlans.length > 0 && (
                <button onClick={() => setShowHistory(!showHistory)} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-all" data-testid="show-history">
                  <History className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300">History ({savedPlans.length})</span>
                </button>
              )}
            </div>
          </header>

          {showHistory && savedPlans.length > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-sm font-bold text-white mb-3">Previous Meal Plans</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedPlans.map((plan) => (
                  <button key={plan.plan_id} onClick={() => { setWeeklyPlan(plan.plan); setShowHistory(false); }}
                    className="w-full text-left p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all">
                    <p className="text-sm text-white font-medium">Week of {plan.week_start}</p>
                    <p className="text-xs text-slate-400 truncate">{plan.preferences || 'No specific preferences'}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Dinner Idea */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center space-x-2 mb-2">
              <ChefHat className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-white">Quick Dinner Idea</h2>
            </div>
            <form onSubmit={handleGetSuggestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Available Ingredients</label>
                <input type="text" value={ingredients} onChange={(e) => setIngredients(e.target.value)}
                  placeholder="e.g., chicken, rice, tomatoes, garlic"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600" data-testid="ingredients-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Dietary Preferences</label>
                <input type="text" value={preferences} onChange={(e) => setPreferences(e.target.value)}
                  placeholder="e.g., vegetarian, quick meals, kid-friendly"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600" data-testid="preferences-input" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-primary hover:bg-primary/80 disabled:bg-slate-800 text-white font-bold py-3 px-4 rounded-full transition-all flex items-center justify-center space-x-2" data-testid="get-suggestion-button">
                {loading ? <><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" /><span>Thinking...</span></> :
                  <><Sparkles className="w-5 h-5" /><span>Get Dinner Idea</span></>}
              </button>
            </form>
          </div>

          {/* Suggestion Result — selectable items */}
          {suggestion && (
            <div className="glass-card rounded-2xl p-5 space-y-3" data-testid="suggestion-result">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <h3 className="text-base font-bold text-white">AI Suggestion</h3>
                </div>
                <span className="text-xs text-slate-500">Tap items to select</span>
              </div>
              <SelectableTextBlock text={suggestion} selectedItems={selectedItems} onToggle={toggleItem} />
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
                <select value={familySize} onChange={(e) => setFamilySize(parseInt(e.target.value))}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm" data-testid="family-size">
                  {[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} people</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Budget</label>
                <select value={budget} onChange={(e) => setBudget(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm" data-testid="budget">
                  <option value="budget">Budget-friendly</option>
                  <option value="moderate">Moderate</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-medium text-slate-400 mb-1">&nbsp;</label>
                <button onClick={handleGetWeeklyPlan} disabled={weeklyLoading}
                  className="w-full bg-secondary hover:bg-secondary/80 disabled:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center space-x-2" data-testid="get-weekly-plan">
                  {weeklyLoading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" /> :
                    <><Calendar className="w-4 h-4" /><span>Generate Plan</span></>}
                </button>
              </div>
            </div>
          </div>

          {/* Weekly Plan Result — selectable items */}
          {weeklyPlan && (
            <div className="glass-card rounded-2xl p-5 space-y-3" data-testid="weekly-plan-result">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-secondary" />
                  <h3 className="text-base font-bold text-white">Your Weekly Plan</h3>
                </div>
                <span className="text-xs text-slate-500">Tap items to select</span>
              </div>
              <SelectableTextBlock text={weeklyPlan} selectedItems={selectedItems} onToggle={toggleItem} />
            </div>
          )}

          {/* Add to Shopping List — sticky bottom bar */}
          {selectedCount > 0 && (
            <div className="fixed bottom-16 md:bottom-4 left-0 right-0 z-40 px-4" data-testid="add-to-cart-bar">
              <div className={`max-w-lg mx-auto flex items-center justify-between bg-green-600 rounded-2xl px-5 py-3 shadow-xl shadow-green-900/30 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">{selectedCount} item{selectedCount !== 1 ? 's' : ''} selected</span>
                </div>
                <button onClick={addToShoppingList} disabled={addingToCart}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-white font-bold text-sm transition-all" data-testid="add-to-shopping-btn">
                  {addingToCart ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" /> :
                    <><Check className="w-4 h-4" /><span>Add to Shopping List</span></>}
                </button>
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
                { name: 'Breakfast 4 Dinner', icon: '🥞', pref: 'Breakfast foods for dinner' },
                { name: 'BBQ Night', icon: '🍖', pref: 'Grilled meats and BBQ' },
              ].map((meal) => (
                <button key={meal.name} onClick={() => setPreferences(meal.pref)}
                  className="glass-card rounded-xl p-4 hover:border-primary/50 transition-all text-center"
                  data-testid={`quick-meal-${meal.name.toLowerCase().replace(/ /g, '-')}`}>
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
