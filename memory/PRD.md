# FamFocus Hub - Product Requirements Document

## Overview
FamFocus Hub is a comprehensive, family-oriented, mobile-friendly application designed to help families manage daily activities, chores, communication, and rewards in an engaging, gamified way.

**Tagline:** *"A place where keeping up with the day-to-day is no longer a chore within itself"*

## Core Features

### 1. Home Hub (Central Dashboard) - OPTIMIZED FOR SINGLE SCREEN
- **Top Bar Layout:**
  - Weather & Time (top-left): Real-time clock with animated weather icons
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

### 8. GPS & Location (CheckIns)
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

## Technical Stack
- **Frontend**: React with TailwindCSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI Integration**: Emergent LLM Key (GPT-5.2)
- **Authentication**: Emergent-managed Google OAuth

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

## API Endpoints

### Events (New/Updated)
- `GET /api/events?event_type={type}` - Filter by type
- `POST /api/events` - With event_time and event_type
- `POST /api/events/work-schedule` - Add work hours

### Geofencing (New)
- `GET /api/geofences` - List safe zones
- `POST /api/geofences` - Create with radius_feet
- `DELETE /api/geofences/{id}` - Remove zone

### Location (New)
- `POST /api/checkins` - Send location update
- `GET /api/checkins/{user_id}` - Get history
- `GET /api/checkins/{user_id}/last` - Last known
- `POST /api/location/gps-disabled` - Report GPS off

### Notifications (New)
- `GET /api/notifications` - List alerts

### Rewards (Updated)
- `PUT /api/rewards/{id}` - Update points
- `DELETE /api/rewards/{id}` - Remove

### Chores (Updated)
- `PUT /api/chores/{id}/approve` - With optional points override
- `PUT /api/chores/{id}/points` - Modify points

## Database Collections
- `users`, `user_sessions`, `chores`, `chore_types`
- `bye_days`, `shopping_items`, `family_wall`
- `daily_quotes`, `messages`, `events`
- `reading_logs`, `rewards`, `checkins`
- `geofences` (NEW), `notifications` (NEW)

## Backlog / Future Tasks

### P0 - High Priority
- [ ] Real weather API integration
- [ ] Push notifications (service worker)
- [ ] Real-time chat (WebSocket)

### P1 - Medium Priority
- [ ] Profile picture uploads
- [ ] GIF attachments in Family Wall
- [ ] Dinner planner AI
- [ ] Welcome tutorial for new users
- [ ] Child nickname customization

### P2 - Low Priority
- [ ] Advanced analytics/reporting
- [ ] Multiple family support
- [ ] Export data feature
- [ ] Mobile app (React Native)

## Notes
- **Weather**: MOCKED (simulated randomly)
- **GPS**: Uses browser geolocation API
- **OAuth**: Emergent-managed Google Auth
- **AI**: Emergent LLM Key (GPT-5.2)
- **Sample Data**: `/app/scripts/populate_sample_data.py`

## Test Reports
- `/app/test_reports/iteration_1.json` - Initial features (100% pass)
- `/app/test_reports/iteration_2.json` - v2 features (100% pass)
