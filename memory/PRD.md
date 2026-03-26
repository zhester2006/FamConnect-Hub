# FamFocus Hub - Product Requirements Document

## Project Overview
Family-oriented app for managing activities, chores, rewards, and communication.

## Status: PRODUCTION READY | Last Updated: March 26, 2026

## Live URL: https://family-connect-app-4.preview.emergentagent.com

---

## Session 13 Changes (March 26, 2026)

### Bug Fixes
1. **Elizabeth not showing in family list** — Fixed phantom virtual family creation for parents without children. Now only creates virtual family for parents who actually have children linked via `parent_id`.
2. **Family members listing incomplete** — `get_family_members` now also includes creator's children for real families, so all members show regardless of which family is selected.
3. **Route ordering conflict** — Moved `/users/family-profiles` and `/users/verify-pin` routes BEFORE the catch-all `/users/{user_id}` route in users.py.
4. **Dev-login email support** — `POST /api/auth/dev-login` now respects the `email` parameter to login as a specific user.
5. **Profile picture rendering** — Avatar component now includes `referrerPolicy="no-referrer"`, `crossOrigin="anonymous"`, and `onError` fallback to show initial on failed image loads.
6. **`is_current` family flag** — Fixed hardcoded `is_current: True` on virtual family; now properly checks `current_family_id`.

### New Features
1. **HomeHub role option** — Added "homehub" to Change Role and Invite modals (4-column grid).
2. **Edit member profile** — Parents can now edit ANY family member's name, email, username, password, and PIN (not just children).
3. **Email attachment for Google sign-in** — Edit Profile modal has email field with hint about future Google sign-in capability.
4. **Profile deletion** — New DELETE `/api/users/{user_id}` endpoint fully removes user and all associated data (memberships, sessions, messages, chores, etc.).
5. **Delete member modal** — Two options: "Remove from Family" (unlinks) and "Delete Completely" (permanent deletion).
6. **Shopping list delete** — Trash buttons on all item states (pending, approved, purchased).
7. **HomeHub PIN for parents** — New PIN section in Settings.js for parents to set/change their HomeHub PIN.
8. **HomeHub orientation toggle** — Toggle between landscape (side-by-side grid) and portrait (vertical stack) layout.
9. **Equal-sized location tabs** — Family member cards in CheckIns.js use grid layout with consistent sizing.

---

## Session 12 Changes (March 26, 2026)

### Bug Fixes
1. **Invite emails** — Invite endpoint sends emails via Resend (when configured). Always returns a shareable family invite code.
2. **Family name editing** — Backend handles "virtual" families. Name persists correctly.
3. **Safe zones saving** — Added proper coordinate validation and error handling.
4. **Profile background layout** — Cover photo style behind profile picture.
5. **Profile pictures throughout app** — Shared Avatar component across 10 pages.
6. **Child current location view** — Detailed child location card in Location tab.
7. **Request Check-in** — Button on each child profile in Location tab.

### Enhancement: Family Invite Link Sharing
- **Invite modal** shows deep link (`/join/{code}`), invite code, and share buttons (Copy All, WhatsApp, SMS)
- **Join page** (`/join/:code`) resolves family code, shows family name preview, and lets users join with one tap
- Backend endpoints: `GET/POST /api/families/join/{code}` for resolving and joining by code

---

## Architecture
```
/app/backend/
  server.py, deps.py (with indexes), routers/ (18 files)
/app/frontend/
  src/pages/ (21 pages incl JoinFamily.js), src/components/ (Avatar.js + others)
```

## Key Features
- Parent Dashboard with Pixie AI, Child Login with Setup Wizard
- Family Management with child profiles + invite link sharing + role assignment (parent/member/child/homehub)
- Real-time WebSocket Live Chat (GIF + Image support)
- Family Wall with posts/polls, AI Dinner Planner
- Shared Calendar, Shopping List (with delete), Chores with AI
- Points & Rewards, Location & Safe Zones with request check-in
- Leaderboard, Reading Logs, Achievements, Analytics, Settings (with HomeHub PIN)
- Profile pictures displayed throughout the app
- HomeHub with orientation toggle (landscape/portrait)
- Full profile editing (name, email, username, password, PIN)

## Production Deployment Checklist
- [ ] Set `DISABLE_DEV_LOGIN=true`
- [ ] Configure CORS_ORIGINS to production domain
- [ ] Set Resend API key for invite emails
- [ ] Set OpenWeatherMap API key for weather
- [ ] Firebase credentials for mobile push notifications

## Testing
- Iteration 31: 100% passed (pre-session 13)
- Iteration 32: First round of session 13 fixes
- Iteration 33: 100% backend (10/10), frontend code review verified

## Upcoming Tasks
- (P1) Voice Commands for Pixie (speech-to-text)
- (P1) Mobile App: Native Google Sign-in
- (P2) Mobile App: Fix Map screen
- (P2) Weekly Family Leaderboard Recap
- (P2) App Deployment Guide for App Stores
