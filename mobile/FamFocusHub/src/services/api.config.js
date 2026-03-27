// API Configuration for FamFocus Hub Mobile App
// IMPORTANT: Change this URL to your production server before release
// For local development, use your computer's IP address (not localhost)
// Example: 'http://192.168.1.100:8001/api'
const API_BASE_URL = 'https://family-pantry-hub-2.preview.emergentagent.com/api';

// Production mode flag - set to true for release builds
export const IS_PRODUCTION = !__DEV__;

// Firebase-only mode: When true, app works without backend server
// Set to true if you want the app to work with Firebase auth only
export const FIREBASE_ONLY_MODE = false;

// Disable console logs in production (but keep them for debugging auth issues)
if (IS_PRODUCTION && !__DEV__) {
  // Keep logs enabled for now to debug issues
  // console.log = () => {};
  // console.warn = () => {};
  // console.info = () => {};
}

export const API_ENDPOINTS = {
  // Auth
  AUTH_SESSION: '/auth/session',
  AUTH_ME: '/auth/me',
  AUTH_LOGOUT: '/auth/logout',
  FIREBASE_LOGIN: '/auth/firebase-login',
  FIREBASE_SIGNUP: '/auth/firebase-signup',
  
  // Family
  FAMILIES: '/families',
  FAMILY_MEMBERS: '/family/members',
  FAMILY_MEMBERS_DETAILED: '/family/members/detailed',
  FAMILY_INFO: '/family/info',
  FAMILY_SWITCH: (id) => `/families/switch/${id}`,
  FAMILY_INVITE: (id) => `/families/${id}/invite`,
  FAMILY_INVITES_PENDING: '/families/invites/pending',
  FAMILY_INVITE_ACCEPT: (id) => `/families/invites/${id}/accept`,
  FAMILY_INVITE_DECLINE: (id) => `/families/invites/${id}/decline`,
  
  // Chores
  CHORES: '/chores',
  CHORE_TYPES: '/chores/types',
  CHORE_COMPLETE: (id) => `/chores/${id}/complete`,
  CHORE_APPROVE: (id) => `/chores/${id}/approve`,
  CHORE_AI_SCHEDULE: '/chores/ai-schedule',
  
  // Tasks
  TASKS: '/tasks',
  TASK_COMPLETE: (id) => `/tasks/${id}/complete`,
  
  // Messages/Chat
  MESSAGES: '/messages',
  MESSAGE_READ: (id) => `/messages/${id}/read`,
  
  // Family Wall
  FAMILY_WALL: '/family-wall',
  DAILY_QUOTE: '/family-wall/daily-quote',
  FAMILY_WALL_LIKE: (id) => `/family-wall/${id}/like`,
  FAMILY_WALL_VOTE: (id) => `/family-wall/${id}/vote`,
  
  // Calendar
  EVENTS: '/events',
  EVENT_DELETE: (id) => `/events/${id}`,
  
  // Rewards
  REWARDS: '/rewards',
  REDEEM_REWARD: (id) => `/rewards/${id}/redeem`,
  PENDING_REDEMPTIONS: '/rewards/pending',
  
  // Shopping
  SHOPPING_LIST: '/shopping',
  
  // Reading
  READING_LOGS: '/reading-logs',
  
  // Leaderboard
  LEADERBOARD: '/leaderboard',
  
  // Weather
  WEATHER: '/weather',
  
  // Location
  LOCATION_UPDATE: '/location/update',
  GEOFENCES: '/geofences',
  CHECKINS: '/checkins',
  LOCATION_ALERTS: '/location/alerts',
  
  // Battery
  BATTERY_UPDATE: '/battery/update',
  BATTERY_STATUS: '/battery/family-status',
  
  // Notifications
  NOTIFICATIONS: '/notifications',
  
  // User
  USER_PROFILE: '/users/me',
  USER_UPDATE: (id) => `/users/${id}`,
  USER_NICKNAME: (id) => `/users/${id}/nickname`,
  USER_POINTS: (id) => `/users/${id}/points`,
  UPLOAD_PICTURE: '/users/upload-picture',
  
  // AI Features
  AI_PIXIE: '/ai/pixie',
  AI_MEAL_PLAN: '/ai/meal-plan',
  AI_CHORE_TIPS: '/ai/chore-tips',
  AI_FAMILY_ACTIVITY: '/ai/family-activity',
  
  // Goals
  GOALS: '/goals',
  
  // Achievements
  ACHIEVEMENTS: '/achievements',
  ACHIEVEMENTS_FAMILY: '/achievements/family',
  ACHIEVEMENTS_USER: (userId) => `/achievements/user/${userId}`,
  ACHIEVEMENTS_CUSTOM: '/achievements/custom',
  ACHIEVEMENTS_CUSTOM_BY_ID: (id) => `/achievements/custom/${id}`,
  ACHIEVEMENTS_CUSTOM_AWARD: (id) => `/achievements/custom/${id}/award`,
  ACHIEVEMENTS_AI_SUGGESTIONS: '/achievements/ai-suggestions',
  ACHIEVEMENTS_CHECK: '/achievements/check',
  ACHIEVEMENTS_SEASONAL: '/achievements/seasonal',
  
  // Dashboard
  DASHBOARD_CONFIG: '/dashboard/config',
  
  // Tutorial
  TUTORIAL_CONTENT: '/tutorial/content',
  TUTORIAL_COMPLETE: '/tutorial/complete',
  TUTORIAL_RESET: '/tutorial/reset',
  
  // GIFs
  GIFS_SEARCH: '/gifs/search',
  GIFS_TRENDING: '/gifs/trending',
  
  // Dinner Planner
  DINNER_PLAN: '/dinner-plan',
  DINNER_PLAN_GENERATE: '/dinner-plan/generate',
};

export default API_BASE_URL;
