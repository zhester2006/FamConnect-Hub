import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Palette, Camera, ChevronRight, Check, Sparkles, Star, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const THEMES = [
  { id: 'cosmic_explorer', name: 'Cosmic Explorer', colors: 'from-purple-500 to-indigo-600', emoji: '🚀' },
  { id: 'ocean_adventure', name: 'Ocean Adventure', colors: 'from-cyan-500 to-blue-600', emoji: '🌊' },
  { id: 'forest_magic', name: 'Forest Magic', colors: 'from-green-500 to-emerald-600', emoji: '🌲' },
  { id: 'sunset_dreams', name: 'Sunset Dreams', colors: 'from-orange-500 to-pink-600', emoji: '🌅' },
  { id: 'candy_land', name: 'Candy Land', colors: 'from-pink-500 to-rose-600', emoji: '🍭' },
  { id: 'golden_star', name: 'Golden Star', colors: 'from-yellow-500 to-amber-600', emoji: '⭐' }
];

const AVATARS = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Max&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Luna&backgroundColor=d1f4d1',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Sam&backgroundColor=ffdfba',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Zoe&backgroundColor=bae1ff',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Leo&backgroundColor=ffffba',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Maya&backgroundColor=ffb3ba'
];

export default function SetupWizard() {
  const location = useLocation();
  const navigate = useNavigate();
  const userData = location.state?.user;
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    picture: AVATARS[0],
    theme: 'cosmic_explorer'
  });
  const [loading, setLoading] = useState(false);

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('dev_session_token');
      const res = await fetch(`${BACKEND_URL}/api/users/${userData?.user_id}/first-login-setup`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const data = await res.json();
        // Update stored user data
        localStorage.setItem('dev_user', JSON.stringify(data.user));
        toast.success('Setup complete! Welcome to FamFocus Hub!');
        navigate('/space');
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Setup failed');
      }
    } catch (error) {
      console.error('Setup error:', error);
      toast.error('Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  if (!userData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl text-white mb-4">Session expired</h2>
          <a href="/child-login" className="text-primary hover:underline">Go back to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Step {step} of {totalSteps}</span>
            <span className="text-white font-bold">{Math.round((step / totalSteps) * 100)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="glass-card rounded-3xl p-8 border border-white/10">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto animate-bounce">
                <PartyPopper className="w-12 h-12 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white mb-2">Welcome, {userData.name}! 🎉</h1>
                <p className="text-slate-400">Let's get your profile set up so you can start earning points and having fun with your family!</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-left">
                <h3 className="text-white font-bold mb-2">What you'll do:</h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Choose your avatar</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Pick your favorite theme</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Add your contact info (optional)</li>
                </ul>
              </div>
              <button onClick={handleNext} className="w-full py-4 bg-gradient-to-r from-primary to-accent text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all">
                Let's Go! <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 2: Avatar */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <Camera className="w-12 h-12 text-primary mx-auto mb-3" />
                <h2 className="text-2xl font-black text-white mb-2">Choose Your Avatar</h2>
                <p className="text-slate-400">Pick one that looks like you!</p>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {AVATARS.map((avatar, idx) => (
                  <button
                    key={idx}
                    onClick={() => setFormData({ ...formData, picture: avatar })}
                    className={`p-2 rounded-xl border-2 transition-all ${
                      formData.picture === avatar 
                        ? 'border-primary bg-primary/20 scale-105' 
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <img src={avatar} alt={`Avatar ${idx + 1}`} className="w-full rounded-lg" />
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 bg-slate-700 text-white rounded-xl font-medium">Back</button>
                <button onClick={handleNext} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2">
                  Next <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Theme */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <Palette className="w-12 h-12 text-accent mx-auto mb-3" />
                <h2 className="text-2xl font-black text-white mb-2">Pick Your Theme</h2>
                <p className="text-slate-400">Make it your own!</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setFormData({ ...formData, theme: theme.id })}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      formData.theme === theme.id 
                        ? 'border-primary ring-2 ring-primary/50' 
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-full h-12 rounded-lg bg-gradient-to-r ${theme.colors} mb-2 flex items-center justify-center`}>
                      <span className="text-2xl">{theme.emoji}</span>
                    </div>
                    <p className="text-white font-medium text-sm">{theme.name}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3 bg-slate-700 text-white rounded-xl font-medium">Back</button>
                <button onClick={handleNext} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2">
                  Next <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Contact (Optional) */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <Star className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                <h2 className="text-2xl font-black text-white mb-2">Almost Done!</h2>
                <p className="text-slate-400">Add your contact info (optional)</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email (optional)
                  </label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block flex items-center gap-2">
                    <Phone className="w-4 h-4" /> Phone (optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="(123) 456-7890"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                <p className="text-slate-400 text-sm">This info helps your parents contact you and is kept private within your family.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="flex-1 py-3 bg-slate-700 text-white rounded-xl font-medium">Back</button>
                <button 
                  onClick={handleComplete} 
                  disabled={loading}
                  className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" /> Complete Setup
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Skip option */}
        {step > 1 && step < 4 && (
          <button 
            onClick={() => setStep(4)} 
            className="block mx-auto mt-4 text-slate-500 hover:text-slate-400 text-sm transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
