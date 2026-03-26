# FamFocus Hub - Product Requirements Document

## Project Overview
A comprehensive, family-oriented, mobile-friendly app for managing family activities, chores, rewards, and communication.

## Current Status: LIVE WITH NEW FEATURES

### Last Updated: December 2024

---

## Live URLs

### Web App
**URL:** https://hub-family-core.preview.emergentagent.com

---

## New Features Implemented (Session 3)

### 1. Weather Forecast
- Expandable 3-day weather forecast on Home Hub
- Shows daily high/low temperatures
- Weather conditions with icons
- Current humidity display
- Click weather card to expand/collapse forecast

### 2. Nature Photos for Home Hub
- Added 10 new bright nature photos to screensaver rotation
- Total of 22 screensaver images now available
- Categories: Mountains, Beaches, Waterfalls, Aurora, Lavender fields, Forests

### 3. Calendar - Monthly Events List
- All events for the current month displayed below calendar
- Events grouped by date with day name
- Today's events highlighted with "TODAY" badge
- Past events shown with reduced opacity
- Scrollable list with max height

### 4. Parent-Child Profile Setup (No sign-in required for child)
- Parents can create child profiles directly
- Set 4-digit PIN during profile creation
- Invite link generated automatically
- Link expires after 7 days
- Child can complete setup on their own device
- Child can customize profile picture, theme, nickname

### 5. PIN-based Profile Verification (Home Hub)
- Home Hub role requires PIN for all actions
- Profile dropdown when adding events/items
- 4-digit PIN verification before action
- Prevents unauthorized changes on shared devices
- Parents can set/change PINs in Family Management

---

## API Endpoints (New)

### Weather
- `GET /api/weather/forecast?lat=&lon=&days=3` - Multi-day forecast

### User/PIN Management
- `POST /api/users/child` - Create child profile with PIN
- `POST /api/users/{user_id}/pin` - Set/update user PIN
- `POST /api/users/verify-pin` - Verify PIN for Home Hub actions
- `GET /api/users/family-profiles` - Get all family members for dropdown

### Invite System
- `GET /api/invite/{invite_code}` - Get invite info
- `POST /api/invite/{invite_code}/complete` - Complete child setup

---

## User Roles

### Parent
- Full access to all features
- Can create child profiles
- Can set/change PINs for family members
- Can approve chores, rewards, etc.

### Child
- Limited access to age-appropriate features
- Complete chores, earn points
- No PIN required on personal device
- PIN required on Home Hub

### Member
- Standard family access
- Participate in family activities

### HomeHub (NEW)
- Display-focused role for shared devices
- PIN required for ALL actions
- Anyone can view family data
- Profile selection + PIN to make changes

---

## Frontend Components

### ProfilePinVerification Component
- `/app/frontend/src/components/ProfilePinVerification.js`
- Profile selection dropdown
- 4-digit PIN input with auto-focus
- Error handling for invalid PINs
- Shows "No PIN" warning for users without PIN

---

## File Changes (Session 3)

### Backend
- `/app/backend/server.py`:
  - Added weather forecast endpoint
  - Added PIN fields to User model
  - Added child profile creation with PIN
  - Added PIN verification endpoint
  - Added family profiles endpoint
  - Added invite system endpoints
  - Added homehub role to role validation

### Frontend
- `/app/frontend/src/utils/pageBackgrounds.js`:
  - Added 10 new bright nature photos
  
- `/app/frontend/src/pages/HomeHub.js`:
  - Expandable weather forecast dropdown
  - PIN verification for Home Hub role actions
  - Lock icons on action buttons for Home Hub
  
- `/app/frontend/src/pages/Calendar.js`:
  - Monthly events list below calendar
  
- `/app/frontend/src/pages/FamilyManagement.js`:
  - Add Child Profile button and modal
  - Set PIN functionality for members
  - HomeHub role in permissions list
  - Invite link generation and copy
  
- `/app/frontend/src/components/ProfilePinVerification.js`:
  - New component for PIN verification modal
  
- `/app/frontend/src/App.css`:
  - Added fadeIn animation

---

## Testing Status

### Verified Features
- [x] Weather forecast endpoint returns 3-day forecast
- [x] Weather forecast displays correctly on Home Hub
- [x] Calendar shows monthly events list
- [x] Family Management shows "Add Child Profile" button
- [x] Add Child Profile modal works with PIN input
- [x] HomeHub role appears in permissions
- [x] Screensaver images rotating with new photos

### Needs User Testing
- [ ] Create actual child profile and verify invite link
- [ ] Complete child setup from invite link
- [ ] PIN verification on Home Hub device
- [ ] Mobile app rebuild with FIREBASE_ONLY_MODE=false

---

## Mobile App Status

- FIREBASE_ONLY_MODE: `false` (uses live backend)
- Build required for changes to take effect
- Firebase services refactored for offline fallback
- PIN verification not yet implemented in mobile

---

## Changelog

### December 2024 - Session 3
- Added 3-day weather forecast to Home Hub
- Added 10 new bright nature screensaver photos
- Added "All Events - Month" list below calendar
- Added "Add Child Profile" with PIN setup
- Added PIN verification system for Home Hub
- Added HomeHub role to role system
- Added invite link system for child setup

### December 2024 - Session 2
- Fixed SyntaxError in api.service.js
- Added offline mode to Firebase services
- Enhanced mock data for AI Pixie

### December 2024 - Session 1
- Migrated to React Native Firebase
- Initial feature implementation

---

## Next Steps

### For User
1. Test web app with all new features
2. Create a child profile to test invite flow
3. Rebuild mobile app to get latest changes

### Future Enhancements
- Native Google Sign-In for mobile
- Voice commands for Pixie
- Push notifications
- Backend modularization
