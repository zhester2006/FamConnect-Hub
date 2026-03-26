# FamFocus Hub - Product Requirements Document

## Project Overview
Family-oriented app for managing activities, chores, rewards, and communication.

## Status: PRODUCTION READY | Last Updated: March 26, 2026

## Live URL: https://famfocus-preview.preview.emergentagent.com

---

## Session 12 Changes (March 26, 2026)

### Bug Fixes
1. **Invite emails** — Invite endpoint now sends emails via Resend (when API key configured). Always returns a shareable family invite code. Frontend shows code with copy button after invite.
2. **Family name editing** — Backend now handles "virtual" families (where family_id = parent user_id). Creates a persistent family doc on first edit. Name displays correctly across the app.
3. **Safe zones saving** — Added proper validation (lat/lng range check), response checking, and error messages. Fixed form to properly show errors on invalid coordinates.
4. **Profile background layout** — Restructured Settings profile section: background is now a cover photo behind the profile picture (Facebook-style), not displayed below it.

### Features Added
5. **Profile pictures throughout the app** — Created shared `Avatar` component showing profile pictures when available, gradient initials otherwise. Updated 10 pages: FamilyManagement, ParentDashboard, LiveChat, FamilyWall, CheckIns, HomeHub, ChoreScheduler, Analytics, Settings.
6. **Child current location view** — Location tab now shows a detailed child location card with current/last-known position, address, map link, and recent check-in history.
7. **Request Check-in button** — Added to each child's profile card in Location tab. Sends a notification to the child requesting them to share their location.

### Backend Changes
- `POST /api/location/request-checkin/{child_id}` — New endpoint for check-in requests
- `PUT /api/families/{family_id}` — Fixed to handle virtual families
- `POST /api/families/{family_id}/invite` — Returns family_code, sends email if Resend configured
- `GET /api/families` — Reads saved family name from DB
- `GET /api/family-wall` — Normalizes user_name/user_picture fields

### Files Modified
- `/app/frontend/src/components/Avatar.js` (NEW — shared avatar component)
- `/app/frontend/src/pages/FamilyManagement.js` (invite code UI, edit family, avatars)
- `/app/frontend/src/pages/CheckIns.js` (request check-in, child location card, avatars)
- `/app/frontend/src/pages/Settings.js` (background behind profile picture)
- `/app/frontend/src/pages/FamilyWall.js` (avatar for posts)
- `/app/frontend/src/pages/LiveChat.js` (avatar for online users)
- `/app/frontend/src/pages/ParentDashboard.js` (avatar for child cards)
- `/app/frontend/src/pages/ChoreScheduler.js` (avatar for children)
- `/app/frontend/src/pages/Analytics.js` (avatar for child stats)
- `/app/frontend/src/pages/HomeHub.js` (avatar for family members)
- `/app/backend/routers/family.py` (invite, edit, families list)
- `/app/backend/routers/location.py` (request check-in endpoint)
- `/app/backend/routers/wall.py` (field normalization)

---

## Architecture
```
/app/backend/
  server.py, deps.py (with indexes), routers/ (18 files)
/app/frontend/
  src/pages/ (20 pages), src/components/ (Avatar.js + others), craco.config.js
```

## Key Features (All Working)
- Parent Dashboard with Pixie AI
- Child Login with Setup Wizard
- Family Management with child profile creation + invite codes
- Real-time WebSocket Live Chat (GIF + Image support)
- Family Wall with posts and polls
- AI Dinner Planner with weekly schedule + calendar sync
- Shared Calendar
- Shopping List
- Chores with AI suggestions
- Points & Rewards system
- Location & Safe Zones with request check-in
- Leaderboard
- Reading Logs, Achievements, Analytics, Settings
- Profile pictures displayed throughout the app

## Production Deployment Checklist
- [ ] Set `DISABLE_DEV_LOGIN=true` in production backend .env
- [ ] Configure CORS_ORIGINS to production domain only
- [ ] Set up MongoDB replica set / Atlas cluster
- [ ] Configure proper SESSION_SECRET (not default)
- [ ] Set up SSL/HTTPS
- [ ] Enable rate limiting on auth endpoints
- [ ] Set real `RESEND_API_KEY` for invite emails

## Test Credentials
- Child: username `testkid`, password `pass123`
- Parent: `POST /api/auth/dev-login` with `{role: "parent"}`

## Pending Tasks
- (P1) Voice Commands for Pixie (speech-to-text)
- (P1) Mobile: Native Google Sign-in
- (P2) Mobile: Map screen fix
- (P2) Mobile: Fix hardcoded URLs (use env vars)
- (P2) Weekly Family Leaderboard Recap
- (P2) App Store Deployment Guide
