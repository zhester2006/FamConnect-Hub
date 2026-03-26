from fastapi import HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from pathlib import Path
import os
import uuid
import logging
import asyncio
import json
import resend

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Resend email setup
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '')

# Email helper function
async def send_email_async(to_email: str, subject: str, html_content: str) -> dict:
    if not resend.api_key or resend.api_key == 're_placeholder_key':
        logging.warning("Resend API key not configured, skipping email")
        return {"status": "skipped", "reason": "API key not configured"}
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Email sent to {to_email}: {result.get('id', 'unknown')}")
        return {"status": "sent", "email_id": result.get("id")}
    except Exception as e:
        logging.error(f"Failed to send email to {to_email}: {str(e)}")
        return {"status": "error", "error": str(e)}

# Helper: get session token from cookies or header
def get_session_token(request: Request, authorization: Optional[str] = None) -> str:
    token = request.cookies.get('session_token')
    if token:
        return token
    if authorization and authorization.startswith('Bearer '):
        return authorization[7:]
    raise HTTPException(status_code=401, detail="Not authenticated")

# Helper: get current authenticated user
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

# Helper: sanitize picture data
def sanitize_picture(picture_data, max_len=500, fallback_name=None):
    if not picture_data:
        if fallback_name:
            return f"https://api.dicebear.com/7.x/avataaars/svg?seed={fallback_name.replace(' ', '_')}"
        return None
    if picture_data.startswith('http'):
        return picture_data
    if len(picture_data) <= max_len:
        return picture_data
    if fallback_name:
        return f"https://api.dicebear.com/7.x/avataaars/svg?seed={fallback_name.replace(' ', '_')}"
    return None

# Helper: generate unique family code
def generate_family_code():
    import random
    import string
    chars = string.ascii_uppercase + string.digits
    chars = chars.replace('0', '').replace('O', '').replace('I', '').replace('1', '').replace('L', '')
    return ''.join(random.choices(chars, k=8))

# Helper: send push notification
async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
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
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "type": "push",
        "user_id": user_id,
        "family_id": user_id,
        "message": f"{title}: {body}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

# Helper: check geofences
async def check_geofences(user, lat, lng):
    import math
    parent_id = user.get('parent_id', user['user_id'])
    geofences = await db.geofences.find({"family_id": parent_id}, {"_id": 0}).to_list(100)
    for fence in geofences:
        lat1, lon1 = math.radians(lat), math.radians(lng)
        lat2, lon2 = math.radians(fence['latitude']), math.radians(fence['longitude'])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        distance_feet = c * 20902231
        last_checkin = await db.checkins.find_one(
            {"user_id": user['user_id']}, {"_id": 0}, sort=[("created_at", -1)], skip=1
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
        if was_inside and not is_inside and fence.get('notify_on_exit'):
            await db.notifications.insert_one({
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
            })

# ============ Pydantic Models ============

class Family(BaseModel):
    model_config = ConfigDict(extra="ignore")
    family_id: str
    family_code: str
    family_name: str
    created_by: str
    created_at: str
    settings: Dict[str, Any] = {}

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "parent"
    profile_icon: Optional[str] = None
    profile_background: Optional[str] = None
    points: int = 0
    badges: List[str] = []
    settings: Dict[str, Any] = {}
    created_at: str
    parent_id: Optional[str] = None
    family_id: Optional[str] = None
    online_status: bool = False
    last_seen: Optional[str] = None
    nickname: Optional[str] = None
    bio: Optional[str] = None
    pin: Optional[str] = None
    invite_code: Optional[str] = None
    invite_expires: Optional[str] = None

class Chore(BaseModel):
    model_config = ConfigDict(extra="ignore")
    chore_id: str
    family_id: str
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    scheduled_date: str
    points: int = 10
    status: str = "pending"
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
    status: str = "pending"
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
    post_type: str = "text"
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
    event_type: str = "appointment"
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    created_by: str
    created_by_name: Optional[str] = None
    status: str = "pending"
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
    status: str = "pending"
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

class FirebaseAuthRequest(BaseModel):
    firebase_uid: str
    email: str
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
