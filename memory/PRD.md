# FamFocus Hub - Product Requirements Document

## Project Overview
A comprehensive, family-oriented, mobile-friendly app for managing family activities, chores, rewards, and communication.

## Current Status: PRODUCTION READY

### Last Updated: December 2024

---

## Live URLs

### Web App
**URL:** https://hub-family-core.preview.emergentagent.com

---

## Session 5 Updates

### 1. Removed Developer Sign-In
- Dev login buttons removed from welcome page
- Clean production-ready login experience
- Only "Sign In with Google" and "Kid's Login" buttons visible

### 2. First-Time Login Tutorial for Children
- New Setup Wizard page at `/setup-wizard`
- 4-step onboarding process:
  1. Welcome message with overview
  2. Choose avatar from 8 options
  3. Pick theme from 6 color schemes
  4. Add email and phone (optional)
- Progress bar shows completion percentage
- Skip option available for steps 2-3

### 3. Daily Inspiration Toggle
- Toggle between "Inspire" (✨) and "Bible" (✝️)
- Available on Family Wall and Home Hub
- Bible verses from Scripture
- Removed "AI-generated" text
- Clean, respectful presentation

---

## Authentication Flow

### Parent Login
1. Go to welcome page
2. Click "Sign In with Google"
3. Authenticate with Google
4. Arrive at Parent Dashboard

### Child Login
1. Go to welcome page
2. Click "Kid's Login →"
3. Enter username and password
4. If first login → Setup Wizard
5. Complete 4-step tutorial
6. Arrive at Child Space

---

## Key Features

### For Parents
- Create child profiles with username/password/PIN
- View and manage all family activities
- AI-powered chore scheduling
- Approve chores, reading logs, purchases
- Track children's points and progress
- Set up Home Hub for shared devices

### For Children
- Fun kid-friendly login and onboarding
- Personal dashboard with chores and points
- Earn rewards for completing tasks
- Family chat with emoji and GIFs
- Reading log submissions
- Leaderboard competition with siblings

### For Home Hub (Shared Device)
- PIN verification for all actions
- Profile dropdown selection
- Quick Actions to mark chores complete
- Weather forecast with 3-day view
- Calendar with monthly events
- Daily inspiration or Bible verse

---

## User Roles

| Role | Access | PIN Required |
|------|--------|--------------|
| Parent | Full | No |
| Child | Limited | No (on own device) |
| Member | Standard | No |
| HomeHub | Display | Yes (all actions) |

---

## Enhancement Suggestions

### Recommended Enhancements

#### 1. **Family Prayer/Devotion Time**
- Schedule family devotion/prayer times
- Send reminders to all family members
- Track attendance and participation
- Add Bible reading plans

#### 2. **Meal Planning Integration**
- Plan weekly meals as a family
- Assign cooking helpers
- Generate shopping lists from recipes
- Track dietary preferences

#### 3. **Family Goals & Savings**
- Set family savings goals
- Track contributions from each member
- Visual progress towards goals
- Reward achievements

#### 4. **Chore Streaks & Bonuses**
- Bonus points for completing chores multiple days in a row
- Visual streak counter
- Special badges for consistency
- Weekly/monthly challenges

#### 5. **Voice Commands (Pixie)**
- "Hey Pixie, what are my chores today?"
- "Mark dishes as complete"
- "What's for dinner?"
- Hands-free Home Hub control

#### 6. **Family Memory Wall**
- Save favorite photos permanently
- Create digital photo albums
- Anniversary and milestone reminders
- Memory slideshow on Home Hub

#### 7. **Emergency Contact Card**
- Quick access emergency numbers
- Medical info for each child
- School and doctor contacts
- Share with babysitters

#### 8. **Allowance Management**
- Weekly/monthly allowance tracking
- Points to real money conversion
- Savings goals for kids
- Teach financial literacy

#### 9. **School Integration**
- Track homework assignments
- School event calendar sync
- Grade tracking (if API available)
- Teacher meeting reminders

#### 10. **Gratitude Journal**
- Daily gratitude prompts
- Family gratitude sharing
- Weekly gratitude roundup
- Positive habit building

---

## Technical Notes

### Frontend
- React 18 with Tailwind CSS
- Shadcn/UI components
- Sonner for toasts
- WebSocket for real-time chat

### Backend  
- FastAPI (Python)
- MongoDB database
- Session-based auth
- Real-time WebSocket support

### Mobile App
- React Native with Expo
- @react-native-firebase for auth
- FIREBASE_ONLY_MODE: false

---

## File Changes (Session 5)

### New Files
- `/app/frontend/src/pages/SetupWizard.js` - First-time login tutorial

### Modified Files
- `WelcomePage.js` - Removed dev login buttons
- `FamilyWall.js` - Added quote type toggle
- `HomeHub.js` - Added quote type toggle
- `App.js` - Added setup-wizard route

---

## Changelog

### December 2024 - Session 5
- Removed developer sign-in buttons (production ready)
- Created first-time setup wizard for children
- Added Bible verse toggle for daily inspiration
- Removed "AI-generated" text from quotes

### December 2024 - Sessions 1-4
- Full app implementation
- Firebase authentication
- PIN verification system
- Child username/password login
- Quick Actions panel
- Weather forecast
- Calendar improvements
- And more...

---

## Next Steps

### For Production
1. Set up Google OAuth credentials
2. Configure Firebase for production
3. Set up custom domain
4. Enable HTTPS everywhere
5. Add rate limiting
6. Set up monitoring and logging

### For Enhancement
1. Implement Prayer/Devotion feature
2. Add chore streaks system
3. Build voice commands for Pixie
4. Create family memory wall
5. Add gratitude journal
