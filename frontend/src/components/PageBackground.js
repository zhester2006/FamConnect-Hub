import React, { useState, useEffect, useMemo } from 'react';
import { SCREENSAVER_IMAGES, getPageBackground } from '@/utils/pageBackgrounds';

// Animated particles component
const Particles = ({ color = 'bg-white/5', count = 15 }) => {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      size: Math.random() * 100 + 30,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 5,
      duration: Math.random() * 15 + 15
    }));
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className={`absolute rounded-full ${color} animate-float-slow`}
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`
          }}
        />
      ))}
    </div>
  );
};

// Screensaver component for Home Hub
export const ScreensaverBackground = ({ transitionDuration = 10000 }) => {
  const [currentIndex, setCurrentIndex] = useState(() => 
    Math.floor(Math.random() * SCREENSAVER_IMAGES.length)
  );
  const [nextIndex, setNextIndex] = useState(() => 
    (Math.floor(Math.random() * SCREENSAVER_IMAGES.length) + 1) % SCREENSAVER_IMAGES.length
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setNextIndex((nextIndex + 1 + Math.floor(Math.random() * 3)) % SCREENSAVER_IMAGES.length);
        setIsTransitioning(false);
      }, 2000);
    }, transitionDuration);

    return () => clearInterval(interval);
  }, [nextIndex, transitionDuration]);

  const currentImage = SCREENSAVER_IMAGES[currentIndex];
  const nextImage = SCREENSAVER_IMAGES[nextIndex];

  return (
    <div className="fixed inset-0 z-0">
      {/* Current Image */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-2000 ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ backgroundImage: `url(${currentImage.url})` }}
      />
      
      {/* Next Image (preloaded) */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-2000 ${
          isTransitioning ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ backgroundImage: `url(${nextImage.url})` }}
      />
      
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/50 to-slate-950/80" />
      
      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-slate-950/60" />
      
      {/* Image info (optional) */}
      <div className="absolute bottom-4 right-4 text-white/30 text-xs">
        {currentImage.description}
      </div>
    </div>
  );
};

// Main PageBackground component
export default function PageBackground({ page, children, className = '' }) {
  const config = getPageBackground(page);

  // For Home Hub, use screensaver
  if (config.useImages) {
    return (
      <div className={`relative min-h-screen ${className}`}>
        <ScreensaverBackground />
        <div className="relative z-10">{children}</div>
      </div>
    );
  }

  // For other pages, use gradient with optional particles
  return (
    <div className={`relative min-h-screen bg-slate-950 ${className}`}>
      {/* Gradient overlay */}
      <div className={`fixed inset-0 bg-gradient-to-br ${config.gradient} pointer-events-none`} />
      
      {/* Animated particles */}
      {config.particles && <Particles color={config.particleColor} />}
      
      {/* Grid pattern overlay */}
      <div 
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// CSS for animations (add to index.css)
export const backgroundAnimationStyles = `
@keyframes float-slow {
  0%, 100% { 
    transform: translateY(0) translateX(0) rotate(0deg); 
    opacity: 0.5;
  }
  25% { 
    transform: translateY(-30px) translateX(10px) rotate(5deg); 
    opacity: 0.3;
  }
  50% { 
    transform: translateY(-20px) translateX(-15px) rotate(-3deg); 
    opacity: 0.6;
  }
  75% { 
    transform: translateY(-40px) translateX(5px) rotate(2deg); 
    opacity: 0.4;
  }
}

.animate-float-slow {
  animation: float-slow 20s ease-in-out infinite;
}

.duration-2000 {
  transition-duration: 2000ms;
}
`;
