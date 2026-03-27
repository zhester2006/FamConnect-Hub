# FamFocus Hub - Product Requirements Document

## Original Problem Statement
A comprehensive, family-oriented app called "FamFocus Hub" with customizable profiles, shared calendar, AI-assisted features, live chat, family wall, shopping list, points & rewards, dinner planner, location tracking, and an AI assistant named Pixie.

## Core Features
- **Profiles**: Parent, Child, and HomeHub shared profiles
- **Calendar**: Drag-and-drop, event creation, shared view
- **Chores**: AI-assisted, approval workflows, points system
- **Live Chat**: Real-time family messaging with read receipts
- **Family Wall**: Social feed with posts, polls, photos
- **Shopping List**: Shared, approval flow for children
- **Points & Rewards**: Gamification for chores/tasks
- **Dinner Planner**: Recipe book, shopping list integration
- **Location & Safe Zones**: Family member tracking
- **Routines**: Daily routine management
- **Weekly Recap**: Family activity summaries
- **Pantry Manager**: AI-powered inventory with receipt scanning
- **Pixie AI Assistant**: Comprehensive smart AI (see below)

## Pixie AI Assistant (GPT-5.2 Powered)
- **Natural Language Commands**: Read/write to all app data
- **Voice Activated**: "Hey Pixie" wake word detection
- **Voice Activity Detection**: Auto-stops recording when user stops speaking
- **TTS Responses**: Woman's voice (OpenAI TTS, "nova" voice) for all voice interactions
- **Smart Actions**: Add to shopping list, calendar, wall, chat; mark/approve chores; send reminders
- **HomeHub Mode**: PIN verification for all actions, asks who is making request
- **Learning**: Stores conversation history, tracks interaction patterns, adapts suggestions per user
- **Preferences**: Always-listening toggle, voice responses toggle (auto-enabled on HomeHub)
- **Permissions**: Role-based (children can't approve, parents have full access)

## Tech Stack
- **Frontend**: React, TailwindCSS, Shadcn/UI, @dnd-kit
- **Backend**: FastAPI, MongoDB
- **AI**: GPT-5.2 (text), OpenAI Whisper (STT), OpenAI TTS (TTS) via Emergent LLM Key
- **Auth**: Session-based with dev-login, Google OAuth

## Architecture
```
/app/backend/routers/
  auth.py, family.py, users.py, chores.py, shopping.py,
  calendar_routes.py, messages.py, wall.py, pantry.py,
  pixie.py, ai.py, weather.py, notifications.py,
  hub_features.py, rewards.py, reading.py, food.py

/app/frontend/src/
  components/ (Sidebar, Avatar, PixieChat, pixie/*)
  pages/ (Dashboard, HomeHub, Calendar, LiveChat, FamilyWall, etc.)
```

## What's Implemented (as of March 27, 2026)
- Full family management (create, join, manage members)
- Complete HomeHub with PIN-verified proxy actions
- Drag-and-drop calendar
- AI chores, shopping list with approval flows
- Live chat with read receipts, parent delete
- Family wall with parent delete
- Dinner planner with recipe book
- Pantry with AI receipt scanner
- Routines and weekly recap
- Pixie AI: full read/write, voice commands, TTS, learning, wake word, VAD
- Elizabeth co-parent visibility fixed across all endpoints

## Upcoming Tasks
- (P1) Voice Commands for Pixie - speech-to-text ✅ DONE
- (P1) Mobile App: Native Google Sign-in
- (P2) Mobile App: Map screen fix
- (P2) Mobile App: Hardcoded URL fix
- (P2) App Store deployment guide
