# Spotify Developer API Key Setup Guide

## How to Get Your Spotify Developer API Keys

### Step 1: Create Spotify Developer Account
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account (or create one if you don't have it)
3. Accept the Developer Terms of Service

### Step 2: Create an App
1. Click **"Create App"** button
2. Fill in the app details:
   - **App Name**: FamilyHub (or any name you prefer)
   - **App Description**: Family management app with music integration
   - **Redirect URIs**: Add these URLs:
     - For local dev: `http://localhost:3000/callback`
     - For production: `https://your-domain.com/callback`
   - **APIs Used**: Select "Web API"
3. Check the agreements checkbox
4. Click **"Save"**

### Step 3: Get Your Credentials
1. On your app's page, click **"Settings"**
2. You'll see:
   - **Client ID**: Copy this (public, safe to expose)
   - **Client Secret**: Click "View client secret" and copy (keep this private!)

### Step 4: Add to Your App
Once you have both keys, share them with me and I'll integrate them into the app:
- Client ID: `YOUR_CLIENT_ID_HERE`
- Client Secret: `YOUR_CLIENT_SECRET_HERE`

### What You'll Be Able to Do:
- Play, pause, skip tracks
- Control volume
- View currently playing track
- Search for songs
- Create and manage playlists

**Note**: The Spotify Web Playback SDK requires Spotify Premium for playback control. Viewing current playback and track info works with free accounts.

---

When you're ready, just share your Client ID and Client Secret with me!
