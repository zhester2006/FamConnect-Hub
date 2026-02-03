# 🎵 Spotify Integration Setup Guide

## Step 1: Get Spotify Developer Credentials

### Create Spotify Developer Account
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account (Premium required for playback)
3. Click **"Create App"**

### Fill in App Details
```
App Name: FamFocus Hub
App Description: Family management app with music integration
Redirect URIs: 
  - http://localhost:3000/callback
  - https://homebridge-5.preview.emergentagent.com/callback
  - [Add your production domain]/callback
```

### Select APIs
- ✅ Web API
- ✅ Web Playback SDK

### Get Your Credentials
1. Click **"Settings"** on your app
2. Copy your **Client ID** (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
3. Click **"View client secret"** and copy it (keep this private!)

---

## Step 2: Add Credentials to FamFocus Hub

### Option A: Via Settings Page (Coming Soon)
1. Log into FamFocus Hub as a Parent
2. Go to Settings → Integrations
3. Click "Connect Spotify"
4. Paste your Client ID and Client Secret
5. Click "Save & Connect"

### Option B: Via Backend Environment (Current Method)

Add these to `/app/backend/.env`:
```bash
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=https://homebridge-5.preview.emergentagent.com/callback
```

---

## Step 3: How It Works

### Authentication Flow
1. User clicks "Connect Spotify" in Home Hub
2. Redirects to Spotify login
3. User authorizes FamFocus Hub
4. Spotify redirects back with access token
5. App stores token and starts playback

### Features Available
- ✅ Search your Spotify library
- ✅ Play/Pause current track
- ✅ Skip forward/backward
- ✅ Volume control
- ✅ Queue management
- ✅ Display album art
- ✅ Show currently playing track

### Requirements
- **Spotify Premium** account (required for Web Playback SDK)
- Modern browser with Web Audio API support
- Active internet connection

---

## Step 4: Using Spotify in FamFocus Hub

### For Parents:
1. Navigate to **Home Hub**
2. See Spotify widget in sidebar
3. Click **"Connect Spotify"** (first time only)
4. Authorize the app
5. Start playing music!

### Playback Controls:
- **Play/Pause**: Click the center play button
- **Skip**: Use forward/back arrows
- **Volume**: Drag the slider
- **Search**: Type in search box (coming soon)

### Controlling from Other Devices:
- Music plays through browser
- Can be controlled from Spotify mobile app
- Syncs with your Spotify account

---

## Troubleshooting

### "Player not ready" error
- Ensure you have Spotify Premium
- Check that you're logged in to Spotify
- Try refreshing the page

### Playback not starting
- Verify Redirect URI matches exactly
- Check browser console for errors
- Ensure credentials are correct

### No audio
- Check browser permissions (allow audio)
- Verify volume isn't muted
- Try playing from Spotify app first

---

## Security Notes

⚠️ **Important:**
- Never share your Client Secret publicly
- Store credentials in environment variables
- Don't commit `.env` file to git
- Rotate secrets if compromised

✅ **Safe to share:**
- Client ID (public identifier)
- Redirect URI (public configuration)

---

## Need Help?

- [Spotify Web API Docs](https://developer.spotify.com/documentation/web-api)
- [Web Playback SDK Guide](https://developer.spotify.com/documentation/web-playback-sdk)
- FamFocus Hub Settings → Help & Support

**Ready to jam? Let's get your family grooving! 🎶**
