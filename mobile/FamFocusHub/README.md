# FamFocus Hub - Mobile App

A comprehensive family management mobile app built with React Native and Expo.

## Features

- **GPS Tracking & Geofencing**: Real-time location tracking with safe zone alerts
- **Battery Monitoring**: Share battery levels with family members
- **Family Wall**: Share posts, photos, GIFs, and polls
- **Shopping List**: Collaborative shopping with categories and urgency markers
- **Dinner Planner**: AI-powered weekly meal planning
- **Live Chat**: Real-time messaging with WebSockets
- **Chores & Rewards**: Gamified task management with points
- **Push Notifications**: Alerts for geofence events, messages, and more
- **Offline Support**: Works offline with automatic sync

## Prerequisites

- Node.js 18+ 
- Expo CLI (`npm install -g expo-cli`)
- iOS: Xcode 14+ (for simulator/device builds)
- Android: Android Studio with SDK 33+
- Physical device for testing location/battery features

## Quick Start

### 1. Install Dependencies

```bash
cd /app/mobile/FamFocusHub
npm install
# or
yarn install
```

### 2. Start Development Server

```bash
npx expo start
```

This opens Expo DevTools. You can:
- Scan QR code with Expo Go app (limited features)
- Press `i` for iOS simulator
- Press `a` for Android emulator

## Testing on Physical Device

### Option A: Expo Go (Quick Testing)

1. Install **Expo Go** app from App Store/Play Store
2. Run `npx expo start` in the project folder
3. Scan the QR code with your phone camera (iOS) or Expo Go app (Android)

**Note**: Expo Go has limitations - some native features like background location may not work fully.

### Option B: Development Build (Recommended for Full Testing)

For testing background location, geofencing, and battery monitoring:

#### Android APK Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure the project (first time only)
eas build:configure

# Create development build
eas build --platform android --profile development

# Or create APK directly
eas build --platform android --profile preview
```

After build completes, download the APK and install on your Android device.

#### iOS Build

```bash
# For simulator
eas build --platform ios --profile development-simulator

# For physical device (requires Apple Developer account)
eas build --platform ios --profile development

# Or use Xcode directly
npx expo run:ios --device
```

### Option C: Local Build (Fastest)

#### Android

```bash
# Generate native Android project
npx expo prebuild --platform android

# Open in Android Studio
cd android && ./gradlew assembleDebug

# Or run directly
npx expo run:android
```

#### iOS

```bash
# Generate native iOS project  
npx expo prebuild --platform ios

# Install pods
cd ios && pod install && cd ..

# Run on device
npx expo run:ios --device
```

## Testing Features

### Location & Geofencing

1. Open the **Location** tab in the app
2. Enable **Background Tracking** (requires permission)
3. Create a **Safe Zone** at your current location
4. Walk outside the zone boundary
5. You should receive a push notification

### Battery Monitoring

1. Go to **Location** tab > **Tracking Settings**
2. Enable **Share Battery Level**
3. Your battery status will be visible to family members
4. Low battery alerts are sent when level drops below 20%

### Push Notifications

1. Grant notification permissions when prompted
2. Notifications are triggered by:
   - Geofence enter/exit events
   - New chat messages
   - Chore reminders
   - Event reminders

## Configuration

### Backend API

Edit `src/services/api.config.js` to point to your backend:

```javascript
const API_BASE_URL = 'https://your-backend-url.com/api';
```

### Expo Project ID

For push notifications, update the project ID in `src/services/push.service.js`:

```javascript
token = (await Notifications.getExpoPushTokenAsync({
  projectId: 'your-expo-project-id'
})).data;
```

## App Structure

```
FamFocusHub/
├── App.js                 # Entry point with service initialization
├── app.json               # Expo configuration
├── package.json           # Dependencies
└── src/
    ├── context/           # React contexts (Auth, etc.)
    ├── navigation/        # React Navigation setup
    ├── screens/           # All app screens
    │   ├── HomeScreen.js
    │   ├── LocationScreen.js
    │   ├── FamilyWallScreen.js
    │   ├── ShoppingListScreen.js
    │   ├── DinnerPlannerScreen.js
    │   ├── ChatScreen.js
    │   └── ...
    ├── services/          # Business logic services
    │   ├── api.service.js       # API calls with caching
    │   ├── api.config.js        # API endpoints
    │   ├── location.service.js  # GPS & geofencing
    │   ├── battery.service.js   # Battery monitoring
    │   ├── push.service.js      # Push notifications
    │   ├── offline.service.js   # Offline support
    │   └── websocket.service.js # Real-time chat
    ├── components/        # Reusable UI components
    └── utils/             # Helper functions
```

## Permissions Required

### Android (android/app/src/main/AndroidManifest.xml)
- `ACCESS_FINE_LOCATION` - GPS location
- `ACCESS_COARSE_LOCATION` - Approximate location
- `ACCESS_BACKGROUND_LOCATION` - Background tracking
- `FOREGROUND_SERVICE` - Background tasks
- `RECEIVE_BOOT_COMPLETED` - Restart services on boot

### iOS (ios/FamFocusHub/Info.plist)
- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`
- `UIBackgroundModes: location`

## Troubleshooting

### Location not updating in background
- Ensure background permission is granted (Settings > Apps > FamFocus > Permissions)
- On Android, disable battery optimization for the app
- Restart the app after granting permissions

### Push notifications not working
- Use a physical device (simulators don't receive push)
- Check notification permissions in device settings
- Ensure Expo push token is being generated

### API calls failing
- Check if backend URL is correct in `api.config.js`
- Ensure device is connected to internet
- Check backend server logs for errors

## Development Tips

1. **Hot Reload**: Changes to JS files auto-reload
2. **Shake Device**: Opens Expo dev menu
3. **Console Logs**: Use `npx expo start` terminal or React Native Debugger
4. **Network Debugging**: Enable "Debug Remote JS" from dev menu

## Support

For issues or questions about the mobile app, check:
- Backend API: `https://familyhub-68.preview.emergentagent.com/docs`
- Expo documentation: `https://docs.expo.dev`
