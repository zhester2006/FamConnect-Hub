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
    token = get_session_token(request)
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

# AI Schedule chores
@api_router.post("/chores/ai-schedule")
async def ai_schedule_chores(request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can schedule chores")
    
    children = data.get('children', [])
    chore_list = data.get('chores', [])
    week_start = data.get('week_start')
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"schedule_{uuid.uuid4().hex[:8]}",
        system_message="You are a helpful assistant for scheduling family chores fairly."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Schedule these chores fairly for Monday-Friday:
Children: {', '.join([c['name'] for c in children])}
Chores: {', '.join(chore_list)}
Week starting: {week_start}

Return a JSON array with format: {{"date": "YYYY-MM-DD", "child_id": "user_xxx", "chore": "chore name"}}"""
    
    response = await chat.send_message(UserMessage(text=prompt))
    return {"schedule": response}

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
async def get_daily_quote(request: Request):
    await get_current_user(request)
    
    today = datetime.now(timezone.utc).date().isoformat()
    existing_quote = await db.daily_quotes.find_one({"date": today}, {"_id": 0})
    if existing_quote:
        return existing_quote
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"quote_{today}",
        system_message="You are a motivational assistant for families."
    ).with_model("openai", "gpt-5.2")
    
    response = await chat.send_message(UserMessage(
        text="Generate a short, inspirational quote for a family today. Return only the quote, no extra text."
    ))
    
    quote_doc = {"date": today, "quote": response, "created_at": datetime.now(timezone.utc).isoformat()}
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
        {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "points": 1, "badges": 1}
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
    logger.info(f"AI Schedule: family_id={family_id}")
    
    # Get family members
    members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "role": 1}
    ).to_list(20)
    
    logger.info(f"AI Schedule: found {len(members)} members")
    
    children = [m for m in members if m.get('role') == 'child']
    logger.info(f"AI Schedule: found {len(children)} children: {[c['name'] for c in children]}")
    
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
        recent = child_chores.get(child['user_id'], [])[:5]
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
{chr(10).join(children_info)}

AVAILABLE CHORES:
{chr(10).join(chores_info)}

SCHEDULING PREFERENCES:
{preferences if preferences else 'Balance workload fairly across all children'}

RULES:
1. Distribute chores fairly based on recent history (children with fewer points should get more)
2. Rotate daily chores so no one does the same thing every day
3. Consider age-appropriateness
4. Include variety for each child
5. Don't overload any single day

Format the schedule clearly by day, showing which child does which chore."""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    # Store the schedule
    schedule_id = f"schedule_{uuid.uuid4().hex[:12]}"
    schedule_doc = {
        "schedule_id": schedule_id,
        "family_id": family_id,
        "schedule": response,
        "days": schedule_days,
        "preferences": preferences,
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chore_schedules.insert_one(schedule_doc)
    
    return {"schedule_id": schedule_id, "schedule": response}

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