# FamFocus Hub - Product Requirements Document

## Overview
FamFocus Hub is a comprehensive, family-oriented, mobile-friendly application designed to help families manage daily activities, chores, communication, and rewards in an engaging, gamified way.

**Tagline:** *"A place where keeping up with the day-to-day is no longer a chore within itself"*

## Core Features

### 1. Home Hub (Central Dashboard) - OPTIMIZED FOR SINGLE SCREEN
- **Top Bar Layout:**
  - Weather & Time (top-left): Real-time clock with animated weather icons (NOW FROM API)
  - Family Online Status (top-right): Avatar row showing who's online
- **Mini Calendar**: Compact calendar with event type color indicators
- **Today's Events**: Quick list of scheduled events
- **Today's Chores**: List with completion status and points
- **Shopping List**: Quick access with add button
- **Daily Inspiration**: AI-generated quotes (Emergent LLM Key)
- **Quick Add**: Modals for events and shopping items

### 2. Collapsible Sidebar
- Toggle button to collapse/expand
- Collapses to icons-only mode (w-16)
- Expands to full navigation (w-64)
- Shows on all screens
- Responsive mobile menu

### 3. Calendar & Events
- **Event Types**: Appointment, Event, Work Schedule, Task
- **Time Picker**: Add specific time to events
- **Work Schedules**: Parents/members add work hours (start/end times)
- **Color-Coded Legend**: Visual distinction by type
- **Filtering**: Sort/filter by event type
- **Creator Attribution**: Shows who added each event

### 4. Chore Management
- **AI-Powered Scheduling**: GPT-5.2 for fair distribution
- **Point System**: Parents set points per chore
- **Point Modification**: Parents can adjust points when approving
- **Penalty System**: Missed chores carry over + makeup tag
- **Bye Day System**: Bumped children get free day
- **Child Exclusions**: Toggle which children do which chores

### 5. Family Wall
- **Posts Feed**: Text, photos, updates
- **Sticky Input**: Always visible at bottom
- **Emoji Picker**: 20 family-friendly emojis
- **Polls (Parent)**: Create interactive polls
- **Voting**: Children vote with avatars displayed

### 6. Rewards Shop
- **Parent Management**: Add, edit, delete rewards
- **Point Customization**: Set/modify points required
- **Child View**: Browse and redeem rewards
- **Point Balance**: Track available points

### 7. Settings
- **15 Theme Options** (each with light/dark variants):
  - Cosmic Explorer, Ocean Breeze, Sunset Glow, Forest Night
  - Purple Dream, Candy Pop, Neon Nights, Autumn Harvest
  - Arctic Frost, Volcano Burst, Mint Fresh, Royal Gold
  - Deep Ocean, Cherry Blossom, Midnight Sky
- **Theme Mode**: Light / Dark / Auto
- **CSS Variables**: Dynamic color application
- **Persistence**: LocalStorage for theme settings
- **Parent Notifications**: 7 toggle categories
- **Browser Push Notifications**: Enable/disable with one click

### 8. GPS & Location (CheckIns)
- **Google Maps Integration**: Uses API key from env variable
- **Geofencing**: Set safe zones (Home, School, etc.)
- **50ft Radius Alerts**: Notify all parents when child leaves
- **GPS Status**: Active/Off indicator
- **Offline Support**: Auto-send last location when offline
- **Route to Last**: Open maps with directions to last known location
- **GPS Disabled Alerts**: Notify parents when child turns off GPS

### 9. AI Guide "Pixie"
- Friendly greeting on welcome page
- Random encouraging messages
- Role-based onboarding (future)

### 10. Reading Logs
- Children submit: Book title, pages read, summary
- Parent approval workflow
- History tracking per child

### 11. Weather Integration (NEW - v3)
- **OpenWeatherMap API**: Real-time weather data
- **Location-based**: Uses browser geolocation
- **Fallback**: Simulated weather if no API key
- **Display**: Temperature, condition, city name

### 12. Push Notifications (NEW - v3)
- **Browser Web Push API**: Works even when app is closed
- **Service Worker**: Background notification handling
- **VAPID Authentication**: Secure push subscriptions
- **Notification Types**: Chores, chat, location alerts, approvals

## Technical Stack
- **Frontend**: React with TailwindCSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI Integration**: Emergent LLM Key (GPT-5.2)
- **Authentication**: Emergent-managed Google OAuth
- **Weather**: OpenWeatherMap API
- **Maps**: Google Maps JavaScript API
- **Notifications**: Web Push API with Service Worker

## What's Been Implemented

### Session 1 - Core Infrastructure ✅
- Full-stack scaffolding
- Page components created
- Sidebar and bottom navigation
- Google OAuth authentication
- Role-based access (parent/child)
- Sample data script
- Light/dark mode

### Session 2 - Major Features ✅
- [x] Collapsible sidebar
- [x] Single-screen Home Hub layout
- [x] Weather animations
- [x] Mini calendar widget
- [x] Event time picker
- [x] Event type dropdown with 4 options
- [x] Work schedule feature
- [x] Calendar filtering by type
- [x] 15 themes with light/dark variants
- [x] Theme Mode toggle
- [x] CSS variable system
- [x] Pixie AI greeting
- [x] Updated tagline
- [x] Parent reward management (CRUD)
- [x] Point modification on chore approval
- [x] GPS status indicator
- [x] Geofence management
- [x] Safe zone creation (50ft radius)
- [x] Route to last location
- [x] GPS disabled notifications
- [x] Parent notification settings (7 categories)

### Session 3 - Weather, Maps & Push (Dec 2025) ✅
- [x] Weather API endpoint with OpenWeatherMap support
- [x] Weather fallback to simulated data when no API key
- [x] Google Maps API key from environment variable
- [x] Push notification subscription endpoints
- [x] VAPID key endpoint for secure push
- [x] Service worker for background notifications
- [x] Push notification utilities (subscribe/unsubscribe)
- [x] Browser notifications UI in Settings page

### Session 4 - Chat, Onboarding, Dinner & Profile (Dec 2025) ✅
- [x] WebSocket real-time chat with automatic reconnection
- [x] Typing indicators in live chat
- [x] Online status indicators for family members
- [x] Read receipts for messages
- [x] Pixie AI Onboarding Guide (7 role-specific steps)
- [x] Step-by-step interactive tutorial for parents and children
- [x] Skip/complete onboarding functionality
- [x] Enhanced AI Dinner Planner with weekly meal plans
- [x] Meal plan history with saved plans
- [x] Family size and budget options for meal planning
- [x] Quick meal ideas grid (8 options)
- [x] Profile picture upload (profile and background)
- [x] Image preview and hover upload UI

### Session 5 - Weather, GIFs, AI Scheduler (Dec 2025) ✅
- [x] OpenWeatherMap API key activated - REAL weather data
- [x] GIF search and trending using Tenor API (Google)
- [x] Family-friendly GIF content filter
- [x] GIF picker UI in Family Wall with search
- [x] AI Chore Scheduler with fair distribution algorithm
- [x] Schedule history with saved schedules
- [x] Duration options (3, 5, 7, 14 days)
- [x] Custom preferences for scheduling
- [x] Child nickname feature for parents

### Session 6 - Analytics, Export, Tutorial (Dec 2025) ✅
- [x] Analytics Dashboard with weekly/monthly stats
- [x] Daily activity chart (7-day bar graph)
- [x] Children performance section with progress bars
- [x] Weekly trends table with completion rates
- [x] Data export - Chores CSV
- [x] Data export - Events CSV
- [x] Data export - Full JSON (all family data)
- [x] Welcome Tutorial with role-specific slides (7 parent, 6 child)
- [x] Tutorial progress tracking and completion
- [x] Multiple Family Support foundation (GET/POST /api/families)
- [x] Nickname display in Leaderboard and Analytics
- [x] Analytics link in sidebar for parents

### Session 7 - Page Backgrounds & Visual Polish (Dec 2025) ✅
- [x] Unique animated gradient backgrounds for each page
- [x] Floating particle effects with page-specific colors
- [x] Home Hub screensaver with rotating nature/historic images
- [x] Ken Burns zoom effect on screensaver images
- [x] 15-second image transitions with fade
- [x] Dark overlay for content readability
- [x] Purple gradient for Parent Dashboard
- [x] Fuchsia gradient with sparkles for Child Space
- [x] Blue gradient for Calendar
- [x] Golden gradient with trophies for Leaderboard
- [x] Teal gradient for Analytics

### Session 8 - Battery Percentage Feature (Dec 2025) ✅
- [x] Battery update endpoint (POST /api/battery/update)
- [x] Family battery status endpoint (GET /api/battery/family)
- [x] Battery permission toggle (PUT /api/permissions/battery)
- [x] Permissions endpoint (GET /api/permissions)
- [x] Low battery notification (<=15%) sent to parents
- [x] Battery indicator on parent dashboard child cards
- [x] Color-coded battery levels (green/yellow/red)
- [x] Charging indicator icon
- [x] Privacy & Permissions section in child Settings
- [x] Browser Battery API integration for real-time updates
- [x] Auto-update battery when permission enabled

### Session 9 - Drag-and-Drop Chore Scheduler (Feb 2026) ✅
- [x] New ChoreScheduler page at /chore-scheduler
- [x] @dnd-kit/core library integration for drag-and-drop
- [x] Calendar View - drag chores onto specific days (7-day week)
- [x] Children View - drag chores onto specific children
- [x] Child selector in Calendar View
- [x] Draggable chore items with point display
- [x] Droppable day columns with visual feedback
- [x] Droppable child rows with visual feedback
- [x] Save Schedule button creates chores via API
- [x] Clear Schedule button removes assignments
- [x] Manual Scheduler button on Parent Dashboard
- [x] Chore Scheduler link in Sidebar for parents
- [x] Help text explaining drag-and-drop functionality

## API Endpoints

### Chat & Real-time (NEW - Session 4)
- `WS /ws/chat/{token}` - WebSocket for real-time chat
- `GET /api/messages` - Get chat messages
- `POST /api/messages` - Send message (REST fallback)
- `PUT /api/messages/{id}/read` - Mark message as read
- `GET /api/family/online` - Get online family members

### Onboarding (NEW - Session 4)
- `GET /api/onboarding/steps` - Get role-specific onboarding steps
- `POST /api/onboarding/complete` - Mark onboarding as done
- `POST /api/onboarding/reset` - Reset onboarding (testing)

### Dinner Planner (Enhanced - Session 4)
- `POST /api/dinner/suggest` - Get AI dinner suggestion
- `POST /api/dinner/weekly-plan` - Create AI weekly meal plan
- `GET /api/dinner/plans` - Get saved meal plans

### Profile (NEW - Session 4)
- `POST /api/users/{id}/upload-picture` - Upload profile/background picture

### Analytics (NEW - Session 6)
- `GET /api/analytics/overview` - Weekly/monthly stats, children performance, daily activity
- `GET /api/analytics/trends?days=X` - Weekly trends over specified days

### Data Export (NEW - Session 6)
- `GET /api/export/chores` - Export chores as CSV
- `GET /api/export/events` - Export events as CSV
- `GET /api/export/full` - Export all family data as JSON

### Tutorial (NEW - Session 6)
- `GET /api/tutorial/content` - Get role-specific tutorial slides
- `POST /api/tutorial/complete` - Mark tutorial as completed
- `POST /api/tutorial/reset` - Reset tutorial for testing

### Multiple Family Support (NEW - Session 6)
- `GET /api/families` - Get user's families
- `POST /api/families` - Create new family
- `POST /api/families/{id}/invite` - Invite user to family
- `POST /api/families/switch/{id}` - Switch active family

### AI Features (NEW - Session 5)
- `POST /api/chores/ai-schedule` - AI-powered fair chore scheduling
- `GET /api/chores/schedules` - Get saved chore schedules

### GIF Features (NEW - Session 5)
- `GET /api/gifs/search?q=X&limit=Y` - Search GIFs via Tenor API
- `GET /api/gifs/trending?limit=Y` - Get trending GIFs

### Child Nicknames (NEW - Session 5)
- `PUT /api/users/{id}/nickname` - Set/update child nickname

### Weather (NOW REAL)
- `GET /api/weather?lat=X&lon=Y` - Get current weather

### Push Notifications (NEW)
- `GET /api/push/vapid-key` - Get VAPID public key
- `POST /api/push/subscribe` - Subscribe to push (auth required)
- `DELETE /api/push/unsubscribe` - Unsubscribe (auth required)

### Events (Updated)
- `GET /api/events?event_type={type}` - Filter by type
- `POST /api/events` - With event_time and event_type
- `POST /api/events/work-schedule` - Add work hours

### Geofencing
- `GET /api/geofences` - List safe zones
- `POST /api/geofences` - Create with radius_feet
- `DELETE /api/geofences/{id}` - Remove zone

### Location
- `POST /api/checkins` - Send location update
- `GET /api/checkins/{user_id}` - Get history
- `GET /api/checkins/{user_id}/last` - Last known
- `POST /api/location/gps-disabled` - Report GPS off

### Notifications
- `GET /api/notifications` - List alerts

### Rewards
- `PUT /api/rewards/{id}` - Update points
- `DELETE /api/rewards/{id}` - Remove

### Chores
- `PUT /api/chores/{id}/approve` - With optional points override
- `PUT /api/chores/{id}/points` - Modify points

## Database Collections
- `users`, `user_sessions`, `chores`, `chore_types`
- `bye_days`, `shopping_items`, `family_wall`
- `daily_quotes`, `messages`, `events`
- `reading_logs`, `rewards`, `checkins`
- `geofences`, `notifications`
- `push_subscriptions` (NEW), `push_queue` (NEW)

## Environment Variables

### Backend (.env)
- `MONGO_URL` - MongoDB connection
- `DB_NAME` - Database name
- `CORS_ORIGINS` - CORS configuration
- `EMERGENT_LLM_KEY` - For AI features
- `OPENWEATHER_API_KEY` - For real weather data (optional)

### Frontend (.env)
- `REACT_APP_BACKEND_URL` - Backend URL
- `REACT_APP_GOOGLE_MAPS_API_KEY` - For Google Maps (optional)

## Backlog / Future Tasks

### P1 - Medium Priority
- [ ] AI Daily Quote enhancement (currently static quote)
- [ ] Live Chat read receipts & online status indicators
- [ ] Family switching UI (use existing endpoints)
- [ ] Family invite system completion

### P2 - Low Priority
- [ ] Advanced analytics with charts library
- [ ] Mobile app (React Native)
- [ ] PDF export option
- [ ] Notification preferences granularity
- [ ] Profile background customization

## Notes
- **Weather**: Uses OpenWeatherMap API (fallback to simulated if no key)
- **GPS**: Uses browser geolocation API
- **OAuth**: Emergent-managed Google Auth
- **AI**: Emergent LLM Key (GPT-5.2)
- **Push**: Browser Web Push API with VAPID
- **Maps**: Google Maps (needs API key for production)
- **Sample Data**: `/app/scripts/populate_sample_data.py`

## Test Reports
- `/app/test_reports/iteration_1.json` - Initial features (100% pass)
- `/app/test_reports/iteration_2.json` - v2 features (100% pass)
- `/app/test_reports/iteration_3.json` - v3 features (100% pass)
- `/app/test_reports/iteration_4.json` - v4 features (100% pass)
- `/app/test_reports/iteration_5.json` - v5 features (100% pass)
- `/app/test_reports/iteration_6.json` - v6 features (100% pass)
- Session 7 - Visual polish (page backgrounds) - No API changes, frontend only
- `/app/test_reports/iteration_7.json` - Battery feature (100% pass - 19/19 tests)
- `/app/test_reports/iteration_8.json` - Drag-and-Drop Chore Scheduler (100% pass - 11/11 tests)
