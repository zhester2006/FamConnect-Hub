# FamFocus Hub - Product Requirements Document

## Project Overview
Family-oriented app for managing activities, chores, rewards, and communication.

## Status: PRODUCTION READY | Last Updated: March 2026

## Live URL: https://famfocus-preview.preview.emergentagent.com

---

## Session 11 Verification (March 2026)

### Child Profile Visibility in Family Management — VERIFIED
- **Issue**: Newly created child profiles were not appearing in the Family Members list.
- **Root cause**: Backend `GET /api/families/{family_id}/members` only queried `family_memberships` collection, missing "virtual" family members tied via `parent_id`.
- **Fix**: Backend updated to also query `users` collection where `parent_id == family_id`.
- **Status**: VERIFIED — Frontend correctly shows all children (existing and newly created) immediately after creation.

---

## Session 10 Bug Fixes (March 2026)

### 1. Live Chat "Reconnecting" Loop — FIXED
- **Root cause**: httpOnly cookies can't be read by JavaScript. LiveChat couldn't extract session token for WebSocket URL.
- **Fix**: Added `GET /api/auth/ws-token` endpoint. LiveChat fetches token via API call, then connects WebSocket. Now shows "Live" status.

### 2. Polls Not Showing on Family Wall — FIXED
- **Root cause**: Backend stored field as `type: 'poll'` but frontend checked `post_type === 'poll'`.
- **Fix**: GET `/api/family-wall` now normalizes `post_type` from `type` field. Fixed one existing poll with missing options.

---

## Architecture
```
/app/backend/
  server.py (203 lines), deps.py (299 lines), routers/ (18 files)
/app/frontend/
  src/pages/ + src/components/
```

## Key Features
- Parent Dashboard with Pixie Daily Digest + Proactive Suggestions
- Bixby-style Pixie AI on login screen
- Real-time WebSocket chat (FIXED)
- Family Wall with polls + voter names (FIXED)
- Achievements with Parent Manage tab + AI suggestions
- NotificationBell with browser push + in-app dropdown
- Child login with Setup Wizard
- GIF and Image sharing in Live Chat
- AI Dinner Planner with weekly schedule + calendar sync
- Family Management with child profile creation (VERIFIED)
- Location & Safe Zones with enforcement modal

## Test Credentials
- Child: username `testkid`, password `pass123`
- Parent: `POST /api/auth/dev-login` with `{role: "parent"}`

## Pending
- (P1) Voice Commands for Pixie (speech-to-text)
- (P1) Mobile: Native Google Sign-in
- (P2) Mobile: Map screen fix
- (P2) Weekly Family Leaderboard Recap
- (P2) App Store Deployment Guide
