import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

export default function DailyDigest({ digest, loading }) {
  if (!digest && !loading) return null;

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-violet-950/40 p-5" data-testid="daily-digest">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-bold text-white">Pixie Daily Digest</h3>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span className="ml-2 text-sm text-slate-400">Pixie is preparing your digest...</span>
        </div>
      </div>
    );
  }

  if (!digest) return null;

  const highlights = digest.member_highlights || [];

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-violet-950/40 p-5" data-testid="daily-digest">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Pixie Daily Digest</h3>
          <p className="text-xs text-cyan-400">{dateStr}</p>
        </div>
      </div>

      <p className="text-white text-sm font-medium mb-2">{digest.greeting}</p>
      <p className="text-slate-300 text-xs leading-relaxed mb-3">{digest.overview}</p>

      {highlights.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {highlights.map((h, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-slate-800/60 rounded-lg px-3 py-1.5 border border-slate-700/40" data-testid={'digest-member-' + i}>
              <span className="text-sm">{h.emoji}</span>
              <div>
                <span className="text-xs font-semibold text-white">{h.name}</span>
                <p className="text-xs text-slate-400">{h.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {digest.tip_of_day && (
          <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
            <p className="text-xs text-yellow-400 font-bold mb-0.5">TIP OF THE DAY</p>
            <p className="text-xs text-slate-300">{digest.tip_of_day}</p>
          </div>
        )}
        {digest.fun_fact && (
          <div className="flex-1 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
            <p className="text-xs text-purple-400 font-bold mb-0.5">FUN FACT</p>
            <p className="text-xs text-slate-300">{digest.fun_fact}</p>
          </div>
        )}
      </div>
    </div>
  );
}
