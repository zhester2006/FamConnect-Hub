# FamFocus Hub - Product Requirements Document

## Project Overview
Family-oriented app for managing activities, chores, rewards, and communication.

## Status: PRODUCTION READY | Last Updated: March 27, 2026

## Live URL: https://family-connect-app-4.preview.emergentagent.com

---

## Session 13 Part 2 Changes (March 27, 2026)

### Bug Fixes
1. **Role change parent→homehub** — Fixed `update_member_role` to check `family_memberships` table for shared family verification (not just `user.family_id/parent_id` which can be None).

### New Features
1. **HomeHub sidebar restrictions** — HomeHub-role users only see: Hub, Calendar, Chat, Wall, Shopping, Leaderboard, Dinner, Rewards. Hidden: Chores, Family, Reading, Location, Settings.
2. **HomeHub scrollable landscape** — Both columns in landscape mode have `overflow-y-auto`.
3. **Notifications system** — Added notifications for:
   - Chore assigned to user
   - Chore completed (notifies parent)
   - Chore approved/denied (notifies child)
   - Calendar event assigned
   - Calendar event needs approval (child→parent)
   - Shopping item request (child→parent)
   - Shopping item approved/denied (parent→child)
   - Role change notification

## Session 13 Part 1 Changes (March 26, 2026)

### Bug Fixes
1. **Elizabeth not showing in family list** — Fixed phantom virtual family creation.
2. **Family members listing incomplete** — Includes creator's children for real families.
3. **Route ordering conflict** — Moved specific routes before catch-all `/users/{user_id}`.
4. **Dev-login email support** — Respects email parameter.
5. **Profile picture rendering** — Avatar onError fallback, referrerPolicy.
6. **`is_current` family flag** — Properly checks `current_family_id`.

### New Features
1. **HomeHub role option** — 4-column role grid (parent/member/child/homehub).
2. **Edit ALL member profiles** — Name, email, username, password, PIN for any family member.
3. **Email for Google sign-in** — Parents attach email to child profiles.
4. **Profile deletion** — Full cleanup of all associated data.
5. **Delete member modal** — "Remove from Family" vs "Delete Completely".
6. **Shopping list delete** — Trash buttons on all item states.
7. **HomeHub PIN for parents** — PIN section in Settings.
8. **HomeHub orientation toggle** — Landscape/portrait layout switch.
9. **Equal-sized location tabs** — Grid layout for member cards in CheckIns.

---

## Architecture
```
/app/backend/
  server.py, deps.py (with indexes), routers/ (18 files)
/app/frontend/
  src/pages/ (21 pages), src/components/ (Avatar.js, Sidebar.js, ProfilePinVerification.js)
```

## Key Features
- Parent Dashboard with Pixie AI, Child Login with Setup Wizard
- Family Management (invite links, role assignment incl. homehub, profile editing)
- Real-time WebSocket Live Chat (GIF + Image support)
- Family Wall, AI Dinner Planner, Shared Calendar
- Shopping List (with delete), Chores with AI + child completion
- Points & Rewards, Location & Safe Zones
- Leaderboard, Reading Logs, Achievements, Analytics
- Settings (HomeHub PIN, profile background)
- HomeHub (orientation toggle, PIN-verified actions, restricted sidebar)
- Notification system for events/chores/shopping approvals

## Testing
- Iteration 33: 100% backend (10/10)
- Iteration 34: 100% backend (15/15), frontend 100%

## Upcoming Tasks
- (P1) Voice Commands for Pixie (speech-to-text)
- (P1) Mobile App: Native Google Sign-in
- (P2) Mobile App: Fix Map screen
- (P2) Weekly Family Leaderboard Recap
- (P2) App Deployment Guide for App Stores
