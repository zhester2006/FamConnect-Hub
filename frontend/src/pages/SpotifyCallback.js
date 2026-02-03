import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function SpotifyCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');

      if (error) {
        console.error('Spotify auth error:', error);
        navigate('/hub');
        return;
      }

      if (code) {
        try {
          await fetch(`${BACKEND_URL}/api/spotify/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ code })
          });

          // Redirect back to Home Hub
          navigate('/hub');
        } catch (error) {
          console.error('Failed to complete Spotify auth:', error);
          navigate('/hub');
        }
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Music className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Connecting Spotify...</h2>
        <p className="text-slate-400">Setting up your music experience</p>
      </div>
    </div>
  );
}
