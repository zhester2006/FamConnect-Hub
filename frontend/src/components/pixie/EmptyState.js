import React from 'react';
import { Sparkles } from 'lucide-react';

const defaultSuggestions = [
  "What's on the calendar today?",
  "Do we have chicken in the pantry?",
  "Has everyone finished their chores?",
  "Add milk to the shopping list",
  "Send a chat message saying dinner is ready"
];

export function EmptyState({ userName, onSelect }) {
  const buttons = [];
  for (let i = 0; i < defaultSuggestions.length; i++) {
    const q = defaultSuggestions[i];
    buttons.push(
      <button
        key={i}
        onClick={() => onSelect(q)}
        className="block w-full text-left text-xs text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 rounded-lg px-3 py-2 transition-all"
        data-testid={`pixie-suggestion-${i}`}
      >
        {q}
      </button>
    );
  }

  return (
    <div className="text-center py-6">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mx-auto mb-3">
        <Sparkles className="w-7 h-7 text-violet-400" />
      </div>
      <p className="text-sm font-bold text-white mb-1">
        Hey {userName}!
      </p>
      <p className="text-xs text-slate-400 max-w-[260px] mx-auto mb-4">
        I can read your calendar, check pantry, manage chores, send messages, and much more!
      </p>
      <div className="space-y-1.5">
        {buttons}
      </div>
    </div>
  );
}
