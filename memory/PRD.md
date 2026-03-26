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

## Latest Features (Session 4)

### 1. Child Username/Password Login
- Parents create child profiles with username and password
- Children login using `/child-login` page
- Kid-friendly login UI with fun animations
- Link from welcome page: "Kid's Login (with username) →"

### 2. Quick Actions Panel on Home Hub
- Shows pending chores grouped by family member
- Children can mark chores as complete directly
- PIN verification required on Home Hub devices
- Shows points earned for each chore

### 3. Parent Credential Management
- Parents can modify child's username/password/PIN
- Edit button appears next to child profiles
- All credentials can be updated anytime

### 4. First-Time Login Tutorial
- Children complete setup wizard on first login
- Add email address and phone number
- Customize profile picture and theme
- `first_login` flag tracks tutorial completion

---

## API Endpoints (New Session 4)

### Child Authentication
- `POST /api/auth/child-login` - Login with username/password

### First-Time Setup
- `POST /api/users/{user_id}/first-login-setup` - Complete tutorial

### Credential Management
- `PUT /api/users/{user_id}/credentials` - Update username/password/PIN

### Quick Actions
- `GET /api/chores/pending-by-member` - Get pending chores grouped by member

---

## User Flows

### Parent Creates Child Profile
1. Go to Family Management
2. Click "Add Child Profile" (pink button)
3. Enter:
   - Child's Name
   - Username (for app login)
   - Password
   - 4-digit PIN (for Home Hub)
4. Click "Create Profile"
5. Success screen shows:
   - Username & PIN confirmation
   - Optional invite link

### Child First Login
1. Child goes to `/child-login`
2. Enters username and password
3. If first login → Redirected to setup wizard
4. Adds email, phone, profile picture
5. Completes tutorial
6. Arrives at Child Dashboard

### Home Hub Quick Actions
1. View pending chores by family member
2. Click chore button to mark complete
3. If Home Hub role → PIN verification modal
4. Select profile and enter PIN
5. Chore marked complete, points awarded

---

## User Schema Updates

```javascript
{
  // Existing fields...
  
  // New fields:
  username: String,        // Alphanumeric, lowercase
  password_hash: String,   // SHA256 hashed
  first_login: Boolean,    // True until tutorial complete
  tutorial_completed: Boolean,
  phone: String           // Added during first login
}
```

---

## Frontend Routes

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | WelcomePage | Public |
| `/child-login` | ChildLogin | Public |
| `/dashboard` | ParentDashboard | Parent |
| `/space` | ChildSpace | Child |
| `/hub` | HomeHub | HomeHub/All |
| `/family` | FamilyManagement | Parent |
| ... | ... | ... |

---

## Role Permissions

### Parent
- Full access to all features
- Create/edit child profiles
- Set/change PINs for all members
- Approve chores, rewards, reading logs

### Child  
- Access own dashboard and features
- Complete chores, earn points
- Login with username/password
- No PIN required on personal device

### HomeHub
- Shared family device role
- **PIN required for ALL actions**
- View all family data
- Profile selection + PIN to make changes

---

## Session 4 File Changes

### Backend
- `server.py`:
  - Added child-login endpoint
  - Added first-login-setup endpoint
  - Added update credentials endpoint
  - Added pending-chores-by-member endpoint
  - Updated child profile creation with username/password

### Frontend
- `ChildLogin.js` (NEW) - Kid-friendly login page
- `WelcomePage.js` - Added "Kid's Login" link
- `FamilyManagement.js`:
  - Updated Add Child modal with username/password
  - Added Edit Credentials modal
  - Added credential edit button for children
- `HomeHub.js`:
  - Added Quick Actions panel
  - Added handleCompleteChore function
  - PIN verification for chore completion
- `App.js` - Added /child-login route

---

## Changelog

### December 2024 - Session 4
- Added child username/password login
- Added Kid's Login page (/child-login)
- Added Quick Actions panel on Home Hub
- Added Edit Credentials modal for parents
- Added first-time login setup endpoint
- Updated child profile creation with credentials

### December 2024 - Session 3
- Weather forecast expansion
- 10 new nature photos
- Calendar monthly events list
- PIN verification system
- HomeHub role

### December 2024 - Session 2
- Fixed build errors
- Firebase offline mode

### December 2024 - Session 1
- Initial implementation

---

## Testing Checklist

### Child Login Flow
- [ ] Create child with username/password
- [ ] Child login at /child-login
- [ ] First-time setup wizard
- [ ] Subsequent logins bypass wizard

### Quick Actions
- [ ] Assign chores to children
- [ ] View Quick Actions on Home Hub
- [ ] Mark chore complete (non-HomeHub)
- [ ] PIN verification on HomeHub

### Credential Management
- [ ] Edit child username
- [ ] Change child password
- [ ] Update child PIN

---

## Future Enhancements

### P1 - High Priority
- Native Google Sign-In for mobile
- Push notifications
- Voice commands for Pixie

### P2 - Medium Priority
- App Store deployment guide
- Offline mode with sync
- Performance optimization

### P3 - Low Priority
- Backend modularization
- Advanced analytics
- Multi-language support
