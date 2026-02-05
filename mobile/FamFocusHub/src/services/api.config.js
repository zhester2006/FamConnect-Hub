// API Configuration for FamFocus Hub Mobile App
const API_BASE_URL = 'https://familyhq-1.preview.emergentagent.com/api';

export const API_ENDPOINTS = {
  // Auth
  AUTH_SESSION: '/auth/session',
  AUTH_ME: '/auth/me',
  AUTH_LOGOUT: '/auth/logout',
  
  // Family
  FAMILIES: '/families',
  FAMILY_MEMBERS: '/family/members',
  FAMILY_SWITCH: (id) => `/families/switch/${id}`,
  FAMILY_INVITE: (id) => `/families/${id}/invite`,
  FAMILY_INVITES_PENDING: '/families/invites/pending',
  FAMILY_INVITE_ACCEPT: (id) => `/families/invites/${id}/accept`,
  FAMILY_INVITE_DECLINE: (id) => `/families/invites/${id}/decline`,
  
  // Chores
  CHORES: '/chores',
  CHORE_TYPES: '/chores/types',
  CHORE_COMPLETE: (id) => `/chores/${id}/complete`,
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
  
  // Calendar
  EVENTS: '/events',
  
  // Rewards
  REWARDS: '/rewards',
  REDEEM_REWARD: (id) => `/rewards/${id}/redeem`,
  
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
  
  // Battery
  BATTERY_UPDATE: '/battery/update',
  BATTERY_STATUS: '/battery/family',
  
  // Notifications
  NOTIFICATIONS: '/notifications',
  
  // User
  USER_PROFILE: '/users/me',
  USER_UPDATE: '/users/update',
  UPLOAD_PICTURE: '/users/upload-picture',
};

export default API_BASE_URL;
