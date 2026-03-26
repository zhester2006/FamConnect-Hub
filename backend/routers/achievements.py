from fastapi import APIRouter, HTTPException, Request, Response
from emergentintegrations.llm.chat import LlmChat, UserMessage
from deps import db, get_current_user, get_session_token, sanitize_picture, generate_family_code, send_email_async, send_push_notification, check_geofences, ADMIN_EMAIL
from deps import User, Family, Chore, ShoppingItem, FamilyWallPost, Message, Event, ReadingLog, Reward, CheckIn, FirebaseAuthRequest
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
import uuid
import json
import logging
import httpx
import re
import os
import base64
import hashlib

router = APIRouter()

# ============================================
# ACHIEVEMENT SYSTEM
# ============================================

# Achievement definitions
ACHIEVEMENT_DEFINITIONS = {
    # Streak Badges
    "streak_7_chores": {"name": "Week Warrior", "description": "Complete chores 7 days in a row", "icon": "🔥", "category": "streak", "requirement": 7, "type": "chore_streak"},
    "streak_14_chores": {"name": "Fortnight Fighter", "description": "Complete chores 14 days in a row", "icon": "⚡", "category": "streak", "requirement": 14, "type": "chore_streak"},
    "streak_30_chores": {"name": "Monthly Master", "description": "Complete chores 30 days in a row", "icon": "👑", "category": "streak", "requirement": 30, "type": "chore_streak"},
    "streak_7_reading": {"name": "Bookworm", "description": "Read 7 days in a row", "icon": "📚", "category": "streak", "requirement": 7, "type": "reading_streak"},
    "streak_14_reading": {"name": "Page Turner", "description": "Read 14 days in a row", "icon": "📖", "category": "streak", "requirement": 14, "type": "reading_streak"},
    "streak_30_reading": {"name": "Literary Legend", "description": "Read 30 days in a row", "icon": "🏆", "category": "streak", "requirement": 30, "type": "reading_streak"},
    
    # Milestone Badges
    "first_chore": {"name": "First Steps", "description": "Complete your first chore", "icon": "⭐", "category": "milestone", "requirement": 1, "type": "chore_count"},
    "chores_10": {"name": "Getting Started", "description": "Complete 10 chores", "icon": "🌟", "category": "milestone", "requirement": 10, "type": "chore_count"},
    "chores_50": {"name": "Chore Champion", "description": "Complete 50 chores", "icon": "💪", "category": "milestone", "requirement": 50, "type": "chore_count"},
    "chores_100": {"name": "Chore Master", "description": "Complete 100 chores", "icon": "🎖️", "category": "milestone", "requirement": 100, "type": "chore_count"},
    "chores_500": {"name": "Legendary Helper", "description": "Complete 500 chores", "icon": "🏅", "category": "milestone", "requirement": 500, "type": "chore_count"},
    "points_100": {"name": "Point Collector", "description": "Earn 100 points", "icon": "💰", "category": "milestone", "requirement": 100, "type": "points"},
    "points_500": {"name": "Point Hoarder", "description": "Earn 500 points", "icon": "💎", "category": "milestone", "requirement": 500, "type": "points"},
    "points_1000": {"name": "Point Master", "description": "Earn 1000 points", "icon": "👸", "category": "milestone", "requirement": 1000, "type": "points"},
    "books_5": {"name": "Book Lover", "description": "Log 5 books", "icon": "📕", "category": "milestone", "requirement": 5, "type": "book_count"},
    "books_20": {"name": "Avid Reader", "description": "Log 20 books", "icon": "📗", "category": "milestone", "requirement": 20, "type": "book_count"},
    "books_50": {"name": "Book Expert", "description": "Log 50 books", "icon": "📘", "category": "milestone", "requirement": 50, "type": "book_count"},
    
    # Family Achievements
    "family_chores_100": {"name": "Team Effort", "description": "Family completed 100 chores together", "icon": "👨‍👩‍👧‍👦", "category": "family", "requirement": 100, "type": "family_chores"},
    "family_chores_500": {"name": "Family Force", "description": "Family completed 500 chores together", "icon": "🏠", "category": "family", "requirement": 500, "type": "family_chores"},
    "family_chores_1000": {"name": "Super Family", "description": "Family completed 1000 chores together", "icon": "🦸", "category": "family", "requirement": 1000, "type": "family_chores"},
    
    # Seasonal Challenges
    "summer_reading": {"name": "Summer Reader", "description": "Complete the Summer Reading Challenge", "icon": "☀️", "category": "seasonal", "requirement": 10, "type": "seasonal_reading"},
    "holiday_helper": {"name": "Holiday Helper", "description": "Complete 20 chores during the holidays", "icon": "🎄", "category": "seasonal", "requirement": 20, "type": "seasonal_chores"},
    "spring_cleaning": {"name": "Spring Cleaner", "description": "Complete the Spring Cleaning Challenge", "icon": "🌸", "category": "seasonal", "requirement": 15, "type": "seasonal_cleaning"},
}

@router.get("/achievements")
async def get_all_achievements(request: Request):
    """Get all available achievements"""
    await get_current_user(request)
    
    achievements = []
    for achievement_id, data in ACHIEVEMENT_DEFINITIONS.items():
        achievements.append({
            "achievement_id": achievement_id,
            **data
        })
    
    return {"achievements": achievements}

@router.get("/achievements/user/{user_id}")
async def get_user_achievements(user_id: str, request: Request):
    """Get achievements earned by a specific user"""
    current_user = await get_current_user(request)
    
    # Get user's earned achievements
    earned = await db.user_achievements.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    earned_ids = [a['achievement_id'] for a in earned]
    
    # Get user stats for progress tracking
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate current stats
    completed_chores = await db.chores.count_documents({"assigned_to": user_id, "status": "completed"})
    total_points = user.get('points', 0)
    books_read = await db.reading_logs.count_documents({"user_id": user_id, "status": "approved"})
    
    # Get streak info
    streak_data = await db.user_streaks.find_one({"user_id": user_id}, {"_id": 0})
    chore_streak = streak_data.get('chore_streak', 0) if streak_data else 0
    reading_streak = streak_data.get('reading_streak', 0) if streak_data else 0
    
    # Build achievement list with progress
    achievements = []
    for achievement_id, data in ACHIEVEMENT_DEFINITIONS.items():
        progress = 0
        requirement = data['requirement']
        
        if data['type'] == 'chore_count':
            progress = min(completed_chores, requirement)
        elif data['type'] == 'points':
            progress = min(total_points, requirement)
        elif data['type'] == 'book_count':
            progress = min(books_read, requirement)
        elif data['type'] == 'chore_streak':
            progress = min(chore_streak, requirement)
        elif data['type'] == 'reading_streak':
            progress = min(reading_streak, requirement)
        
        achievements.append({
            "achievement_id": achievement_id,
            **data,
            "earned": achievement_id in earned_ids,
            "earned_at": next((a['earned_at'] for a in earned if a['achievement_id'] == achievement_id), None),
            "progress": progress,
            "progress_percent": min(100, int((progress / requirement) * 100))
        })
    
    return {
        "achievements": achievements,
        "stats": {
            "total_earned": len(earned_ids),
            "chore_streak": chore_streak,
            "reading_streak": reading_streak,
            "total_chores": completed_chores,
            "total_points": total_points,
            "books_read": books_read
        }
    }

@router.get("/achievements/family")
async def get_family_achievements(request: Request):
    """Get family-wide achievements"""
    current_user = await get_current_user(request)
    parent_id = current_user['user_id'] if current_user['role'] == 'parent' else current_user.get('parent_id')
    
    # Get family members
    family_members = await db.users.find(
        {"$or": [{"user_id": parent_id}, {"parent_id": parent_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1}
    ).to_list(20)
    
    member_ids = [m['user_id'] for m in family_members]
    
    # Calculate family stats
    family_chores = await db.chores.count_documents({"assigned_to": {"$in": member_ids}, "status": "completed"})
    
    # Get family achievements
    earned = await db.family_achievements.find({"family_id": parent_id}, {"_id": 0}).to_list(20)
    earned_ids = [a['achievement_id'] for a in earned]
    
    # Filter to family achievements only
    family_achievements = []
    for achievement_id, data in ACHIEVEMENT_DEFINITIONS.items():
        if data['category'] == 'family':
            progress = 0
            if data['type'] == 'family_chores':
                progress = min(family_chores, data['requirement'])
            
            family_achievements.append({
                "achievement_id": achievement_id,
                **data,
                "earned": achievement_id in earned_ids,
                "earned_at": next((a['earned_at'] for a in earned if a['achievement_id'] == achievement_id), None),
                "progress": progress,
                "progress_percent": min(100, int((progress / data['requirement']) * 100))
            })
    
    return {
        "achievements": family_achievements,
        "family_stats": {
            "total_chores": family_chores,
            "member_count": len(family_members)
        }
    }

# ==================== ACHIEVEMENT/BADGE/GOAL MANAGEMENT (Parents) ====================

@router.post("/achievements/custom")
async def create_custom_achievement(request: Request, data: dict):
    """Create a custom achievement/badge (parent only) with AI icon suggestion"""
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can create custom achievements")
    
    family_id = current_user['user_id']
    name = data.get('name', '').strip()
    description = data.get('description', '')
    
    if not name:
        raise HTTPException(status_code=400, detail="Achievement name is required")
    
    # Generate icon using AI if not provided
    icon = data.get('icon')
    if not icon:
        try:
            chat = LlmChat(
                api_key=os.environ['EMERGENT_LLM_KEY'],
                session_id=f"badge_icon_{uuid.uuid4().hex[:8]}",
                system_message="You are a helpful assistant that suggests emojis for achievements and badges. Reply with only a single emoji, nothing else."
            ).with_model("openai", "gpt-5.2")
            
            icon_response = await chat.send_message(UserMessage(text=f"What single emoji best represents this achievement: {name}. Description: {description}"))
            icon = str(icon_response).strip()[:4]
            if len(icon) > 4 or icon.isalpha():
                icon = "🏆"
        except:
            icon = "🏆"
    
    achievement_id = f"custom_{uuid.uuid4().hex[:12]}"
    
    achievement_doc = {
        "achievement_id": achievement_id,
        "family_id": family_id,
        "name": name,
        "description": description,
        "icon": icon,
        "category": data.get('category', 'custom'),
        "type": data.get('type', 'manual'),  # manual, chores, points, reading
        "requirement": data.get('requirement', 1),
        "points_reward": data.get('points_reward', 0),
        "active": True,
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.custom_achievements.insert_one(achievement_doc)
    return await db.custom_achievements.find_one({"achievement_id": achievement_id}, {"_id": 0})

@router.get("/achievements/custom")
async def get_custom_achievements(request: Request):
    """Get all custom achievements for the family"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    achievements = await db.custom_achievements.find(
        {"family_id": family_id, "active": True},
        {"_id": 0}
    ).to_list(100)
    
    return {"achievements": achievements}

@router.put("/achievements/custom/{achievement_id}")
async def update_custom_achievement(achievement_id: str, request: Request, data: dict):
    """Update a custom achievement (parent only)"""
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can update achievements")
    
    update_data = {}
    for field in ['name', 'description', 'icon', 'requirement', 'points_reward', 'active']:
        if field in data:
            update_data[field] = data[field]
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.custom_achievements.update_one({"achievement_id": achievement_id}, {"$set": update_data})
    return await db.custom_achievements.find_one({"achievement_id": achievement_id}, {"_id": 0})

@router.delete("/achievements/custom/{achievement_id}")
async def delete_custom_achievement(achievement_id: str, request: Request):
    """Delete a custom achievement (parent only)"""
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can delete achievements")
    
    await db.custom_achievements.delete_one({"achievement_id": achievement_id, "family_id": current_user['user_id']})
    return {"success": True}

@router.post("/achievements/custom/{achievement_id}/award")
async def award_custom_achievement(achievement_id: str, request: Request, data: dict):
    """Award a custom achievement to a child (parent only)"""
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can award achievements")
    
    child_id = data.get('child_id')
    if not child_id:
        raise HTTPException(status_code=400, detail="child_id is required")
    
    # Get the achievement
    achievement = await db.custom_achievements.find_one({"achievement_id": achievement_id}, {"_id": 0})
    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement not found")
    
    # Check if already awarded
    existing = await db.user_achievements.find_one({
        "achievement_id": achievement_id,
        "user_id": child_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Achievement already awarded to this child")
    
    # Award the achievement
    award_doc = {
        "achievement_id": achievement_id,
        "user_id": child_id,
        "awarded_by": current_user['user_id'],
        "earned_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_achievements.insert_one(award_doc)
    
    # Award points if configured
    if achievement.get('points_reward', 0) > 0:
        await db.users.update_one(
            {"user_id": child_id},
            {"$inc": {"points": achievement['points_reward']}}
        )
    
    return {"success": True, "message": f"Achievement '{achievement['name']}' awarded!"}

@router.post("/achievements/ai-suggestions")
async def get_ai_achievement_suggestions(request: Request, data: dict):
    """Get AI suggestions for new achievements based on family activity"""
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can get suggestions")
    
    family_id = current_user['user_id']
    context = data.get('context', '')  # Optional context like "summer activities" or "reading"
    
    # Get family stats for context
    children = await db.users.find({"parent_id": family_id}, {"_id": 0, "name": 1, "nickname": 1}).to_list(10)
    child_names = [c.get('nickname') or c.get('name', 'Child') for c in children]
    
    existing_achievements = await db.custom_achievements.find(
        {"family_id": family_id},
        {"_id": 0, "name": 1}
    ).to_list(20)
    existing_names = [a['name'] for a in existing_achievements]
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"achievement_suggest_{uuid.uuid4().hex[:8]}",
        system_message="You are a helpful family achievement system assistant. Suggest fun, motivating achievements for children."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Suggest 5 creative achievement badges for a family app.
Children in family: {', '.join(child_names) if child_names else 'Multiple children'}
Context/Theme: {context if context else 'General family achievements'}
Existing achievements to avoid duplicating: {', '.join(existing_names[:10]) if existing_names else 'None yet'}

For each suggestion provide:
1. Name (short, catchy)
2. Description (1 sentence)
3. Emoji icon
4. Requirement (what to do to earn it)
5. Suggested points reward

Format as JSON array: [{{"name": "...", "description": "...", "icon": "...", "requirement": "...", "points": 10}}, ...]"""
    
    try:
        response = await chat.send_message(UserMessage(text=prompt))
        response_text = str(response).strip()
        
        # Extract JSON
        json_match = re.search(r'\[[\s\S]*\]', response_text)
        if json_match:
            suggestions = json.loads(json_match.group())
            return {"suggestions": suggestions}
        else:
            return {"suggestions": [], "error": "Could not parse suggestions"}
    except Exception as e:
        logger.error(f"AI achievement suggestion error: {e}")
        return {"suggestions": [], "error": str(e)}

@router.post("/achievements/check")
async def check_achievements(request: Request):
    """Check and award any new achievements for the current user"""
    current_user = await get_current_user(request)
    user_id = current_user['user_id']
    parent_id = current_user['user_id'] if current_user['role'] == 'parent' else current_user.get('parent_id')
    
    newly_earned = []
    
    # Get current earned achievements
    existing = await db.user_achievements.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    existing_ids = [a['achievement_id'] for a in existing]
    
    # Calculate stats
    completed_chores = await db.chores.count_documents({"assigned_to": user_id, "status": "completed"})
    total_points = current_user.get('points', 0)
    books_read = await db.reading_logs.count_documents({"user_id": user_id, "status": "approved"})
    
    # Get streak info
    streak_data = await db.user_streaks.find_one({"user_id": user_id}, {"_id": 0})
    chore_streak = streak_data.get('chore_streak', 0) if streak_data else 0
    reading_streak = streak_data.get('reading_streak', 0) if streak_data else 0
    
    # Check each achievement
    for achievement_id, data in ACHIEVEMENT_DEFINITIONS.items():
        if achievement_id in existing_ids or data['category'] == 'family':
            continue
        
        earned = False
        requirement = data['requirement']
        
        if data['type'] == 'chore_count' and completed_chores >= requirement:
            earned = True
        elif data['type'] == 'points' and total_points >= requirement:
            earned = True
        elif data['type'] == 'book_count' and books_read >= requirement:
            earned = True
        elif data['type'] == 'chore_streak' and chore_streak >= requirement:
            earned = True
        elif data['type'] == 'reading_streak' and reading_streak >= requirement:
            earned = True
        
        if earned:
            await db.user_achievements.insert_one({
                "user_id": user_id,
                "achievement_id": achievement_id,
                "earned_at": datetime.now(timezone.utc).isoformat()
            })
            newly_earned.append({
                "achievement_id": achievement_id,
                **data
            })
    
    # Check family achievements
    if parent_id:
        family_existing = await db.family_achievements.find({"family_id": parent_id}, {"_id": 0}).to_list(20)
        family_existing_ids = [a['achievement_id'] for a in family_existing]
        
        # Get family members
        family_members = await db.users.find(
            {"$or": [{"user_id": parent_id}, {"parent_id": parent_id}]},
            {"_id": 0, "user_id": 1}
        ).to_list(20)
        member_ids = [m['user_id'] for m in family_members]
        
        family_chores = await db.chores.count_documents({"assigned_to": {"$in": member_ids}, "status": "completed"})
        
        for achievement_id, data in ACHIEVEMENT_DEFINITIONS.items():
            if data['category'] != 'family' or achievement_id in family_existing_ids:
                continue
            
            if data['type'] == 'family_chores' and family_chores >= data['requirement']:
                await db.family_achievements.insert_one({
                    "family_id": parent_id,
                    "achievement_id": achievement_id,
                    "earned_at": datetime.now(timezone.utc).isoformat()
                })
                newly_earned.append({
                    "achievement_id": achievement_id,
                    **data,
                    "is_family": True
                })
    
    return {"newly_earned": newly_earned, "count": len(newly_earned)}

@router.post("/achievements/streak/update")
async def update_streak(request: Request, data: dict):
    """Update user's streak (called after completing chores/reading)"""
    current_user = await get_current_user(request)
    user_id = current_user['user_id']
    streak_type = data.get('type', 'chore')  # 'chore' or 'reading'
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    streak_data = await db.user_streaks.find_one({"user_id": user_id})
    
    if not streak_data:
        streak_data = {
            "user_id": user_id,
            "chore_streak": 0,
            "reading_streak": 0,
            "last_chore_date": None,
            "last_reading_date": None,
            "longest_chore_streak": 0,
            "longest_reading_streak": 0
        }
    
    if streak_type == 'chore':
        last_date = streak_data.get('last_chore_date')
        if last_date:
            last = datetime.fromisoformat(last_date).date()
            today_date = datetime.fromisoformat(today).date()
            diff = (today_date - last).days
            
            if diff == 1:
                streak_data['chore_streak'] += 1
            elif diff > 1:
                streak_data['chore_streak'] = 1
            # Same day - no change
        else:
            streak_data['chore_streak'] = 1
        
        streak_data['last_chore_date'] = today
        streak_data['longest_chore_streak'] = max(streak_data['longest_chore_streak'], streak_data['chore_streak'])
    
    elif streak_type == 'reading':
        last_date = streak_data.get('last_reading_date')
        if last_date:
            last = datetime.fromisoformat(last_date).date()
            today_date = datetime.fromisoformat(today).date()
            diff = (today_date - last).days
            
            if diff == 1:
                streak_data['reading_streak'] += 1
            elif diff > 1:
                streak_data['reading_streak'] = 1
        else:
            streak_data['reading_streak'] = 1
        
        streak_data['last_reading_date'] = today
        streak_data['longest_reading_streak'] = max(streak_data['longest_reading_streak'], streak_data['reading_streak'])
    
    await db.user_streaks.update_one(
        {"user_id": user_id},
        {"$set": streak_data},
        upsert=True
    )
    
    return {
        "chore_streak": streak_data['chore_streak'],
        "reading_streak": streak_data['reading_streak'],
        "longest_chore_streak": streak_data['longest_chore_streak'],
        "longest_reading_streak": streak_data['longest_reading_streak']
    }

# Seasonal challenges management (parent only)
@router.get("/achievements/seasonal")
async def get_seasonal_challenges(request: Request):
    """Get active seasonal challenges"""
    current_user = await get_current_user(request)
    parent_id = current_user['user_id'] if current_user['role'] == 'parent' else current_user.get('parent_id')
    
    # Get custom family challenges
    custom_challenges = await db.seasonal_challenges.find(
        {"family_id": parent_id, "active": True},
        {"_id": 0}
    ).to_list(20)
    
    # Get default seasonal challenges based on current month
    month = datetime.now(timezone.utc).month
    default_challenges = []
    
    if month in [6, 7, 8]:  # Summer
        default_challenges.append({
            "challenge_id": "summer_reading",
            "name": "Summer Reading Challenge",
            "description": "Read 10 books this summer",
            "icon": "☀️",
            "requirement": 10,
            "type": "books"
        })
    elif month in [11, 12, 1]:  # Winter/Holiday
        default_challenges.append({
            "challenge_id": "holiday_helper",
            "name": "Holiday Helper",
            "description": "Complete 20 chores during the holidays",
            "icon": "🎄",
            "requirement": 20,
            "type": "chores"
        })
    elif month in [3, 4, 5]:  # Spring
        default_challenges.append({
            "challenge_id": "spring_cleaning",
            "name": "Spring Cleaning",
            "description": "Complete 15 cleaning chores",
            "icon": "🌸",
            "requirement": 15,
            "type": "chores"
        })
    
    return {
        "custom_challenges": custom_challenges,
        "default_challenges": default_challenges
    }

@router.post("/achievements/seasonal")
async def create_seasonal_challenge(request: Request, data: dict):
    """Create a custom seasonal challenge (parent only)"""
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can create challenges")
    
    challenge_id = f"challenge_{uuid.uuid4().hex[:12]}"
    
    challenge = {
        "challenge_id": challenge_id,
        "family_id": current_user['user_id'],
        "name": data['name'],
        "description": data.get('description', ''),
        "icon": data.get('icon', '🏆'),
        "requirement": data.get('requirement', 10),
        "type": data.get('type', 'chores'),
        "start_date": data.get('start_date', datetime.now(timezone.utc).isoformat()),
        "end_date": data.get('end_date'),
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.seasonal_challenges.insert_one(challenge)
    return await db.seasonal_challenges.find_one({"challenge_id": challenge_id}, {"_id": 0})


# CUSTOMIZABLE CHILD DASHBOARD
# ============================================

DEFAULT_DASHBOARD_CONFIG = {
    "sections": [
        {"id": "points", "name": "My Points", "visible": True, "order": 0},
        {"id": "chores", "name": "Today's Chores", "visible": True, "order": 1},
        {"id": "events", "name": "Upcoming Events", "visible": True, "order": 2},
        {"id": "achievements", "name": "Achievements", "visible": True, "order": 3},
        {"id": "goals", "name": "My Goals", "visible": True, "order": 4},
        {"id": "shortcuts", "name": "Quick Access", "visible": True, "order": 5},
    ],
    "shortcuts": ["chat", "rewards", "leaderboard"],
    "theme": None  # Use family theme by default
}

@router.get("/dashboard/config")
async def get_dashboard_config(request: Request):
    """Get user's dashboard configuration"""
    current_user = await get_current_user(request)
    
    config = await db.dashboard_configs.find_one(
        {"user_id": current_user['user_id']},
        {"_id": 0}
    )
    
    if not config:
        config = {
            "user_id": current_user['user_id'],
            **DEFAULT_DASHBOARD_CONFIG
        }
    
    return config

@router.put("/dashboard/config")
async def update_dashboard_config(request: Request, data: dict):
    """Update user's dashboard configuration"""
    current_user = await get_current_user(request)
    
    update_data = {}
    
    if 'sections' in data:
        update_data['sections'] = data['sections']
    if 'shortcuts' in data:
        update_data['shortcuts'] = data['shortcuts']
    if 'theme' in data:
        update_data['theme'] = data['theme']
    
    if update_data:
        await db.dashboard_configs.update_one(
            {"user_id": current_user['user_id']},
            {"$set": update_data},
            upsert=True
        )
    
    return await db.dashboard_configs.find_one(
        {"user_id": current_user['user_id']},
        {"_id": 0}
    )

@router.put("/dashboard/sections/reorder")
async def reorder_dashboard_sections(request: Request, data: dict):
    """Reorder dashboard sections"""
    current_user = await get_current_user(request)
    
    section_order = data.get('section_order', [])  # List of section IDs in new order
    
    config = await db.dashboard_configs.find_one({"user_id": current_user['user_id']})
    if not config:
        config = {"user_id": current_user['user_id'], **DEFAULT_DASHBOARD_CONFIG}
    
    # Update order based on new list
    sections = config.get('sections', DEFAULT_DASHBOARD_CONFIG['sections'])
    for i, section_id in enumerate(section_order):
        for section in sections:
            if section['id'] == section_id:
                section['order'] = i
                break
    
    # Sort by new order
    sections.sort(key=lambda x: x['order'])
    
    await db.dashboard_configs.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"sections": sections}},
        upsert=True
    )
    
    return {"sections": sections}

@router.put("/dashboard/sections/{section_id}/visibility")
async def toggle_section_visibility(section_id: str, request: Request, data: dict):
    """Toggle visibility of a dashboard section"""
    current_user = await get_current_user(request)
    
    visible = data.get('visible', True)
    
    config = await db.dashboard_configs.find_one({"user_id": current_user['user_id']})
    if not config:
        config = {"user_id": current_user['user_id'], **DEFAULT_DASHBOARD_CONFIG}
    
    sections = config.get('sections', DEFAULT_DASHBOARD_CONFIG['sections'])
    for section in sections:
        if section['id'] == section_id:
            section['visible'] = visible
            break
    
    await db.dashboard_configs.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"sections": sections}},
        upsert=True
    )
    
    return {"section_id": section_id, "visible": visible}

# Personal Goals
@router.get("/goals")
async def get_goals(request: Request):
    """Get user's personal goals"""
    current_user = await get_current_user(request)
    
    goals = await db.personal_goals.find(
        {"user_id": current_user['user_id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return {"goals": goals}

@router.post("/goals")
async def create_goal(request: Request, data: dict):
    """Create a personal goal"""
    current_user = await get_current_user(request)
    
    goal_id = f"goal_{uuid.uuid4().hex[:12]}"
    
    goal = {
        "goal_id": goal_id,
        "user_id": current_user['user_id'],
        "title": data['title'],
        "description": data.get('description', ''),
        "target": data.get('target', 1),
        "current": 0,
        "type": data.get('type', 'custom'),  # 'books', 'chores', 'points', 'custom'
        "deadline": data.get('deadline'),
        "completed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.personal_goals.insert_one(goal)
    return await db.personal_goals.find_one({"goal_id": goal_id}, {"_id": 0})

@router.put("/goals/{goal_id}")
async def update_goal(goal_id: str, request: Request, data: dict):
    """Update goal progress or details"""
    current_user = await get_current_user(request)
    
    goal = await db.personal_goals.find_one({"goal_id": goal_id, "user_id": current_user['user_id']})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    update_data = {}
    if 'current' in data:
        update_data['current'] = data['current']
        # Auto-complete if target reached
        if data['current'] >= goal.get('target', 1):
            update_data['completed'] = True
            update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
    if 'title' in data:
        update_data['title'] = data['title']
    if 'description' in data:
        update_data['description'] = data['description']
    if 'target' in data:
        update_data['target'] = data['target']
    if 'deadline' in data:
        update_data['deadline'] = data['deadline']
    
    await db.personal_goals.update_one(
        {"goal_id": goal_id},
        {"$set": update_data}
    )
    
    return await db.personal_goals.find_one({"goal_id": goal_id}, {"_id": 0})

@router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, request: Request):
    """Delete a personal goal"""
    current_user = await get_current_user(request)
    
    result = await db.personal_goals.delete_one({
        "goal_id": goal_id,
        "user_id": current_user['user_id']
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    return {"success": True, "deleted": goal_id}

@router.post("/goals/{goal_id}/increment")
async def increment_goal(goal_id: str, request: Request, data: dict = None):
    """Increment goal progress by 1 (or specified amount)"""
    current_user = await get_current_user(request)
    
    goal = await db.personal_goals.find_one({"goal_id": goal_id, "user_id": current_user['user_id']})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    increment = data.get('amount', 1) if data else 1
    new_current = goal.get('current', 0) + increment
    
    update_data = {"current": new_current}
    if new_current >= goal.get('target', 1):
        update_data['completed'] = True
        update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.personal_goals.update_one(
        {"goal_id": goal_id},
        {"$set": update_data}
    )
    
    return await db.personal_goals.find_one({"goal_id": goal_id}, {"_id": 0})

# Favorite shortcuts
@router.get("/shortcuts")
async def get_shortcuts(request: Request):
    """Get user's favorite shortcuts"""
    current_user = await get_current_user(request)
    
    config = await db.dashboard_configs.find_one(
        {"user_id": current_user['user_id']},
        {"_id": 0, "shortcuts": 1}
    )
    
    shortcuts = config.get('shortcuts', DEFAULT_DASHBOARD_CONFIG['shortcuts']) if config else DEFAULT_DASHBOARD_CONFIG['shortcuts']
    
    # Available shortcuts with metadata
    all_shortcuts = {
        "chat": {"id": "chat", "name": "Family Chat", "icon": "chatbubbles", "color": "#6366f1"},
        "rewards": {"id": "rewards", "name": "Rewards Shop", "icon": "gift", "color": "#a855f7"},
        "leaderboard": {"id": "leaderboard", "name": "Leaderboard", "icon": "trophy", "color": "#eab308"},
        "calendar": {"id": "calendar", "name": "Calendar", "icon": "calendar", "color": "#3b82f6"},
        "shopping": {"id": "shopping", "name": "Shopping List", "icon": "cart", "color": "#14b8a6"},
        "reading": {"id": "reading", "name": "Reading Log", "icon": "book", "color": "#ec4899"},
        "dinner": {"id": "dinner", "name": "Dinner Planner", "icon": "restaurant", "color": "#f97316"},
        "family_wall": {"id": "family_wall", "name": "Family Wall", "icon": "people", "color": "#10b981"},
        "achievements": {"id": "achievements", "name": "Achievements", "icon": "medal", "color": "#fbbf24"},
    }
    
    active_shortcuts = [all_shortcuts.get(s, {"id": s, "name": s, "icon": "apps", "color": "#6b7280"}) for s in shortcuts]
    
    return {
        "active": active_shortcuts,
        "available": list(all_shortcuts.values())
    }

@router.put("/shortcuts")
async def update_shortcuts(request: Request, data: dict):
    """Update user's favorite shortcuts"""
    current_user = await get_current_user(request)
    
    shortcuts = data.get('shortcuts', [])
    
    # Limit to 6 shortcuts max
    shortcuts = shortcuts[:6]
    
    await db.dashboard_configs.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"shortcuts": shortcuts}},
        upsert=True
    )
    
    return {"shortcuts": shortcuts}


