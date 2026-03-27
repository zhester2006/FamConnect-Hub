# FamFocus Hub - Product Requirements Document

## Status: PRODUCTION READY | Last Updated: March 27, 2026
## Live URL: https://chore-share-test.preview.emergentagent.com

---

## Current Family State
- Zachery Hester: parent (user_f5d5c9e075da)
- Elizabeth Buss: parent (user_10ad6e706051)
- Home Hub: homehub (user_c92a35507cef, formerly Isaiah)
- Eli: child, Nivea: child, Jeremiah: child

---

## Session 13 Changes (March 26-27, 2026)

### Critical Fixes
1. **HomeHub role not working** — `get_user_families` now resolves families for ALL roles via `family_id`/`parent_id` fields (not just parent virtual families or memberships). HomeHub-role users can now see and interact with their family.
2. **Family member authorization** — `get_family_members` now authorizes access for users linked via `family_id`/`parent_id`, not just via `family_memberships`.
3. **Admin→Parent label** — All "admin" membership roles changed to "parent" in DB and API responses. Family creators now use "parent" role. Backend normalizes admin→parent in responses.
4. **Role change fix** — `update_member_role` checks `family_memberships` table + shared families for verification (not just `user.family_id/parent_id`).
5. **Elizabeth phantom family** — Fixed virtual family creation for parents without children.
6. **Route ordering** — `/users/family-profiles` and `/users/verify-pin` before catch-all `/users/{user_id}`.
7. **OAuth redirect** — homehub→`/hub`, parent→`/dashboard`, child→`/space`.

### Features Added
1. **HomeHub role** — Full role with restricted sidebar (Hub, Calendar, Chat, Wall, Shopping, Leaderboard, Dinner, Rewards only).
2. **Edit ALL member profiles** — Name, email, username, password, PIN.
3. **Profile deletion** — Full data cleanup.
4. **Shopping delete** — Trash buttons on all items.
5. **HomeHub orientation toggle** — Landscape/portrait.
6. **Notifications** — Chore assignment/completion/approval, event creation, shopping decisions.
7. **HomeHub PIN** — Parents set PIN in Settings.
8. **Equal-sized location tabs**.

## Architecture
```
/app/backend/routers/ (18 files), deps.py, server.py
/app/frontend/src/pages/ (21 pages), components/ (Avatar, Sidebar, ProfilePinVerification)
```

## Testing: Iteration 36 — 100% backend (11/11), 100% frontend

## Upcoming Tasks
- (P1) Voice Commands for Pixie (speech-to-text)
- (P1) Mobile App: Native Google Sign-in
- (P2) Weekly Family Leaderboard Recap
- (P2) Mobile App deployment (hardcoded URL fixes)
- (P2) App Store Deployment Guide
