# FamFocus Hub - Product Requirements Document

## Project Overview
A comprehensive, family-oriented, mobile-friendly app for managing family activities, chores, rewards, and communication.

## Current Status: READY FOR BUILD ✅

### Last Updated: December 2024

---

## Firebase Configuration - VERIFIED ✅

### Project Details
- **Project ID:** `family-hub-app-d9c04`
- **Database URL:** `https://family-hub-app-d9c04-default-rtdb.firebaseio.com`
- **Storage Bucket:** `family-hub-app-d9c04.firebasestorage.app`
- **Package Name:** `com.famfocus.hub`
- **SHA-1 Fingerprint:** `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

### Firebase Services Enabled
- ✅ Authentication (Email/Password, Google)
- ✅ Realtime Database
- ✅ Storage

### React Native Firebase Packages
- `@react-native-firebase/app`: ^21.14.0
- `@react-native-firebase/auth`: ^21.14.0
- `@react-native-firebase/database`: ^21.14.0
- `@react-native-firebase/storage`: ^21.14.0

---

## Authentication Flow

### Supported Methods
1. **Email/Password** - Full support with signup, login, password reset
2. **Google Sign-In** - Via OAuth (requires SHA-1 fingerprint)
3. **Biometric Login** - Face ID / Fingerprint for quick access

### Auth Service Methods
- `signInWithEmail(email, password)`
- `signUpWithEmail(email, password, displayName)`
- `signInWithGoogle(idToken)`
- `signOut()`
- `sendPasswordReset(email)`
- `changePassword(currentPassword, newPassword)`

---

## User Roles

### Parent
- Full access to all features
- Manage family members
- Approve chores, rewards, etc.

### Child
- Limited access
- Complete chores
- Earn points and rewards

### HomeHub
- Display-focused role
- Calendar, chores, shopping, family wall
- No points/rewards (for shared displays)

---

## Core Features

### Implemented ✅
- User authentication (Firebase)
- Parent/Child/HomeHub dashboards
- Chores management with AI scheduling
- Family chat (Firebase Realtime Database)
- Family wall (posts, photos, polls)
- Calendar/events
- Shopping list
- Dinner planner with AI suggestions
- Location tracking & safe zones
- Points & rewards system
- Leaderboard
- Reading logs
- Achievements & badges
- Pixie AI assistant
- Push notifications
- Profile management
- Biometric authentication

### Pending
- Parent Management UI for Goals/Achievements/Badges
- AI Achievement Suggestions integration
- Backend refactoring (server.py modularization)

---

## Build Instructions

### Prerequisites
1. Node.js installed
2. Android Studio with SDK
3. Firebase project configured

### Build Steps
```bash
cd mobile/FamFocusHub

# Clean install dependencies
rd /s /q node_modules
npm install

# Clean and prebuild
cd android
gradlew clean
cd ..
npx expo prebuild --clean

# Build release APK
cd android
gradlew assembleRelease -x lint -x lintVitalAnalyzeRelease
```

### APK Location
`android/app/build/outputs/apk/release/app-release.apk`

---

## Known Issues

### Resolved ✅
- Firebase web SDK removed, replaced with React Native Firebase
- expo-dev-client removed (was causing Kotlin version conflicts)
- All Firebase services updated to use native modules
- google-services.json files synced

### Outstanding
- Map screen may not show image (Google Maps API key verification needed)
- Poll voting navigation issue (fix attempted, needs testing)

---

## API Configuration

- **Backend URL:** `https://family-hub-app-2.preview.emergentagent.com/api`
- **Firebase endpoints:** `/auth/firebase-login`, `/auth/firebase-signup`

---

## File Structure

```
/app/mobile/FamFocusHub/
├── android/
│   └── app/
│       └── google-services.json ✅
├── src/
│   ├── context/
│   │   └── AuthContext.js ✅
│   ├── navigation/
│   │   └── AppNavigator.js ✅
│   ├── screens/
│   │   └── LoginScreen.js ✅
│   └── services/
│       ├── firebase.init.js ✅
│       ├── firebase.auth.service.js ✅
│       ├── firebase.chat.service.js ✅
│       ├── firebase.storage.service.js ✅
│       ├── firebase.familywall.service.js ✅
│       ├── firebase.notification.service.js ✅
│       └── firebase.service.js ✅
├── app.json ✅
├── google-services.json ✅
└── package.json ✅
```

---

## Changelog

### December 2024
- Migrated from Firebase Web SDK to React Native Firebase
- Removed expo-dev-client (Kotlin conflict)
- Updated all Firebase service files
- Synced google-services.json files
- Verified all auth methods
- Removed legacy firebase.config.js
- Updated package.json dependencies
- Added @react-native-firebase/app plugin to app.json
