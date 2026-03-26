import React, { useState, useEffect, useCallback } from 'react';
import { Utensils, ChefHat, Sparkles, Calendar, History, ShoppingCart, Check, Square, CheckSquare, CalendarPlus, X, RefreshCw, Trash2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekDates() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return DAY_NAMES.map((name, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isToday = dateStr === today.toISOString().split('T')[0];
    const isPast = d < new Date(today.toISOString().split('T')[0]);
    return { name, date: dateStr, isToday, isPast, display: `${d.getMonth() + 1}/${d.getDate()}` };
  });
}

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
              {trimmed.replace(/^[-*]\s*/, '')}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Extracts meal names from AI text by finding day headers and the meal after them
function extractMealsFromPlan(text) {
  if (!text) return {};
  const meals = {};
  const lines = text.split('\n');
  let currentDay = null;

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    for (const day of DAY_NAMES) {
      if (trimmed.includes(day.toLowerCase())) {
        currentDay = day;
        // Check if meal name is on the same line after a colon/dash
        const afterDay = line.split(/[:\-]/)[1]?.trim();
        if (afterDay && afterDay.length > 2 && afterDay.length < 80) {
          meals[day] = afterDay.replace(/^\*+|\*+$/g, '').trim();
        }
        break;
      }
    }
    // If we found a day but no meal yet, check next non-header line
    if (currentDay && !meals[currentDay]) {
      const clean = trimmed.replace(/^[-*#\d.]+\s*/, '').replace(/\*+/g, '');
      if (clean.length > 3 && clean.length < 80 && !DAY_NAMES.some(d => clean.includes(d.toLowerCase()))) {
        // Check if this looks like a meal name (has keywords)
        if (clean.includes('meal') || clean.includes('name') || /^[a-z]/.test(clean)) {
          const mealName = clean.replace(/^meal\s*name\s*[:\-]?\s*/i, '').trim();
          if (mealName.length > 2) {
            meals[currentDay] = mealName.charAt(0).toUpperCase() + mealName.slice(1);
          }
        }
      }
    }
  }
  return meals;
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

  // Dinner Schedule state
  const [schedule, setSchedule] = useState([]);
  const [weekDates] = useState(getWeekDates);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [aiFillingDays, setAiFillingDays] = useState(false);
  const [assigningDay, setAssigningDay] = useState(null); // date string being assigned
  const [mealNameInput, setMealNameInput] = useState('');

  const fetchSchedule = useCallback(async () => {
    try {
      const monday = weekDates[0].date;
      const res = await fetch(`${BACKEND_URL}/api/dinner/schedule?week_start=${monday}`, { credentials: 'include' });
      const data = await res.json();
      setSchedule(data.schedule || []);
    } catch (error) { console.error('Failed to fetch schedule:', error); }
  }, [weekDates]);

  useEffect(() => { fetchSavedPlans(); fetchSchedule(); }, [fetchSchedule]);

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
      const res = await fetch(`${BACKEND_URL}/api/dinner/suggest`, {
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
      else next.set(key, text.replace(/^[-*]\s*/, '').trim());
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

  // Add a single meal to the dinner schedule for a specific day
  const addMealToSchedule = async (date, mealName, description = '') => {
    if (!mealName.trim()) return;
    setScheduleLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/dinner/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ meals: [{ date, meal_name: mealName, description, source: 'manual' }] })
      });
      if (res.ok) {
        toast.success(`Scheduled "${mealName}" for dinner!`);
        fetchSchedule();
        setAssigningDay(null);
        setMealNameInput('');
      }
    } catch { toast.error('Failed to add to schedule'); }
    finally { setScheduleLoading(false); }
  };

  // Add extracted meals from weekly plan to schedule
  const addPlanToSchedule = async () => {
    const extracted = extractMealsFromPlan(weeklyPlan);
    const meals = [];
    for (const day of weekDates) {
      const mealName = extracted[day.name];
      if (mealName) {
        meals.push({ date: day.date, meal_name: mealName, source: 'ai_plan' });
      }
    }
    if (meals.length === 0) {
      toast.error('Could not extract meal names from the plan. Try adding meals manually.');
      return;
    }
    setScheduleLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/dinner/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ meals })
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Scheduled ${data.count} meals for the week!`);
        fetchSchedule();
      }
    } catch { toast.error('Failed to add plan to schedule'); }
    finally { setScheduleLoading(false); }
  };

  // Remove meal from schedule
  const removeMealFromSchedule = async (date) => {
    try {
      await fetch(`${BACKEND_URL}/api/dinner/schedule/${date}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      toast.success('Removed from schedule');
      fetchSchedule();
    } catch { toast.error('Failed to remove'); }
  };

  // AI fill unplanned days
  const aiFillUnplannedDays = async () => {
    const plannedDates = schedule.map(s => s.date);
    const unplanned = weekDates.filter(d => !d.isPast && !plannedDates.includes(d.date)).map(d => d.date);
    if (unplanned.length === 0) {
      toast.info('All days are already planned!');
      return;
    }
    setAiFillingDays(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/dinner/schedule/ai-fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ unplanned_days: unplanned, preferences })
      });
      const data = await res.json();
      const suggestions = data.suggestions || [];
      if (suggestions.length > 0) {
        // Add all suggestions to the schedule
        const addRes = await fetch(`${BACKEND_URL}/api/dinner/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ meals: suggestions.map(s => ({ ...s, source: 'ai_suggestion' })) })
        });
        if (addRes.ok) {
          const addData = await addRes.json();
          toast.success(`AI suggested ${addData.count} meals for unplanned days!`);
          fetchSchedule();
        }
      } else {
        toast.error('AI could not generate suggestions. Try again.');
      }
    } catch { toast.error('Failed to get AI suggestions'); }
    finally { setAiFillingDays(false); }
  };

  const selectedCount = selectedItems.size;
  const plannedDates = schedule.map(s => s.date);
  const unplannedCount = weekDates.filter(d => !d.isPast && !plannedDates.includes(d.date)).length;

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <div className="p-4 pt-16 md:pt-4 lg:p-6 lg:pt-6 pb-24 md:pb-6 space-y-4" data-testid="dinner-planner">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white flex items-center space-x-2">
                <Utensils className="w-6 h-6 text-primary" />
                <span>Dinner Planner</span>
              </h1>
              <p className="text-sm text-slate-400 mt-1">Plan meals, schedule dinners, and build your shopping list</p>
            </div>
            <div className="flex gap-2">
              {savedPlans.length > 0 && (
                <button onClick={() => setShowHistory(!showHistory)} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-all" data-testid="show-history">
                  <History className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300 hidden sm:inline">History ({savedPlans.length})</span>
                </button>
              )}
            </div>
          </header>

          {/* ===== DINNER SCHEDULE (Week View) ===== */}
          <div className="glass-card rounded-2xl p-5 space-y-4" data-testid="dinner-schedule">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-bold text-white">This Week's Dinners</h2>
              </div>
              {unplannedCount > 0 && (
                <button
                  onClick={aiFillUnplannedDays}
                  disabled={aiFillingDays}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 hover:bg-accent/30 border border-accent/30 text-accent rounded-full text-xs font-bold transition-all disabled:opacity-50"
                  data-testid="ai-fill-btn"
                >
                  {aiFillingDays ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-accent" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span>AI Fill {unplannedCount} Day{unplannedCount !== 1 ? 's' : ''}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {weekDates.map((day) => {
                const meal = schedule.find(s => s.date === day.date);
                return (
                  <div
                    key={day.date}
                    className={`relative rounded-xl p-3 border transition-all min-h-[90px] ${
                      day.isToday ? 'border-primary bg-primary/10' :
                      meal ? 'border-green-500/30 bg-green-500/5' :
                      day.isPast ? 'border-slate-800 bg-slate-900/30 opacity-50' :
                      'border-slate-800 bg-slate-900/50 hover:border-slate-600'
                    }`}
                    data-testid={`schedule-day-${day.date}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold ${day.isToday ? 'text-primary' : 'text-slate-400'}`}>
                        {day.name.slice(0, 3)} {day.display}
                      </span>
                      {day.isToday && <span className="text-[8px] bg-primary/20 text-primary px-1.5 rounded-full font-bold">TODAY</span>}
                    </div>
                    {meal ? (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white leading-tight">{meal.meal_name}</p>
                        {meal.description && <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">{meal.description}</p>}
                        <button
                          onClick={() => removeMealFromSchedule(day.date)}
                          className="absolute top-1.5 right-1.5 p-1 hover:bg-red-500/20 rounded-lg opacity-0 group-hover:opacity-100 hover:opacity-100 transition-all"
                          data-testid={`remove-meal-${day.date}`}
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    ) : !day.isPast ? (
                      assigningDay === day.date ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={mealNameInput}
                            onChange={(e) => setMealNameInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') addMealToSchedule(day.date, mealNameInput); if (e.key === 'Escape') setAssigningDay(null); }}
                            placeholder="Meal name..."
                            autoFocus
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-white placeholder:text-slate-600"
                            data-testid={`meal-input-${day.date}`}
                          />
                          <div className="flex gap-1">
                            <button onClick={() => addMealToSchedule(day.date, mealNameInput)} className="flex-1 bg-green-600 text-white text-[9px] py-0.5 rounded font-bold">Add</button>
                            <button onClick={() => { setAssigningDay(null); setMealNameInput(''); }} className="flex-1 bg-slate-700 text-white text-[9px] py-0.5 rounded">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAssigningDay(day.date); setMealNameInput(''); }}
                          className="w-full h-full flex flex-col items-center justify-center text-slate-600 hover:text-slate-400 transition-all"
                          data-testid={`add-meal-${day.date}`}
                        >
                          <CalendarPlus className="w-4 h-4 mb-1" />
                          <span className="text-[9px]">Add Meal</span>
                        </button>
                      )
                    ) : (
                      <p className="text-[10px] text-slate-600 italic">No meal planned</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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

          {/* Suggestion Result */}
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

          {/* Weekly Plan Result */}
          {weeklyPlan && (
            <div className="glass-card rounded-2xl p-5 space-y-3" data-testid="weekly-plan-result">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-secondary" />
                  <h3 className="text-base font-bold text-white">Your Weekly Plan</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addPlanToSchedule}
                    disabled={scheduleLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 hover:bg-accent/30 border border-accent/30 text-accent rounded-full text-xs font-bold transition-all disabled:opacity-50"
                    data-testid="add-plan-to-schedule-btn"
                  >
                    <CalendarPlus className="w-3 h-3" />
                    <span>Add to Schedule</span>
                  </button>
                  <span className="text-xs text-slate-500 self-center">Tap items to select</span>
                </div>
              </div>
              <SelectableTextBlock text={weeklyPlan} selectedItems={selectedItems} onToggle={toggleItem} />
            </div>
          )}

          {/* Sticky Action Bar */}
          {selectedCount > 0 && (
            <div className="fixed bottom-20 md:bottom-4 left-0 right-0 z-40 px-4" data-testid="add-to-cart-bar">
              <div className={`max-w-lg mx-auto flex items-center justify-between bg-green-600 rounded-2xl px-5 py-3 shadow-xl shadow-green-900/30 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">{selectedCount} item{selectedCount !== 1 ? 's' : ''}</span>
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
                { name: 'Pasta Night', icon: '\ud83c\udf5d', pref: 'Italian pasta dishes' },
                { name: 'Taco Tuesday', icon: '\ud83c\udf2e', pref: 'Mexican tacos and sides' },
                { name: 'Pizza Party', icon: '\ud83c\udf55', pref: 'Homemade pizza' },
                { name: 'Stir Fry', icon: '\ud83e\udd58', pref: 'Asian stir fry dishes' },
                { name: 'Burger Night', icon: '\ud83c\udf54', pref: 'Gourmet burgers' },
                { name: 'Soup & Salad', icon: '\ud83e\udd57', pref: 'Light healthy soups and salads' },
                { name: 'Breakfast 4 Dinner', icon: '\ud83e\udd5e', pref: 'Breakfast foods for dinner' },
                { name: 'BBQ Night', icon: '\ud83c\udf56', pref: 'Grilled meats and BBQ' },
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
