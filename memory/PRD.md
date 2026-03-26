# FamFocus Hub - Product Requirements Document

## Project Overview
A comprehensive, family-oriented, mobile-friendly app for managing family activities, chores, rewards, and communication.

## Current Status: PRODUCTION READY

### Last Updated: March 2026

---

## Live URLs

### Web App
**URL:** https://family-dashboard-14.preview.emergentagent.com

---

## Session 6 Updates (March 2026)

### Bug Fixes
1. **Live Chat WebSocket Fix** - WebSocket URL was missing `/api` prefix, causing connections to never reach the backend through Kubernetes ingress. Fixed both frontend URL and backend route.
2. **Child Login Session Bug** - Sessions were stored in wrong collection (`sessions` instead of `user_sessions`), causing auth failures after child login. Fixed to use correct collection and set session cookie.
3. **Child Login Redirect** - Was navigating to non-existent `/child-dashboard`. Fixed to redirect to `/space`.
4. **WebSocket Token Retrieval** - `getSessionToken()` now checks both cookies and localStorage for session tokens.

### UI Improvements
5. **Welcome Page Logo Removed** - FamFocus Hub logo/image removed from top of Welcome Screen per user request.
6. **Poll Voter Names** - FamilyWall's PollComponent now receives `familyMembers` prop and displays voter names.

---

## Session 5 Updates

### 1. Removed Developer Sign-In
- Dev login buttons removed from welcome page
- Clean production-ready login experience
- Only "Sign In with Google" and "Kid's Login" buttons visible

### 2. First-Time Login Tutorial for Children
- New Setup Wizard page at `/setup-wizard`
- 4-step onboarding process:
  1. Welcome message with overview
  2. Choose avatar from 8 options
  3. Pick theme from 6 color schemes
  4. Add email and phone (optional)
- Progress bar shows completion percentage
- Skip option available for steps 2-3

### 3. Daily Inspiration Toggle
- Toggle between "Inspire" and "Bible"
- Available on Family Wall and Home Hub
- Bible verses from Scripture
- Removed "AI-generated" text
- Clean, respectful presentation

---

## Authentication Flow

### Parent Login
1. Go to welcome page
2. Click "Sign In with Google"
3. Authenticate with Google
4. Arrive at Parent Dashboard

### Child Login
1. Go to welcome page → Click "Kid's Login"
2. Enter username and password
3. If first login → Setup Wizard → Complete 4-step tutorial
4. Arrive at Child Space (`/space`)

---

## Key Features

### For Parents
- Create child profiles with username/password/PIN
- View and manage all family activities
- AI-powered chore scheduling
- Approve chores, reading logs, purchases
- Track children's points and progress
- Set up Home Hub for shared devices

### For Children
- Fun kid-friendly login and onboarding
- Personal dashboard with chores and points
- Earn rewards for completing tasks
- Family chat with emoji and GIFs
- Reading log submissions
- Leaderboard competition with siblings

### For Home Hub (Shared Device)
- PIN verification for all actions
- Profile dropdown selection
- Quick Actions to mark chores complete
- Weather forecast with 3-day view
- Calendar with monthly events
- Daily inspiration or Bible verse

---

## User Roles

| Role | Access | PIN Required |
|------|--------|--------------|
| Parent | Full | No |
| Child | Limited | No (on own device) |
| Member | Standard | No |
| HomeHub | Display | Yes (all actions) |

---

## Technical Notes

### Frontend
- React 18 with Tailwind CSS
- Shadcn/UI components
- Sonner for toasts
- WebSocket for real-time chat (via /api/ws/chat/)

### Backend  
- FastAPI (Python)
- MongoDB database
- Session-based auth (user_sessions collection)
- Real-time WebSocket support

### Mobile App
- React Native with Expo
- @react-native-firebase for auth
- FIREBASE_ONLY_MODE: false

---

## Test Credentials
- Child login: username `testkid`, password `pass123`
- Dev parent login: `POST /api/auth/dev-login` with `{role: "parent"}`

---

## Pending Issues
- (P1) Mobile App: Native Google Sign-in not implemented
- (P2) Mobile App: Map screen doesn't display map image

## In-Progress Tasks
- (P1) First-time login tutorial: SetupWizard.js created, redirect works, but needs thorough E2E testing
- (P2) Refactor server.py into modular routers (7200+ lines)

## Upcoming Tasks
- (P1) Parent Management UI: Custom Goals, Achievements, Badges
- (P1) AI Achievement Suggestions integration
- (P2) Push Notifications (web + mobile)
- (P2) Voice Commands for Pixie
- (P2) App Store Deployment Guide
