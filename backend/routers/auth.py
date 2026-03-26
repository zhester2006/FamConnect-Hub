from fastapi import APIRouter, HTTPException, Request, Response
from deps import db, get_current_user, get_session_token, sanitize_picture, generate_family_code, send_email_async, send_push_notification, check_geofences, ADMIN_EMAIL
from deps import User, Family, Chore, ShoppingItem, FamilyWallPost, Message, Event, ReadingLog, Reward, CheckIn
from pydantic import BaseModel
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

# Auth endpoints
@router.post("/auth/session")
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

@router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = get_session_token(request)
    await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}

# Mobile OAuth callback handler
@router.get("/auth/google/mobile")
async def google_mobile_auth(redirect_uri: str):
    """Start Google OAuth for mobile app"""
    # The mobile app will handle the OAuth flow, this just validates the redirect URI
    return {"redirect_uri": redirect_uri, "message": "Use standard OAuth flow"}

@router.post("/auth/mobile/callback")
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

# Development-only mock login for testing
@router.post("/auth/dev-login")
async def dev_login(response: Response, data: dict = None):
    """Mock login for development/testing purposes"""
    role = data.get('role', 'parent') if data else 'parent'
    
    # Find or create a test user
    user = await db.users.find_one({"role": role}, {"_id": 0})
    if not user:
        user_id = f"user_test_{uuid.uuid4().hex[:8]}"
        user = {
            "user_id": user_id,
            "email": f"test_{role}@famfocus.demo",
            "name": f"Test {role.capitalize()}",
            "role": role,
            "points": 100,
            "badges": [],
            "settings": {"theme": "cosmic_explorer", "notifications_enabled": True},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "online_status": True,
            "last_seen": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    # Create session token
    session_token = str(uuid.uuid4())
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
    
    return {"user": user, "session_token": session_token}

# Firebase Auth endpoints for mobile app
class FirebaseAuthRequest(BaseModel):
    idToken: Optional[str] = None
    user: Optional[dict] = None
    displayName: Optional[str] = None

@router.post("/auth/firebase-login")
async def firebase_login(response: Response, data: FirebaseAuthRequest):
    """Handle Firebase Authentication login from mobile app"""
    if not data.user:
        raise HTTPException(status_code=400, detail="User data required")
    
    firebase_user = data.user
    email = firebase_user.get('email')
    
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    # Find or create user
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": firebase_user.get('displayName') or firebase_user.get('name') or email.split('@')[0],
            "picture": firebase_user.get('photoURL') or firebase_user.get('picture'),
            "role": "parent",
            "points": 0,
            "badges": [],
            "settings": {"theme": "cosmic_explorer", "notifications_enabled": True},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "online_status": True,
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "firebase_uid": firebase_user.get('uid')
        }
        await db.users.insert_one(user)
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        # Update last seen and firebase_uid
        await db.users.update_one(
            {"user_id": user['user_id']},
            {"$set": {
                "online_status": True,
                "last_seen": datetime.now(timezone.utc).isoformat(),
                "firebase_uid": firebase_user.get('uid')
            }}
        )
    
    # Create session token
    session_token = f"session_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user['user_id'],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        "created_at": datetime.now(timezone.utc),
        "auth_method": "firebase"
    })
    
    return {"session_token": session_token, "user": user}

@router.post("/auth/firebase-signup")
async def firebase_signup(response: Response, data: FirebaseAuthRequest):
    """Handle Firebase Authentication signup from mobile app"""
    if not data.user:
        raise HTTPException(status_code=400, detail="User data required")
    
    firebase_user = data.user
    email = firebase_user.get('email')
    display_name = data.displayName or firebase_user.get('displayName') or email.split('@')[0]
    
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    # Check if user already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists with this email")
    
    # Create new user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = {
        "user_id": user_id,
        "email": email,
        "name": display_name,
        "picture": firebase_user.get('photoURL'),
        "role": "parent",
        "points": 0,
        "badges": [],
        "settings": {"theme": "cosmic_explorer", "notifications_enabled": True},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "online_status": True,
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "firebase_uid": firebase_user.get('uid')
    }
    await db.users.insert_one(user)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    # Create session token
    session_token = f"session_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        "created_at": datetime.now(timezone.utc),
        "auth_method": "firebase"
    })
    
    return {"session_token": session_token, "user": user}

@router.post("/auth/child-login")
async def child_login(data: dict, response: Response):
    """Login for children using username and password"""
    username = data.get('username', '').lower().strip()
    password = data.get('password', '')
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    
    # Find user by username
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Verify password
    import hashlib
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if user.get('password_hash') != password_hash:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create session
    session_token = str(uuid.uuid4())
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    })
    
    # Set session cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=30*24*60*60,
        httponly=True,
        samesite="lax",
        path="/"
    )
    
    # Return user without sensitive fields
    user_data = await db.users.find_one({"user_id": user['user_id']}, {"_id": 0, "password_hash": 0, "pin": 0})
    
    return {
        "success": True,
        "session_token": session_token,
        "user": user_data,
        "first_login": user.get('first_login', False),
        "tutorial_completed": user.get('tutorial_completed', True)
    }



@router.get("/auth/ws-token")
async def get_ws_token(request: Request):
    """Return the session token for WebSocket connections (since httpOnly cookies aren't readable by JS)"""
    current_user = await get_current_user(request)
    token = request.cookies.get('session_token')
    if not token:
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No session token found")
    return {"token": token}
