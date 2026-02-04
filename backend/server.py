from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Helper function for getting session token
def get_session_token(request: Request, authorization: Optional[str] = None) -> str:
    token = request.cookies.get('session_token')
    if token:
        return token
    if authorization and authorization.startswith('Bearer '):
        return authorization[7:]
    raise HTTPException(status_code=401, detail="Not authenticated")

# Helper function to get current user
async def get_current_user(request: Request):
    authorization = request.headers.get('Authorization')
    token = get_session_token(request, authorization)
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "parent"  # parent, child, member
    profile_icon: Optional[str] = None
    profile_background: Optional[str] = None
    points: int = 0
    badges: List[str] = []
    settings: Dict[str, Any] = {}
    created_at: str
    parent_id: Optional[str] = None
    online_status: bool = False
    last_seen: Optional[str] = None

class Chore(BaseModel):
    model_config = ConfigDict(extra="ignore")
    chore_id: str
    family_id: str
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    scheduled_date: str
    points: int = 10
    status: str = "pending"  # pending, completed, approved, missed
    completed_at: Optional[str] = None
    completed_by: Optional[str] = None
    created_by: str
    created_at: str
    recurring: bool = True

class ShoppingItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item_id: str
    family_id: str
    name: str
    requested_by: str
    status: str = "pending"  # pending, approved, purchased
    approved_by: Optional[str] = None
    created_at: str

class FamilyWallPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    post_id: str
    family_id: str
    user_id: str
    user_name: str
    user_picture: Optional[str] = None
    content: str
    media_url: Optional[str] = None
    post_type: str = "text"  # text, image, poll
    poll_options: Optional[List[Dict[str, Any]]] = None
    created_at: str

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message_id: str
    family_id: str
    user_id: str
    user_name: str
    user_picture: Optional[str] = None
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    read_by: List[str] = []
    created_at: str

class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    event_id: str
    family_id: str
    title: str
    description: Optional[str] = None
    event_date: str
    event_time: Optional[str] = None
    event_type: str = "appointment"  # appointment, work_schedule, event, task
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    created_by: str
    created_by_name: Optional[str] = None
    status: str = "pending"  # pending, approved
    created_at: str

class ReadingLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str
    user_id: str
    family_id: str
    book_name: str
    pages_read: int
    summary: str
    date: str
    status: str = "pending"  # pending, approved
    created_at: str

class Reward(BaseModel):
    model_config = ConfigDict(extra="ignore")
    reward_id: str
    family_id: str
    name: str
    description: Optional[str] = None
    points_required: int
    image_url: Optional[str] = None
    created_at: str

class CheckIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    checkin_id: str
    user_id: str
    family_id: str
    latitude: float
    longitude: float
    address: Optional[str] = None
    created_at: str

# Auth endpoints
@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    session_id = request.headers.get('X-Session-ID')
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
            headers={'X-Session-ID': session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session ID")
        session_data = resp.json()
    
    user = await db.users.find_one({"email": session_data['email']}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": session_data['email'],
            "name": session_data['name'],
            "picture": session_data.get('picture'),
            "role": "parent",
            "points": 0,
            "badges": [],
            "settings": {"theme": "cosmic_explorer", "notifications_enabled": True},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "online_status": True,
            "last_seen": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        await db.users.update_one(
            {"user_id": user['user_id']},
            {"$set": {"online_status": True, "last_seen": datetime.now(timezone.utc).isoformat()}}
        )
    
    session_token = session_data['session_token']
    await db.user_sessions.insert_one({
        "user_id": user['user_id'],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    return {"user": user}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = get_session_token(request)
    await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}

# Mobile OAuth callback handler
@api_router.get("/auth/google/mobile")
async def google_mobile_auth(redirect_uri: str):
    """Start Google OAuth for mobile app"""
    # The mobile app will handle the OAuth flow, this just validates the redirect URI
    return {"redirect_uri": redirect_uri, "message": "Use standard OAuth flow"}

@api_router.post("/auth/mobile/callback")
async def mobile_auth_callback(request: Request, response: Response, data: dict):
    """Handle mobile OAuth callback and return session token"""
    session_id = data.get('session_id')
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
            headers={'X-Session-ID': session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session ID")
        session_data = resp.json()
    
    user = await db.users.find_one({"email": session_data['email']}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": session_data['email'],
            "name": session_data['name'],
            "picture": session_data.get('picture'),
            "role": "parent",
            "points": 0,
            "badges": [],
            "settings": {"theme": "cosmic_explorer", "notifications_enabled": True},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "online_status": True,
            "last_seen": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    session_token = f"session_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    })
    
    # Return token directly for mobile (no cookie needed)
    return {"session_token": session_token, "user": user}

# Push notification device registration
@api_router.post("/notifications/register-device")
async def register_device_for_push(request: Request, data: dict):
    """Register a device for push notifications"""
    current_user = await get_current_user(request)
    
    token = data.get('token')
    platform = data.get('platform', 'unknown')
    
    if not token:
        raise HTTPException(status_code=400, detail="Push token required")
    
    # Update or insert device registration
    await db.push_devices.update_one(
        {"user_id": current_user['user_id'], "token": token},
        {"$set": {
            "user_id": current_user['user_id'],
            "token": token,
            "platform": platform,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True}

@api_router.delete("/notifications/unregister-device")
async def unregister_device(request: Request, data: dict):
    """Unregister a device from push notifications"""
    current_user = await get_current_user(request)
    token = data.get('token')
    
    if token:
        await db.push_devices.delete_one({
            "user_id": current_user['user_id'],
            "token": token
        })
    
    return {"success": True}

# User/Profile endpoints
@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str, request: Request):
    await get_current_user(request)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.get("/family/members")
async def get_family_members(request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] == 'parent':
        members = await db.users.find({"$or": [{"user_id": current_user['user_id']}, {"parent_id": current_user['user_id']}]}, {"_id": 0}).to_list(100)
    else:
        members = await db.users.find({"user_id": {"$in": [current_user['user_id'], current_user.get('parent_id')]}}, {"_id": 0}).to_list(100)
    return {"members": members}

@api_router.post("/users/child")
async def create_child_profile(request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can create child profiles")
    
    child_id = f"user_{uuid.uuid4().hex[:12]}"
    child_doc = {
        "user_id": child_id,
        "email": data.get('email', f"child_{child_id}@family.local"),
        "name": data['name'],
        "picture": data.get('picture'),
        "role": "child",
        "parent_id": current_user['user_id'],
        "points": 0,
        "badges": [],
        "settings": {"theme": "cosmic_explorer", "notifications_enabled": True, "excluded_chores": []},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "online_status": False,
        "last_seen": None
    }
    await db.users.insert_one(child_doc)
    return await db.users.find_one({"user_id": child_id}, {"_id": 0})

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can change roles")
    
    new_role = data.get('role')
    if new_role not in ['parent', 'child', 'member']:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'parent', 'child', or 'member'")
    
    # Ensure the user being updated is part of the family
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent changing your own role
    if user_id == current_user['user_id']:
        raise HTTPException(status_code=403, detail="Cannot change your own role")
    
    await db.users.update_one({
        "user_id": user_id
    }, {
        "$set": {"role": new_role}
    })
    
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['user_id'] != user_id and current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    await db.users.update_one({"user_id": user_id}, {"$set": data})
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

# Chore endpoints
@api_router.get("/chores")
async def get_chores(request: Request, date: Optional[str] = None):
    current_user = await get_current_user(request)
    query = {"$or": [{"assigned_to": current_user['user_id']}, {"created_by": current_user['user_id']}]}
    if date:
        query["scheduled_date"] = date
    chores = await db.chores.find(query, {"_id": 0}).to_list(1000)
    return {"chores": chores}

@api_router.post("/chores")
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
    return await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})

@api_router.put("/chores/{chore_id}/complete")
async def complete_chore(chore_id: str, request: Request):
    current_user = await get_current_user(request)
    chore = await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    await db.chores.update_one(
        {"chore_id": chore_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat(), "completed_by": current_user['user_id']}}
    )
    return await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})

@api_router.put("/chores/{chore_id}/approve")
async def approve_chore(chore_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can approve chores")
    
    approved = data.get('approved', True)
    status = "approved" if approved else "pending"
    modified_points = data.get('points')  # Allow parent to modify points
    
    update_data = {"status": status}
    if modified_points is not None:
        update_data["points"] = modified_points
    
    if approved:
        chore = await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})
        if chore and chore.get('completed_by'):
            points_to_award = modified_points if modified_points is not None else chore.get('points', 10)
            await db.users.update_one(
                {"user_id": chore['completed_by']},
                {"$inc": {"points": points_to_award}}
            )
    
    await db.chores.update_one({"chore_id": chore_id}, {"$set": update_data})
    return await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})

# Update chore points (parent only)
@api_router.put("/chores/{chore_id}/points")
async def update_chore_points(chore_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can modify points")
    
    new_points = data.get('points')
    if new_points is None or new_points < 0:
        raise HTTPException(status_code=400, detail="Invalid points value")
    
    await db.chores.update_one({"chore_id": chore_id}, {"$set": {"points": new_points}})
    return await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})

# Get all available chore types
@api_router.get("/chores/types")
async def get_chore_types(request: Request):
    current_user = await get_current_user(request)
    chore_types = await db.chore_types.find({}, {"_id": 0}).to_list(100)
    if not chore_types:
        # Return default chore types
        default_types = [
            {"name": "Dishes", "points": 10, "description": "Wash and put away dishes"},
            {"name": "Vacuum", "points": 15, "description": "Vacuum the floors"},
            {"name": "Laundry", "points": 15, "description": "Wash, dry and fold laundry"},
            {"name": "Take out trash", "points": 5, "description": "Take trash to the bins"},
            {"name": "Clean room", "points": 10, "description": "Clean and organize bedroom"},
            {"name": "Feed pets", "points": 5, "description": "Feed and water pets"},
            {"name": "Set table", "points": 5, "description": "Set the table for meals"},
            {"name": "Sweep floors", "points": 10, "description": "Sweep all floors"},
            {"name": "Wipe counters", "points": 5, "description": "Clean kitchen counters"},
            {"name": "Make bed", "points": 5, "description": "Make your bed each morning"}
        ]
        return {"chore_types": default_types}
    return {"chore_types": chore_types}

# Add new chore type
@api_router.post("/chores/types")
async def add_chore_type(request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can add chore types")
    
    type_id = f"type_{uuid.uuid4().hex[:12]}"
    type_doc = {
        "type_id": type_id,
        "name": data['name'],
        "points": data.get('points', 10),
        "description": data.get('description', ''),
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chore_types.insert_one(type_doc)
    return await db.chore_types.find_one({"type_id": type_id}, {"_id": 0})

# Delete chore type
@api_router.delete("/chores/types/{type_name}")
async def delete_chore_type(type_name: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can delete chore types")
    
    await db.chore_types.delete_one({"name": type_name})
    return {"success": True}

# Toggle child exclusion from chore
@api_router.put("/chores/exclude-child")
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
@api_router.post("/chores/process-missed")
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
@api_router.get("/chores/bye-days")
async def get_bye_days(request: Request):
    current_user = await get_current_user(request)
    query = {}
    if current_user['role'] == 'child':
        query["user_id"] = current_user['user_id']
    
    bye_days = await db.bye_days.find(query, {"_id": 0}).sort("date", -1).to_list(50)
    return {"bye_days": bye_days}

# Get child's chore settings
@api_router.get("/chores/child-settings/{child_id}")
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
@api_router.get("/shopping")
async def get_shopping_list(request: Request):
    current_user = await get_current_user(request)
    items = await db.shopping_items.find({}, {"_id": 0}).to_list(1000)
    return {"items": items}

@api_router.post("/shopping")
async def add_shopping_item(request: Request, data: dict):
    current_user = await get_current_user(request)
    item_id = f"item_{uuid.uuid4().hex[:12]}"
    status = "approved" if current_user['role'] == 'parent' else "pending"
    
    item_doc = {
        "item_id": item_id,
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "name": data['name'],
        "requested_by": current_user['user_id'],
        "status": status,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.shopping_items.insert_one(item_doc)
    return await db.shopping_items.find_one({"item_id": item_id}, {"_id": 0})

@api_router.put("/shopping/{item_id}")
async def update_shopping_item(item_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent' and data.get('status') == 'approved':
        raise HTTPException(status_code=403, detail="Only parents can approve items")
    
    await db.shopping_items.update_one({"item_id": item_id}, {"$set": data})
    return await db.shopping_items.find_one({"item_id": item_id}, {"_id": 0})

# Family Wall
@api_router.get("/family-wall")
async def get_family_wall(request: Request):
    await get_current_user(request)
    posts = await db.family_wall.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"posts": posts}

@api_router.post("/family-wall")
async def create_post(request: Request, data: dict):
    current_user = await get_current_user(request)
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    
    post_doc = {
        "post_id": post_id,
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "user_id": current_user['user_id'],
        "user_name": current_user['name'],
        "user_picture": current_user.get('picture'),
        "content": data['content'],
        "media_url": data.get('media_url'),
        "post_type": data.get('post_type', 'text'),
        "poll_options": data.get('poll_options'),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.family_wall.insert_one(post_doc)
    return await db.family_wall.find_one({"post_id": post_id}, {"_id": 0})

@api_router.post("/family-wall/{post_id}/vote")
async def vote_on_poll(post_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    option_index = data.get('option_index')
    
    post = await db.family_wall.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.get('post_type') != 'poll':
        raise HTTPException(status_code=400, detail="Post is not a poll")
    
    poll_options = post.get('poll_options', [])
    if option_index < 0 or option_index >= len(poll_options):
        raise HTTPException(status_code=400, detail="Invalid option index")
    
    # Check if user already voted
    for opt in poll_options:
        if current_user['user_id'] in opt.get('votes', []):
            raise HTTPException(status_code=400, detail="Already voted")
    
    # Add vote
    poll_options[option_index]['votes'] = poll_options[option_index].get('votes', []) + [current_user['user_id']]
    
    await db.family_wall.update_one(
        {"post_id": post_id},
        {"$set": {"poll_options": poll_options}}
    )
    return await db.family_wall.find_one({"post_id": post_id}, {"_id": 0})

# AI Daily Quote
@api_router.get("/family-wall/daily-quote")
async def get_daily_quote(request: Request, refresh: bool = False):
    await get_current_user(request)
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Check for existing quote if not forcing refresh
    if not refresh:
        existing_quote = await db.daily_quotes.find_one({"date": today}, {"_id": 0})
        if existing_quote:
            return existing_quote
    
    # Generate new quote with AI
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"quote_{today}_{uuid.uuid4().hex[:8]}",
        system_message="You are a warm, encouraging motivational assistant for families. Create quotes that inspire togetherness, love, and positive action."
    ).with_model("openai", "gpt-5.2")
    
    themes = [
        "family bonding", "teamwork", "gratitude", "kindness", 
        "perseverance", "love", "growth", "joy", "togetherness"
    ]
    import random
    theme = random.choice(themes)
    
    response = await chat.send_message(UserMessage(
        text=f"Generate a short, heartfelt inspirational quote for a family about {theme}. Make it uplifting and actionable. Return only the quote text, no quotation marks or attribution."
    ))
    
    # Ensure response is a string and clean it
    quote_text = str(response).strip().strip('"').strip("'")
    
    # If refreshing, update existing quote; otherwise insert new
    quote_doc = {"date": today, "quote": quote_text, "theme": theme, "created_at": datetime.now(timezone.utc).isoformat()}
    
    if refresh:
        await db.daily_quotes.update_one(
            {"date": today},
            {"$set": quote_doc},
            upsert=True
        )
    else:
        await db.daily_quotes.insert_one(quote_doc)
    
    return quote_doc

# Messages/Chat
@api_router.get("/messages")
async def get_messages(request: Request):
    await get_current_user(request)
    messages = await db.messages.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"messages": messages}

@api_router.post("/messages")
async def send_message(request: Request, data: dict):
    current_user = await get_current_user(request)
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    
    message_doc = {
        "message_id": message_id,
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "user_id": current_user['user_id'],
        "user_name": current_user['name'],
        "user_picture": current_user.get('picture'),
        "content": data['content'],
        "media_url": data.get('media_url'),
        "media_type": data.get('media_type'),
        "read_by": [current_user['user_id']],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(message_doc)
    return await db.messages.find_one({"message_id": message_id}, {"_id": 0})

@api_router.put("/messages/{message_id}/read")
async def mark_message_read(message_id: str, request: Request):
    current_user = await get_current_user(request)
    await db.messages.update_one(
        {"message_id": message_id},
        {"$addToSet": {"read_by": current_user['user_id']}}
    )
    return {"success": True}

# Events/Calendar
@api_router.get("/events")
async def get_events(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None, event_type: Optional[str] = None):
    await get_current_user(request)
    query = {}
    if start_date and end_date:
        query["event_date"] = {"$gte": start_date, "$lte": end_date}
    if event_type:
        query["event_type"] = event_type
    events = await db.events.find(query, {"_id": 0}).sort("event_date", 1).to_list(1000)
    return {"events": events}

@api_router.post("/events")
async def create_event(request: Request, data: dict):
    current_user = await get_current_user(request)
    event_id = f"event_{uuid.uuid4().hex[:12]}"
    status = "approved" if current_user['role'] == 'parent' else "pending"
    
    event_doc = {
        "event_id": event_id,
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "title": data['title'],
        "description": data.get('description'),
        "event_date": data['event_date'],
        "event_time": data.get('event_time'),
        "event_type": data.get('event_type', 'appointment'),
        "work_start_time": data.get('work_start_time'),
        "work_end_time": data.get('work_end_time'),
        "created_by": current_user['user_id'],
        "created_by_name": current_user['name'],
        "status": status,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.events.insert_one(event_doc)
    return await db.events.find_one({"event_id": event_id}, {"_id": 0})

# Work Schedule endpoint
@api_router.post("/events/work-schedule")
async def create_work_schedule(request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] not in ['parent', 'member']:
        raise HTTPException(status_code=403, detail="Only parents and members can add work schedules")
    
    event_id = f"event_{uuid.uuid4().hex[:12]}"
    
    event_doc = {
        "event_id": event_id,
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "title": f"{current_user['name']}'s Work",
        "description": data.get('description'),
        "event_date": data['event_date'],
        "event_type": "work_schedule",
        "work_start_time": data['start_time'],
        "work_end_time": data['end_time'],
        "created_by": current_user['user_id'],
        "created_by_name": current_user['name'],
        "status": "approved",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.events.insert_one(event_doc)
    return await db.events.find_one({"event_id": event_id}, {"_id": 0})

# Reading logs
@api_router.get("/reading-logs")
async def get_reading_logs(request: Request, child_id: Optional[str] = None):
    current_user = await get_current_user(request)
    
    if current_user['role'] == 'parent' and child_id:
        # Parent viewing child's logs
        logs = await db.reading_logs.find({"user_id": child_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    elif current_user['role'] == 'parent':
        # Parent viewing all children's logs
        logs = await db.reading_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        # Child viewing own logs
        logs = await db.reading_logs.find({"user_id": current_user['user_id']}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"logs": logs}

@api_router.post("/reading-logs")
async def create_reading_log(request: Request, data: dict):
    current_user = await get_current_user(request)
    log_id = f"log_{uuid.uuid4().hex[:12]}"
    
    log_doc = {
        "log_id": log_id,
        "user_id": current_user['user_id'],
        "user_name": current_user['name'],
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "book_name": data['book_name'],
        "pages_read": data.get('pages_read', 0),
        "summary": data['summary'],
        "date": data.get('date', datetime.now(timezone.utc).date().isoformat()),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.reading_logs.insert_one(log_doc)
    return await db.reading_logs.find_one({"log_id": log_id}, {"_id": 0})

@api_router.put("/reading-logs/{log_id}/approve")
async def approve_reading_log(log_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can approve reading logs")
    
    approved = data.get('approved', True)
    status = "approved" if approved else "rejected"
    
    await db.reading_logs.update_one(
        {"log_id": log_id},
        {"$set": {"status": status, "approved_by": current_user['user_id'], "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    return await db.reading_logs.find_one({"log_id": log_id}, {"_id": 0})

# Dinner planner
@api_router.post("/dinner/suggest")
async def suggest_dinner(request: Request, data: dict):
    await get_current_user(request)
    
    ingredients = data.get('ingredients', [])
    preferences = data.get('preferences', '')
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"dinner_{uuid.uuid4().hex[:8]}",
        system_message="You are a helpful cooking assistant for families."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Suggest a family-friendly dinner meal.
Ingredients available: {', '.join(ingredients) if ingredients else 'any'}
Preferences: {preferences}

Provide: meal name, ingredients list, and simple cooking instructions."""
    
    response = await chat.send_message(UserMessage(text=prompt))
    return {"suggestion": response}

# Rewards
@api_router.get("/rewards")
async def get_rewards(request: Request):
    await get_current_user(request)
    rewards = await db.rewards.find({}, {"_id": 0}).to_list(100)
    return {"rewards": rewards}

@api_router.post("/rewards")
async def create_reward(request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can create rewards")
    
    reward_id = f"reward_{uuid.uuid4().hex[:12]}"
    reward_doc = {
        "reward_id": reward_id,
        "family_id": current_user['user_id'],
        "name": data['name'],
        "description": data.get('description'),
        "points_required": data['points_required'],
        "image_url": data.get('image_url'),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.rewards.insert_one(reward_doc)
    return await db.rewards.find_one({"reward_id": reward_id}, {"_id": 0})

@api_router.put("/rewards/{reward_id}")
async def update_reward(reward_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can modify rewards")
    
    update_data = {}
    if 'name' in data:
        update_data['name'] = data['name']
    if 'description' in data:
        update_data['description'] = data['description']
    if 'points_required' in data:
        update_data['points_required'] = data['points_required']
    if 'image_url' in data:
        update_data['image_url'] = data['image_url']
    
    await db.rewards.update_one({"reward_id": reward_id}, {"$set": update_data})
    return await db.rewards.find_one({"reward_id": reward_id}, {"_id": 0})

@api_router.delete("/rewards/{reward_id}")
async def delete_reward(reward_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can delete rewards")
    
    await db.rewards.delete_one({"reward_id": reward_id})
    return {"success": True}

@api_router.post("/rewards/{reward_id}/redeem")
async def redeem_reward(reward_id: str, request: Request):
    current_user = await get_current_user(request)
    reward = await db.rewards.find_one({"reward_id": reward_id}, {"_id": 0})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    if current_user['points'] < reward['points_required']:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$inc": {"points": -reward['points_required']}}
    )
    return {"success": True, "remaining_points": current_user['points'] - reward['points_required']}

# Leaderboard
@api_router.get("/leaderboard")
async def get_leaderboard(request: Request):
    current_user = await get_current_user(request)
    parent_id = current_user.get('parent_id', current_user['user_id'])
    
    children = await db.users.find(
        {"parent_id": parent_id, "role": "child"},
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1, "picture": 1, "points": 1, "badges": 1}
    ).sort("points", -1).to_list(100)
    
    return {"leaderboard": children}

# Check-ins
@api_router.post("/checkins")
async def create_checkin(request: Request, data: dict):
    current_user = await get_current_user(request)
    checkin_id = f"checkin_{uuid.uuid4().hex[:12]}"
    
    checkin_doc = {
        "checkin_id": checkin_id,
        "user_id": current_user['user_id'],
        "user_name": current_user['name'],
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "latitude": data['latitude'],
        "longitude": data['longitude'],
        "address": data.get('address'),
        "is_offline_update": data.get('is_offline_update', False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.checkins.insert_one(checkin_doc)
    
    # Check geofences
    await check_geofences(current_user, data['latitude'], data['longitude'])
    
    return await db.checkins.find_one({"checkin_id": checkin_id}, {"_id": 0})

@api_router.get("/checkins/{user_id}")
async def get_user_checkins(user_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent' and current_user['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    checkins = await db.checkins.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    return {"checkins": checkins}

@api_router.get("/checkins/{user_id}/last")
async def get_last_checkin(user_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent' and current_user['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    checkin = await db.checkins.find_one({"user_id": user_id}, {"_id": 0}, sort=[("created_at", -1)])
    return checkin or {"error": "No checkins found"}

# Geofencing
@api_router.get("/geofences")
async def get_geofences(request: Request):
    current_user = await get_current_user(request)
    parent_id = current_user.get('parent_id', current_user['user_id'])
    geofences = await db.geofences.find({"family_id": parent_id}, {"_id": 0}).to_list(100)
    return {"geofences": geofences}

@api_router.post("/geofences")
async def create_geofence(request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can create geofences")
    
    geofence_id = f"fence_{uuid.uuid4().hex[:12]}"
    geofence_doc = {
        "geofence_id": geofence_id,
        "family_id": current_user['user_id'],
        "name": data['name'],  # e.g., "Home", "School"
        "latitude": data['latitude'],
        "longitude": data['longitude'],
        "radius_feet": data.get('radius_feet', 50),
        "notify_on_exit": data.get('notify_on_exit', True),
        "notify_on_enter": data.get('notify_on_enter', False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.geofences.insert_one(geofence_doc)
    return await db.geofences.find_one({"geofence_id": geofence_id}, {"_id": 0})

@api_router.delete("/geofences/{geofence_id}")
async def delete_geofence(geofence_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can delete geofences")
    
    await db.geofences.delete_one({"geofence_id": geofence_id})
    return {"success": True}

# GPS Status Notification
@api_router.post("/location/gps-disabled")
async def report_gps_disabled(request: Request, data: dict):
    current_user = await get_current_user(request)
    
    # Create notification for parents
    notification_doc = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "type": "gps_disabled",
        "user_id": current_user['user_id'],
        "user_name": current_user['name'],
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "message": f"{current_user['name']}'s GPS has been turned off",
        "last_known_lat": data.get('last_latitude'),
        "last_known_lng": data.get('last_longitude'),
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    return {"success": True}

# Get notifications
@api_router.get("/notifications")
async def get_notifications(request: Request):
    current_user = await get_current_user(request)
    parent_id = current_user.get('parent_id', current_user['user_id'])
    notifications = await db.notifications.find(
        {"family_id": parent_id}, 
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return {"notifications": notifications}

# Weather API endpoint
@api_router.get("/weather")
async def get_weather(lat: float = 40.7128, lon: float = -74.0060):
    """Fetch current weather from OpenWeatherMap API"""
    api_key = os.environ.get('OPENWEATHER_API_KEY')
    
    # Map OpenWeatherMap conditions to our simplified conditions
    condition_map = {
        'Clear': 'sunny',
        'Clouds': 'cloudy',
        'Rain': 'rainy',
        'Drizzle': 'rainy',
        'Thunderstorm': 'stormy',
        'Snow': 'snowy',
        'Mist': 'cloudy',
        'Fog': 'cloudy',
        'Wind': 'windy'
    }
    
    if not api_key:
        # Return simulated weather if no API key configured
        import random
        conditions = ['sunny', 'cloudy', 'rainy', 'windy']
        temps = [65, 68, 72, 75, 78, 80, 82]
        return {
            "temp": random.choice(temps),
            "condition": random.choice(conditions),
            "description": "Simulated weather (no API key)",
            "is_mocked": True
        }
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "lat": lat,
                    "lon": lon,
                    "appid": api_key,
                    "units": "imperial"
                },
                timeout=10
            )
            res.raise_for_status()
            data = res.json()
            
            weather_main = data.get("weather", [{}])[0].get("main", "Clear")
            condition = condition_map.get(weather_main, 'cloudy')
            
            return {
                "temp": round(data.get("main", {}).get("temp", 72)),
                "condition": condition,
                "description": data.get("weather", [{}])[0].get("description", ""),
                "humidity": data.get("main", {}).get("humidity"),
                "wind_speed": data.get("wind", {}).get("speed"),
                "city": data.get("name"),
                "is_mocked": False
            }
    except httpx.HTTPStatusError as e:
        logger.error(f"Weather API error: {e}")
        # Fallback to simulated on API errors (401, 403, etc.)
        import random
        return {
            "temp": random.choice([65, 68, 72, 75, 78]),
            "condition": random.choice(['sunny', 'cloudy']),
            "description": "Weather API key may need activation (can take up to 2 hours)",
            "is_mocked": True
        }
    except Exception as e:
        logger.error(f"Weather fetch error: {e}")
        # Fallback to simulated on error
        import random
        return {
            "temp": random.choice([65, 68, 72, 75, 78]),
            "condition": random.choice(['sunny', 'cloudy']),
            "description": "Weather unavailable",
            "is_mocked": True
        }

# Push Notification Subscription
class PushSubscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    subscription_id: str
    user_id: str
    endpoint: str
    keys: Dict[str, str]
    created_at: str

@api_router.post("/push/subscribe")
async def subscribe_push(request: Request, data: dict):
    """Register a push notification subscription"""
    current_user = await get_current_user(request)
    
    subscription_id = f"sub_{uuid.uuid4().hex[:12]}"
    subscription_doc = {
        "subscription_id": subscription_id,
        "user_id": current_user['user_id'],
        "endpoint": data.get('endpoint'),
        "keys": data.get('keys', {}),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove old subscriptions for this user
    await db.push_subscriptions.delete_many({"user_id": current_user['user_id']})
    await db.push_subscriptions.insert_one(subscription_doc)
    
    return {"success": True, "subscription_id": subscription_id}

@api_router.delete("/push/unsubscribe")
async def unsubscribe_push(request: Request):
    """Remove push notification subscription"""
    current_user = await get_current_user(request)
    await db.push_subscriptions.delete_many({"user_id": current_user['user_id']})
    return {"success": True}

@api_router.get("/push/vapid-key")
async def get_vapid_key():
    """Get the public VAPID key for push notifications"""
    # For production, generate and store VAPID keys properly
    # This is a placeholder public key
    return {"publicKey": "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"}

# Helper function to send push notification
async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Queue a push notification for a user"""
    notification_doc = {
        "notification_id": f"push_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "title": title,
        "body": body,
        "data": data or {},
        "sent": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.push_queue.insert_one(notification_doc)
    
    # Also store in notifications collection for in-app display
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "type": "push",
        "user_id": user_id,
        "family_id": user_id,  # Will be updated based on context
        "message": f"{title}: {body}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

# Helper function to check geofences
async def check_geofences(user, lat, lng):
    import math
    
    parent_id = user.get('parent_id', user['user_id'])
    geofences = await db.geofences.find({"family_id": parent_id}, {"_id": 0}).to_list(100)
    
    for fence in geofences:
        # Calculate distance in feet
        lat1, lon1 = math.radians(lat), math.radians(lng)
        lat2, lon2 = math.radians(fence['latitude']), math.radians(fence['longitude'])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        distance_feet = c * 20902231  # Earth radius in feet
        
        # Get last known position
        last_checkin = await db.checkins.find_one(
            {"user_id": user['user_id']}, 
            {"_id": 0}, 
            sort=[("created_at", -1)],
            skip=1
        )
        
        is_inside = distance_feet <= fence['radius_feet']
        was_inside = False
        
        if last_checkin:
            lat1_old = math.radians(last_checkin['latitude'])
            lon1_old = math.radians(last_checkin['longitude'])
            dlat_old = lat2 - lat1_old
            dlon_old = lon2 - lon1_old
            a_old = math.sin(dlat_old/2)**2 + math.cos(lat1_old) * math.cos(lat2) * math.sin(dlon_old/2)**2
            c_old = 2 * math.asin(math.sqrt(a_old))
            old_distance = c_old * 20902231
            was_inside = old_distance <= fence['radius_feet']
        
        # Create notification if crossed boundary
        if was_inside and not is_inside and fence.get('notify_on_exit'):
            notification_doc = {
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "type": "geofence_exit",
                "user_id": user['user_id'],
                "user_name": user['name'],
                "family_id": parent_id,
                "geofence_name": fence['name'],
                "message": f"{user['name']} has left {fence['name']}",
                "latitude": lat,
                "longitude": lng,
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification_doc)

# GIF Search using Tenor API (Google's GIF service - free)
@api_router.get("/gifs/search")
async def search_gifs(q: str, limit: int = 20):
    """Search for GIFs using Tenor API"""
    # Tenor API key (free anonymous key)
    api_key = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://tenor.googleapis.com/v2/search",
                params={
                    "key": api_key,
                    "q": q,
                    "limit": limit,
                    "contentfilter": "high",  # Family-friendly
                    "media_filter": "gif,tinygif"
                },
                timeout=10
            )
            res.raise_for_status()
            data = res.json()
            
            gifs = []
            for gif in data.get("results", []):
                media = gif.get("media_formats", {})
                gifs.append({
                    "id": gif.get("id"),
                    "title": gif.get("content_description", ""),
                    "url": media.get("gif", {}).get("url", ""),
                    "preview": media.get("tinygif", {}).get("url", "") or media.get("gif", {}).get("url", ""),
                    "width": media.get("gif", {}).get("dims", [200])[0],
                    "height": media.get("gif", {}).get("dims", [200, 200])[1] if len(media.get("gif", {}).get("dims", [])) > 1 else 200
                })
            
            return {"gifs": gifs}
    except Exception as e:
        logger.error(f"GIF search error: {e}")
        return {"gifs": [], "error": str(e)}

# GIF Trending
@api_router.get("/gifs/trending")
async def trending_gifs(limit: int = 20):
    """Get trending GIFs using Tenor API"""
    api_key = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://tenor.googleapis.com/v2/featured",
                params={
                    "key": api_key,
                    "limit": limit,
                    "contentfilter": "high",
                    "media_filter": "gif,tinygif"
                },
                timeout=10
            )
            res.raise_for_status()
            data = res.json()
            
            gifs = []
            for gif in data.get("results", []):
                media = gif.get("media_formats", {})
                gifs.append({
                    "id": gif.get("id"),
                    "title": gif.get("content_description", ""),
                    "url": media.get("gif", {}).get("url", ""),
                    "preview": media.get("tinygif", {}).get("url", "") or media.get("gif", {}).get("url", ""),
                    "width": media.get("gif", {}).get("dims", [200])[0],
                    "height": media.get("gif", {}).get("dims", [200, 200])[1] if len(media.get("gif", {}).get("dims", [])) > 1 else 200
                })
            
            return {"gifs": gifs}
    except Exception as e:
        logger.error(f"GIF trending error: {e}")
        return {"gifs": [], "error": str(e)}

# Advanced AI Chore Scheduling
@api_router.post("/chores/ai-schedule")
async def ai_schedule_chores(request: Request, data: dict):
    """Use AI to create a fair chore schedule for the family"""
    current_user = await get_current_user(request)
    
    if current_user.get('role') != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can schedule chores")
    
    family_id = current_user['user_id']
    
    # Get family members
    members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "role": 1}
    ).to_list(20)
    
    children = [m for m in members if m.get('role') == 'child']
    
    # Get available chores
    chores = await db.chore_types.find(
        {"family_id": family_id},
        {"_id": 0}
    ).to_list(50)
    
    if not chores:
        # Use default chores
        chores = [
            {"name": "Wash dishes", "points": 10, "frequency": "daily"},
            {"name": "Take out trash", "points": 5, "frequency": "daily"},
            {"name": "Clean room", "points": 15, "frequency": "weekly"},
            {"name": "Vacuum living room", "points": 10, "frequency": "weekly"},
            {"name": "Set the table", "points": 5, "frequency": "daily"},
            {"name": "Feed pets", "points": 5, "frequency": "daily"},
            {"name": "Do laundry", "points": 15, "frequency": "weekly"},
            {"name": "Mow lawn", "points": 20, "frequency": "weekly"}
        ]
    
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
        points = child_points.get(child['user_id'], 0)
        recent = [c for c in child_chores.get(child['user_id'], [])[:5] if c]  # Filter out None values
        children_info.append(f"- {child['name']}: {points} points earned, recent chores: {', '.join(recent) if recent else 'none'}")
    
    chores_info = [f"- {c['name']} ({c.get('points', 10)} points, {c.get('frequency', 'daily')})" for c in chores[:15]]
    
    preferences = data.get('preferences', '')
    schedule_days = data.get('days', 7)
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"chore_schedule_{uuid.uuid4().hex[:8]}",
        system_message="You are a helpful family chore scheduling assistant. Create fair and balanced chore schedules."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Create a {schedule_days}-day chore schedule for this family.

CHILDREN:
{chr(10).join(children_info) if children_info else 'No children found'}

AVAILABLE CHORES:
{chr(10).join(chores_info) if chores_info else 'No chores found'}

SCHEDULING PREFERENCES:
{preferences if preferences else 'Balance workload fairly across all children'}

RULES:
1. Distribute chores fairly based on recent history (children with fewer points should get more)
2. Rotate daily chores so no one does the same thing every day
3. Consider age-appropriateness
4. Include variety for each child
5. Don't overload any single day

Format the schedule clearly by day, showing which child does which chore."""
    
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
@api_router.get("/chores/schedules")
async def get_chore_schedules(request: Request):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    schedules = await db.chore_schedules.find(
        {"family_id": family_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {"schedules": schedules}

# Child nicknames
@api_router.put("/users/{user_id}/nickname")
async def update_nickname(user_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    
    # Only parents can set nicknames, or users can set their own
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if current_user['role'] != 'parent' and current_user['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    nickname = data.get('nickname', '').strip()
    if len(nickname) > 20:
        raise HTTPException(status_code=400, detail="Nickname too long (max 20 chars)")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"nickname": nickname}}
    )
    
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

# WebSocket Connection Manager for Real-time Chat
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}  # family_id -> list of websockets
        self.user_connections: Dict[str, WebSocket] = {}  # user_id -> websocket
        self.typing_users: Dict[str, set] = {}  # family_id -> set of user_ids typing
    
    async def connect(self, websocket: WebSocket, user_id: str, family_id: str):
        await websocket.accept()
        if family_id not in self.active_connections:
            self.active_connections[family_id] = []
        self.active_connections[family_id].append(websocket)
        self.user_connections[user_id] = websocket
        
        # Update user online status
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"online_status": True, "last_seen": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Broadcast user joined
        await self.broadcast_status(family_id, user_id, "online")
    
    def disconnect(self, websocket: WebSocket, user_id: str, family_id: str):
        if family_id in self.active_connections:
            if websocket in self.active_connections[family_id]:
                self.active_connections[family_id].remove(websocket)
        if user_id in self.user_connections:
            del self.user_connections[user_id]
    
    async def broadcast_message(self, family_id: str, message: dict):
        if family_id in self.active_connections:
            for connection in self.active_connections[family_id]:
                try:
                    await connection.send_json({"type": "message", "data": message})
                except:
                    pass
    
    async def broadcast_typing(self, family_id: str, user_id: str, user_name: str, is_typing: bool):
        if family_id not in self.typing_users:
            self.typing_users[family_id] = set()
        
        if is_typing:
            self.typing_users[family_id].add(user_id)
        else:
            self.typing_users[family_id].discard(user_id)
        
        if family_id in self.active_connections:
            for connection in self.active_connections[family_id]:
                try:
                    await connection.send_json({
                        "type": "typing",
                        "data": {"user_id": user_id, "user_name": user_name, "is_typing": is_typing}
                    })
                except:
                    pass
    
    async def broadcast_status(self, family_id: str, user_id: str, status: str):
        if family_id in self.active_connections:
            for connection in self.active_connections[family_id]:
                try:
                    await connection.send_json({
                        "type": "status",
                        "data": {"user_id": user_id, "status": status}
                    })
                except:
                    pass

manager = ConnectionManager()

# WebSocket endpoint for real-time chat
@app.websocket("/ws/chat/{session_token}")
async def websocket_chat(websocket: WebSocket, session_token: str):
    # Verify session
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        await websocket.close(code=4001)
        return
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        await websocket.close(code=4001)
        return
    
    family_id = user.get('parent_id', user['user_id'])
    user_id = user['user_id']
    
    await manager.connect(websocket, user_id, family_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "message":
                # Save message to database
                message_id = f"msg_{uuid.uuid4().hex[:12]}"
                message_doc = {
                    "message_id": message_id,
                    "family_id": family_id,
                    "user_id": user_id,
                    "user_name": user['name'],
                    "user_picture": user.get('picture'),
                    "content": data.get("content", ""),
                    "media_url": data.get("media_url"),
                    "media_type": data.get("media_type"),
                    "read_by": [user_id],
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.messages.insert_one(message_doc)
                
                # Broadcast to all family members
                await manager.broadcast_message(family_id, message_doc)
            
            elif data.get("type") == "typing":
                await manager.broadcast_typing(
                    family_id, user_id, user['name'], data.get("is_typing", False)
                )
            
            elif data.get("type") == "read":
                # Mark messages as read
                message_ids = data.get("message_ids", [])
                for msg_id in message_ids:
                    await db.messages.update_one(
                        {"message_id": msg_id},
                        {"$addToSet": {"read_by": user_id}}
                    )
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id, family_id)
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"online_status": False, "last_seen": datetime.now(timezone.utc).isoformat()}}
        )
        await manager.broadcast_status(family_id, user_id, "offline")

# Profile picture upload endpoint
@api_router.post("/users/{user_id}/upload-picture")
async def upload_profile_picture(user_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['user_id'] != user_id and current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    image_data = data.get('image')  # Base64 encoded image
    image_type = data.get('type', 'profile')  # 'profile' or 'background'
    
    if not image_data:
        raise HTTPException(status_code=400, detail="No image data provided")
    
    # Store in database (for simplicity, storing base64 directly)
    # In production, would upload to cloud storage
    update_field = 'picture' if image_type == 'profile' else 'profile_background'
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {update_field: image_data}}
    )
    
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

# Pixie AI Onboarding - Get onboarding steps
@api_router.get("/onboarding/steps")
async def get_onboarding_steps(request: Request):
    current_user = await get_current_user(request)
    role = current_user.get('role', 'member')
    
    # Check if user has completed onboarding
    if current_user.get('settings', {}).get('onboarding_completed'):
        return {"completed": True, "steps": []}
    
    # Role-specific onboarding steps
    parent_steps = [
        {
            "step": 1,
            "title": "Welcome to FamFocus Hub!",
            "message": "Hey there! I'm Pixie, your family's AI assistant. I'm here to help you get the most out of FamFocus Hub. Let me show you around!",
            "target": None,
            "position": "center"
        },
        {
            "step": 2,
            "title": "Your Dashboard",
            "message": "This is your Parent Dashboard - your command center! Here you can see your children's activities, pending approvals, and manage the family.",
            "target": "parent-dashboard",
            "position": "bottom"
        },
        {
            "step": 3,
            "title": "Home Hub",
            "message": "The Home Hub is perfect for a quick family overview - weather, calendar, chores, and shopping list all in one place!",
            "target": "sidebar-home-hub",
            "position": "right"
        },
        {
            "step": 4,
            "title": "Manage Chores",
            "message": "Create and assign chores to your children. I can even help schedule them fairly using AI! Set point values to motivate everyone.",
            "target": "sidebar-dashboard",
            "position": "right"
        },
        {
            "step": 5,
            "title": "Safe Zones & Location",
            "message": "Set up safe zones like home and school. You'll get notified when your children leave these areas.",
            "target": "sidebar-location",
            "position": "right"
        },
        {
            "step": 6,
            "title": "Rewards Shop",
            "message": "Create rewards that children can earn with their points. It's a great way to motivate good behavior!",
            "target": "sidebar-rewards",
            "position": "right"
        },
        {
            "step": 7,
            "title": "You're All Set!",
            "message": "That's the basics! Explore the app and remember - I'm always here in the Family Wall with daily inspiration. Have fun with your family!",
            "target": None,
            "position": "center"
        }
    ]
    
    child_steps = [
        {
            "step": 1,
            "title": "Welcome to FamFocus Hub!",
            "message": "Hey there, superstar! I'm Pixie, and I'm going to help you explore FamFocus Hub. It's going to be fun!",
            "target": None,
            "position": "center"
        },
        {
            "step": 2,
            "title": "Your Space",
            "message": "This is YOUR space! See your daily missions (chores), earn points, and check your progress.",
            "target": "child-space",
            "position": "bottom"
        },
        {
            "step": 3,
            "title": "Complete Chores, Earn Points!",
            "message": "When you finish a chore, mark it complete. Your parents will approve it, and you'll earn points!",
            "target": "today-missions",
            "position": "bottom"
        },
        {
            "step": 4,
            "title": "Rewards Shop",
            "message": "Spend your hard-earned points on awesome rewards! Check out what's available.",
            "target": "sidebar-rewards",
            "position": "right"
        },
        {
            "step": 5,
            "title": "Family Chat",
            "message": "Chat with your family in real-time! Share updates, ask questions, or just say hi.",
            "target": "sidebar-chat",
            "position": "right"
        },
        {
            "step": 6,
            "title": "Reading Log",
            "message": "Love reading? Log your books here and share summaries with your parents!",
            "target": "sidebar-reading",
            "position": "right"
        },
        {
            "step": 7,
            "title": "You're Ready!",
            "message": "That's it! Go complete some missions, earn points, and have fun with your family!",
            "target": None,
            "position": "center"
        }
    ]
    
    return {
        "completed": False,
        "steps": parent_steps if role == 'parent' else child_steps,
        "total_steps": 7
    }

# Mark onboarding complete
@api_router.post("/onboarding/complete")
async def complete_onboarding(request: Request):
    current_user = await get_current_user(request)
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"settings.onboarding_completed": True}}
    )
    
    return {"success": True}

# Reset onboarding (for testing)
@api_router.post("/onboarding/reset")
async def reset_onboarding(request: Request):
    current_user = await get_current_user(request)
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"settings.onboarding_completed": False}}
    )
    
    return {"success": True}

# Enhanced Dinner Planner with weekly meal planning
@api_router.post("/dinner/weekly-plan")
async def create_weekly_meal_plan(request: Request, data: dict):
    current_user = await get_current_user(request)
    
    family_size = data.get('family_size', 4)
    preferences = data.get('preferences', '')
    budget = data.get('budget', 'moderate')
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"mealplan_{uuid.uuid4().hex[:8]}",
        system_message="You are a helpful family meal planning assistant."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Create a weekly dinner plan for a family of {family_size}.
Preferences: {preferences}
Budget: {budget}

For each day (Monday-Sunday), provide:
1. Meal name
2. Brief description
3. Estimated prep time
4. Key ingredients

Format as a clear list for each day."""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    # Store the meal plan
    plan_id = f"mealplan_{uuid.uuid4().hex[:12]}"
    plan_doc = {
        "plan_id": plan_id,
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "week_start": datetime.now(timezone.utc).date().isoformat(),
        "plan": response,
        "preferences": preferences,
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.meal_plans.insert_one(plan_doc)
    
    return {"plan_id": plan_id, "plan": response}

# Get saved meal plans
@api_router.get("/dinner/plans")
async def get_meal_plans(request: Request):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    plans = await db.meal_plans.find(
        {"family_id": family_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {"plans": plans}

# Get online family members
@api_router.get("/family/online")
async def get_online_members(request: Request):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    online_members = await db.users.find(
        {
            "$or": [
                {"user_id": family_id},
                {"parent_id": family_id}
            ],
            "online_status": True
        },
        {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "last_seen": 1}
    ).to_list(50)
    
    return {"online": online_members}

# ==================== ANALYTICS ====================

@api_router.get("/analytics/overview")
async def get_analytics_overview(request: Request):
    """Get family analytics overview"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    # Get all family members
    members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0}
    ).to_list(20)
    
    children = [m for m in members if m.get('role') == 'child']
    
    # Get chore completion stats
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()
    
    # Weekly chores
    weekly_chores = await db.chores.find({
        "family_id": family_id,
        "created_at": {"$gte": week_ago}
    }, {"_id": 0}).to_list(500)
    
    weekly_completed = len([c for c in weekly_chores if c.get('status') == 'completed'])
    weekly_total = len(weekly_chores)
    
    # Monthly chores
    monthly_chores = await db.chores.find({
        "family_id": family_id,
        "created_at": {"$gte": month_ago}
    }, {"_id": 0}).to_list(2000)
    
    monthly_completed = len([c for c in monthly_chores if c.get('status') == 'completed'])
    monthly_total = len(monthly_chores)
    
    # Points by child
    child_stats = []
    for child in children:
        child_chores = [c for c in monthly_chores if c.get('assigned_to') == child['user_id']]
        completed = len([c for c in child_chores if c.get('status') == 'completed'])
        total_points = sum(c.get('points', 0) for c in child_chores if c.get('status') == 'completed')
        
        child_stats.append({
            "user_id": child['user_id'],
            "name": child.get('nickname') or child['name'],
            "display_name": child.get('nickname') or child['name'],
            "chores_completed": completed,
            "chores_total": len(child_chores),
            "completion_rate": round((completed / len(child_chores) * 100) if child_chores else 0, 1),
            "points_earned": total_points
        })
    
    # Daily activity for the past 7 days
    daily_activity = []
    for i in range(7):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        
        day_chores = [c for c in weekly_chores if day_start <= c.get('created_at', '') <= day_end]
        day_completed = len([c for c in day_chores if c.get('status') == 'completed'])
        
        daily_activity.append({
            "date": day.strftime("%Y-%m-%d"),
            "day": day.strftime("%a"),
            "completed": day_completed,
            "total": len(day_chores)
        })
    
    daily_activity.reverse()
    
    return {
        "weekly": {
            "completed": weekly_completed,
            "total": weekly_total,
            "completion_rate": round((weekly_completed / weekly_total * 100) if weekly_total else 0, 1)
        },
        "monthly": {
            "completed": monthly_completed,
            "total": monthly_total,
            "completion_rate": round((monthly_completed / monthly_total * 100) if monthly_total else 0, 1)
        },
        "children": child_stats,
        "daily_activity": daily_activity,
        "total_family_members": len(members),
        "total_children": len(children)
    }

@api_router.get("/analytics/trends")
async def get_analytics_trends(request: Request, days: int = 30):
    """Get points and activity trends over time"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).isoformat()
    
    # Get all chores in the period
    chores = await db.chores.find({
        "family_id": family_id,
        "created_at": {"$gte": start_date}
    }, {"_id": 0}).to_list(5000)
    
    # Group by week
    weeks = {}
    for chore in chores:
        if chore.get('created_at'):
            date = datetime.fromisoformat(chore['created_at'].replace('Z', '+00:00'))
            week_start = (date - timedelta(days=date.weekday())).strftime("%Y-%m-%d")
            
            if week_start not in weeks:
                weeks[week_start] = {"completed": 0, "total": 0, "points": 0}
            
            weeks[week_start]["total"] += 1
            if chore.get('status') == 'completed':
                weeks[week_start]["completed"] += 1
                weeks[week_start]["points"] += chore.get('points', 0)
    
    trends = [{"week": k, **v} for k, v in sorted(weeks.items())]
    
    return {"trends": trends, "period_days": days}

# ==================== DATA EXPORT ====================

@api_router.get("/export/chores")
async def export_chores_csv(request: Request):
    """Export chores data as CSV"""
    current_user = await get_current_user(request)
    
    if current_user.get('role') != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can export data")
    
    family_id = current_user['user_id']
    
    # Get all chores
    chores = await db.chores.find(
        {"family_id": family_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(5000)
    
    # Get member names
    members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1}
    ).to_list(50)
    member_names = {m['user_id']: m.get('nickname') or m['name'] for m in members}
    
    # Build CSV
    csv_lines = ["Date,Chore,Assigned To,Status,Points"]
    for chore in chores:
        date = chore.get('created_at', '')[:10]
        name = chore.get('chore_name', chore.get('name', 'Unknown'))
        assigned = member_names.get(chore.get('assigned_to'), 'Unassigned')
        status = chore.get('status', 'pending')
        points = chore.get('points', 0)
        csv_lines.append(f'"{date}","{name}","{assigned}","{status}",{points}')
    
    csv_content = "\n".join(csv_lines)
    
    return {
        "filename": f"famfocus_chores_{datetime.now().strftime('%Y%m%d')}.csv",
        "content": csv_content,
        "mime_type": "text/csv"
    }

@api_router.get("/export/events")
async def export_events_csv(request: Request):
    """Export events data as CSV"""
    current_user = await get_current_user(request)
    
    if current_user.get('role') != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can export data")
    
    family_id = current_user['user_id']
    
    events = await db.events.find(
        {"family_id": family_id},
        {"_id": 0}
    ).sort("start_date", -1).to_list(2000)
    
    csv_lines = ["Date,Title,Type,Time,Created By"]
    for event in events:
        date = event.get('start_date', event.get('date', ''))[:10]
        title = event.get('title', 'Untitled')
        event_type = event.get('event_type', 'event')
        time = event.get('event_time', '')
        created_by = event.get('created_by_name', '')
        csv_lines.append(f'"{date}","{title}","{event_type}","{time}","{created_by}"')
    
    csv_content = "\n".join(csv_lines)
    
    return {
        "filename": f"famfocus_events_{datetime.now().strftime('%Y%m%d')}.csv",
        "content": csv_content,
        "mime_type": "text/csv"
    }

@api_router.get("/export/full")
async def export_all_data(request: Request):
    """Export all family data as JSON"""
    current_user = await get_current_user(request)
    
    if current_user.get('role') != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can export data")
    
    family_id = current_user['user_id']
    
    # Get all family data
    members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0, "password_hash": 0}
    ).to_list(50)
    
    chores = await db.chores.find({"family_id": family_id}, {"_id": 0}).to_list(5000)
    events = await db.events.find({"family_id": family_id}, {"_id": 0}).to_list(2000)
    rewards = await db.rewards.find({"family_id": family_id}, {"_id": 0}).to_list(100)
    reading_logs = await db.reading_logs.find({"family_id": family_id}, {"_id": 0}).to_list(1000)
    
    export_data = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "family_id": family_id,
        "members": members,
        "chores": chores,
        "events": events,
        "rewards": rewards,
        "reading_logs": reading_logs
    }
    
    return {
        "filename": f"famfocus_full_export_{datetime.now().strftime('%Y%m%d')}.json",
        "content": export_data,
        "mime_type": "application/json"
    }

# ==================== MULTIPLE FAMILY SUPPORT ====================

@api_router.get("/families")
async def get_user_families(request: Request):
    """Get all families the user belongs to"""
    current_user = await get_current_user(request)
    user_id = current_user['user_id']
    
    # Get families where user is parent or member
    families = []
    
    # Check if user is a parent (owns a family)
    if current_user.get('role') == 'parent':
        member_count = await db.users.count_documents({"parent_id": user_id})
        families.append({
            "family_id": user_id,
            "name": current_user.get('family_name', f"{current_user['name']}'s Family"),
            "role": "parent",
            "member_count": member_count + 1,
            "is_current": True
        })
    
    # Check family memberships
    memberships = await db.family_memberships.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(20)
    
    for membership in memberships:
        family = await db.families.find_one(
            {"family_id": membership['family_id']},
            {"_id": 0}
        )
        if family:
            member_count = await db.family_memberships.count_documents({"family_id": family['family_id']})
            families.append({
                "family_id": family['family_id'],
                "name": family.get('name', 'Family'),
                "role": membership.get('role', 'member'),
                "member_count": member_count,
                "is_current": family['family_id'] == current_user.get('current_family_id')
            })
    
    return {"families": families}

@api_router.post("/families")
async def create_family(request: Request, data: dict):
    """Create a new family"""
    current_user = await get_current_user(request)
    
    family_id = f"family_{uuid.uuid4().hex[:12]}"
    family_name = data.get('name', f"{current_user['name']}'s Family")
    
    family_doc = {
        "family_id": family_id,
        "name": family_name,
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.families.insert_one(family_doc)
    
    # Add creator as admin
    membership_doc = {
        "membership_id": f"mem_{uuid.uuid4().hex[:12]}",
        "family_id": family_id,
        "user_id": current_user['user_id'],
        "role": "admin",
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    await db.family_memberships.insert_one(membership_doc)
    
    return {"family_id": family_id, "name": family_name}

@api_router.post("/families/{family_id}/invite")
async def invite_to_family(family_id: str, request: Request, data: dict):
    """Invite someone to join a family"""
    current_user = await get_current_user(request)
    
    # Check if user has permission to invite
    membership = await db.family_memberships.find_one({
        "family_id": family_id,
        "user_id": current_user['user_id'],
        "role": {"$in": ["admin", "parent"]}
    })
    
    if not membership and current_user['user_id'] != family_id:
        raise HTTPException(status_code=403, detail="Not authorized to invite members")
    
    invite_email = data.get('email')
    invite_role = data.get('role', 'member')
    
    invite_doc = {
        "invite_id": f"inv_{uuid.uuid4().hex[:12]}",
        "family_id": family_id,
        "email": invite_email,
        "role": invite_role,
        "invited_by": current_user['user_id'],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.family_invites.insert_one(invite_doc)
    
    return {"invite_id": invite_doc['invite_id'], "status": "pending"}

@api_router.post("/families/switch/{family_id}")
async def switch_family(family_id: str, request: Request):
    """Switch to a different family"""
    current_user = await get_current_user(request)
    
    # Verify membership
    membership = await db.family_memberships.find_one({
        "family_id": family_id,
        "user_id": current_user['user_id']
    })
    
    is_parent = current_user['user_id'] == family_id
    
    if not membership and not is_parent:
        raise HTTPException(status_code=403, detail="Not a member of this family")
    
    # Update current family
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"current_family_id": family_id}}
    )
    
    return {"success": True, "current_family_id": family_id}

@api_router.get("/families/invites/pending")
async def get_pending_invites(request: Request):
    """Get pending invites for current user"""
    current_user = await get_current_user(request)
    email = current_user.get('email')
    
    invites = await db.family_invites.find(
        {"email": email, "status": "pending"},
        {"_id": 0}
    ).to_list(50)
    
    # Get family details for each invite
    for invite in invites:
        family = await db.families.find_one(
            {"family_id": invite['family_id']},
            {"_id": 0}
        )
        if family:
            invite['family_name'] = family.get('name', 'Unknown Family')
        else:
            # If family_id is user_id (parent's family)
            parent = await db.users.find_one({"user_id": invite['family_id']}, {"_id": 0})
            if parent:
                invite['family_name'] = parent.get('family_name', f"{parent.get('name')}'s Family")
    
    return {"invites": invites}

@api_router.post("/families/invites/{invite_id}/accept")
async def accept_invite(invite_id: str, request: Request):
    """Accept a family invitation"""
    current_user = await get_current_user(request)
    
    invite = await db.family_invites.find_one({"invite_id": invite_id}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite['email'] != current_user.get('email'):
        raise HTTPException(status_code=403, detail="This invite is not for you")
    
    if invite['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Invite already processed")
    
    # Create membership
    membership_doc = {
        "membership_id": f"mem_{uuid.uuid4().hex[:12]}",
        "family_id": invite['family_id'],
        "user_id": current_user['user_id'],
        "role": invite.get('role', 'member'),
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    await db.family_memberships.insert_one(membership_doc)
    
    # Update invite status
    await db.family_invites.update_one(
        {"invite_id": invite_id},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "family_id": invite['family_id']}

@api_router.post("/families/invites/{invite_id}/decline")
async def decline_invite(invite_id: str, request: Request):
    """Decline a family invitation"""
    current_user = await get_current_user(request)
    
    invite = await db.family_invites.find_one({"invite_id": invite_id}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite['email'] != current_user.get('email'):
        raise HTTPException(status_code=403, detail="This invite is not for you")
    
    await db.family_invites.update_one(
        {"invite_id": invite_id},
        {"$set": {"status": "declined", "declined_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True}

@api_router.delete("/families/{family_id}/leave")
async def leave_family(family_id: str, request: Request):
    """Leave a family"""
    current_user = await get_current_user(request)
    
    # Can't leave own family as parent
    if current_user['user_id'] == family_id:
        raise HTTPException(status_code=400, detail="Cannot leave your own family")
    
    result = await db.family_memberships.delete_one({
        "family_id": family_id,
        "user_id": current_user['user_id']
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    # If this was current family, switch to primary
    if current_user.get('current_family_id') == family_id:
        await db.users.update_one(
            {"user_id": current_user['user_id']},
            {"$unset": {"current_family_id": ""}}
        )
    
    return {"success": True}

# ==================== WELCOME TUTORIAL ====================

@api_router.get("/tutorial/content")
async def get_tutorial_content(request: Request):
    """Get welcome tutorial content"""
    current_user = await get_current_user(request)
    role = current_user.get('role', 'member')
    
    # Check if user has seen the tutorial
    if current_user.get('settings', {}).get('tutorial_completed'):
        return {"completed": True, "slides": []}
    
    parent_slides = [
        {
            "id": 1,
            "title": "Welcome to FamFocus Hub!",
            "description": "Your family's command center for chores, events, and rewards. Let's take a quick tour!",
            "image": "welcome",
            "icon": "home"
        },
        {
            "id": 2,
            "title": "Home Hub Dashboard",
            "description": "See everything at a glance - weather, calendar, chores, and shopping list all in one place.",
            "image": "dashboard",
            "icon": "layout-dashboard"
        },
        {
            "id": 3,
            "title": "Smart Chore Management",
            "description": "Create chores, set points, and let AI help schedule them fairly. Kids earn points for completing tasks!",
            "image": "chores",
            "icon": "check-circle"
        },
        {
            "id": 4,
            "title": "Family Calendar",
            "description": "Track events, work schedules, and appointments. Everyone stays in sync!",
            "image": "calendar",
            "icon": "calendar"
        },
        {
            "id": 5,
            "title": "Rewards & Motivation",
            "description": "Create rewards for kids to redeem with their earned points. Customize point values for each reward.",
            "image": "rewards",
            "icon": "gift"
        },
        {
            "id": 6,
            "title": "Location Safety",
            "description": "Set up safe zones and get notified when kids arrive or leave important locations.",
            "image": "location",
            "icon": "map-pin"
        },
        {
            "id": 7,
            "title": "You're All Set!",
            "description": "Start by adding your family members and creating some chores. Have fun organizing your family!",
            "image": "complete",
            "icon": "party-popper"
        }
    ]
    
    child_slides = [
        {
            "id": 1,
            "title": "Welcome to FamFocus Hub!",
            "description": "Your own space to track missions, earn points, and claim awesome rewards!",
            "image": "welcome",
            "icon": "rocket"
        },
        {
            "id": 2,
            "title": "Your Daily Missions",
            "description": "Check your missions (chores) and mark them complete to earn points!",
            "image": "missions",
            "icon": "target"
        },
        {
            "id": 3,
            "title": "Earn Points & Climb Up!",
            "description": "Complete missions to earn points. See how you rank on the family leaderboard!",
            "image": "points",
            "icon": "trophy"
        },
        {
            "id": 4,
            "title": "Rewards Shop",
            "description": "Spend your hard-earned points on cool rewards your parents have set up!",
            "image": "rewards",
            "icon": "gift"
        },
        {
            "id": 5,
            "title": "Stay Connected",
            "description": "Chat with your family, share updates, and have fun together!",
            "image": "chat",
            "icon": "message-circle"
        },
        {
            "id": 6,
            "title": "Ready to Go!",
            "description": "Start completing missions and earning points. Good luck, superstar!",
            "image": "complete",
            "icon": "star"
        }
    ]
    
    return {
        "completed": False,
        "slides": parent_slides if role == 'parent' else child_slides,
        "total_slides": len(parent_slides if role == 'parent' else child_slides)
    }

@api_router.post("/tutorial/complete")
async def complete_tutorial(request: Request):
    """Mark tutorial as completed"""
    current_user = await get_current_user(request)
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"settings.tutorial_completed": True}}
    )
    
    return {"success": True}

@api_router.post("/tutorial/reset")
async def reset_tutorial(request: Request):
    """Reset tutorial for testing"""
    current_user = await get_current_user(request)
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"settings.tutorial_completed": False}}
    )
    
    return {"success": True}

# ==================== BATTERY STATUS ====================

@api_router.post("/battery/update")
async def update_battery_status(request: Request, data: dict):
    """Update user's battery status (called from child's device)"""
    current_user = await get_current_user(request)
    
    battery_level = data.get('level')  # 0-100
    is_charging = data.get('is_charging', False)
    
    if battery_level is None or not (0 <= battery_level <= 100):
        raise HTTPException(status_code=400, detail="Invalid battery level")
    
    # Check if user has granted permission to share battery
    if not current_user.get('permissions', {}).get('share_battery', False):
        return {"success": False, "message": "Battery sharing not enabled"}
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {
            "battery": {
                "level": battery_level,
                "is_charging": is_charging,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }}
    )
    
    # Create notification if battery is critically low
    if battery_level <= 15 and not is_charging:
        parent_id = current_user.get('parent_id')
        if parent_id:
            await db.notifications.insert_one({
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "type": "battery_low",
                "user_id": parent_id,
                "family_id": parent_id,
                "message": f"{current_user['name']}'s battery is critically low ({battery_level}%)",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    return {"success": True, "level": battery_level}

@api_router.get("/battery/family")
async def get_family_battery_status(request: Request):
    """Get battery status for all family members (parents only)"""
    current_user = await get_current_user(request)
    
    if current_user.get('role') != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can view family battery status")
    
    family_id = current_user['user_id']
    
    # Get all children with battery sharing enabled
    children = await db.users.find(
        {
            "parent_id": family_id,
            "permissions.share_battery": True
        },
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1, "picture": 1, "battery": 1}
    ).to_list(20)
    
    battery_status = []
    for child in children:
        battery = child.get('battery', {})
        battery_status.append({
            "user_id": child['user_id'],
            "name": child.get('nickname') or child['name'],
            "picture": child.get('picture'),
            "level": battery.get('level'),
            "is_charging": battery.get('is_charging', False),
            "updated_at": battery.get('updated_at'),
            "is_stale": battery.get('updated_at') and (
                datetime.now(timezone.utc) - datetime.fromisoformat(battery['updated_at'].replace('Z', '+00:00'))
            ).total_seconds() > 3600  # Stale if older than 1 hour
        })
    
    return {"battery_status": battery_status}

@api_router.put("/permissions/battery")
async def toggle_battery_permission(request: Request, data: dict):
    """Toggle battery sharing permission"""
    current_user = await get_current_user(request)
    
    share_battery = data.get('share_battery', False)
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"permissions.share_battery": share_battery}}
    )
    
    return {"success": True, "share_battery": share_battery}

@api_router.get("/permissions")
async def get_permissions(request: Request):
    """Get user's permission settings"""
    current_user = await get_current_user(request)
    
    return {
        "permissions": current_user.get('permissions', {
            "share_battery": False,
            "share_location": True
        })
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()