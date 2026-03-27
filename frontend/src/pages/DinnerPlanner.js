import React, { useState, useEffect, useCallback } from 'react';
import { Utensils, ChefHat, Sparkles, Calendar, History, ShoppingCart, Check, CalendarPlus, X, Trash2, Pencil, ArrowRightLeft } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function buildWeekDates() {
  var today = new Date();
  var monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  var result = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(monday);
    d.setDate(monday.getDate() + i);
    var dateStr = d.toISOString().split('T')[0];
    var isToday = dateStr === today.toISOString().split('T')[0];
    var isPast = d < new Date(today.toISOString().split('T')[0]);
    result.push({ name: DAY_NAMES[i], date: dateStr, isToday: isToday, isPast: isPast, display: (d.getMonth() + 1) + '/' + d.getDate() });
  }
  return result;
}

var WEEK_DATES = buildWeekDates();
var FUTURE_DATES = [];
for (var _i = 0; _i < WEEK_DATES.length; _i++) {
  if (!WEEK_DATES[_i].isPast) FUTURE_DATES.push(WEEK_DATES[_i]);
}

function DayOptions() {
  var items = [];
  items.push(<option key="empty" value="">Pick a day...</option>);
  for (var j = 0; j < FUTURE_DATES.length; j++) {
    var fd = FUTURE_DATES[j];
    items.push(<option key={fd.date} value={fd.date}>{fd.name} {fd.display}{fd.isToday ? ' (Today)' : ''}</option>);
  }
  return items;
}

function IngredientChips({ items, selected, onToggle }) {
  var chips = [];
  for (var i = 0; i < items.length; i++) {
    var ing = items[i];
    var isSel = selected.has(ing);
    chips.push(
      <button key={i} onClick={function(x) { return function() { onToggle(x); }; }(ing)}
        className={'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-all ' + (isSel ? 'bg-green-500/15 border border-green-500/30 text-green-300' : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:border-slate-500')}>
        {isSel && <Check className="w-2.5 h-2.5" />}{ing}
      </button>
    );
  }
  return <div className="flex flex-wrap gap-1">{chips}</div>;
}

export default function DinnerPlanner({ user }) {
  var [suggestion, setSuggestion] = useState(null);
  var [rawSuggestion, setRawSuggestion] = useState('');
  var [loading, setLoading] = useState(false);
  var [weeklyLoading, setWeeklyLoading] = useState(false);
  var [ingredients, setIngredients] = useState('');
  var [preferences, setPreferences] = useState('');
  var [sidebarOpen, setSidebarOpen] = useState(false);
  var [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  var [structuredPlan, setStructuredPlan] = useState(null);
  var [rawPlan, setRawPlan] = useState('');
  var [savedPlans, setSavedPlans] = useState([]);
  var [showHistory, setShowHistory] = useState(false);
  var [familySize, setFamilySize] = useState(4);
  var [budget, setBudget] = useState('moderate');
  var [schedule, setSchedule] = useState([]);
  var [aiFillingDays, setAiFillingDays] = useState(false);
  var [editingDay, setEditingDay] = useState(null);
  var [movingFrom, setMovingFrom] = useState(null);
  var [assigningDay, setAssigningDay] = useState(null);
  var [mealNameInput, setMealNameInput] = useState('');
  // Suggestion ingredient selection
  var [sugSelectedIngs, setSugSelectedIngs] = useState(new Set());
  var [sugTargetDay, setSugTargetDay] = useState('');
  // Plan day selections (per-day ingredient sets)
  var [planDayIngs, setPlanDayIngs] = useState({});
  var [planDayTargets, setPlanDayTargets] = useState({});
  // Recipe Book
  var [recipes, setRecipes] = useState([]);
  var [showRecipeBook, setShowRecipeBook] = useState(false);
  var [showAddRecipe, setShowAddRecipe] = useState(false);
  var [newRecipe, setNewRecipe] = useState({ name: '', category: 'dinner', prep_time: '', cook_time: '', ingredients: '', steps: '', servings: 4 });

  var fetchSchedule = useCallback(function() {
    return fetch(BACKEND_URL + '/api/dinner/schedule?week_start=' + WEEK_DATES[0].date, { credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(data) { setSchedule(data.schedule || []); })
      .catch(function() {});
  }, []);

  useEffect(function() { fetchSavedPlans(); fetchSchedule(); fetchRecipes(); }, [fetchSchedule]);

  function fetchSavedPlans() {
    fetch(BACKEND_URL + '/api/dinner/plans', { credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(data) { setSavedPlans(data.plans || []); })
      .catch(function() {});
  }

  function fetchRecipes() {
    var token = localStorage.getItem('dev_session_token');
    var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    fetch(BACKEND_URL + '/api/recipes', { credentials: 'include', headers: headers })
      .then(function(r) { return r.json(); })
      .then(function(data) { setRecipes(data.recipes || []); })
      .catch(function() {});
  }

  function handleSaveRecipe() {
    if (!newRecipe.name.trim()) { toast.error('Recipe name required'); return; }
    var token = localStorage.getItem('dev_session_token');
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var ingredientsList = newRecipe.ingredients.split('\n').filter(function(i) { return i.trim(); });
    var stepsList = newRecipe.steps.split('\n').filter(function(s) { return s.trim(); });
    fetch(BACKEND_URL + '/api/recipes', {
      method: 'POST', headers: headers, credentials: 'include',
      body: JSON.stringify({
        name: newRecipe.name, category: newRecipe.category,
        prep_time: newRecipe.prep_time, cook_time: newRecipe.cook_time,
        ingredients: ingredientsList, steps: stepsList, servings: parseInt(newRecipe.servings) || 4
      })
    }).then(function(r) { if (r.ok) { toast.success('Recipe saved!'); setShowAddRecipe(false); setNewRecipe({ name: '', category: 'dinner', prep_time: '', cook_time: '', ingredients: '', steps: '', servings: 4 }); fetchRecipes(); } })
      .catch(function() { toast.error('Failed to save recipe'); });
  }

  function handleRecipeToShopping(recipeId) {
    var token = localStorage.getItem('dev_session_token');
    var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    fetch(BACKEND_URL + '/api/recipes/' + recipeId + '/to-shopping', {
      method: 'POST', headers: headers, credentials: 'include'
    }).then(function(r) { return r.json(); }).then(function(data) {
      toast.success(data.message || 'Ingredients added!');
    }).catch(function() { toast.error('Failed'); });
  }

  function handleDeleteRecipe(recipeId) {
    var token = localStorage.getItem('dev_session_token');
    var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    fetch(BACKEND_URL + '/api/recipes/' + recipeId, {
      method: 'DELETE', headers: headers, credentials: 'include'
    }).then(function() { toast.success('Recipe deleted'); fetchRecipes(); })
      .catch(function() { toast.error('Failed'); });
  }

  function handleGetSuggestion(e) {
    e.preventDefault();
    setLoading(true); setSuggestion(null); setRawSuggestion(''); setSugSelectedIngs(new Set()); setSugTargetDay('');
    fetch(BACKEND_URL + '/api/dinner/suggest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ ingredients: ingredients, preferences: preferences })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.structured) setSuggestion(data.structured);
      else setRawSuggestion(data.suggestion || '');
    }).catch(function() { toast.error('Failed'); }).finally(function() { setLoading(false); });
  }

  function handleGetWeeklyPlan() {
    setWeeklyLoading(true); setStructuredPlan(null); setRawPlan(''); setPlanDayIngs({}); setPlanDayTargets({});
    fetch(BACKEND_URL + '/api/dinner/weekly-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ preferences: preferences, family_size: familySize, budget: budget })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.structured_plan && data.structured_plan.days) setStructuredPlan(data.structured_plan);
      else setRawPlan(data.plan || '');
    }).catch(function() { toast.error('Failed'); }).finally(function() { setWeeklyLoading(false); });
  }

  function addMealToSchedule(date, mealName, desc) {
    if (!mealName || !mealName.trim()) return;
    fetch(BACKEND_URL + '/api/dinner/schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ meals: [{ date: date, meal_name: mealName, description: desc || '', source: 'plan' }] })
    }).then(function(r) { if (r.ok) { toast.success('Scheduled!'); fetchSchedule(); setAssigningDay(null); setMealNameInput(''); } })
      .catch(function() { toast.error('Failed'); });
  }

  function addIngredientsToCart(items) {
    var promises = [];
    for (var k = 0; k < items.length; k++) {
      promises.push(fetch(BACKEND_URL + '/api/shopping', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: items[k] })
      }));
    }
    Promise.all(promises).then(function() { toast.success('Added ' + items.length + ' to shopping list!'); }).catch(function() { toast.error('Failed'); });
  }

  function removeMeal(date) {
    fetch(BACKEND_URL + '/api/dinner/schedule/' + date, { method: 'DELETE', credentials: 'include' })
      .then(function() { toast.success('Removed'); fetchSchedule(); }).catch(function() { toast.error('Failed'); });
  }

  function updateMeal(date, mealName, desc) {
    fetch(BACKEND_URL + '/api/dinner/schedule/' + date, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ meal_name: mealName, description: desc })
    }).then(function() { toast.success('Updated!'); fetchSchedule(); setEditingDay(null); }).catch(function() { toast.error('Failed'); });
  }

  function moveMeal(fromDate, toDate) {
    fetch(BACKEND_URL + '/api/dinner/schedule/move', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ from_date: fromDate, to_date: toDate })
    }).then(function(r) { return r.json(); }).then(function(data) {
      toast.success(data.swapped ? 'Swapped!' : 'Moved!'); fetchSchedule(); setMovingFrom(null);
    }).catch(function() { toast.error('Failed'); });
  }

  function aiFillUnplannedDays() {
    var schedMap = {};
    for (var s = 0; s < schedule.length; s++) schedMap[schedule[s].date] = true;
    var unplanned = [];
    for (var u = 0; u < WEEK_DATES.length; u++) {
      if (!WEEK_DATES[u].isPast && !schedMap[WEEK_DATES[u].date]) unplanned.push(WEEK_DATES[u].date);
    }
    if (unplanned.length === 0) { toast.info('All planned!'); return; }
    setAiFillingDays(true);
    fetch(BACKEND_URL + '/api/dinner/schedule/ai-fill', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ unplanned_days: unplanned, preferences: preferences })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.suggestions && data.suggestions.length > 0) {
        var meals = [];
        for (var m = 0; m < data.suggestions.length; m++) {
          meals.push({ date: data.suggestions[m].date, meal_name: data.suggestions[m].meal_name, description: data.suggestions[m].description || '', source: 'ai' });
        }
        return fetch(BACKEND_URL + '/api/dinner/schedule', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ meals: meals })
        }).then(function(r) { return r.json(); }).then(function(d) { toast.success('AI scheduled ' + d.count + ' meals!'); fetchSchedule(); });
      } else { toast.error('No suggestions'); }
    }).catch(function() { toast.error('Failed'); }).finally(function() { setAiFillingDays(false); });
  }

  // Pre-compute everything before JSX
  var scheduleMap = {};
  for (var si = 0; si < schedule.length; si++) scheduleMap[schedule[si].date] = schedule[si];
  var unplannedCount = 0;
  for (var ui = 0; ui < WEEK_DATES.length; ui++) {
    if (!WEEK_DATES[ui].isPast && !scheduleMap[WEEK_DATES[ui].date]) unplannedCount++;
  }

  // Build schedule day cards
  var scheduleDayCards = [];
  for (var di = 0; di < WEEK_DATES.length; di++) {
    var wd = WEEK_DATES[di];
    var meal = scheduleMap[wd.date];
    var isMovingThis = movingFrom === wd.date;
    var isMovingTarget = movingFrom !== null && movingFrom !== wd.date && !wd.isPast;
    var cls = 'group relative rounded-xl p-3 border transition-all min-h-[100px] ';
    if (isMovingThis) cls += 'border-yellow-500 bg-yellow-500/10 ring-2 ring-yellow-500/30';
    else if (isMovingTarget) cls += 'border-dashed border-blue-500/50 bg-blue-500/5 cursor-pointer hover:bg-blue-500/10';
    else if (wd.isToday) cls += 'border-primary bg-primary/10';
    else if (meal) cls += 'border-green-500/30 bg-green-500/5';
    else if (wd.isPast) cls += 'border-slate-800 bg-slate-900/30 opacity-50';
    else cls += 'border-slate-800 bg-slate-900/50 hover:border-slate-600';

    scheduleDayCards.push(
      <ScheduleDay key={wd.date} day={wd} meal={meal} cls={cls}
        isMovingTarget={isMovingTarget} movingFrom={movingFrom}
        editingDay={editingDay} setEditingDay={setEditingDay}
        setMovingFrom={setMovingFrom} assigningDay={assigningDay}
        setAssigningDay={setAssigningDay} mealNameInput={mealNameInput}
        setMealNameInput={setMealNameInput} addMealToSchedule={addMealToSchedule}
        updateMeal={updateMeal} removeMeal={removeMeal} moveMeal={moveMeal} />
    );
  }

  // Build plan day cards
  var planDayCards = [];
  if (structuredPlan && structuredPlan.days) {
    var days = structuredPlan.days;
    for (var pi = 0; pi < days.length; pi++) {
      planDayCards.push(
        <PlanCard key={pi} dayData={days[pi]} addMealToSchedule={addMealToSchedule} addIngredientsToCart={addIngredientsToCart} />
      );
    }
  }

  // Build saved plans list
  var savedPlanItems = [];
  for (var sp = 0; sp < savedPlans.length; sp++) {
    var plan = savedPlans[sp];
    savedPlanItems.push(
      <button key={plan.plan_id} onClick={function(p) { return function() {
        if (p.structured_plan && p.structured_plan.days) setStructuredPlan(p.structured_plan);
        else setRawPlan(p.plan); setShowHistory(false);
      }; }(plan)} className="w-full text-left p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all">
        <p className="text-sm text-white font-medium">Week of {plan.week_start}</p>
        <p className="text-xs text-slate-400 truncate">{plan.preferences || 'No preferences'}</p>
      </button>
    );
  }

  // Suggestion ingredients
  var sugIngChips = null;
  if (suggestion && suggestion.ingredients) {
    var sugIngs = suggestion.ingredients;
    sugIngChips = <IngredientChips items={sugIngs} selected={sugSelectedIngs} onToggle={function(ing) {
      setSugSelectedIngs(function(prev) { var n = new Set(prev); if (n.has(ing)) n.delete(ing); else n.add(ing); return n; });
    }} />;
  }

  var sugSteps = [];
  if (suggestion && suggestion.steps) {
    for (var sti = 0; sti < suggestion.steps.length; sti++) {
      sugSteps.push(<li key={sti} className="text-xs text-slate-300 leading-relaxed">{suggestion.steps[sti]}</li>);
    }
  }

  // Family size options
  var sizeOptions = [];
  for (var fs = 2; fs <= 8; fs++) sizeOptions.push(<option key={fs} value={fs}>{fs} people</option>);

  // Quick meals
  var quickMeals = [
    { name: 'Pasta Night', pref: 'Italian pasta dishes' },
    { name: 'Taco Tuesday', pref: 'Mexican tacos and sides' },
    { name: 'Pizza Party', pref: 'Homemade pizza' },
    { name: 'Stir Fry', pref: 'Asian stir fry dishes' },
    { name: 'Burger Night', pref: 'Gourmet burgers' },
    { name: 'Soup & Salad', pref: 'Light healthy soups and salads' },
    { name: 'Breakfast 4 Dinner', pref: 'Breakfast foods for dinner' },
    { name: 'BBQ Night', pref: 'Grilled meats and BBQ' },
  ];
  var quickMealCards = [];
  for (var qi = 0; qi < quickMeals.length; qi++) {
    quickMealCards.push(
      <button key={quickMeals[qi].name} onClick={function(p) { return function() { setPreferences(p); }; }(quickMeals[qi].pref)}
        className="glass-card rounded-xl p-4 hover:border-primary/50 transition-all text-center"
        data-testid={'quick-meal-' + quickMeals[qi].name.toLowerCase().replace(/ /g, '-')}>
        <p className="text-sm font-medium text-white">{quickMeals[qi].name}</p>
      </button>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <main className={'flex-1 overflow-y-auto transition-all duration-300 ' + (sidebarCollapsed ? 'md:ml-16' : 'md:ml-64')}>
        <div className="p-4 pt-16 md:pt-4 lg:p-6 lg:pt-6 pb-24 md:pb-6 space-y-4" data-testid="dinner-planner">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white flex items-center space-x-2">
                <Utensils className="w-6 h-6 text-primary" /><span>Dinner Planner</span>
              </h1>
              <p className="text-sm text-slate-400 mt-1">Plan meals, schedule dinners, build your shopping list</p>
            </div>
            {savedPlans.length > 0 && (
              <button onClick={function() { setShowHistory(!showHistory); }} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-all" data-testid="show-history">
                <History className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-300 hidden sm:inline">History</span>
              </button>
            )}
            <button onClick={function() { setShowRecipeBook(!showRecipeBook); }} className={'flex items-center space-x-2 px-4 py-2 rounded-full transition-all ' + (showRecipeBook ? 'bg-primary text-white' : 'bg-slate-800 hover:bg-slate-700')} data-testid="recipe-book-btn">
              <Utensils className="w-4 h-4" /><span className="text-sm hidden sm:inline">Recipe Book</span>
            </button>
          </header>

          <div className="glass-card rounded-2xl p-5 space-y-4" data-testid="dinner-schedule">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-accent" /><h2 className="text-lg font-bold text-white">This Week's Dinners</h2>
              </div>
              <div className="flex gap-2">
                {movingFrom && (
                  <button onClick={function() { setMovingFrom(null); }} className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-full text-xs font-bold">Cancel</button>
                )}
                {unplannedCount > 0 && (
                  <button onClick={aiFillUnplannedDays} disabled={aiFillingDays}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 hover:bg-accent/30 border border-accent/30 text-accent rounded-full text-xs font-bold transition-all disabled:opacity-50"
                    data-testid="ai-fill-btn">
                    {aiFillingDays ? <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-accent" /> : <Sparkles className="w-3 h-3" />}
                    AI Fill {unplannedCount} Day{unplannedCount !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {scheduleDayCards}
            </div>
          </div>

          {showHistory && savedPlanItems.length > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-sm font-bold text-white mb-3">Previous Meal Plans</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">{savedPlanItems}</div>
            </div>
          )}

          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center space-x-2 mb-2">
              <ChefHat className="w-5 h-5 text-accent" /><h2 className="text-lg font-bold text-white">Quick Dinner Idea</h2>
            </div>
            <form onSubmit={handleGetSuggestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Available Ingredients</label>
                <input type="text" value={ingredients} onChange={function(e) { setIngredients(e.target.value); }}
                  placeholder="e.g., chicken, rice, tomatoes" className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600" data-testid="ingredients-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Dietary Preferences</label>
                <input type="text" value={preferences} onChange={function(e) { setPreferences(e.target.value); }}
                  placeholder="e.g., vegetarian, kid-friendly" className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600" data-testid="preferences-input" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-primary hover:bg-primary/80 disabled:bg-slate-800 text-white font-bold py-3 px-4 rounded-full transition-all flex items-center justify-center space-x-2" data-testid="get-suggestion-button">
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" /> : <Sparkles className="w-5 h-5" />}
                <span>{loading ? 'Thinking...' : 'Get Dinner Idea'}</span>
              </button>
            </form>
          </div>

          {suggestion && (
            <div className="glass-card rounded-2xl p-5 space-y-3" data-testid="suggestion-result">
              <div className="flex items-center space-x-2 mb-2">
                <Sparkles className="w-5 h-5 text-accent" /><h3 className="text-base font-bold text-white">{suggestion.meal_name}</h3>
              </div>
              {suggestion.description && <p className="text-sm text-slate-300">{suggestion.description}</p>}
              {suggestion.prep_time && <p className="text-xs text-slate-500">Prep: {suggestion.prep_time} {suggestion.cook_time ? '| Cook: ' + suggestion.cook_time : ''}</p>}
              <div className="flex items-center gap-2 py-2 border-t border-b border-slate-800">
                <CalendarPlus className="w-4 h-4 text-accent" />
                <span className="text-xs text-white font-bold flex-1">{suggestion.meal_name}</span>
                <select value={sugTargetDay} onChange={function(e) { setSugTargetDay(e.target.value); }}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white" data-testid="suggestion-target-day">
                  <DayOptions />
                </select>
                <button onClick={function() { if (sugTargetDay) addMealToSchedule(sugTargetDay, suggestion.meal_name, suggestion.description || ''); else toast.error('Pick a day'); }}
                  className="px-3 py-1 bg-accent/20 border border-accent/30 text-accent rounded-lg text-[10px] font-bold" data-testid="add-suggestion-schedule">Schedule</button>
              </div>
              {sugIngChips && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Ingredients</span>
                    <button onClick={function() { setSugSelectedIngs(function(p) { return p.size === suggestion.ingredients.length ? new Set() : new Set(suggestion.ingredients); }); }}
                      className="text-[9px] text-primary hover:underline">Toggle All</button>
                  </div>
                  {sugIngChips}
                  {sugSelectedIngs.size > 0 && (
                    <button onClick={function() { addIngredientsToCart(Array.from(sugSelectedIngs)); setSugSelectedIngs(new Set()); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 text-green-400 rounded-lg text-[10px] font-bold transition-all"
                      data-testid="add-suggestion-ingredients">
                      <ShoppingCart className="w-3 h-3" />Add {sugSelectedIngs.size} to Shopping List
                    </button>
                  )}
                </div>
              )}
              {sugSteps.length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Steps</span>
                  <ol className="list-decimal list-inside space-y-1 mt-1">{sugSteps}</ol>
                </div>
              )}
            </div>
          )}

          {rawSuggestion && !suggestion && (
            <div className="glass-card rounded-2xl p-5" data-testid="suggestion-result-raw">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{rawSuggestion}</pre>
            </div>
          )}

          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="w-5 h-5 text-secondary" /><h2 className="text-lg font-bold text-white">Weekly Meal Plan</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Family Size</label>
                <select value={familySize} onChange={function(e) { setFamilySize(parseInt(e.target.value)); }}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm" data-testid="family-size">
                  {sizeOptions}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Budget</label>
                <select value={budget} onChange={function(e) { setBudget(e.target.value); }}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm" data-testid="budget">
                  <option value="budget">Budget-friendly</option>
                  <option value="moderate">Moderate</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-medium text-slate-400 mb-1"> </label>
                <button onClick={handleGetWeeklyPlan} disabled={weeklyLoading}
                  className="w-full bg-secondary hover:bg-secondary/80 disabled:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center space-x-2" data-testid="get-weekly-plan">
                  {weeklyLoading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" /> : <Calendar className="w-4 h-4" />}
                  <span>{weeklyLoading ? 'Generating...' : 'Generate Plan'}</span>
                </button>
              </div>
            </div>
          </div>

          {planDayCards.length > 0 && (
            <div className="space-y-3" data-testid="structured-plan">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-secondary" /><h3 className="text-base font-bold text-white">Your Weekly Plan</h3>
                </div>
                <span className="text-xs text-slate-500">Pick days, select ingredients</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{planDayCards}</div>
            </div>
          )}

          {rawPlan && !structuredPlan && (
            <div className="glass-card rounded-2xl p-5" data-testid="raw-plan">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{rawPlan}</pre>
            </div>
          )}

          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white mb-4">Quick Meal Ideas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{quickMealCards}</div>
          </div>

          {/* Recipe Book */}
          {showRecipeBook && (
            <div className="glass-card rounded-2xl p-5 border border-primary/30" data-testid="recipe-book">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Utensils className="w-5 h-5 text-primary" /> Recipe Book</h3>
                <button onClick={function() { setShowAddRecipe(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary/80 text-white rounded-full text-xs font-bold" data-testid="add-recipe-btn">
                  <span>+ Add Recipe</span>
                </button>
              </div>
              {recipes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No saved recipes yet. Add your family favorites!</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recipes.map(function(recipe) {
                    return (
                      <div key={recipe.recipe_id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-slate-500 transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="text-sm font-bold text-white">{recipe.name}</h4>
                            <span className="text-[10px] text-primary capitalize">{recipe.category}</span>
                          </div>
                          <button onClick={function() { handleDeleteRecipe(recipe.recipe_id); }} className="text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        {(recipe.prep_time || recipe.cook_time) && (
                          <p className="text-[10px] text-slate-500 mb-2">
                            {recipe.prep_time && 'Prep: ' + recipe.prep_time}
                            {recipe.cook_time && ' | Cook: ' + recipe.cook_time}
                            {' | Serves ' + recipe.servings}
                          </p>
                        )}
                        {recipe.ingredients && recipe.ingredients.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Ingredients ({recipe.ingredients.length})</p>
                            <p className="text-[10px] text-slate-400 line-clamp-2">{recipe.ingredients.join(', ')}</p>
                          </div>
                        )}
                        <button onClick={function() { handleRecipeToShopping(recipe.recipe_id); }}
                          className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 text-green-400 rounded-lg text-[10px] font-bold transition-all mt-2"
                          data-testid={'recipe-to-shopping-' + recipe.recipe_id}>
                          <ShoppingCart className="w-3 h-3" /> Add Ingredients to Shopping
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Add Recipe Modal */}
          {showAddRecipe && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="glass-card rounded-2xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-black text-white">Save Recipe</h2>
                  <button onClick={function() { setShowAddRecipe(false); }} className="p-1 hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="space-y-3">
                  <input type="text" placeholder="Recipe name" value={newRecipe.name}
                    onChange={function(e) { setNewRecipe(Object.assign({}, newRecipe, { name: e.target.value })); }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none" data-testid="recipe-name-input" />
                  <select value={newRecipe.category} onChange={function(e) { setNewRecipe(Object.assign({}, newRecipe, { category: e.target.value })); }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none">
                    <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option><option value="snack">Snack</option><option value="dessert">Dessert</option>
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" placeholder="Prep time" value={newRecipe.prep_time}
                      onChange={function(e) { setNewRecipe(Object.assign({}, newRecipe, { prep_time: e.target.value })); }}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none" />
                    <input type="text" placeholder="Cook time" value={newRecipe.cook_time}
                      onChange={function(e) { setNewRecipe(Object.assign({}, newRecipe, { cook_time: e.target.value })); }}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none" />
                    <input type="number" placeholder="Servings" value={newRecipe.servings}
                      onChange={function(e) { setNewRecipe(Object.assign({}, newRecipe, { servings: e.target.value })); }}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Ingredients (one per line)</label>
                    <textarea value={newRecipe.ingredients} onChange={function(e) { setNewRecipe(Object.assign({}, newRecipe, { ingredients: e.target.value })); }}
                      placeholder="1 cup flour&#10;2 eggs&#10;1 tsp salt" rows="4"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none resize-none" data-testid="recipe-ingredients-input" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Steps (one per line)</label>
                    <textarea value={newRecipe.steps} onChange={function(e) { setNewRecipe(Object.assign({}, newRecipe, { steps: e.target.value })); }}
                      placeholder="Mix dry ingredients&#10;Add wet ingredients&#10;Bake at 350F for 30 min" rows="4"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none resize-none" data-testid="recipe-steps-input" />
                  </div>
                  <button onClick={handleSaveRecipe}
                    className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-3 rounded-xl" data-testid="save-recipe-btn">
                    Save Recipe
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ScheduleDay({ day, meal, cls, isMovingTarget, movingFrom, editingDay, setEditingDay, setMovingFrom, assigningDay, setAssigningDay, mealNameInput, setMealNameInput, addMealToSchedule, updateMeal, removeMeal, moveMeal }) {
  function handleClick() { if (isMovingTarget) moveMeal(movingFrom, day.date); }

  var content;
  if (meal && editingDay && editingDay.date === day.date) {
    content = (
      <div className="space-y-1.5" onClick={function(e) { e.stopPropagation(); }}>
        <input type="text" value={editingDay.meal_name} onChange={function(e) { setEditingDay({ date: editingDay.date, meal_name: e.target.value, description: editingDay.description }); }}
          className="w-full bg-slate-950 border border-slate-600 rounded-lg px-2 py-1 text-[11px] text-white" autoFocus data-testid={'edit-name-' + day.date} />
        <input type="text" value={editingDay.description || ''} onChange={function(e) { setEditingDay({ date: editingDay.date, meal_name: editingDay.meal_name, description: e.target.value }); }}
          placeholder="Description..." className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-slate-300 placeholder:text-slate-600" />
        <div className="flex gap-1">
          <button onClick={function() { updateMeal(day.date, editingDay.meal_name, editingDay.description); }} className="flex-1 bg-green-600 text-white text-[9px] py-1 rounded font-bold">Save</button>
          <button onClick={function() { setEditingDay(null); }} className="flex-1 bg-slate-700 text-white text-[9px] py-1 rounded">Cancel</button>
        </div>
      </div>
    );
  } else if (meal) {
    content = (
      <div className="space-y-1">
        <p className="text-xs font-bold text-white leading-tight">{meal.meal_name}</p>
        {meal.description && <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">{meal.description}</p>}
        <div className="flex gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={function(e) { e.stopPropagation(); }}>
          <button onClick={function() { setEditingDay({ date: day.date, meal_name: meal.meal_name, description: meal.description || '' }); }}
            className="p-1 hover:bg-slate-700 rounded" data-testid={'edit-btn-' + day.date}><Pencil className="w-3 h-3 text-slate-400" /></button>
          <button onClick={function() { setMovingFrom(movingFrom === day.date ? null : day.date); }}
            className={'p-1 rounded ' + (movingFrom === day.date ? 'bg-yellow-500/20' : 'hover:bg-slate-700')} data-testid={'move-btn-' + day.date}><ArrowRightLeft className="w-3 h-3 text-slate-400" /></button>
          <button onClick={function() { removeMeal(day.date); }}
            className="p-1 hover:bg-red-500/20 rounded" data-testid={'delete-btn-' + day.date}><Trash2 className="w-3 h-3 text-red-400" /></button>
        </div>
      </div>
    );
  } else if (day.isPast) {
    content = <p className="text-[10px] text-slate-600 italic">No meal</p>;
  } else if (assigningDay === day.date) {
    content = (
      <div className="space-y-1" onClick={function(e) { e.stopPropagation(); }}>
        <input type="text" value={mealNameInput} onChange={function(e) { setMealNameInput(e.target.value); }}
          onKeyDown={function(e) { if (e.key === 'Enter') addMealToSchedule(day.date, mealNameInput); if (e.key === 'Escape') setAssigningDay(null); }}
          placeholder="Meal name..." autoFocus className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-white placeholder:text-slate-600"
          data-testid={'meal-input-' + day.date} />
        <div className="flex gap-1">
          <button onClick={function() { addMealToSchedule(day.date, mealNameInput); }} className="flex-1 bg-green-600 text-white text-[9px] py-0.5 rounded font-bold">Add</button>
          <button onClick={function() { setAssigningDay(null); setMealNameInput(''); }} className="flex-1 bg-slate-700 text-white text-[9px] py-0.5 rounded">Cancel</button>
        </div>
      </div>
    );
  } else {
    content = (
      <button onClick={function(e) { e.stopPropagation(); setAssigningDay(day.date); setMealNameInput(''); }}
        className="w-full h-full flex flex-col items-center justify-center text-slate-600 hover:text-slate-400 transition-all pt-2"
        data-testid={'add-meal-' + day.date}>
        <CalendarPlus className="w-4 h-4 mb-1" /><span className="text-[9px]">Add Meal</span>
      </button>
    );
  }

  return (
    <div className={cls} onClick={handleClick} data-testid={'schedule-day-' + day.date}>
      <div className="flex items-center justify-between mb-1">
        <span className={'text-[10px] font-bold ' + (day.isToday ? 'text-primary' : 'text-slate-400')}>{day.name.slice(0, 3)} {day.display}</span>
        {day.isToday && <span className="text-[8px] bg-primary/20 text-primary px-1.5 rounded-full font-bold">TODAY</span>}
        {isMovingTarget && <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 rounded-full font-bold">DROP</span>}
      </div>
      {content}
    </div>
  );
}

function PlanCard({ dayData, addMealToSchedule, addIngredientsToCart }) {
  var [selIngs, setSelIngs] = useState(new Set());
  var [targetDate, setTargetDate] = useState('');

  var ingChips = [];
  var ings = dayData.ingredients || [];
  for (var i = 0; i < ings.length; i++) {
    var ing = ings[i];
    var sel = selIngs.has(ing);
    ingChips.push(
      <button key={i} onClick={function(x) { return function() { setSelIngs(function(p) { var n = new Set(p); if (n.has(x)) n.delete(x); else n.add(x); return n; }); }; }(ing)}
        className={'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-all ' + (sel ? 'bg-green-500/15 border border-green-500/30 text-green-300' : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:border-slate-500')}
        data-testid={'ingredient-' + dayData.day + '-' + i}>
        {sel && <Check className="w-2.5 h-2.5" />}{ing}
      </button>
    );
  }

  return (
    <div className="glass-card rounded-xl p-4 space-y-3 border border-slate-800 hover:border-slate-600 transition-all" data-testid={'plan-day-' + dayData.day}>
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{dayData.day}</span>
        <h4 className="text-sm font-bold text-white leading-tight">{dayData.meal_name}</h4>
      </div>
      {dayData.description && <p className="text-[11px] text-slate-400 leading-snug">{dayData.description}</p>}
      {dayData.prep_time && <p className="text-[10px] text-slate-500">Prep: {dayData.prep_time} {dayData.cook_time ? '| Cook: ' + dayData.cook_time : ''}</p>}
      <div className="flex items-center gap-2">
        <select value={targetDate} onChange={function(e) { setTargetDate(e.target.value); }}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white"
          data-testid={'target-date-' + dayData.day}>
          <DayOptions />
        </select>
        <button onClick={function() { if (targetDate) { addMealToSchedule(targetDate, dayData.meal_name, dayData.description || ''); setTargetDate(''); } else toast.error('Pick a day'); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-accent/20 hover:bg-accent/30 border border-accent/30 text-accent rounded-lg text-[10px] font-bold transition-all whitespace-nowrap"
          data-testid={'add-to-schedule-' + dayData.day}>
          <CalendarPlus className="w-3 h-3" />Schedule
        </button>
      </div>
      {ings.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Ingredients</span>
            <button onClick={function() { setSelIngs(function(p) { return p.size === ings.length ? new Set() : new Set(ings); }); }}
              className="text-[9px] text-primary hover:underline">Toggle All</button>
          </div>
          <div className="flex flex-wrap gap-1">{ingChips}</div>
          {selIngs.size > 0 && (
            <button onClick={function() { addIngredientsToCart(Array.from(selIngs)); setSelIngs(new Set()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 text-green-400 rounded-lg text-[10px] font-bold transition-all"
              data-testid={'add-ingredients-' + dayData.day}>
              <ShoppingCart className="w-3 h-3" />Add {selIngs.size} to Shopping List
            </button>
          )}
        </div>
      )}
    </div>
  );
}
