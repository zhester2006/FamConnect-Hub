// Page Background Configuration for FamFocus Hub
// Each page gets a unique animated gradient background

export const PAGE_BACKGROUNDS = {
  // Dashboard - Purple to Blue gradient
  dashboard: {
    gradient: 'from-purple-900/40 via-indigo-900/30 to-slate-950',
    particles: true,
    particleColor: 'bg-purple-500/10'
  },
  // Home Hub - Uses rotating images (handled separately)
  hub: {
    useImages: true,
    gradient: 'from-slate-950/90 to-slate-950/70'
  },
  // Family - Warm pink to purple
  family: {
    gradient: 'from-pink-900/30 via-purple-900/20 to-slate-950',
    particles: true,
    particleColor: 'bg-pink-500/10'
  },
  // Calendar - Blue gradient
  calendar: {
    gradient: 'from-blue-900/40 via-cyan-900/20 to-slate-950',
    particles: true,
    particleColor: 'bg-blue-500/10'
  },
  // Chat - Green to teal
  chat: {
    gradient: 'from-emerald-900/30 via-teal-900/20 to-slate-950',
    particles: true,
    particleColor: 'bg-emerald-500/10'
  },
  // Family Wall - Pink to magenta
  wall: {
    gradient: 'from-rose-900/30 via-pink-900/20 to-slate-950',
    particles: true,
    particleColor: 'bg-rose-500/10'
  },
  // Shopping - Cyan to blue
  shopping: {
    gradient: 'from-cyan-900/30 via-blue-900/20 to-slate-950',
    particles: true,
    particleColor: 'bg-cyan-500/10'
  },
  // Leaderboard - Yellow to orange
  leaderboard: {
    gradient: 'from-amber-900/30 via-orange-900/20 to-slate-950',
    particles: true,
    particleColor: 'bg-amber-500/10'
  },
  // Dinner - Orange to red
  dinner: {
    gradient: 'from-orange-900/30 via-red-900/20 to-slate-950',
    particles: true,
    particleColor: 'bg-orange-500/10'
  },
  // Rewards - Purple to violet
  rewards: {
    gradient: 'from-violet-900/30 via-purple-900/20 to-slate-950',
    particles: true,
    particleColor: 'bg-violet-500/10'
  },
  // Reading - Indigo to blue
  reading: {
    gradient: 'from-indigo-900/30 via-blue-900/20 to-slate-950',
    particles: true,
    particleColor: 'bg-indigo-500/10'
  },
  // Location/CheckIns - Green to emerald
  checkins: {
    gradient: 'from-green-900/30 via-emerald-900/20 to-slate-950',
    particles: true,
    particleColor: 'bg-green-500/10'
  },
  // Analytics - Teal to cyan
  analytics: {
    gradient: 'from-teal-900/30 via-cyan-900/20 to-slate-950',
    particles: true,
    particleColor: 'bg-teal-500/10'
  },
  // Settings - Slate neutral
  settings: {
    gradient: 'from-slate-800/50 via-slate-900/30 to-slate-950',
    particles: false
  },
  // Child Space - Fun colorful
  space: {
    gradient: 'from-fuchsia-900/30 via-violet-900/20 to-slate-950',
    particles: true,
    particleColor: 'bg-fuchsia-500/10'
  }
};

// Screensaver images for Home Hub
export const SCREENSAVER_IMAGES = [
  // Nature - Mountains & Sunsets
  {
    url: 'https://images.unsplash.com/photo-1655061951084-0c465dab250f?w=1920&q=80',
    category: 'nature',
    description: 'Mountains with dramatic clouds'
  },
  {
    url: 'https://images.unsplash.com/photo-1641981344598-d14b7d99524f?w=1920&q=80',
    category: 'nature',
    description: 'Mountain range at sunset'
  },
  {
    url: 'https://images.unsplash.com/photo-1682613375621-c10d167c852e?w=1920&q=80',
    category: 'nature',
    description: 'Mountain sunset view'
  },
  // Historic Places
  {
    url: 'https://images.unsplash.com/photo-1761865201769-a2c622825be5?w=1920&q=80',
    category: 'historic',
    description: 'Historic buildings with spires'
  },
  {
    url: 'https://images.unsplash.com/photo-1764214656668-7ee9fa6bbe8b?w=1920&q=80',
    category: 'historic',
    description: 'Leaning Tower of Pisa'
  },
  {
    url: 'https://images.unsplash.com/photo-1724398915575-2bfdbca9efc2?w=1920&q=80',
    category: 'historic',
    description: 'Colosseum in Rome'
  },
  // Ocean & Beach
  {
    url: 'https://images.unsplash.com/photo-1769076292541-db655ae26a58?w=1920&q=80',
    category: 'beach',
    description: 'Tropical beach with palm trees'
  },
  {
    url: 'https://images.unsplash.com/photo-1759391272188-216a346b52c9?w=1920&q=80',
    category: 'beach',
    description: 'Driftwood arch on beach'
  },
  // Northern Lights
  {
    url: 'https://images.unsplash.com/photo-1549633759-5e6e8b0ed2ab?w=1920&q=80',
    category: 'aurora',
    description: 'Aurora lights over forest'
  },
  {
    url: 'https://images.unsplash.com/photo-1580045174397-fe17bf126895?w=1920&q=80',
    category: 'aurora',
    description: 'Northern Lights in Alaska'
  },
  {
    url: 'https://images.unsplash.com/photo-1614090691187-983c32a930c9?w=1920&q=80',
    category: 'aurora',
    description: 'Green aurora over road'
  },
  {
    url: 'https://images.unsplash.com/photo-1549633760-e91f5397021b?w=1920&q=80',
    category: 'aurora',
    description: 'Northern Lights wallpaper'
  }
];

// Get random screensaver image
export const getRandomScreensaver = () => {
  return SCREENSAVER_IMAGES[Math.floor(Math.random() * SCREENSAVER_IMAGES.length)];
};

// Get background config for a page
export const getPageBackground = (pageName) => {
  return PAGE_BACKGROUNDS[pageName] || PAGE_BACKGROUNDS.dashboard;
};
