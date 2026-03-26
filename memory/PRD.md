# FamFocus Hub - Product Requirements Document

## Project Overview
Family-oriented app for managing activities, chores, rewards, and communication.

## Status: PRODUCTION READY | Last Updated: March 2026

## Live URL: https://famfocus-preview.preview.emergentagent.com

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

## Test Credentials
- Child: username `testkid`, password `pass123`
- Parent: `POST /api/auth/dev-login` with `{role: "parent"}`

## Pending
- (P1) Mobile: Native Google Sign-in
- (P2) Mobile: Map screen
- (P2) Voice Commands for Pixie
- (P2) App Store Deployment Guide
