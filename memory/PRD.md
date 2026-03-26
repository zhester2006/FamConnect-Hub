# FamFocus Hub - Product Requirements Document

## Project Overview
A comprehensive, family-oriented, mobile-friendly app for managing family activities, chores, rewards, and communication.

## Current Status: PRODUCTION READY
### Last Updated: March 2026

---

## Live URL
**Web App:** https://family-dashboard-14.preview.emergentagent.com

---

## Session 8 Updates (March 2026)

### 1. Server Refactor: 7200+ lines → Modular Routers
- `server.py` reduced from **7254 lines to 203 lines**
- Created `deps.py` with shared DB connection, helpers, and Pydantic models (299 lines)
- Split into **18 modular router files** under `/app/backend/routers/`:
  - `auth.py` | `family.py` | `users.py` | `chores.py` | `shopping.py`
  - `wall.py` | `messages.py` | `calendar_routes.py` | `reading.py` | `food.py`
  - `ai.py` | `rewards.py` | `location.py` | `notifications.py` | `weather.py`
  - `gifs.py` | `achievements.py` | `misc.py`
- WebSocket handler remains in `server.py`

### 2. Push Notifications (Web: Browser + In-App Bell)
- **NotificationBell component** in Sidebar with:
  - Unread count badge (pulsing red)
  - Dropdown showing all notifications with icons, timestamps, read/unread state
  - Mark All Read and Clear All buttons
  - Auto-refreshes every 30 seconds
- **Browser Push**: Requests notification permission, shows OS-level notifications when new ones arrive
- New endpoints: `GET /api/notifications/unread-count`, `POST /api/push/subscribe`

### 3. Enhanced Pixie AI — Proactive Suggestions
- New endpoint: `POST /api/ai/pixie/proactive-suggestions`
- Analyzes family data (pending chores, upcoming events, recent meals, members)
- Uses GPT-5.2 via Emergent LLM Key to generate 3-4 contextual suggestions
- Categories: chore, meal, activity, schedule — each with priority level
- **Dashboard Widget**: Pixie suggestions shown on Parent Dashboard with refresh button

### 4. Bixby-Style Pixie on Login Screen
- Glowing cyan orb with floating particles and pulse animation
- "PIXIE" label with green online indicator
- Speech bubble with rotating tips (5 tips, 4-second cycle with indicator dots)
- Tap to expand — shows grid of 6 Pixie capabilities
- Replaced old text-based PixieGreeting with interactive visual assistant

---

## Architecture

```
/app/
├── backend/
│   ├── server.py       (203 lines — app setup, WebSocket, router includes)
│   ├── deps.py         (299 lines — db, helpers, models)
│   ├── routers/        (18 router files, ~6600 lines total)
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/      (WelcomePage, ParentDashboard, HomeHub, Achievements, etc.)
│   │   ├── components/ (NotificationBell, Sidebar, ProfilePinVerification, etc.)
│   │   └── App.js
│   └── .env
└── mobile/
    └── FamFocusHub/
```

## Key Features
- **Parent Dashboard**: Stats, AI chore scheduler, Pixie proactive suggestions, battery status
- **Home Hub**: Weather, calendar, PIN verification, quick actions, daily inspiration
- **Family Wall**: Posts, polls with voter names, Bible/Inspiration quotes
- **Live Chat**: Real-time WebSocket messaging
- **Achievements**: Personal/family/seasonal badges, Parent Manage tab (CRUD + AI suggestions)
- **Notifications**: In-app bell + browser push
- **Child System**: Username/password login, Setup Wizard, points & rewards

## Test Credentials
- Child login: username `testkid`, password `pass123`
- Dev parent login: `POST /api/auth/dev-login` with `{role: "parent"}`

## Pending Issues
- (P1) Mobile App: Native Google Sign-in not implemented
- (P2) Mobile App: Map screen doesn't display map image

## Upcoming Tasks
- (P2) Voice Commands for Pixie (speech-to-text)
- (P2) App Store Deployment Guide
- (P2) Mobile push notifications
