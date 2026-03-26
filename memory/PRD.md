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

## Session 7 Updates (March 2026)

### 1. Logo Improvement
- Welcome page logo enlarged (w-44/h-44, lg:w-52/h-52) with glowing blue drop-shadow effect
- Subtle pulsing glow behind the logo for visual appeal

### 2. Setup Wizard E2E Verified
- Full 4-step flow tested: Welcome → Avatar → Theme → Contact → Complete
- Child login with first_login=true redirects to /setup-wizard correctly
- Setup completion marks first_login=false and redirects to /space

### 3. Parent Management UI (Achievements)
- New "Manage" tab on Achievements page (parent-only)
- **Create Achievement**: Modal with name, description, icon, points reward, type fields
- **AI Suggestions**: Panel with context input, GPT-5.2 generates 5 creative badge ideas
- **Award to Children**: Select a child from family members to award a custom badge
- **Delete Achievement**: Remove custom achievements
- **Custom Goals & Badges List**: Grid display of all custom achievements with award/delete actions

### 4. AI Achievement Suggestions
- Uses Emergent LLM Key with GPT-5.2 model
- Accepts optional theme/context (e.g., "summer", "reading", "kindness")
- Returns 5 suggestions with name, description, icon, requirement, and points
- "Use" button pre-fills the Create Achievement form

---

## Session 6 Updates (March 2026)

### Bug Fixes
1. **Live Chat WebSocket Fix** - WebSocket URL missing `/api` prefix
2. **Child Login Session Bug** - Wrong collection (`sessions` vs `user_sessions`)
3. **Child Login Redirect** - Fixed to `/space`
4. **WebSocket Token Retrieval** - Checks both cookies and localStorage

### UI Improvements
5. **Welcome Page Logo** - Managed per user request
6. **Poll Voter Names** - FamilyWall PollComponent displays voter names

---

## Authentication Flow

### Parent Login
1. Go to welcome page → Click "Sign In with Google"
2. Authenticate with Google → Arrive at Parent Dashboard

### Child Login
1. Go to welcome page → Click "Kid's Login"
2. Enter username and password
3. If first login → Setup Wizard (4 steps) → Child Space
4. If returning → Child Space directly

---

## Key Features

### For Parents
- Create child profiles with username/password/PIN
- **Custom Goals & Achievements** (NEW) - Create, manage, award badges
- **AI Achievement Suggestions** (NEW) - GPT-5.2 powered badge ideas
- View and manage all family activities
- AI-powered chore scheduling
- Approve chores, reading logs, purchases
- Track children's points and progress
- Set up Home Hub for shared devices

### For Children
- Fun kid-friendly login and onboarding (Setup Wizard)
- Personal dashboard with chores and points
- Earn rewards and custom badges for completing tasks
- Family chat with emoji and GIFs
- Reading log submissions
- Leaderboard competition with siblings

### For Home Hub (Shared Device)
- PIN verification for all actions
- Quick Actions to mark chores complete
- Weather forecast, Calendar, Daily inspiration

---

## Technical Notes

### Frontend
- React 18 with Tailwind CSS
- Shadcn/UI components, Sonner for toasts
- WebSocket for real-time chat (via /api/ws/chat/)

### Backend  
- FastAPI (Python), MongoDB database
- Session-based auth (user_sessions collection)
- Emergent LLM Key for AI features (GPT-5.2)

### Key API Endpoints
- `POST /api/achievements/custom` - Create custom achievement
- `GET /api/achievements/custom` - List custom achievements
- `DELETE /api/achievements/custom/{id}` - Delete
- `POST /api/achievements/custom/{id}/award` - Award to child
- `POST /api/achievements/ai-suggestions` - AI suggestions

---

## Test Credentials
- Child login: username `testkid`, password `pass123`
- Dev parent login: `POST /api/auth/dev-login` with `{role: "parent"}`

---

## Pending Issues
- (P1) Mobile App: Native Google Sign-in not implemented
- (P2) Mobile App: Map screen doesn't display map image

## Upcoming Tasks
- (P2) Push Notifications (web + mobile)
- (P2) Voice Commands for Pixie (speech-to-text)
- (P2) Refactor server.py into modular routers (7200+ lines)
- (P2) App Store Deployment Guide
