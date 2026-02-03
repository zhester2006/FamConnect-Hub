import React, { useState, useEffect } from 'react';
import { Book, CheckCircle, Clock, Plus } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ReadingLogs({ user }) {
  const [logs, setLogs] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddLog, setShowAddLog] = useState(false);
  const [readingData, setReadingData] = useState({
    book_name: '',
    pages_read: '',
    summary: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/reading-logs`, { credentials: 'include' });
      const data = await res.json();
      setLogs(data.logs);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BACKEND_URL}/api/reading-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(readingData)
      });
      toast.success('Reading log submitted for review!');
      setShowAddLog(false);
      setReadingData({ book_name: '', pages_read: '', summary: '', date: new Date().toISOString().split('T')[0] });
      setTimerRunning(false);
      setTimeElapsed(0);
      fetchLogs();
    } catch (error) {
      console.error('Failed to submit log:', error);
      toast.error('Failed to submit reading log');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-8">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-white flex items-center space-x-2">
                <Book className="w-8 h-8 text-secondary" />
                <span>Reading Logs</span>
              </h1>
              <p className="text-slate-400 mt-1">Track your daily reading progress</p>
            </div>
            {user?.role === 'child' && (
              <button
                onClick={() => setShowAddLog(true)}
                className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-full font-bold transition-all neon-glow flex items-center space-x-2"
                data-testid="add-log-button"
              >
                <Plus className="w-5 h-5" />
                <span>New Log</span>
              </button>
            )}
          </header>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">30-Minute Reading Timer</h3>
              <Clock className="w-6 h-6 text-accent" />
            </div>
            <div className="text-center py-8">
              <div className="text-6xl font-black text-white mb-4">
                {formatTime(timeElapsed)}
              </div>
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={() => setTimerRunning(!timerRunning)}
                  className={`px-6 py-3 rounded-full font-bold transition-all ${
                    timerRunning
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white neon-glow'
                  }`}
                  data-testid="timer-toggle"
                >
                  {timerRunning ? 'Pause' : 'Start Reading'}
                </button>
                <button
                  onClick={() => { setTimerRunning(false); setTimeElapsed(0); }}
                  className="px-6 py-3 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all"
                  data-testid="timer-reset"
                >
                  Reset
                </button>
              </div>
              {timeElapsed >= 1800 && (
                <p className="text-green-400 font-bold mt-4">✨ Great job! You've completed 30 minutes!</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white">Your Reading History</h3>
            {logs.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <Book className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">No reading logs yet</p>
                <p className="text-slate-500 text-sm mt-2">Start your reading journey today!</p>
              </div>
            ) : (
              logs.map(log => (
                <div key={log.log_id} className="glass-card rounded-2xl p-5" data-testid="reading-log">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-white text-lg">{log.book_name}</h4>
                      <p className="text-sm text-slate-400 mt-1">{new Date(log.date).toLocaleDateString()}</p>
                    </div>
                    {log.status === 'approved' ? (
                      <div className="flex items-center space-x-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-full">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-bold">Approved</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-bold">Pending</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-sm text-slate-400">Pages read:</span>
                    <span className="text-accent font-bold">{log.pages_read}</span>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl p-4">
                    <p className="text-sm text-slate-300 leading-relaxed">{log.summary}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {showAddLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" data-testid="add-log-modal">
          <div className="glass-card rounded-3xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-black text-white mb-4">Submit Reading Log</h2>
            <form onSubmit={handleSubmitLog} className="space-y-4">
              <input
                type="text"
                placeholder="Book name"
                value={readingData.book_name}
                onChange={(e) => setReadingData({...readingData, book_name: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                required
                data-testid="book-name-input"
              />
              <input
                type="number"
                placeholder="Pages read"
                value={readingData.pages_read}
                onChange={(e) => setReadingData({...readingData, pages_read: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                required
                data-testid="pages-input"
              />
              <textarea
                placeholder="Brief summary of what you read"
                value={readingData.summary}
                onChange={(e) => setReadingData({...readingData, summary: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 h-32 resize-none"
                required
                data-testid="summary-input"
              />
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/80 text-white font-bold py-3 px-4 rounded-full transition-all"
                  data-testid="submit-log-button"
                >
                  Submit Log
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLog(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-full transition-all"
                  data-testid="cancel-log-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}