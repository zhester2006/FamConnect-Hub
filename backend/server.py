from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie
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
    event_type: str = "appointment"  # appointment, work_schedule, task
    created_by: str
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
    update_data = {"status": status}
    
    if approved:
        chore = await db.chores.find_one({"chore_id": chore_id}, {"_id": 0})
        if chore and chore.get('completed_by'):
            await db.users.update_one(
                {"user_id": chore['completed_by']},
                {"$inc": {"points": chore.get('points', 10)}}
            )
    
    await db.chores.update_one({"chore_id": chore_id}, {"$set": update_data})
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
async def get_events(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    await get_current_user(request)
    query = {}
    if start_date and end_date:
        query["event_date"] = {"$gte": start_date, "$lte": end_date}
    events = await db.events.find(query, {"_id": 0}).to_list(1000)
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
        "event_type": data.get('event_type', 'appointment'),
        "created_by": current_user['user_id'],
        "status": status,
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
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "latitude": data['latitude'],
        "longitude": data['longitude'],
        "address": data.get('address'),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.checkins.insert_one(checkin_doc)
    return await db.checkins.find_one({"checkin_id": checkin_id}, {"_id": 0})

@api_router.get("/checkins/{user_id}")
async def get_user_checkins(user_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent' and current_user['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    checkins = await db.checkins.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    return {"checkins": checkins}

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