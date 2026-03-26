import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Loader2, CheckCircle, XCircle, LogIn } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function JoinFamily({ user }) {
  const { code } = useParams();
  const navigate = useNavigate();
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (code) resolveCode();
  }, [code]);

  const resolveCode = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/join/${code}`);
      if (res.ok) {
        const data = await res.json();
        setFamily(data);
      } else {
        setError('Invalid or expired invite code');
      }
    } catch {
      setError('Could not verify invite code');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      navigate('/', { state: { joinCode: code } });
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/join/${code}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setJoined(true);
        // Refresh user session so React picks up the new family
        try {
          const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, { credentials: 'include' });
          if (meRes.ok) {
            const meData = await meRes.json();
            localStorage.setItem('famfocus_user', JSON.stringify(meData));
          }
        } catch {}
        setTimeout(() => navigate('/family'), 2000);
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to join');
      }
    } catch {
      setError('Failed to join family');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="glass-card rounded-2xl p-6 text-center space-y-5">
          {loading ? (
            <>
              <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
              <p className="text-slate-400 text-sm">Verifying invite code...</p>
            </>
          ) : error ? (
            <>
              <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-black text-white">Invite Not Found</h2>
              <p className="text-sm text-slate-400">{error}</p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
              >
                Go Home
              </button>
            </>
          ) : joined ? (
            <>
              <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-black text-white">Welcome!</h2>
              <p className="text-sm text-slate-400">You've joined <span className="text-primary font-semibold">{family?.family_name}</span>. Redirecting...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-black text-white">You're Invited!</h2>
              <p className="text-sm text-slate-400">
                You've been invited to join
              </p>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-lg font-black text-primary">{family?.family_name}</p>
                <p className="text-xs text-slate-500 mt-1">Code: {code}</p>
              </div>
              {user ? (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full py-3 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  data-testid="join-family-btn"
                >
                  {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  {joining ? 'Joining...' : 'Join Family'}
                </button>
              ) : (
                <button
                  onClick={() => navigate('/', { state: { joinCode: code } })}
                  className="w-full py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  data-testid="login-to-join-btn"
                >
                  <LogIn className="w-4 h-4" />
                  Log In to Join
                </button>
              )}
              <button
                onClick={() => navigate('/')}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition-all"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
