import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Home, CheckCircle, Calendar, Gift, MapPin, MessageCircle, Rocket, Target, Trophy, Star, PartyPopper, LayoutDashboard } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ICONS = {
  home: Home,
  'layout-dashboard': LayoutDashboard,
  'check-circle': CheckCircle,
  calendar: Calendar,
  gift: Gift,
  'map-pin': MapPin,
  'message-circle': MessageCircle,
  'party-popper': PartyPopper,
  rocket: Rocket,
  target: Target,
  trophy: Trophy,
  star: Star
};

const BACKGROUNDS = {
  welcome: 'from-primary via-purple-600 to-accent',
  dashboard: 'from-blue-600 via-primary to-purple-600',
  chores: 'from-green-600 via-teal-500 to-primary',
  missions: 'from-orange-500 via-red-500 to-pink-500',
  calendar: 'from-blue-500 via-indigo-500 to-purple-500',
  rewards: 'from-yellow-500 via-orange-500 to-red-500',
  location: 'from-green-500 via-emerald-500 to-teal-500',
  chat: 'from-pink-500 via-purple-500 to-indigo-500',
  points: 'from-yellow-400 via-orange-500 to-red-500',
  complete: 'from-accent via-primary to-secondary'
};

export default function WelcomeTutorial({ user, onComplete }) {
  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkTutorial();
  }, []);

  const checkTutorial = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/tutorial/content`, {
        credentials: 'include'
      });
      const data = await res.json();
      
      if (!data.completed && data.slides?.length > 0) {
        setSlides(data.slides);
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Failed to check tutorial:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/tutorial/complete`, {
        method: 'POST',
        credentials: 'include'
      });
      setIsVisible(false);
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Failed to complete tutorial:', error);
    }
  };

  const handleSkip = async () => {
    await handleComplete();
  };

  if (isLoading || !isVisible || slides.length === 0) {
    return null;
  }

  const slide = slides[currentSlide];
  const IconComponent = ICONS[slide.icon] || Star;
  const bgGradient = BACKGROUNDS[slide.image] || BACKGROUNDS.welcome;
  const progress = ((currentSlide + 1) / slides.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" data-testid="welcome-tutorial">
      {/* Animated Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-90`}>
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white/10 animate-float"
              style={{
                width: Math.random() * 100 + 50,
                height: Math.random() * 100 + 50,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${Math.random() * 10 + 10}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-lg mx-4">
        {/* Skip Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleSkip}
            className="text-white/60 hover:text-white text-sm flex items-center space-x-1 transition-all"
            data-testid="skip-tutorial"
          >
            <span>Skip Tutorial</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
          {/* Progress */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-white/60 mb-2">
              <span>Step {currentSlide + 1} of {slides.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center animate-bounce-slow shadow-lg">
              <IconComponent className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-8">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-4">
              {slide.title}
            </h2>
            <p className="text-white/80 text-base lg:text-lg leading-relaxed">
              {slide.description}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentSlide === 0}
              className={`flex items-center space-x-1 px-4 py-2 rounded-full transition-all ${
                currentSlide === 0
                  ? 'text-white/30 cursor-not-allowed'
                  : 'text-white hover:bg-white/10'
              }`}
              data-testid="prev-slide"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back</span>
            </button>

            {/* Dots */}
            <div className="flex space-x-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentSlide
                      ? 'bg-white w-6'
                      : i < currentSlide
                        ? 'bg-white/60'
                        : 'bg-white/30'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="flex items-center space-x-1 px-6 py-2 bg-white text-slate-900 rounded-full font-bold hover:bg-white/90 transition-all shadow-lg"
              data-testid="next-slide"
            >
              <span>{currentSlide === slides.length - 1 ? "Let's Go!" : 'Next'}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Fun Elements */}
        <div className="flex justify-center mt-6 space-x-2">
          {['✨', '🎉', '🚀', '⭐', '💪'].map((emoji, i) => (
            <span
              key={i}
              className="text-2xl animate-float"
              style={{ animationDelay: `${i * 0.2}s` }}
            >
              {emoji}
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-bounce-slow {
          animation: bounce 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
