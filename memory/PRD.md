# FamFocus Hub - Product Requirements Document

## Project Overview
A comprehensive, family-oriented, mobile-friendly app for managing family activities, chores, rewards, and communication.

## Current Status: PRODUCTION READY
### Last Updated: March 2026

---

## Live URL
**Web App:** https://family-dashboard-14.preview.emergentagent.com

---

## Session 9 Updates (March 2026)

### Pixie Daily Digest
- New endpoint: `POST /api/ai/pixie/daily-digest`
- Generates personalized morning summary using GPT-5.2:
  - Greeting, day overview, member motivational highlights
  - Tip of the day, fun fact
- **Cached per family per day** (subsequent calls return cached version)
- Creates notification entry for the bell
- Beautiful gradient card on Parent Dashboard with member chips, yellow/purple info cards
- DailyDigest extracted as standalone component to avoid babel build issues

---

## Session 8 Updates (March 2026)

### 1. Server Refactor: 7200+ lines to Modular Routers
- `server.py`: 7254 → 203 lines
- `deps.py`: Shared DB, helpers, models (299 lines)
- 18 router files under `/app/backend/routers/` (~6600 lines total)

### 2. Push Notifications (Web)
- NotificationBell in Sidebar: unread badge, dropdown, mark-all-read, clear-all
- Browser push: permission request, OS notifications on new items
- Endpoints: `GET /api/notifications/unread-count`, `POST /api/push/subscribe`

### 3. Enhanced Pixie AI — Proactive Suggestions
- `POST /api/ai/pixie/proactive-suggestions` — context-aware suggestions
- Dashboard widget with refresh button

### 4. Bixby-Style Pixie on Login Screen
- Glowing cyan orb with floating particles
- Rotating speech bubble tips, tap-to-expand capabilities grid

---

## Architecture

```
/app/
├── backend/
│   ├── server.py       (203 lines — app, WebSocket, router includes)
│   ├── deps.py         (299 lines — db, helpers, models)
│   ├── routers/        (18 files, ~6600 lines)
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/      (WelcomePage, ParentDashboard, HomeHub, Achievements, etc.)
│   │   ├── components/ (DailyDigest, NotificationBell, Sidebar, etc.)
│   │   └── App.js
│   └── .env
└── mobile/FamFocusHub/
```

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
