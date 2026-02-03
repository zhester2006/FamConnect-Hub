# FamFocus Hub - Product Requirements Document

## Overview
FamFocus Hub is a comprehensive, family-oriented, mobile-friendly application designed to help families manage daily activities, chores, communication, and rewards in an engaging, gamified way.

## Core Features

### 1. Home Hub (Central Dashboard)
- **Date/Time Display**: Real-time clock with date
- **Weather Widget**: Animated weather icons (sunny, cloudy, rainy, windy, snowy, stormy) with temperature display
- **Family Online Status**: Shows which family members are currently active
- **Mini Calendar**: Compact calendar widget with event indicators
- **Today's Chores**: Quick view of daily chores and their status
- **Shopping List**: Quick access to family shopping list
- **Daily Inspiration**: AI-generated motivational quotes (using Emergent LLM Key)
- **Quick Add**: Add events and shopping items directly from hub

### 2. Family Wall
- **Posts Feed**: Family members can share text, photos, and updates
- **Sticky Input Bar**: Always-visible input at bottom for quick posting
- **Emoji Picker**: 20 family-friendly emojis for posts
- **Polls (Parent Only)**: Parents can create interactive polls for dinner ideas, events, etc.
- **Voting System**: Children can vote on polls with their icon displayed

### 3. Chore Management
- **Automated AI Scheduling**: Uses GPT-5.2 for fair chore distribution
- **Penalty System**: Missed chores carry over to next day with "Makeup" tag
- **Bye Day System**: Children bumped from their turn get a free day
- **Parent Controls**: 
  - Add/remove chore types
  - Toggle which children are eligible for each chore
  - Approve/deny completed chores
- **Point System**: Earn points for completing chores

### 4. Child Space
- **Personal Dashboard**: View points, rank, and badges
- **Today's Missions**: List of assigned chores with completion status
- **Reading Log**: Submit book title, pages read, and summary for parent approval
- **Leaderboard**: Compare points with siblings

### 5. Parent Dashboard
- **Stats Overview**: Pending approvals, completed chores, events, progress
- **Children Cards**: Quick view of each child with points and online status
- **Pending Approvals**: Approve/deny chores, shopping requests, reading logs
- **Child Details Modal**: 
  - View child's chore history
  - View reading logs
  - Configure chore exclusions

### 6. Live Chat
- **Messenger-Style Layout**: Sent messages on right, received on left
- **User Avatars**: Display profile initial
- **Read Receipts**: Single check for sent, double check for read
- **Timestamps**: Show time for each message

### 7. Settings
- **15 Theme Options**: Color schemes for personalization
- **Dark/Light Mode**: Toggle between themes
- **Notification Preferences (Parent Only)**:
  - Chore updates
  - New events
  - Chat messages
  - Wall posts
  - Approval requests
  - Reading logs

### 8. Additional Features
- **Calendar**: Full calendar with day/week/month views
- **Shopping List**: Request items (requires parent approval for children)
- **Rewards Shop**: Redeem points for rewards set by parents
- **Dinner Planner**: AI-powered meal suggestions
- **Check-ins**: Location check-in system (GPS)
- **Leaderboard**: Points ranking among children

## Technical Stack
- **Frontend**: React with TailwindCSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI Integration**: Emergent LLM Key (GPT-5.2)
- **Authentication**: Emergent-managed Google OAuth

## What's Been Implemented (December 2025)

### Phase 1 - Core Infrastructure ✅
- [x] Full-stack application scaffolding
- [x] React frontend with routing
- [x] FastAPI backend with MongoDB
- [x] Sidebar and bottom navigation
- [x] Google OAuth authentication
- [x] Role-based access (parent/child)
- [x] Sample data population script

### Phase 2 - Home Hub & Dashboard ✅
- [x] Home Hub with compact tabs
- [x] Date/time display with weather animations
- [x] Family online status
- [x] Mini calendar widget
- [x] Daily AI-generated quotes
- [x] Today's chores and shopping list widgets
- [x] Add event and shopping item modals

### Phase 3 - Family Wall ✅
- [x] Sticky input bar at bottom
- [x] Emoji picker
- [x] Parent poll creation
- [x] Interactive poll voting with user icons
- [x] Daily inspiration display

### Phase 4 - Chore System ✅
- [x] AI-powered chore scheduling endpoint
- [x] Penalty system for missed chores
- [x] Bye day tracking
- [x] Chore type management
- [x] Child exclusion toggles
- [x] Point system

### Phase 5 - Child & Parent Views ✅
- [x] Child Space with daily missions
- [x] Reading log submission
- [x] Parent dashboard with stats
- [x] Child details modal
- [x] Chore settings per child
- [x] Leaderboard

### Phase 6 - Settings ✅
- [x] 15 theme options
- [x] Dark/light mode toggle
- [x] Notification preferences for parents

## Backlog / Future Tasks

### P1 - High Priority
- [ ] Profile picture uploads
- [ ] Check-in request with push notifications
- [ ] Real-time chat updates (WebSocket)
- [ ] GIF and media attachments in Family Wall
- [ ] Push notification integration

### P2 - Medium Priority
- [ ] Dinner planner AI integration
- [ ] Connect meal ingredients to shopping list
- [ ] Child nickname customization
- [ ] Welcome tutorial for new users
- [ ] Real weather API integration

### P3 - Low Priority
- [ ] Advanced reporting/analytics
- [ ] Multiple family support
- [ ] Export data feature
- [ ] Mobile app (React Native)

## API Endpoints

### Authentication
- `POST /api/auth/session` - Create session from Google OAuth
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Family
- `GET /api/family/members` - Get family members
- `POST /api/users/child` - Create child profile
- `PUT /api/users/{id}` - Update user
- `PUT /api/users/{id}/role` - Change user role

### Chores
- `GET /api/chores` - Get chores
- `POST /api/chores` - Create chore
- `PUT /api/chores/{id}/complete` - Mark complete
- `PUT /api/chores/{id}/approve` - Approve chore
- `POST /api/chores/ai-schedule` - AI scheduling
- `GET /api/chores/types` - Get chore types
- `POST /api/chores/types` - Add chore type
- `PUT /api/chores/exclude-child` - Toggle exclusion
- `POST /api/chores/process-missed` - Process penalties
- `GET /api/chores/bye-days` - Get bye days
- `GET /api/chores/child-settings/{id}` - Get child settings

### Shopping
- `GET /api/shopping` - Get items
- `POST /api/shopping` - Add item
- `PUT /api/shopping/{id}` - Update item

### Family Wall
- `GET /api/family-wall` - Get posts
- `POST /api/family-wall` - Create post/poll
- `POST /api/family-wall/{id}/vote` - Vote on poll
- `GET /api/family-wall/daily-quote` - Get AI quote

### Reading Logs
- `GET /api/reading-logs` - Get logs
- `POST /api/reading-logs` - Submit log
- `PUT /api/reading-logs/{id}/approve` - Approve log

### Events
- `GET /api/events` - Get events
- `POST /api/events` - Create event

### Other
- `GET /api/messages` - Get chat messages
- `POST /api/messages` - Send message
- `GET /api/rewards` - Get rewards
- `POST /api/rewards` - Create reward
- `POST /api/rewards/{id}/redeem` - Redeem reward
- `GET /api/leaderboard` - Get leaderboard
- `POST /api/checkins` - Create check-in
- `GET /api/checkins/{user_id}` - Get check-ins

## Database Schema

### Collections
- `users` - User profiles (parents, children, members)
- `user_sessions` - Authentication sessions
- `chores` - Chore assignments
- `chore_types` - Available chore types
- `bye_days` - Bye day records
- `shopping_items` - Shopping list
- `family_wall` - Wall posts and polls
- `daily_quotes` - Cached daily quotes
- `messages` - Chat messages
- `events` - Calendar events
- `reading_logs` - Reading submissions
- `rewards` - Reward items
- `checkins` - Location check-ins

## Notes
- Weather data is currently MOCKED (simulated randomly)
- Google OAuth is Emergent-managed
- AI features use Emergent LLM Key (GPT-5.2)
- Sample data can be populated via `/app/scripts/populate_sample_data.py`
