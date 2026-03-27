from fastapi import APIRouter, HTTPException, Request
from deps import db, get_current_user
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

router = APIRouter()

# ==================== CHORE STREAKS ====================

@router.get("/streaks")
async def get_family_streaks(request: Request):
    """Get chore completion streaks for all family members"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}, {"family_id": family_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "role": 1, "picture": 1}
    ).to_list(100)
    
    streaks = []
    for member in members:
        if member.get('role') == 'homehub':
            continue
        
        # Get approved chores for this member in last 90 days
        cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")
        completed = await db.chores.find({
            "assigned_to": member['user_id'],
            "status": {"$in": ["approved", "completed"]},
            "scheduled_date": {"$gte": cutoff}
        }, {"_id": 0, "scheduled_date": 1}).to_list(1000)
        
        # Calculate current streak
        dates_set = set(c['scheduled_date'] for c in completed)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        current_streak = 0
        check_date = datetime.now(timezone.utc)
        
        while True:
            date_str = check_date.strftime("%Y-%m-%d")
            if date_str in dates_set:
                current_streak += 1
                check_date -= timedelta(days=1)
            elif date_str == today:
                check_date -= timedelta(days=1)
            else:
                break
        
        # Calculate longest streak
        sorted_dates = sorted(dates_set)
        longest_streak = 0
        temp_streak = 0
        prev_date = None
        for d in sorted_dates:
            dt = datetime.strptime(d, "%Y-%m-%d")
            if prev_date and (dt - prev_date).days == 1:
                temp_streak += 1
            else:
                temp_streak = 1
            longest_streak = max(longest_streak, temp_streak)
            prev_date = dt
        
        # Determine streak badge
        badge = None
        if current_streak >= 30:
            badge = {"name": "Legendary", "color": "text-yellow-400", "bg": "bg-yellow-500/20"}
        elif current_streak >= 14:
            badge = {"name": "On Fire", "color": "text-orange-400", "bg": "bg-orange-500/20"}
        elif current_streak >= 7:
            badge = {"name": "Streak Master", "color": "text-green-400", "bg": "bg-green-500/20"}
        elif current_streak >= 3:
            badge = {"name": "Getting Started", "color": "text-blue-400", "bg": "bg-blue-500/20"}
        
        streaks.append({
            "user_id": member['user_id'],
            "name": member.get('name'),
            "role": member.get('role'),
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "total_completed": len(dates_set),
            "badge": badge
        })
    
    streaks.sort(key=lambda x: x['current_streak'], reverse=True)
    return {"streaks": streaks}

# ==================== WEEKLY RECAP ====================

@router.get("/weekly-recap")
async def get_weekly_recap(request: Request):
    """Get family weekly recap - top performers, stats"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    # Get date range for this week (Monday to Sunday)
    today = datetime.now(timezone.utc)
    days_since_monday = today.weekday()
    monday = (today - timedelta(days=days_since_monday)).strftime("%Y-%m-%d")
    sunday = (today - timedelta(days=days_since_monday) + timedelta(days=6)).strftime("%Y-%m-%d")
    
    members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}, {"family_id": family_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "role": 1, "points": 1, "picture": 1}
    ).to_list(100)
    
    member_stats = []
    total_chores_completed = 0
    total_events = 0
    total_points_earned = 0
    
    for member in members:
        if member.get('role') == 'homehub':
            continue
        
        # Chores completed this week
        chores = await db.chores.find({
            "assigned_to": member['user_id'],
            "status": {"$in": ["approved", "completed"]},
            "scheduled_date": {"$gte": monday, "$lte": sunday}
        }, {"_id": 0, "points": 1}).to_list(100)
        
        chores_count = len(chores)
        points_this_week = sum(c.get('points', 0) for c in chores)
        total_chores_completed += chores_count
        total_points_earned += points_this_week
        
        member_stats.append({
            "user_id": member['user_id'],
            "name": member.get('name'),
            "role": member.get('role'),
            "chores_completed": chores_count,
            "points_earned": points_this_week,
            "total_points": member.get('points', 0)
        })
    
    # Events this week
    events = await db.events.find({
        "family_id": family_id,
        "event_date": {"$gte": monday, "$lte": sunday}
    }, {"_id": 0}).to_list(100)
    total_events = len(events)
    
    # Shopping items this week
    shopping = await db.shopping_items.find({
        "created_at": {"$gte": monday}
    }, {"_id": 0}).to_list(100)
    
    # Sort by points earned
    member_stats.sort(key=lambda x: x['points_earned'], reverse=True)
    
    # Determine MVP
    mvp = member_stats[0] if member_stats and member_stats[0]['points_earned'] > 0 else None
    
    return {
        "week_start": monday,
        "week_end": sunday,
        "mvp": mvp,
        "member_stats": member_stats,
        "total_chores_completed": total_chores_completed,
        "total_events": total_events,
        "total_points_earned": total_points_earned,
        "shopping_items_count": len(shopping)
    }

# ==================== ROUTINES ====================

@router.get("/routines")
async def get_routines(request: Request):
    """Get all routines for the family"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    routines = await db.routines.find({"family_id": family_id}, {"_id": 0}).to_list(100)
    
    # Get today's completions
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    completions = await db.routine_completions.find({
        "family_id": family_id,
        "date": today
    }, {"_id": 0}).to_list(1000)
    
    completion_set = {(c['routine_id'], c['item_index'], c['user_id']) for c in completions}
    
    # Enrich routines with completion status
    for routine in routines:
        for i, item in enumerate(routine.get('items', [])):
            item['completed_by'] = []
            for member_id in routine.get('assigned_to', []):
                if (routine['routine_id'], i, member_id) in completion_set:
                    item['completed_by'].append(member_id)
    
    return {"routines": routines}

@router.post("/routines")
async def create_routine(request: Request, data: dict):
    """Create a morning/evening routine checklist"""
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can create routines")
    
    routine_id = f"routine_{uuid.uuid4().hex[:12]}"
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    items = [{"name": item, "order": i} for i, item in enumerate(data.get('items', []))]
    
    routine_doc = {
        "routine_id": routine_id,
        "family_id": family_id,
        "name": data.get('name', 'Routine'),
        "type": data.get('type', 'morning'),  # morning, evening, custom
        "items": items,
        "assigned_to": data.get('assigned_to', []),
        "time_limit": data.get('time_limit'),  # optional minutes
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.routines.insert_one(routine_doc)
    return await db.routines.find_one({"routine_id": routine_id}, {"_id": 0})

@router.post("/routines/{routine_id}/complete")
async def complete_routine_item(routine_id: str, request: Request, data: dict):
    """Mark a routine item as completed for today"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    item_index = data.get('item_index', 0)
    user_id = data.get('submitted_by', current_user['user_id'])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check if already completed
    existing = await db.routine_completions.find_one({
        "routine_id": routine_id,
        "item_index": item_index,
        "user_id": user_id,
        "date": today
    })
    
    if existing:
        # Toggle off
        await db.routine_completions.delete_one({"_id": existing['_id']})
        return {"completed": False, "message": "Item unchecked"}
    
    await db.routine_completions.insert_one({
        "routine_id": routine_id,
        "item_index": item_index,
        "user_id": user_id,
        "family_id": family_id,
        "date": today,
        "completed_at": datetime.now(timezone.utc).isoformat()
    })
    return {"completed": True, "message": "Item completed!"}

@router.delete("/routines/{routine_id}")
async def delete_routine(routine_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can delete routines")
    await db.routines.delete_one({"routine_id": routine_id})
    await db.routine_completions.delete_many({"routine_id": routine_id})
    return {"message": "Routine deleted"}

# ==================== STICKY NOTES (HUB MESSAGE BOARD) ====================

@router.get("/hub/notes")
async def get_hub_notes(request: Request):
    """Get sticky notes for the home hub"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    notes = await db.hub_notes.find(
        {"family_id": family_id},
        {"_id": 0}
    ).sort("pinned", -1).to_list(50)
    
    return {"notes": notes}

@router.post("/hub/notes")
async def create_hub_note(request: Request, data: dict):
    """Create a sticky note on the hub"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    # Support submitted_by for HomeHub proxy
    submitted_by = data.get('submitted_by')
    if submitted_by and current_user.get('role') == 'homehub':
        acting_user = await db.users.find_one({"user_id": submitted_by}, {"_id": 0, "password_hash": 0})
        if acting_user:
            current_user = acting_user
    
    note_id = f"note_{uuid.uuid4().hex[:12]}"
    colors = ['bg-yellow-300', 'bg-pink-300', 'bg-blue-300', 'bg-green-300', 'bg-purple-300', 'bg-orange-300']
    
    note_doc = {
        "note_id": note_id,
        "family_id": family_id,
        "text": data.get('text', ''),
        "color": data.get('color', colors[len(data.get('text', '')) % len(colors)]),
        "pinned": data.get('pinned', False),
        "created_by": current_user['user_id'],
        "created_by_name": current_user.get('name', 'Unknown'),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.hub_notes.insert_one(note_doc)
    return await db.hub_notes.find_one({"note_id": note_id}, {"_id": 0})

@router.delete("/hub/notes/{note_id}")
async def delete_hub_note(note_id: str, request: Request):
    await get_current_user(request)
    result = await db.hub_notes.delete_one({"note_id": note_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted"}

# ==================== HUB THEMES ====================

@router.get("/hub/themes")
async def get_hub_themes(request: Request):
    """Get available hub themes"""
    themes = [
        {"id": "classic", "name": "Classic", "preview": "from-slate-900 to-slate-800", "clock_style": "digital"},
        {"id": "sunset", "name": "Sunset Glow", "preview": "from-orange-900 to-pink-900", "clock_style": "digital"},
        {"id": "ocean", "name": "Ocean Calm", "preview": "from-blue-900 to-cyan-900", "clock_style": "digital"},
        {"id": "forest", "name": "Forest", "preview": "from-green-900 to-emerald-900", "clock_style": "digital"},
        {"id": "midnight", "name": "Midnight", "preview": "from-indigo-950 to-purple-950", "clock_style": "digital"},
        {"id": "warm", "name": "Warm Earth", "preview": "from-amber-900 to-red-900", "clock_style": "analog"},
        {"id": "neon", "name": "Neon City", "preview": "from-fuchsia-900 to-violet-900", "clock_style": "digital"},
        {"id": "minimal", "name": "Minimal", "preview": "from-neutral-900 to-stone-900", "clock_style": "digital"}
    ]
    return {"themes": themes}

@router.put("/hub/theme")
async def set_hub_theme(request: Request, data: dict):
    """Set the hub theme for the family"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    await db.hub_settings.update_one(
        {"family_id": family_id},
        {"$set": {
            "family_id": family_id,
            "theme": data.get('theme', 'classic'),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"success": True, "theme": data.get('theme')}

@router.get("/hub/settings")
async def get_hub_settings(request: Request):
    """Get hub settings including theme"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    settings = await db.hub_settings.find_one({"family_id": family_id}, {"_id": 0})
    return settings or {"theme": "classic"}

# ==================== RECIPES (Meal Planning) ====================

@router.get("/recipes")
async def get_recipes(request: Request, category: Optional[str] = None):
    """Get saved family recipes"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    query = {"family_id": family_id}
    if category:
        query["category"] = category
    
    recipes = await db.recipes.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"recipes": recipes}

@router.post("/recipes")
async def save_recipe(request: Request, data: dict):
    """Save a recipe to the family collection"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    recipe_id = f"recipe_{uuid.uuid4().hex[:12]}"
    recipe_doc = {
        "recipe_id": recipe_id,
        "family_id": family_id,
        "name": data.get('name', 'Untitled Recipe'),
        "description": data.get('description', ''),
        "category": data.get('category', 'dinner'),
        "prep_time": data.get('prep_time', ''),
        "cook_time": data.get('cook_time', ''),
        "ingredients": data.get('ingredients', []),
        "steps": data.get('steps', []),
        "servings": data.get('servings', 4),
        "favorite": data.get('favorite', False),
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.recipes.insert_one(recipe_doc)
    return await db.recipes.find_one({"recipe_id": recipe_id}, {"_id": 0})

@router.post("/recipes/{recipe_id}/to-shopping")
async def recipe_ingredients_to_shopping(recipe_id: str, request: Request):
    """Add all recipe ingredients to shopping list"""
    current_user = await get_current_user(request)
    recipe = await db.recipes.find_one({"recipe_id": recipe_id}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    family_id = current_user.get('parent_id', current_user['user_id'])
    added = 0
    for ingredient in recipe.get('ingredients', []):
        item_id = f"item_{uuid.uuid4().hex[:12]}"
        await db.shopping_items.insert_one({
            "item_id": item_id,
            "family_id": family_id,
            "name": ingredient,
            "requested_by": current_user['user_id'],
            "requested_by_name": current_user.get('name', 'Recipe'),
            "status": "approved",
            "source": f"recipe:{recipe['name']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        added += 1
    
    return {"message": f"{added} ingredients added to shopping list", "added": added}

@router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can delete recipes")
    result = await db.recipes.delete_one({"recipe_id": recipe_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"message": "Recipe deleted"}

# ==================== CALENDAR EVENT MOVE (Drag & Drop) ====================

@router.put("/events/{event_id}/move")
async def move_event(event_id: str, request: Request, data: dict):
    """Move an event to a new date (for drag and drop)"""
    await get_current_user(request)
    new_date = data.get('new_date')
    if not new_date:
        raise HTTPException(status_code=400, detail="new_date is required")
    
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    await db.events.update_one(
        {"event_id": event_id},
        {"$set": {"event_date": new_date, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    return {"event": updated, "message": f"Event moved to {new_date}"}

# ==================== PUSH NOTIFICATION SUBSCRIPTION ====================

@router.post("/push/subscribe")
async def subscribe_push(request: Request, data: dict):
    """Subscribe to browser push notifications"""
    current_user = await get_current_user(request)
    
    subscription = data.get('subscription')
    if not subscription:
        raise HTTPException(status_code=400, detail="Subscription data required")
    
    await db.push_subscriptions.update_one(
        {"user_id": current_user['user_id'], "endpoint": subscription.get('endpoint')},
        {"$set": {
            "user_id": current_user['user_id'],
            "subscription": subscription,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"success": True, "message": "Push notifications enabled"}

@router.delete("/push/unsubscribe")
async def unsubscribe_push(request: Request):
    """Unsubscribe from push notifications"""
    current_user = await get_current_user(request)
    await db.push_subscriptions.delete_many({"user_id": current_user['user_id']})
    return {"success": True, "message": "Push notifications disabled"}
