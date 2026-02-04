import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, Check } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PIXIE_MESSAGES = [
  "Hey there! I'm Pixie!",
  "Let me show you around!",
  "This is going to be fun!",
  "Your family will love this!",
  "Ready to get started?"
];

export default function PixieOnboarding({ user, onComplete }) {
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/onboarding/steps`, {
        credentials: 'include'
      });
      const data = await res.json();
      
      if (!data.completed && data.steps?.length > 0) {
        setSteps(data.steps);
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Failed to check onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/onboarding/complete`, {
        method: 'POST',
        credentials: 'include'
      });
      setIsVisible(false);
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  };

  const handleSkip = async () => {
    await handleComplete();
  };

  if (isLoading || !isVisible || steps.length === 0) {
    return null;
  }

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" data-testid="pixie-onboarding">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      {/* Spotlight effect for targeted elements */}
      {step.target && (
        <div className="absolute inset-0 pointer-events-none">
          <div 
            className="absolute bg-white/5 rounded-xl border-2 border-primary animate-pulse"
            style={{
              // This would be dynamically positioned based on target element
              // For now using placeholder positions
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '200px',
              height: '50px',
              display: step.target ? 'block' : 'none'
            }}
          />
        </div>
      )}

      {/* Onboarding Card */}
      <div className="relative z-10 max-w-md w-full mx-4">
        {/* Pixie Avatar */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent via-primary to-secondary flex items-center justify-center animate-bounce shadow-lg shadow-primary/50">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-400 border-2 border-slate-950 flex items-center justify-center">
              <span className="text-xs">✨</span>
            </div>
          </div>
        </div>

        {/* Content Card */}
        <div className="glass-card rounded-2xl p-6 border border-white/20 shadow-2xl">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Step {currentStep + 1} of {steps.length}</span>
              <button
                onClick={handleSkip}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                data-testid="skip-onboarding"
              >
                Skip Tour
              </button>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Step Content */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center space-x-1 bg-accent/20 text-accent px-3 py-1 rounded-full text-xs font-bold mb-3">
              <Sparkles className="w-3 h-3" />
              <span>Pixie Says</span>
            </div>
            <h2 className="text-xl font-black text-white mb-3">{step.title}</h2>
            <p className="text-slate-300 leading-relaxed">{step.message}</p>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`flex items-center space-x-1 px-4 py-2 rounded-full transition-all ${
                currentStep === 0 
                  ? 'text-slate-600 cursor-not-allowed' 
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
              data-testid="prev-step"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>

            <div className="flex space-x-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentStep 
                      ? 'bg-primary w-4' 
                      : index < currentStep 
                        ? 'bg-green-400' 
                        : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="flex items-center space-x-1 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-full transition-all font-bold"
              data-testid="next-step"
            >
              {currentStep === steps.length - 1 ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Done</span>
                </>
              ) : (
                <>
                  <span className="text-sm">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pixie's Fun Message */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500 italic">
            "{PIXIE_MESSAGES[currentStep % PIXIE_MESSAGES.length]}"
          </p>
        </div>
      </div>
    </div>
  );
}
