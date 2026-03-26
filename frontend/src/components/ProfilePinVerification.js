import React, { useState, useEffect } from 'react';
import { X, User, Lock, Check, AlertCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ProfilePinVerification({ 
  isOpen, 
  onClose, 
  onVerified, 
  actionLabel = "Continue",
  title = "Verify Your Identity"
}) {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pinRefs = [React.useRef(), React.useRef(), React.useRef(), React.useRef()];

  useEffect(() => {
    if (isOpen) {
      fetchProfiles();
      setSelectedProfile(null);
      setPin(['', '', '', '']);
      setError('');
    }
  }, [isOpen]);

  const fetchProfiles = async () => {
    try {
      const token = localStorage.getItem('dev_session_token');
      const res = await fetch(`${BACKEND_URL}/api/users/family-profiles`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
      }
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    }
  };

  const handlePinChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newPin = [...pin];
    newPin[index] = value.slice(-1); // Only keep last digit
    setPin(newPin);
    setError('');

    // Auto-focus next input
    if (value && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = async () => {
    if (!selectedProfile) {
      setError('Please select your profile');
      return;
    }

    const fullPin = pin.join('');
    if (fullPin.length !== 4) {
      setError('Please enter your 4-digit PIN');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/users/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: selectedProfile.user_id,
          pin: fullPin
        })
      });

      if (res.ok) {
        const data = await res.json();
        onVerified(data.user);
        onClose();
      } else {
        const data = await res.json();
        setError(data.detail || 'Invalid PIN');
        setPin(['', '', '', '']);
        pinRefs[0].current?.focus();
      }
    } catch (error) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            {title}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Profile Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-3">Who's making this request?</label>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {profiles.map((profile) => (
                <button
                  key={profile.user_id}
                  onClick={() => {
                    setSelectedProfile(profile);
                    setError('');
                    setTimeout(() => pinRefs[0].current?.focus(), 100);
                  }}
                  className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                    selectedProfile?.user_id === profile.user_id
                      ? 'border-primary bg-primary/20 ring-2 ring-primary/50'
                      : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  {profile.picture ? (
                    <img 
                      src={profile.picture} 
                      alt={profile.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {profile.name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-xs text-white font-medium truncate w-full text-center">
                    {profile.name?.split(' ')[0]}
                  </span>
                  {!profile.has_pin && (
                    <span className="text-[10px] text-orange-400">No PIN</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* PIN Entry */}
          {selectedProfile && selectedProfile.has_pin && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-3 text-center">
                Enter your 4-digit PIN
              </label>
              <div className="flex justify-center gap-3">
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    ref={pinRefs[index]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    className="w-14 h-14 text-center text-2xl font-bold bg-slate-800 border border-slate-600 rounded-xl text-white focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                  />
                ))}
              </div>
            </div>
          )}

          {selectedProfile && !selectedProfile.has_pin && (
            <div className="text-center p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
              <AlertCircle className="w-8 h-8 text-orange-400 mx-auto mb-2" />
              <p className="text-orange-400 text-sm">
                {selectedProfile.name} doesn't have a PIN set up yet.
              </p>
              <p className="text-slate-400 text-xs mt-1">
                A parent needs to set up a PIN in Family Management.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleVerify}
            disabled={!selectedProfile || !selectedProfile.has_pin || loading}
            className="w-full py-3 bg-primary hover:bg-primary/80 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5" />
                {actionLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
