# FamFocus Hub - Product Requirements Document

## Project Overview
Family-oriented app for managing activities, chores, rewards, and communication.

## Status: DEPLOYMENT READY | Last Updated: March 26, 2026

## Live URL: https://famfocus-preview.preview.emergentagent.com

---

## Deployment Prep (March 26, 2026) — COMPLETE

### Changes Made
- **DB Indexes**: 25+ MongoDB indexes on startup for all high-frequency query fields (user_id, family_id, session_token, email, etc.). Session TTL index for auto-expiry.
- **Dev-Login Guard**: `POST /api/auth/dev-login` checks `DISABLE_DEV_LOGIN` env var. Set to `true` in production.
- **Lint Clean**: All backend source files pass ruff lint. Fixed bare excepts, logger defs, function redefs, unused vars.
- **Frontend Build**: Verified `yarn build` (craco) succeeds.

### Health Check (Iteration 31) — ALL PASS
- Backend Health: healthy
- Auth (dev-login, child-login, /me, ws-token): all working
- Key APIs (families, events, shopping, family-wall, rewards, leaderboard, dinner/schedule): all 200
- Services: Backend, Frontend, MongoDB all RUNNING
- Logs: No errors
- Disk: 82% free
- Frontend Build: compiles successfully

### Deployment Agent Findings
- Web app: NO BLOCKERS
- Mobile app (Expo): 2 hardcoded URLs (separate project, not web app)

---

## Architecture
```
/app/backend/
  server.py, deps.py (with indexes), routers/ (18 files)
/app/frontend/
  src/pages/ (20 pages), src/components/, craco.config.js
```

## Key Features (All Working)
- Parent Dashboard with Pixie AI
- Child Login with Setup Wizard
- Family Management with child profile creation
- Real-time WebSocket Live Chat (GIF + Image support)
- Family Wall with posts and polls
- AI Dinner Planner with weekly schedule + calendar sync
- Shared Calendar
- Shopping List
- Chores with AI suggestions
- Points & Rewards system
- Location & Safe Zones
- Leaderboard
- Reading Logs, Achievements, Analytics, Settings

## Production Deployment Checklist
- [ ] Set `DISABLE_DEV_LOGIN=true` in production backend .env
- [ ] Configure CORS_ORIGINS to production domain only
- [ ] Set up MongoDB replica set / Atlas cluster
- [ ] Configure proper SESSION_SECRET (not default)
- [ ] Set up SSL/HTTPS
- [ ] Enable rate limiting on auth endpoints

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
