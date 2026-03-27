import React, { useState, useEffect, useCallback } from 'react';
import { Sun, Moon, Plus, Check, X, Trash2, Clock, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function isItemDone(item, userId) {
  if (!item || !userId) return false;
  var completedBy = item.completed_by;
  if (!completedBy || !Array.isArray(completedBy)) return false;
  return completedBy.includes(userId);
}

export default function Routines({ user }) {
  const [routines, setRoutines] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [routineType, setRoutineType] = useState('morning');
  const [routineItems, setRoutineItems] = useState(['']);
  const [creating, setCreating] = useState(false);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('dev_session_token');
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }, []);

  const fetchData = useCallback(() => {
    fetch(BACKEND_URL + '/api/routines', { credentials: 'include', headers: getHeaders() })
      .then(r => r.json())
      .then(data => setRoutines(data.routines || []))
      .catch(() => {});
  }, [getHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = () => {
    const validItems = routineItems.filter(i => i.trim());
    if (!routineName.trim() || validItems.length === 0) { toast.error('Name and at least one item required'); return; }
    setCreating(true);
    fetch(BACKEND_URL + '/api/routines', {
      method: 'POST', headers: getHeaders(), credentials: 'include',
      body: JSON.stringify({ name: routineName, type: routineType, items: validItems, assigned_to: [] })
    }).then(res => { if (res.ok) { toast.success('Routine created!'); setShowCreate(false); setRoutineName(''); setRoutineType('morning'); setRoutineItems(['']); fetchData(); }
    }).catch(() => toast.error('Failed')).finally(() => setCreating(false));
  };

  const handleComplete = (routineId, itemIndex) => {
    fetch(BACKEND_URL + '/api/routines/' + routineId + '/complete', {
      method: 'POST', headers: getHeaders(), credentials: 'include',
      body: JSON.stringify({ item_index: itemIndex, submitted_by: user ? user.user_id : undefined })
    }).then(r => r.ok ? r.json() : null).then(d => { if (d) toast.success(d.completed ? 'Done!' : 'Unchecked'); fetchData(); }).catch(() => toast.error('Failed'));
  };

  const handleDelete = (routineId) => {
    fetch(BACKEND_URL + '/api/routines/' + routineId, { method: 'DELETE', headers: getHeaders(), credentials: 'include' })
      .then(() => { toast.success('Deleted'); fetchData(); }).catch(() => toast.error('Failed'));
  };

  const userId = user ? user.user_id : null;
  const userRole = user ? user.role : null;

  return (
    <div className="flex h-screen relative">
      <div className="fixed inset-0 bg-gradient-to-br from-amber-900/20 via-slate-950 to-indigo-900/20 pointer-events-none" />
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <main className={`flex-1 overflow-y-auto transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <div className="p-4 pt-16 md:pt-4 lg:p-6 lg:pt-6 pb-24 md:pb-6 space-y-4" data-testid="routines-page">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-xl lg:text-2xl font-black text-white">Daily Routines</h1>
              <p className="text-sm text-slate-400">Morning & evening checklists</p>
            </div>
            {userRole === 'parent' && (
              <button onClick={() => setShowCreate(true)} className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2" data-testid="create-routine-btn">
                <Plus className="w-4 h-4" /> New Routine
              </button>
            )}
          </header>

          {routines.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Sun className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-white mb-2">No Routines Yet</h2>
              <p className="text-slate-400 text-sm">Create morning and evening routines for the family!</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {routines.map(routine => {
                const rItems = routine.items || [];
                const doneCount = rItems.filter(itm => isItemDone(itm, userId)).length;
                const pct = rItems.length > 0 ? Math.round((doneCount / rItems.length) * 100) : 0;
                const isEvening = routine.type === 'evening';
                const isCustom = routine.type === 'custom';
                const colorClass = isEvening ? 'text-indigo-400' : isCustom ? 'text-teal-400' : 'text-yellow-400';
                const bgClass = isEvening ? 'bg-indigo-500/10' : isCustom ? 'bg-teal-500/10' : 'bg-yellow-500/10';
                const TypeIcon = isEvening ? Moon : isCustom ? Clock : Sun;
                const typeLabel = isEvening ? 'Evening' : isCustom ? 'Custom' : 'Morning';
                
                return (
                  <div key={routine.routine_id} className="glass-card rounded-2xl p-4 border border-slate-800" data-testid={`routine-card-${routine.routine_id}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${bgClass}`}><TypeIcon className={`w-5 h-5 ${colorClass}`} /></div>
                        <div>
                          <h3 className="font-bold text-white">{routine.name}</h3>
                          <span className={`text-xs ${colorClass}`}>{typeLabel}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{doneCount}/{rItems.length}</span>
                        {userRole === 'parent' && (
                          <button onClick={() => handleDelete(routine.routine_id)} className="p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full mb-3 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="space-y-1.5">
                      {rItems.map((itm, idx) => {
                        const done = isItemDone(itm, userId);
                        return (
                          <button key={idx} onClick={() => handleComplete(routine.routine_id, idx)}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${done ? 'bg-green-500/10 border border-green-500/20' : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'}`}
                            data-testid={`routine-check-${routine.routine_id}-${idx}`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${done ? 'border-green-500 bg-green-500' : 'border-slate-600'}`}>
                              {done && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`text-sm flex-1 ${done ? 'text-green-400 line-through' : 'text-white'}`}>{itm.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white">Create Routine</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Routine name" value={routineName} onChange={e => setRoutineName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500" data-testid="routine-name-input" />
              
              <div className="flex gap-2">
                {[
                  { key: 'morning', icon: Sun, label: 'Morning', clr: 'yellow' },
                  { key: 'evening', icon: Moon, label: 'Evening', clr: 'indigo' },
                  { key: 'custom', icon: Clock, label: 'Custom', clr: 'teal' }
                ].map(t => {
                  const active = routineType === t.key;
                  const Icon = t.icon;
                  return (
                    <button key={t.key} onClick={() => setRoutineType(t.key)}
                      className={`flex-1 p-3 rounded-xl border text-center transition-all ${active ? `bg-${t.clr}-500/10 border-${t.clr}-500/30` : 'bg-slate-800/50 border-slate-700'}`}>
                      <Icon className={`w-5 h-5 mx-auto ${active ? `text-${t.clr}-400` : 'text-slate-400'}`} />
                      <span className={`text-xs ${active ? `text-${t.clr}-400` : 'text-slate-400'}`}>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-2 block">Checklist Items</label>
                {routineItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input type="text" placeholder={`Step ${idx + 1}`} value={item}
                      onChange={e => { const items = [...routineItems]; items[idx] = e.target.value; setRoutineItems(items); }}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500" />
                    {routineItems.length > 1 && (
                      <button onClick={() => setRoutineItems(routineItems.filter((_, i) => i !== idx))} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => setRoutineItems([...routineItems, ''])} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"><Plus className="w-3 h-3" /> Add step</button>
              </div>

              <button onClick={handleCreate} disabled={creating}
                className="w-full bg-primary hover:bg-primary/80 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2" data-testid="submit-routine-btn">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create Routine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
