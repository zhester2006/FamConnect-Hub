# FamFocus Hub - Product Requirements Document

## Project Overview
Family-oriented app for managing activities, chores, rewards, and communication.

## Status: PRODUCTION READY | Last Updated: March 26, 2026

## Live URL: https://famfocus-preview.preview.emergentagent.com

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
- Family Management with child profiles + invite link sharing
- Real-time WebSocket Live Chat (GIF + Image support)
- Family Wall with posts/polls, AI Dinner Planner
- Shared Calendar, Shopping List, Chores with AI
- Points & Rewards, Location & Safe Zones with request check-in
- Leaderboard, Reading Logs, Achievements, Analytics, Settings
- Profile pictures displayed throughout the app

## Production Deployment Checklist
- [ ] Set `DISABLE_DEV_LOGIN=true`
- [ ] Configure CORS_ORIGINS to production domain
- [ ] Set up MongoDB Atlas cluster
- [ ] Configure SESSION_SECRET
- [ ] Set real `RESEND_API_KEY` for invite emails
- [ ] SSL/HTTPS + rate limiting

## Pending Tasks
- (P1) Voice Commands for Pixie (speech-to-text)
- (P1) Mobile: Native Google Sign-in
- (P2) Mobile: Map screen fix, hardcoded URLs
- (P2) Weekly Family Leaderboard Recap
- (P2) App Store Deployment Guide
