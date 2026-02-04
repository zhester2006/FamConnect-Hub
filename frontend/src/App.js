import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import '@/App.css';

import WelcomePage from '@/pages/WelcomePage';
import ParentDashboard from '@/pages/ParentDashboard';
import ChildSpace from '@/pages/ChildSpace';
import Calendar from '@/pages/Calendar';
import LiveChat from '@/pages/LiveChat';
import FamilyWall from '@/pages/FamilyWall';
import ShoppingList from '@/pages/ShoppingList';
import RewardsShop from '@/pages/RewardsShop';
import DinnerPlanner from '@/pages/DinnerPlanner';
import Settings from '@/pages/Settings';
import HomeHub from '@/pages/HomeHub';
import FamilyManagement from '@/pages/FamilyManagement';
import Leaderboard from '@/pages/Leaderboard';
import ReadingLogs from '@/pages/ReadingLogs';
import CheckIns from '@/pages/CheckIns';
import Analytics from '@/pages/Analytics';
import PixieOnboarding from '@/components/PixieOnboarding';
import WelcomeTutorial from '@/components/WelcomeTutorial';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const sessionId = params.get('session_id');

    if (!sessionId) {
      navigate('/login');
      return;
    }

    fetch(`${BACKEND_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'X-Session-ID': sessionId },
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        navigate(data.user.role === 'parent' ? '/dashboard' : '/space', {
          replace: true,
          state: { user: data.user }
        });
      })
      .catch(err => {
        console.error('Auth error:', err);
        navigate('/login');
      });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-slate-400">Logging you in...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.user) {
      setUser(location.state.user);
      setIsAuthenticated(true);
      return;
    }

    const checkAuth = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Not authenticated');
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate, location.state]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return isAuthenticated ? (
    <>
      <WelcomeTutorial user={user} />
      <PixieOnboarding user={user} />
      {React.cloneElement(children, { user })}
    </>
  ) : null;
}

function AppRouter() {
  const location = useLocation();

  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<WelcomePage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
      <Route path="/space" element={<ProtectedRoute><ChildSpace /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><LiveChat /></ProtectedRoute>} />
      <Route path="/family-wall" element={<ProtectedRoute><FamilyWall /></ProtectedRoute>} />
      <Route path="/family" element={<ProtectedRoute><FamilyManagement /></ProtectedRoute>} />
      <Route path="/shopping" element={<ProtectedRoute><ShoppingList /></ProtectedRoute>} />
      <Route path="/rewards" element={<ProtectedRoute><RewardsShop /></ProtectedRoute>} />
      <Route path="/dinner" element={<ProtectedRoute><DinnerPlanner /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/hub" element={<ProtectedRoute><HomeHub /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="/reading" element={<ProtectedRoute><ReadingLogs /></ProtectedRoute>} />
      <Route path="/checkins" element={<ProtectedRoute><CheckIns /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;