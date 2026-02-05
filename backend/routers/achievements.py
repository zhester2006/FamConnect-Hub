# Achievement System Router
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/achievements", tags=["achievements"])

# Achievement definitions - imported from main server
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

# Database and auth functions will be injected
db = None
get_current_user = None

def init_router(database, auth_func):
    global db, get_current_user
    db = database
    get_current_user = auth_func

@router.get("")
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

@router.get("/user/{user_id}")
async def get_user_achievements(user_id: str, request: Request):
    """Get achievements earned by a specific user"""
    await get_current_user(request)
    
    earned = await db.user_achievements.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    earned_ids = [a['achievement_id'] for a in earned]
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    completed_chores = await db.chores.count_documents({"assigned_to": user_id, "status": "completed"})
    total_points = user.get('points', 0)
    books_read = await db.reading_logs.count_documents({"user_id": user_id, "status": "approved"})
    
    streak_data = await db.user_streaks.find_one({"user_id": user_id}, {"_id": 0})
    chore_streak = streak_data.get('chore_streak', 0) if streak_data else 0
    reading_streak = streak_data.get('reading_streak', 0) if streak_data else 0
    
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

@router.get("/family")
async def get_family_achievements(request: Request):
    """Get family-wide achievements"""
    current_user = await get_current_user(request)
    parent_id = current_user['user_id'] if current_user['role'] == 'parent' else current_user.get('parent_id')
    
    family_members = await db.users.find(
        {"$or": [{"user_id": parent_id}, {"parent_id": parent_id}]},
        {"_id": 0, "user_id": 1}
    ).to_list(20)
    
    member_ids = [m['user_id'] for m in family_members]
    family_chores = await db.chores.count_documents({"assigned_to": {"$in": member_ids}, "status": "completed"})
    
    earned = await db.family_achievements.find({"family_id": parent_id}, {"_id": 0}).to_list(20)
    earned_ids = [a['achievement_id'] for a in earned]
    
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

@router.post("/check")
async def check_achievements(request: Request):
    """Check and award any new achievements for the current user"""
    current_user = await get_current_user(request)
    user_id = current_user['user_id']
    parent_id = current_user['user_id'] if current_user['role'] == 'parent' else current_user.get('parent_id')
    
    newly_earned = []
    
    existing = await db.user_achievements.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    existing_ids = [a['achievement_id'] for a in existing]
    
    completed_chores = await db.chores.count_documents({"assigned_to": user_id, "status": "completed"})
    total_points = current_user.get('points', 0)
    books_read = await db.reading_logs.count_documents({"user_id": user_id, "status": "approved"})
    
    streak_data = await db.user_streaks.find_one({"user_id": user_id}, {"_id": 0})
    chore_streak = streak_data.get('chore_streak', 0) if streak_data else 0
    reading_streak = streak_data.get('reading_streak', 0) if streak_data else 0
    
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
    
    return {"newly_earned": newly_earned, "count": len(newly_earned)}

@router.get("/seasonal")
async def get_seasonal_challenges(request: Request):
    """Get active seasonal challenges"""
    current_user = await get_current_user(request)
    parent_id = current_user['user_id'] if current_user['role'] == 'parent' else current_user.get('parent_id')
    
    custom_challenges = await db.seasonal_challenges.find(
        {"family_id": parent_id, "active": True},
        {"_id": 0}
    ).to_list(20)
    
    month = datetime.now(timezone.utc).month
    default_challenges = []
    
    if month in [6, 7, 8]:
        default_challenges.append({
            "challenge_id": "summer_reading",
            "name": "Summer Reading Challenge",
            "description": "Read 10 books this summer",
            "icon": "☀️",
            "requirement": 10,
            "type": "books"
        })
    elif month in [11, 12, 1]:
        default_challenges.append({
            "challenge_id": "holiday_helper",
            "name": "Holiday Helper",
            "description": "Complete 20 chores during the holidays",
            "icon": "🎄",
            "requirement": 20,
            "type": "chores"
        })
    elif month in [3, 4, 5]:
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
