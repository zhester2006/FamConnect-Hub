# FamFocus Hub - Product Requirements Document

## Project Overview
A comprehensive, family-oriented, mobile-friendly app for managing family activities, chores, rewards, and communication.

## Current Status: LIVE AND FULLY FUNCTIONAL

### Last Updated: December 2024

---

## Live URLs

### Web App
**URL:** https://hub-family-core.preview.emergentagent.com
- Fully functional with all features
- Login via Google or Dev Login buttons
- Works on desktop and mobile browsers

### Mobile App
**Backend URL:** https://hub-family-core.preview.emergentagent.com/api
- FIREBASE_ONLY_MODE: **false** (uses live backend)
- Rebuild required to pull latest changes

---

## Working Features

### Authentication
- [x] Google Sign-In (Web)
- [x] Dev Login (Parent/Child modes for testing)
- [x] Firebase Auth (Mobile - Email/Password)
- [x] Session management with tokens
- [x] Role-based access (Parent, Child, HomeHub)

### Parent Dashboard
- [x] Overview cards (Pending Approvals, Chores Done, Today's Events, Progress)
- [x] AI Scheduler for auto-generating fair chore schedules
- [x] Manual Scheduler with drag-and-drop
- [x] Children overview with points and check-in buttons
- [x] View Details for each child

### Chore Scheduler
- [x] Drag-and-drop chore assignment
- [x] Calendar view by week
- [x] Filter by children
- [x] Point values for each chore
- [x] Save/Clear schedule functionality

### Family Chat
- [x] Real-time WebSocket messaging
- [x] Online/Offline status indicators
- [x] Read receipts
- [x] Emoji reactions
- [x] Voice messages
- [x] Image/GIF sharing

### Family Wall
- [x] Posts with likes and comments
- [x] Polls with voting
- [x] Photo sharing
- [x] GIF search and sharing
- [x] Daily AI-generated inspiration quotes

### Other Features
- [x] Calendar with event management
- [x] Shopping list with collaborative editing
- [x] Leaderboard with points ranking
- [x] Achievements and badges
- [x] Dinner Planner with AI suggestions
- [x] Rewards shop
- [x] Reading logs
- [x] Check-ins and location tracking
- [x] Analytics dashboard
- [x] Weather widget
- [x] Settings and profile management

### AI Features (Pixie)
- [x] Dinner/meal suggestions
- [x] Activity recommendations
- [x] Chore tips and motivation
- [x] Homework help suggestions
- [x] Weather-based planning

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/dev-login` - Dev login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/firebase-login` - Firebase login
- `POST /api/auth/firebase-signup` - Firebase signup

### Family
- `GET /api/family/members` - Get family members
- `GET /api/families` - Get user's families

### Chores
- `GET /api/chores` - Get all chores
- `GET /api/chores/types` - Get chore types
- `POST /api/chores` - Create chore
- `POST /api/chores/{id}/complete` - Complete chore
- `POST /api/chores/{id}/approve` - Approve chore

### Events
- `GET /api/events` - Get events
- `POST /api/events` - Create event

### Shopping
- `GET /api/shopping` - Get shopping list
- `POST /api/shopping` - Add item

### Family Wall
- `GET /api/family-wall` - Get posts
- `POST /api/family-wall` - Create post
- `GET /api/family-wall/daily-quote` - Get daily quote

### AI
- `POST /api/ai/pixie` - Chat with Pixie AI
- `POST /api/ai/meal-plan` - Get meal suggestions
- `POST /api/chores/ai-schedule` - Generate AI chore schedule

### Other
- `GET /api/weather` - Get weather
- `GET /api/leaderboard` - Get leaderboard
- `GET /api/rewards` - Get rewards

---

## Mobile App Build Instructions

### Prerequisites
1. Node.js and npm installed
2. Android Studio with SDK
3. Firebase project configured (family-hub-app-d9c04)

### Build Steps
```bash
cd mobile/FamFocusHub

# Clean everything
cd android && gradlew --stop && cd ..
rd /s /q android
rd /s /q node_modules

# Install dependencies
npm install

# Prebuild
npx expo prebuild --clean

# Build release APK
cd android
gradlew assembleRelease -x lint -x lintVitalAnalyzeRelease
```

### APK Location
`android/app/build/outputs/apk/release/app-release.apk`

---

## Database Schema (MongoDB)

### Collections
- `users` - User profiles and settings
- `families` - Family groups
- `chores` - Chore definitions and assignments
- `events` - Calendar events
- `shopping_items` - Shopping list items
- `messages` - Chat messages
- `family_wall_posts` - Family wall posts
- `rewards` - Rewards catalog
- `achievements` - User achievements

---

## Tech Stack

### Frontend (Web)
- React 18
- Tailwind CSS
- Lucide React icons
- Sonner for toasts

### Frontend (Mobile)
- React Native with Expo
- @react-native-firebase/* for auth
- React Navigation

### Backend
- FastAPI (Python)
- MongoDB
- WebSocket for real-time features
- OpenAI/Gemini for AI features

---

## Session 2 Changes

1. **Disabled FIREBASE_ONLY_MODE** - App now uses live backend
2. **Fixed Chat crashes** - Graceful Firebase error handling
3. **Fixed Family Wall crashes** - Graceful Firebase error handling  
4. **Enhanced mock data** - Better fallbacks for offline mode
5. **Verified all API endpoints** - All working correctly

---

## Test Credentials

### Dev Login (Web)
- Click "Dev: Parent Login" or "Dev: Child Login" buttons
- No password required

### Mobile App
- Sign up with Email/Password via Firebase
- Or use the dev login endpoints

---

## Known Limitations

1. **Google Sign-In (Mobile)** - Requires `@react-native-google-signin/google-signin` setup
2. **Push Notifications** - Requires additional Firebase Cloud Messaging setup
3. **Location Tracking** - Requires user permission and Google Maps API key

---

## Future Enhancements

### P1 - High Priority
- Native Google Sign-In for mobile
- Push notification integration
- Parent Management UI for custom Goals/Achievements

### P2 - Medium Priority
- Voice Commands for Pixie
- Offline mode with sync
- App Store deployment guide

### P3 - Low Priority
- Backend refactoring (modular routers)
- Performance optimization
- Analytics dashboard improvements
