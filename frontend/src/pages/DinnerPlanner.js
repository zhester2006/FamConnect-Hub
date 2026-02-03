import React, { useState } from 'react';
import { Utensils, ChefHat, Sparkles } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function DinnerPlanner({ user }) {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [ingredients, setIngredients] = useState('');
  const [preferences, setPreferences] = useState('');

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

  return (
    <div className="min-h-screen bg-slate-950 pb-24" data-testid="dinner-planner">
      <div className="p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-black text-white flex items-center space-x-2">
            <Utensils className="w-7 h-7 text-primary" />
            <span>Dinner Planner</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Let AI help you plan tonight's dinner</p>
        </header>

        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center space-x-2 mb-2">
            <ChefHat className="w-6 h-6 text-accent" />
            <h2 className="text-lg font-bold text-white">Get AI Suggestions</h2>
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
              className="w-full bg-primary hover:bg-primary/80 disabled:bg-slate-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-full transition-all neon-glow flex items-center justify-center space-x-2"
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
                  <span>Get Dinner Ideas</span>
                </>
              )}
            </button>
          </form>
        </div>

        {suggestion && (
          <div className="glass-card rounded-2xl p-6 space-y-3" data-testid="suggestion-result">
            <div className="flex items-center space-x-2 mb-3">
              <Sparkles className="w-6 h-6 text-accent" />
              <h3 className="text-lg font-bold text-white">AI Suggestion</h3>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-white whitespace-pre-wrap leading-relaxed">{suggestion}</p>
            </div>
          </div>
        )}

        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Quick Meal Ideas</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: 'Pasta Night', icon: '🍝' },
              { name: 'Taco Tuesday', icon: '🌯' },
              { name: 'Pizza Party', icon: '🍕' },
              { name: 'Stir Fry', icon: '🥘' },
            ].map((meal) => (
              <button
                key={meal.name}
                onClick={() => setPreferences(meal.name)}
                className="glass-card rounded-xl p-4 hover:border-primary/50 transition-all text-center"
                data-testid={`quick-meal-${meal.name.toLowerCase().replace(' ', '-')}`}
              >
                <span className="text-3xl mb-2 block">{meal.icon}</span>
                <p className="text-sm font-medium text-white">{meal.name}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <BottomNav userRole={user?.role} />
    </div>
  );
}