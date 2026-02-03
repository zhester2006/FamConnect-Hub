import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Music, Link as LinkIcon, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function SpotifyPlayerEnhanced() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [volume, setVolume] = useState(50);
  const [isConnected, setIsConnected] = useState(false);
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  // Mock tracks for demo mode
  const mockTracks = [
    { name: 'Happy Family Time', artist: 'Sunny Days Band', album: 'Family Vibes' },
    { name: 'Morning Energy', artist: 'The Cheerful Ones', album: 'Rise & Shine' },
    { name: 'Dinner Jazz', artist: 'Smooth Kitchen', album: 'Cooking Tunes' },
  ];

  const [trackIndex, setTrackIndex] = useState(0);

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      console.log('Spotify SDK Ready');
    };

    return () => {
      if (player) {
        player.disconnect();
      }
    };
  }, []);

  // Check if user has Spotify connected
  useEffect(() => {
    checkSpotifyConnection();
  }, []);

  const checkSpotifyConnection = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
        credentials: 'include'
      });
      const userData = await res.json();
      
      if (userData.spotify_access_token) {
        setAccessToken(userData.spotify_access_token);
        setIsConnected(true);
        initializePlayer(userData.spotify_access_token);
      } else {
        // Demo mode
        setCurrentTrack(mockTracks[0]);
      }
    } catch (error) {
      console.error('Failed to check Spotify connection:', error);
      setCurrentTrack(mockTracks[0]);
    }
  };

  const initializePlayer = useCallback((token) => {
    if (!window.Spotify) {
      setTimeout(() => initializePlayer(token), 1000);
      return;
    }

    const spotifyPlayer = new window.Spotify.Player({
      name: 'FamFocus Hub Player',
      getOAuthToken: cb => { cb(token); },
      volume: volume / 100
    });

    // Player ready
    spotifyPlayer.addListener('ready', ({ device_id }) => {
      console.log('Ready with Device ID', device_id);
      setDeviceId(device_id);
      toast.success('Spotify connected!');
    });

    // Not ready
    spotifyPlayer.addListener('not_ready', ({ device_id }) => {
      console.log('Device ID has gone offline', device_id);
    });

    // Player state changed
    spotifyPlayer.addListener('player_state_changed', (state) => {
      if (!state) return;

      setCurrentTrack({
        name: state.track_window.current_track.name,
        artist: state.track_window.current_track.artists[0].name,
        album: state.track_window.current_track.album.name,
        image: state.track_window.current_track.album.images[0].url
      });
      setIsPlaying(!state.paused);
    });

    spotifyPlayer.connect();
    setPlayer(spotifyPlayer);
  }, [volume]);

  const handleConnectSpotify = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/spotify/auth-url`, {
        credentials: 'include'
      });
      const data = await res.json();
      
      // Open Spotify auth in popup
      window.location.href = data.auth_url;
    } catch (error) {
      console.error('Failed to connect Spotify:', error);
      toast.error('Failed to connect Spotify');
    }
  };

  const togglePlay = () => {
    if (player && isConnected) {
      player.togglePlay();
    } else {
      // Demo mode
      setIsPlaying(!isPlaying);
    }
  };

  const skipForward = () => {
    if (player && isConnected) {
      player.nextTrack();
    } else {
      // Demo mode
      const nextIndex = (trackIndex + 1) % mockTracks.length;
      setTrackIndex(nextIndex);
      setCurrentTrack(mockTracks[nextIndex]);
    }
  };

  const skipBack = () => {
    if (player && isConnected) {
      player.previousTrack();
    } else {
      // Demo mode
      const prevIndex = trackIndex === 0 ? mockTracks.length - 1 : trackIndex - 1;
      setTrackIndex(prevIndex);
      setCurrentTrack(mockTracks[prevIndex]);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (player && isConnected) {
      player.setVolume(newVolume / 100);
    }
  };

  return (
    <div className=\"glass-card rounded-2xl p-4\" data-testid=\"spotify-player\">
      <div className=\"flex items-center space-x-2 mb-3\">
        <div className=\"w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center\">
          <Music className=\"w-4 h-4 text-white\" />
        </div>
        <div className=\"flex-1 min-w-0\">
          <h3 className=\"text-sm font-bold text-white\">Spotify</h3>
          <p className=\"text-xs text-slate-400 truncate\">
            {isConnected ? (
              <span className=\"flex items-center space-x-1\">
                <CheckCircle className=\"w-3 h-3 text-green-400\" />
                <span>Connected</span>
              </span>
            ) : (
              'Demo Mode'
            )}
          </p>
        </div>
      </div>

      {!isConnected && (
        <button
          onClick={handleConnectSpotify}
          className=\"w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 px-4 rounded-full transition-all mb-3 flex items-center justify-center space-x-2\"
          data-testid=\"connect-spotify-button\"
        >
          <LinkIcon className=\"w-4 h-4\" />
          <span className=\"text-sm\">Connect Spotify</span>
        </button>
      )}

      {currentTrack ? (
        <div className=\"space-y-3\">
          {/* Album Art */}
          <div className=\"w-full aspect-square rounded-lg overflow-hidden\">
            {currentTrack.image ? (
              <img src={currentTrack.image} alt={currentTrack.album} className=\"w-full h-full object-cover\" />
            ) : (
              <div className=\"w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center\">
                <Music className=\"w-12 h-12 text-white opacity-50\" />
              </div>
            )}
          </div>

          {/* Track Info */}
          <div className=\"text-center\">
            <h4 className=\"font-bold text-white text-sm truncate\">{currentTrack.name}</h4>
            <p className=\"text-xs text-slate-400 truncate\">{currentTrack.artist}</p>
          </div>

          {/* Progress Bar */}
          <div className=\"h-1 bg-slate-800 rounded-full overflow-hidden\">
            <div 
              className=\"h-full bg-green-500 transition-all\"
              style={{ width: isPlaying ? '45%' : '0%' }}
            ></div>
          </div>

          {/* Controls */}
          <div className=\"flex items-center justify-center space-x-3\">
            <button
              onClick={skipBack}
              className=\"p-1.5 hover:bg-slate-800 rounded-full transition-all\"
              data-testid=\"skip-back\"
            >
              <SkipBack className=\"w-4 h-4 text-slate-300\" />
            </button>
            
            <button
              onClick={togglePlay}
              className=\"p-3 bg-green-500 hover:bg-green-600 rounded-full transition-all\"
              data-testid=\"play-pause\"
            >
              {isPlaying ? (
                <Pause className=\"w-5 h-5 text-white\" />
              ) : (
                <Play className=\"w-5 h-5 text-white ml-0.5\" />
              )}
            </button>
            
            <button
              onClick={skipForward}
              className=\"p-1.5 hover:bg-slate-800 rounded-full transition-all\"
              data-testid=\"skip-forward\"
            >
              <SkipForward className=\"w-4 h-4 text-slate-300\" />
            </button>
          </div>

          {/* Volume Control */}
          <div className=\"flex items-center space-x-2\">
            <Volume2 className=\"w-3 h-3 text-slate-400\" />
            <input
              type=\"range\"
              min=\"0\"
              max=\"100\"
              value={volume}
              onChange={handleVolumeChange}
              className=\"flex-1 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer\"
              style={{
                background: `linear-gradient(to right, #10B981 0%, #10B981 ${volume}%, #1E293B ${volume}%, #1E293B 100%)`
              }}
              data-testid=\"volume-slider\"
            />
            <span className=\"text-xs text-slate-400 w-7 text-right\">{volume}%</span>
          </div>
        </div>
      ) : (
        <div className=\"text-center py-6\">
          <Music className=\"w-10 h-10 text-slate-600 mx-auto mb-2\" />
          <p className=\"text-slate-400 text-xs\">No track loaded</p>
        </div>
      )}
    </div>
  );
}
