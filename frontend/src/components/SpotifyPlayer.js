import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Music } from 'lucide-react';

export default function SpotifyPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [volume, setVolume] = useState(50);
  const [isConnected, setIsConnected] = useState(false);

  // Simulated Spotify player - replace with actual Spotify SDK when keys are provided
  const mockTracks = [
    { name: 'Happy Family Time', artist: 'Sunny Days Band', album: 'Family Vibes' },
    { name: 'Morning Energy', artist: 'The Cheerful Ones', album: 'Rise & Shine' },
    { name: 'Dinner Jazz', artist: 'Smooth Kitchen', album: 'Cooking Tunes' },
  ];

  const [trackIndex, setTrackIndex] = useState(0);

  useEffect(() => {
    // Initialize with first track
    setCurrentTrack(mockTracks[0]);
  }, []);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    // TODO: Connect to actual Spotify SDK
  };

  const skipForward = () => {
    const nextIndex = (trackIndex + 1) % mockTracks.length;
    setTrackIndex(nextIndex);
    setCurrentTrack(mockTracks[nextIndex]);
  };

  const skipBack = () => {
    const prevIndex = trackIndex === 0 ? mockTracks.length - 1 : trackIndex - 1;
    setTrackIndex(prevIndex);
    setCurrentTrack(mockTracks[prevIndex]);
  };

  const handleVolumeChange = (e) => {
    setVolume(e.target.value);
    // TODO: Set actual Spotify volume
  };

  return (
    <div className="glass-card rounded-2xl p-4" data-testid="spotify-player">
      <div className="flex items-center space-x-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
          <Music className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white">Spotify</h3>
          <p className="text-xs text-slate-400 truncate">
            {isConnected ? 'Connected' : 'Demo Mode'}
          </p>
        </div>
      </div>

      {currentTrack ? (
        <div className="space-y-3">
          {/* Compact Album Art */}
          <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Music className="w-12 h-12 text-white opacity-50" />
          </div>

          {/* Compact Track Info */}
          <div className="text-center">
            <h4 className="font-bold text-white text-sm truncate">{currentTrack.name}</h4>
            <p className="text-xs text-slate-400 truncate">{currentTrack.artist}</p>
          </div>

          {/* Compact Progress Bar */}
          <div className="space-y-1">
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all"
                style={{ width: isPlaying ? '45%' : '0%' }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{isPlaying ? '1:23' : '0:00'}</span>
              <span>3:45</span>
            </div>
          </div>

          {/* Compact Controls */}
          <div className="flex items-center justify-center space-x-3">
            <button
              onClick={skipBack}
              className="p-1.5 hover:bg-slate-800 rounded-full transition-all"
              data-testid="skip-back"
            >
              <SkipBack className="w-4 h-4 text-slate-300" />
            </button>
            
            <button
              onClick={togglePlay}
              className="p-3 bg-green-500 hover:bg-green-600 rounded-full transition-all"
              data-testid="play-pause"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </button>
            
            <button
              onClick={skipForward}
              className="p-1.5 hover:bg-slate-800 rounded-full transition-all"
              data-testid="skip-forward"
            >
              <SkipForward className="w-4 h-4 text-slate-300" />
            </button>
          </div>

          {/* Compact Volume Control */}
          <div className="flex items-center space-x-2">
            <Volume2 className="w-3 h-3 text-slate-400" />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #10B981 0%, #10B981 ${volume}%, #1E293B ${volume}%, #1E293B 100%)`
              }}
              data-testid="volume-slider"
            />
            <span className="text-xs text-slate-400 w-7 text-right">{volume}%</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <Music className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-xs">No track loaded</p>
        </div>
      )}
    </div>
  );
}
