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

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/chores")
async def get_chores(request: Request, date: Optional[str] = None):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    # Get all family members for assignee lookup
    family_members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1, "picture": 1, "role": 1}
    ).to_list(100)
    # Sanitize pictures to prevent large base64 data in responses
    member_map = {}
    for m in family_members:
        m['picture'] = sanitize_picture(m.get('picture'), fallback_name=m.get('nickname') or m.get('name'))
        member_map[m['user_id']] = m
    
    query = {"$or": [{"family_id": family_id}, {"created_by": current_user['user_id']}, {"assigned_to": current_user['user_id']}]}
    if date:
        query["scheduled_date"] = date
    chores = await db.chores.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich chores with assignee details (already sanitized)
    for chore in chores:
        assignee_id = chore.get('assigned_to')
        if assignee_id and assignee_id in member_map:
            assignee = member_map[assignee_id]
            chore['assignee_name'] = assignee.get('nickname') or assignee.get('name')
            chore['assignee_picture'] = assignee.get('picture')
        
        completed_by_id = chore.get('completed_by')
        if completed_by_id and completed_by_id in member_map:
            completer = member_map[completed_by_id]
            chore['completed_by_name'] = completer.get('nickname') or completer.get('name')
            chore['completed_by_picture'] = completer.get('picture')
    
    return {"chores": chores}

@router.get("/chores/pending-by-member")
async def get_pending_chores_by_member(request: Request):
    """Get pending chores grouped by family member for Home Hub quick actions"""
    current_user = await get_current_user(request)
    family_id = current_user.get('family_id') or current_user.get('parent_id') or current_user['user_id']
    
    # Get all family members
    family_members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}, {"family_id": family_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1, "picture": 1, "role": 1}
    ).to_list(100)
    
    member_map = {}
    for m in family_members:
        m['picture'] = sanitize_picture(m.get('picture'), fallback_name=m.get('nickname') or m.get('name'))
        member_map[m['user_id']] = m
    
    # Get today's pending chores
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    pending_chores = await db.chores.find({
        "$or": [{"family_id": family_id}, {"created_by": family_id}],
        "scheduled_date": today,
        "status": {"$in": ["pending", "in_progress"]}
    }, {"_id": 0}).to_list(100)
    
    # Group by assignee
    by_member = {}
    for chore in pending_chores:
        assignee_id = chore.get('assigned_to')
        if assignee_id:
            if assignee_id not in by_member:
                member = member_map.get(assignee_id, {"name": "Unknown", "user_id": assignee_id})
                by_member[assignee_id] = {
                    "user_id": assignee_id,
                    "name": member.get('nickname') or member.get('name'),
                    "picture": member.get('picture'),
                    "role": member.get('role'),
                    "chores": []
                }
            by_member[assignee_id]["chores"].append(chore)
    
    return {"members": list(by_member.values())}

@router.post("/chores")
async def create_chore(request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can create chores")
    
    chore_id = f"chore_{uuid.uuid4().hex[:12]}"
    chore_doc = {
        "chore_id": chore_id,
        "family_id": current_user['user_id'],
        "title": data['title'],
        "description": data.get('description'),
        "assigned_to": data.get('assigned_to'),
        "scheduled_date": data['scheduled_date'],
        "points": data.get('points', 10),
        "status": "pending",
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "recurring": data.get('recurring', False)
    }
    await db.chores.insert_one(chore_doc)
    
    # Notify the assigned person about the new chore
    assigned_to = data.get('assigned_to')
    if assigned_to and assigned_to != current_user['user_id']:
        notification_doc = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": assigned_to,
            "type": "chore_assigned",
            "title": "New Chore Assigned",
            "message": f"You have a new chore: '{data['title']}' scheduled for {data['scheduled_date']}",
            "data": {"chore_id": chore_id},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
    
    return await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})

@router.put("/chores/{chore_id}/complete")
async def complete_chore(chore_id: str, request: Request):
    current_user = await get_current_user(request)
    chore = await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    await db.chores.update_one(
        {"chore_id": chore_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat(), "completed_by": current_user['user_id']}}
    )
    
    # Get the parent to notify them
    parent_id = current_user.get('parent_id', current_user['user_id'])
    if current_user['role'] == 'child' and parent_id:
        notification_doc = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": parent_id,
            "type": "chore_completed",
            "title": "Chore Needs Approval",
            "message": f"{current_user.get('nickname') or current_user.get('name', 'Child')} completed '{chore.get('title', 'a chore')}' and needs your approval",
            "data": {"chore_id": chore_id, "child_id": current_user['user_id']},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
    
    return await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})

@router.put("/chores/{chore_id}/approve")
async def approve_chore(chore_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can approve chores")
    
    approved = data.get('approved', True)
    status = "approved" if approved else "denied"
    modified_points = data.get('points')  # Allow parent to modify points
    
    update_data = {"status": status, "approved_at": datetime.now(timezone.utc).isoformat()}
    if modified_points is not None:
        update_data["points"] = modified_points
    
    chore = await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})
    points_awarded = 0
    
    if approved and chore and chore.get('completed_by'):
        points_awarded = modified_points if modified_points is not None else chore.get('points', 10)
        await db.users.update_one(
            {"user_id": chore['completed_by']},
            {"$inc": {"points": points_awarded}}
        )
    
    await db.chores.update_one({"chore_id": chore_id}, {"$set": update_data})
    
    # Create notification for the child
    if chore and chore.get('completed_by'):
        notification_doc = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": chore['completed_by'],
            "type": "chore_approval",
            "title": f"Chore {'Approved' if approved else 'Denied'}",
            "message": f"Your chore '{chore.get('title', 'Chore')}' was {'approved' if approved else 'denied'}{f' (+{points_awarded} points!)' if approved and points_awarded else ''}",
            "data": {"chore_id": chore_id, "approved": approved, "points": points_awarded},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
    
    return await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})

# Update chore points (parent only)
@router.put("/chores/{chore_id}/points")
async def update_chore_points(chore_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can modify points")
    
    new_points = data.get('points')
    if new_points is None or new_points < 0:
        raise HTTPException(status_code=400, detail="Invalid points value")
    
    await db.chores.update_one({"chore_id": chore_id}, {"$set": {"points": new_points}})
    return await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})

# Child claims an unassigned chore
@router.put("/chores/{chore_id}/claim")
async def claim_chore(chore_id: str, request: Request):
    current_user = await get_current_user(request)
    
    chore = await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    # Only allow claiming unassigned chores
    if chore.get('assigned_to'):
        raise HTTPException(status_code=400, detail="Chore is already assigned")
    
    await db.chores.update_one(
        {"chore_id": chore_id},
        {"$set": {
            "assigned_to": current_user['user_id'],
            "claimed_by_child": True,
            "claimed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})

# Update chore (parent only - for editing dates, assignees, etc.)
@router.put("/chores/{chore_id}")
async def update_chore(chore_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can edit chores")
    
    chore = await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    # Allow updating these fields
    allowed_fields = ['title', 'description', 'points', 'assigned_to', 'scheduled_date', 'recurring', 'status']
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if update_data:
        await db.chores.update_one({"chore_id": chore_id}, {"$set": update_data})
    
    return await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})

# Delete chore (parent only)
@router.delete("/chores/{chore_id}")
async def delete_chore(chore_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can delete chores")
    
    result = await db.chores.delete_one({"chore_id": chore_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    return {"message": "Chore deleted"}

# Get all available chore types
@router.get("/chores/types")
async def get_chore_types(request: Request):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    # Get custom chore types for this family
    custom_types = await db.chore_types.find({"family_id": family_id}, {"_id": 0}).to_list(100)
    
    # Default chore types (always available)
    default_types = [
        {"type_id": "default_dishes", "name": "Dishes", "icon": "🍽️", "points": 10, "frequency": "daily", "description": "Wash and put away dishes"},
        {"type_id": "default_vacuum", "name": "Vacuum", "icon": "🧹", "points": 15, "frequency": "weekly", "description": "Vacuum the floors"},
        {"type_id": "default_laundry", "name": "Laundry", "icon": "👕", "points": 15, "frequency": "weekly", "description": "Wash, dry and fold laundry"},
        {"type_id": "default_trash", "name": "Take out trash", "icon": "🗑️", "points": 5, "frequency": "daily", "description": "Take trash to the bins"},
        {"type_id": "default_room", "name": "Clean room", "icon": "🛏️", "points": 10, "frequency": "weekly", "description": "Clean and organize bedroom"},
        {"type_id": "default_pets", "name": "Feed pets", "icon": "🐕", "points": 5, "frequency": "daily", "description": "Feed and water pets"},
        {"type_id": "default_table", "name": "Set table", "icon": "🍴", "points": 5, "frequency": "daily", "description": "Set the table for meals"},
        {"type_id": "default_sweep", "name": "Sweep floors", "icon": "🧹", "points": 10, "frequency": "weekly", "description": "Sweep all floors"},
        {"type_id": "default_counters", "name": "Wipe counters", "icon": "✨", "points": 5, "frequency": "daily", "description": "Clean kitchen counters"},
        {"type_id": "default_bed", "name": "Make bed", "icon": "🛏️", "points": 5, "frequency": "daily", "description": "Make your bed each morning"}
    ]
    
    # Combine default and custom types (custom types come first)
    all_types = custom_types + default_types
    
    return {"chore_types": all_types}

# Add new chore type with AI-generated icon
@router.post("/chores/types")
async def add_chore_type(request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can add chore types")
    
    chore_name = data['name']
    
    # Generate icon using AI if not provided
    icon = data.get('icon')
    if not icon:
        try:
            chat = LlmChat(
                api_key=os.environ['EMERGENT_LLM_KEY'],
                session_id=f"chore_icon_{uuid.uuid4().hex[:8]}",
                system_message="You are a helpful assistant that suggests emojis for household chores. Reply with only a single emoji, nothing else."
            ).with_model("openai", "gpt-5.2")
            
            icon_response = await chat.send_message(UserMessage(text=f"What single emoji best represents this chore: {chore_name}"))
            icon = str(icon_response).strip()[:4]  # Get just the emoji (emojis can be 1-4 chars)
            
            # Fallback if response is too long or not an emoji
            if len(icon) > 4 or icon.isalpha():
                icon = "✨"
        except Exception as e:
            logger.error(f"Failed to generate chore icon: {e}")
            icon = "✨"  # Default fallback icon
    
    type_id = f"type_{uuid.uuid4().hex[:12]}"
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    type_doc = {
        "type_id": type_id,
        "family_id": family_id,
        "name": chore_name,
        "icon": icon,
        "points": data.get('points', 10),
        "frequency": data.get('frequency', 'daily'),
        "description": data.get('description', ''),
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chore_types.insert_one(type_doc)
    return await db.chore_types.find_one({"type_id": type_id}, {"_id": 0})

# Update chore type
@router.put("/chores/types/{type_id}")
async def update_chore_type(type_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can update chore types")
    
    update_data = {}
    if 'name' in data:
        update_data['name'] = data['name']
    if 'icon' in data:
        update_data['icon'] = data['icon']
    if 'points' in data:
        update_data['points'] = data['points']
    if 'frequency' in data:
        update_data['frequency'] = data['frequency']
    if 'description' in data:
        update_data['description'] = data['description']
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.chore_types.update_one({"type_id": type_id}, {"$set": update_data})
    return await db.chore_types.find_one({"type_id": type_id}, {"_id": 0})

# Delete chore type
@router.delete("/chores/types/{type_id}")
async def delete_chore_type(type_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can delete chore types")
    
    # Try to delete by type_id first, then fall back to name for backwards compatibility
    result = await db.chore_types.delete_one({"type_id": type_id})
    if result.deleted_count == 0:
        # Fall back to name match
        result = await db.chore_types.delete_one({"name": type_id})
    
    return {"success": result.deleted_count > 0}

# Toggle child exclusion from chore
@router.put("/chores/exclude-child")
async def toggle_child_chore_exclusion(request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can manage exclusions")
    
    child_id = data.get('child_id')
    chore_name = data.get('chore_name')
    exclude = data.get('exclude', True)
    
    child = await db.users.find_one({"user_id": child_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    
    excluded_chores = child.get('settings', {}).get('excluded_chores', [])
    
    if exclude and chore_name not in excluded_chores:
        excluded_chores.append(chore_name)
    elif not exclude and chore_name in excluded_chores:
        excluded_chores.remove(chore_name)
    
    await db.users.update_one(
        {"user_id": child_id},
        {"$set": {"settings.excluded_chores": excluded_chores}}
    )
    return await db.users.find_one({"user_id": child_id}, {"_id": 0})

# Process missed chores (penalty system)
@router.post("/chores/process-missed")
async def process_missed_chores(request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can process missed chores")
    
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Find missed chores from yesterday
    missed_chores = await db.chores.find({
        "scheduled_date": yesterday,
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    results = []
    for missed in missed_chores:
        # Mark as missed
        await db.chores.update_one(
            {"chore_id": missed['chore_id']},
            {"$set": {"status": "missed"}}
        )
        
        # Find who was supposed to do the chore today
        today_chore = await db.chores.find_one({
            "title": missed['title'],
            "scheduled_date": today
        }, {"_id": 0})
        
        if today_chore and today_chore.get('assigned_to') != missed.get('assigned_to'):
            # Give the bumped child a "bye day"
            bye_doc = {
                "bye_id": f"bye_{uuid.uuid4().hex[:12]}",
                "user_id": today_chore['assigned_to'],
                "date": today,
                "reason": f"Bumped due to {missed.get('assigned_to_name', 'another child')} missing {missed['title']}",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.bye_days.insert_one(bye_doc)
            
            # Reassign today's chore to the child who missed
            await db.chores.update_one(
                {"chore_id": today_chore['chore_id']},
                {"$set": {"assigned_to": missed['assigned_to'], "assigned_to_name": missed.get('assigned_to_name')}}
            )
        
        # Create additional chore for today (the missed one)
        penalty_chore = {
            "chore_id": f"chore_{uuid.uuid4().hex[:12]}",
            "family_id": missed['family_id'],
            "title": f"{missed['title']} (Makeup)",
            "description": f"Makeup chore from {yesterday}",
            "assigned_to": missed['assigned_to'],
            "assigned_to_name": missed.get('assigned_to_name'),
            "scheduled_date": today,
            "points": missed.get('points', 10),
            "status": "pending",
            "created_by": current_user['user_id'],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_penalty": True
        }
        await db.chores.insert_one(penalty_chore)
        results.append({"missed": missed['title'], "penalty_created": True})
    
    return {"processed": len(missed_chores), "results": results}

# Get bye days
@router.get("/chores/bye-days")
async def get_bye_days(request: Request):
    current_user = await get_current_user(request)
    query = {}
    if current_user['role'] == 'child':
        query["user_id"] = current_user['user_id']
    
    bye_days = await db.bye_days.find(query, {"_id": 0}).sort("date", -1).to_list(50)
    return {"bye_days": bye_days}

# Get child's chore settings
@router.get("/chores/child-settings/{child_id}")
async def get_child_chore_settings(child_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can view child settings")
    
    child = await db.users.find_one({"user_id": child_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    
    excluded_chores = child.get('settings', {}).get('excluded_chores', [])
    chore_types = await db.chore_types.find({}, {"_id": 0}).to_list(100)
    
    if not chore_types:
        chore_types = [
            {"name": "Dishes", "points": 10},
            {"name": "Vacuum", "points": 15},
            {"name": "Laundry", "points": 15},
            {"name": "Take out trash", "points": 5},
            {"name": "Clean room", "points": 10},
            {"name": "Feed pets", "points": 5}
        ]
    
    return {
        "child": child,
        "excluded_chores": excluded_chores,
        "available_chores": chore_types
    }

# Shopping list

@router.post("/chores/ai-schedule")
async def ai_schedule_chores(request: Request, data: dict):
    """Use AI to create a fair chore schedule for the family with advanced options"""
    current_user = await get_current_user(request)
    
    if current_user.get('role') != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can schedule chores")
    
    family_id = current_user['user_id']
    
    # Get family members
    members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1, "role": 1, "age": 1}
    ).to_list(20)
    
    children = [m for m in members if m.get('role') == 'child']
    
    # Handle exclusions - can exclude by name or user_id
    excluded_members = data.get('excluded_members', [])
    excluded_chores = data.get('excluded_chores', [])
    
    # Filter out excluded children
    if excluded_members:
        excluded_lower = [e.lower() for e in excluded_members]
        children = [
            c for c in children 
            if c['user_id'] not in excluded_members 
            and c.get('name', '').lower() not in excluded_lower
            and c.get('nickname', '').lower() not in excluded_lower
        ]
    
    # Get available chores
    chores = await db.chore_types.find(
        {"family_id": family_id},
        {"_id": 0}
    ).to_list(50)
    
    if not chores:
        # Use default chores
        chores = [
            {"name": "Wash dishes", "points": 10, "frequency": "daily", "icon": "🍽️"},
            {"name": "Take out trash", "points": 5, "frequency": "daily", "icon": "🗑️"},
            {"name": "Clean room", "points": 15, "frequency": "weekly", "icon": "🛏️"},
            {"name": "Vacuum living room", "points": 10, "frequency": "weekly", "icon": "🧹"},
            {"name": "Set the table", "points": 5, "frequency": "daily", "icon": "🍴"},
            {"name": "Feed pets", "points": 5, "frequency": "daily", "icon": "🐕"},
            {"name": "Do laundry", "points": 15, "frequency": "weekly", "icon": "👕"},
            {"name": "Mow lawn", "points": 20, "frequency": "weekly", "icon": "🌱"}
        ]
    
    # Filter out excluded chores
    if excluded_chores:
        excluded_chores_lower = [c.lower() for c in excluded_chores]
        chores = [c for c in chores if c.get('name', '').lower() not in excluded_chores_lower]
    
    # Get recent chore history for fairness
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_assignments = await db.chores.find(
        {"family_id": family_id, "created_at": {"$gte": week_ago}},
        {"_id": 0, "assigned_to": 1, "chore_name": 1, "points": 1}
    ).to_list(100)
    
    # Calculate points earned per child
    child_points = {c['user_id']: 0 for c in children}
    child_chores = {c['user_id']: [] for c in children}
    for assignment in recent_assignments:
        if assignment.get('assigned_to') in child_points:
            child_points[assignment['assigned_to']] += assignment.get('points', 0)
            child_chores[assignment['assigned_to']].append(assignment.get('chore_name'))
    
    # Build context for AI
    children_info = []
    for child in children:
        name = child.get('nickname') or child.get('name', 'Unknown')
        points = child_points.get(child['user_id'], 0)
        age = child.get('age', 'unknown')
        recent = [c for c in child_chores.get(child['user_id'], [])[:5] if c]
        children_info.append(f"- {name} (age: {age}): {points} points this week, recent chores: {', '.join(recent) if recent else 'none'}")
    
    chores_info = [f"- {c['name']} ({c.get('points', 10)} points, {c.get('frequency', 'daily')})" for c in chores[:15]]
    
    # Advanced preferences
    preferences = data.get('preferences', '')
    schedule_days = data.get('days', 7)
    natural_language = data.get('natural_language', '')  # "Give Sarah more outdoor chores"
    specific_assignments = data.get('specific_assignments', [])  # [{child: "Sarah", chore: "Mow lawn", day: "Saturday"}]
    
    # Build preference string from all inputs
    all_preferences = []
    if preferences:
        all_preferences.append(preferences)
    if natural_language:
        all_preferences.append(f"Additional request: {natural_language}")
    if specific_assignments:
        for assign in specific_assignments:
            all_preferences.append(f"Assign {assign.get('chore')} to {assign.get('child')} on {assign.get('day', 'any day')}")
    
    preference_text = "\n".join(all_preferences) if all_preferences else "Balance workload fairly across all children"
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"chore_schedule_{uuid.uuid4().hex[:8]}",
        system_message="You are a helpful family chore scheduling assistant. Create fair and balanced chore schedules. Be specific with dates and assignments."
    ).with_model("openai", "gpt-5.2")
    
    today = datetime.now(timezone.utc).strftime("%A, %B %d")
    
    prompt = f"""Create a {schedule_days}-day chore schedule for this family starting from {today}.

CHILDREN TO ASSIGN CHORES:
{chr(10).join(children_info) if children_info else 'No children available (some may be excluded)'}

AVAILABLE CHORES:
{chr(10).join(chores_info) if chores_info else 'No chores available'}

SCHEDULING PREFERENCES AND REQUESTS:
{preference_text}

RULES:
1. Distribute chores fairly based on recent history (children with fewer points should get more)
2. Rotate daily chores so no one does the same thing every day
3. Consider age-appropriateness (younger kids get simpler tasks)
4. Include variety for each child
5. Don't overload any single day (max 2-3 chores per child per day)
6. Follow any specific assignments or preferences mentioned above

Format the schedule clearly by day with actual dates, showing which child does which chore and the points they'll earn."""
    
    logger.info(f"AI Schedule prompt has {len(children_info)} children, {len(chores_info)} chores")
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    # Ensure response is a string
    schedule_text = str(response) if response else "Unable to generate schedule"
    
    # Store the schedule
    schedule_id = f"schedule_{uuid.uuid4().hex[:12]}"
    schedule_doc = {
        "schedule_id": schedule_id,
        "family_id": family_id,
        "schedule": schedule_text,
        "days": schedule_days,
        "preferences": preferences,
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chore_schedules.insert_one(schedule_doc)
    
    return {"schedule_id": schedule_id, "schedule": schedule_text}

# Get chore schedules
@router.get("/chores/schedules")
async def get_chore_schedules(request: Request):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    schedules = await db.chore_schedules.find(
        {"family_id": family_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {"schedules": schedules}

# Child nicknames

