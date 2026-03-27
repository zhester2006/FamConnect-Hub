from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, File, Form
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

# These specific routes MUST come before the catch-all /users/{user_id} route
@router.get("/users/family-profiles")
async def get_family_profiles(request: Request):
    """Get all family member profiles for Home Hub dropdown"""
    current_user = await get_current_user(request)
    family_id = current_user.get('family_id') or current_user.get('parent_id') or current_user.get('user_id')
    
    # Get all family members
    members = await db.users.find({
        "$or": [
            {"family_id": family_id},
            {"parent_id": family_id},
            {"user_id": family_id}
        ]
    }, {"_id": 0, "pin": 0}).to_list(100)
    
    # Filter out homehub profiles from the selection - they are shared devices, not people
    profiles = [m for m in members if m.get('role') != 'homehub']
    
    # Add has_pin flag
    for member in profiles:
        member_full = await db.users.find_one({"user_id": member['user_id']})
        member['has_pin'] = bool(member_full.get('pin'))
    
    return {"profiles": profiles}

@router.post("/users/verify-pin")
async def verify_user_pin(request: Request, data: dict):
    """Verify a user's PIN for Home Hub actions"""
    user_id = data.get('user_id')
    pin = data.get('pin')
    
    if not user_id or not pin:
        raise HTTPException(status_code=400, detail="User ID and PIN required")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('pin') != pin:
        raise HTTPException(status_code=401, detail="Invalid PIN")
    
    return {
        "success": True,
        "user": {
            "user_id": user['user_id'],
            "name": user['name'],
            "role": user['role'],
            "picture": user.get('picture')
        }
    }

# User/Profile endpoints
@router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str, request: Request):
    await get_current_user(request)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/family/members")
async def get_family_members(request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] in ('parent', 'homehub'):
        # For parent: find self + all children/homehubs under them
        # For homehub: find all members under the parent who created this homehub
        parent_id = current_user['user_id'] if current_user['role'] == 'parent' else current_user.get('parent_id')
        members = await db.users.find({"$or": [{"user_id": parent_id}, {"parent_id": parent_id}]}, {"_id": 0}).to_list(100)
    else:
        members = await db.users.find({"user_id": {"$in": [current_user['user_id'], current_user.get('parent_id')]}}, {"_id": 0}).to_list(100)
    
    # Sanitize pictures to prevent large base64 data in responses
    for member in members:
        member['picture'] = sanitize_picture(member.get('picture'), fallback_name=member.get('nickname') or member.get('name'))
    
    return {"members": members}

@router.post("/users/child")
async def create_child_profile(request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can create child profiles")
    
    child_id = f"user_{uuid.uuid4().hex[:12]}"
    
    # Generate invite code for child to complete setup
    invite_code = uuid.uuid4().hex[:8].upper()
    invite_expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    
    # Get family_id from current user
    family_id = current_user.get('family_id') or current_user.get('parent_id') or current_user.get('user_id')
    
    # Validate username if provided
    username = data.get('username')
    if username:
        # Check username is alphanumeric and not taken
        if not username.isalnum() or len(username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 alphanumeric characters")
        existing = await db.users.find_one({"username": username.lower()})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
    
    # Hash password if provided
    password_hash = None
    if data.get('password'):
        import hashlib
        password_hash = hashlib.sha256(data['password'].encode()).hexdigest()
    
    child_doc = {
        "user_id": child_id,
        "email": data.get('email', f"child_{child_id}@family.local"),
        "name": data['name'],
        "picture": data.get('picture'),
        "role": "child",
        "parent_id": current_user['user_id'],
        "family_id": family_id,
        "points": 0,
        "badges": [],
        "settings": {"theme": "cosmic_explorer", "notifications_enabled": True, "excluded_chores": []},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "online_status": False,
        "last_seen": None,
        "pin": data.get('pin'),
        "username": username.lower() if username else None,
        "password_hash": password_hash,
        "invite_code": invite_code,
        "invite_expires": invite_expires,
        "first_login": True,  # Will be set to False after tutorial completion
        "phone": None,  # Child will add during first login
        "tutorial_completed": False
    }
    await db.users.insert_one(child_doc)
    
    # Auto-add child to all families the parent belongs to
    parent_memberships = await db.family_memberships.find(
        {"user_id": current_user['user_id']},
        {"_id": 0, "family_id": 1}
    ).to_list(20)
    
    for pm in parent_memberships:
        child_membership = {
            "membership_id": f"mem_{uuid.uuid4().hex[:12]}",
            "family_id": pm['family_id'],
            "user_id": child_id,
            "role": "child",
            "joined_at": datetime.now(timezone.utc).isoformat()
        }
        await db.family_memberships.insert_one(child_membership)
    
    # Also add to family_id directly if not already covered
    if family_id:
        existing = await db.family_memberships.find_one({"family_id": family_id, "user_id": child_id})
        if not existing:
            await db.family_memberships.insert_one({
                "membership_id": f"mem_{uuid.uuid4().hex[:12]}",
                "family_id": family_id,
                "user_id": child_id,
                "role": "child",
                "joined_at": datetime.now(timezone.utc).isoformat()
            })
    
    result = await db.users.find_one({"user_id": child_id}, {"_id": 0, "password_hash": 0})
    result['invite_link'] = f"/join/{invite_code}"
    return result

@router.post("/users/{user_id}/pin")
async def set_user_pin(user_id: str, request: Request, data: dict):
    """Set or update a user's PIN"""
    current_user = await get_current_user(request)
    
    # Parents can set PIN for children, users can set their own
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    can_update = (
        current_user['user_id'] == user_id or  # Own PIN
        (current_user['role'] == 'parent' and target_user.get('parent_id') == current_user['user_id'])  # Parent setting child's PIN
    )
    
    if not can_update:
        raise HTTPException(status_code=403, detail="Unauthorized to set this user's PIN")
    
    pin = data.get('pin')
    if not pin or len(pin) != 4 or not pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")
    
    await db.users.update_one({"user_id": user_id}, {"$set": {"pin": pin}})
    return {"success": True, "message": "PIN updated successfully"}

@router.get("/invite/{invite_code}")
async def get_invite_info(invite_code: str):
    """Get info about an invite code for child setup"""
    user = await db.users.find_one({"invite_code": invite_code.upper()}, {"_id": 0, "pin": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    # Check if expired
    if user.get('invite_expires'):
        expires = datetime.fromisoformat(user['invite_expires'].replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=410, detail="Invite code has expired")
    
    return {
        "user_id": user['user_id'],
        "name": user['name'],
        "role": user['role'],
        "picture": user.get('picture')
    }

@router.post("/invite/{invite_code}/complete")
async def complete_invite_setup(invite_code: str, data: dict):
    """Complete child setup from invite link"""
    user = await db.users.find_one({"invite_code": invite_code.upper()})
    
    if not user:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    # Check if expired
    if user.get('invite_expires'):
        expires = datetime.fromisoformat(user['invite_expires'].replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=410, detail="Invite code has expired")
    
    # Update profile with child's preferences
    updates = {
        "invite_code": None,  # Clear invite code after use
        "invite_expires": None
    }
    
    if data.get('picture'):
        updates['picture'] = data['picture']
    if data.get('theme'):
        updates['settings.theme'] = data['theme']
    if data.get('nickname'):
        updates['nickname'] = data['nickname']
    
    await db.users.update_one({"user_id": user['user_id']}, {"$set": updates})
    
    # Return session token for the child
    session_token = str(uuid.uuid4())
    await db.sessions.insert_one({
        "session_id": session_token,
        "user_id": user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    })
    
    updated_user = await db.users.find_one({"user_id": user['user_id']}, {"_id": 0, "pin": 0})
    return {
        "success": True,
        "session_token": session_token,
        "user": updated_user
    }


@router.post("/users/{user_id}/first-login-setup")
async def complete_first_login_setup(user_id: str, request: Request, data: dict):
    """Complete first-time login setup for child - add email, phone, etc."""
    current_user = await get_current_user(request)
    
    # Verify user is updating their own profile
    if current_user['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="Can only update your own profile")
    
    updates = {
        "first_login": False,
        "tutorial_completed": True
    }
    
    if data.get('email'):
        # Validate email format
        import re
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', data['email']):
            raise HTTPException(status_code=400, detail="Invalid email format")
        updates['email'] = data['email']
    
    if data.get('phone'):
        # Basic phone validation
        phone = re.sub(r'\D', '', data['phone'])
        if len(phone) < 10:
            raise HTTPException(status_code=400, detail="Invalid phone number")
        updates['phone'] = data['phone']
    
    if data.get('picture'):
        updates['picture'] = data['picture']
    
    if data.get('theme'):
        updates['settings.theme'] = data['theme']
    
    await db.users.update_one({"user_id": user_id}, {"$set": updates})
    
    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0, "pin": 0})
    return {"success": True, "user": updated_user}

@router.put("/users/{user_id}/credentials")
async def update_child_credentials(user_id: str, request: Request, data: dict):
    """Parent updates a family member's profile info (name, username, password, PIN, email)"""
    current_user = await get_current_user(request)
    
    target_user = await db.users.find_one({"user_id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_parent = current_user['role'] == 'parent' and (
        target_user.get('parent_id') == current_user['user_id'] or
        target_user.get('family_id') == current_user.get('family_id')
    )
    is_self = current_user['user_id'] == user_id
    
    if not is_parent and not is_self:
        raise HTTPException(status_code=403, detail="Not authorized to modify this profile")
    
    updates = {}
    
    # Update name
    if data.get('name'):
        name = data['name'].strip()
        if len(name) < 1:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        updates['name'] = name
    
    # Update email (for future Google sign-in)
    if 'email' in data and data['email'] is not None:
        email = data['email'].strip()
        if email:
            existing = await db.users.find_one({"email": email, "user_id": {"$ne": user_id}})
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use by another account")
        updates['email'] = email
    
    # Update username
    if data.get('username'):
        username = data['username'].lower().strip()
        if not username.isalnum() or len(username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 alphanumeric characters")
        existing = await db.users.find_one({"username": username, "user_id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        updates['username'] = username
    
    # Update password
    if data.get('password'):
        import hashlib
        if len(data['password']) < 4:
            raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
        updates['password_hash'] = hashlib.sha256(data['password'].encode()).hexdigest()
    
    # Update PIN
    if data.get('pin'):
        if len(data['pin']) != 4 or not data['pin'].isdigit():
            raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")
        updates['pin'] = data['pin']
    
    if updates:
        await db.users.update_one({"user_id": user_id}, {"$set": updates})
    
    return {"success": True, "message": "Profile updated successfully"}

@router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can change roles")
    
    new_role = data.get('role')
    if new_role not in ['parent', 'child', 'member', 'homehub']:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'parent', 'child', 'member', or 'homehub'")
    
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

@router.put("/users/{user_id}")
async def update_user(user_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['user_id'] != user_id and current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    await db.users.update_one({"user_id": user_id}, {"$set": data})
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

# Parent can add or remove points from a child
@router.post("/users/{user_id}/points")
async def modify_child_points(user_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can modify points")
    
    child = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    
    amount = data.get('amount', 0)  # Positive to add, negative to remove
    reason = data.get('reason', '')
    
    # Update points (don't go below 0)
    new_points = max(0, (child.get('points', 0) + amount))
    await db.users.update_one({"user_id": user_id}, {"$set": {"points": new_points}})
    
    # Log the points change
    await db.points_history.insert_one({
        "log_id": f"points_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "changed_by": current_user['user_id'],
        "amount": amount,
        "reason": reason,
        "new_total": new_points,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"user_id": user_id, "points": new_points, "change": amount}

# Child nicknames
@router.put("/users/{user_id}/nickname")
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


@router.post("/users/{user_id}/upload-picture")
async def upload_profile_picture(user_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['user_id'] != user_id and current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    content_type = request.headers.get('content-type', '')
    
    if 'multipart/form-data' in content_type:
        # Handle FormData upload
        form = await request.form()
        file = form.get('file')
        image_type = form.get('type', 'profile')
        
        if file:
            import base64
            contents = await file.read()
            image_data = f"data:image/jpeg;base64,{base64.b64encode(contents).decode()}"
        else:
            raise HTTPException(status_code=400, detail="No file provided")
    else:
        # Handle JSON upload
        data = await request.json()
        image_data = data.get('image')
        image_type = data.get('type', 'profile')
        
        if not image_data:
            raise HTTPException(status_code=400, detail="No image data provided")
    
    update_field = 'picture' if image_type == 'profile' else 'profile_background'
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {update_field: image_data}}
    )
    
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

# General image upload endpoint
@router.post("/upload/image")
async def upload_image(request: Request):
    await get_current_user(request)  # validates auth
    
    content_type = request.headers.get('content-type', '')
    
    if 'multipart/form-data' in content_type:
        form = await request.form()
        file = form.get('file')
        
        if file:
            import base64
            contents = await file.read()
            image_data = f"data:image/jpeg;base64,{base64.b64encode(contents).decode()}"
            return {"url": image_data, "success": True}
        else:
            raise HTTPException(status_code=400, detail="No file provided")
    else:
        data = await request.json()
        image_data = data.get('image')
        if image_data:
            return {"url": image_data, "success": True}
        raise HTTPException(status_code=400, detail="No image data provided")


@router.delete("/users/{user_id}")
async def delete_user_profile(user_id: str, request: Request):
    """Fully delete a user profile and all associated data (parent only, or self-delete)"""
    current_user = await get_current_user(request)
    
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Authorization: parent can delete children in their family, or user deletes themselves
    is_self = current_user['user_id'] == user_id
    is_parent_of_target = (
        current_user['role'] == 'parent' and
        target_user.get('parent_id') == current_user['user_id']
    )
    
    if not is_self and not is_parent_of_target:
        raise HTTPException(status_code=403, detail="Only parents can delete child profiles, or delete your own profile")
    
    # Delete all associated data across collections
    await db.family_memberships.delete_many({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.messages.delete_many({"user_id": user_id})
    await db.notifications.delete_many({"user_id": user_id})
    await db.checkins.delete_many({"user_id": user_id})
    await db.achievements.delete_many({"user_id": user_id})
    await db.reading_logs.delete_many({"user_id": user_id})
    await db.points_history.delete_many({"user_id": user_id})
    await db.push_queue.delete_many({"user_id": user_id})
    
    # Unassign chores
    await db.chores.update_many(
        {"assigned_to": user_id},
        {"$set": {"assigned_to": None}}
    )
    
    # Delete the user document
    await db.users.delete_one({"user_id": user_id})
    
    return {"success": True, "message": f"Profile for {target_user.get('name', 'user')} has been completely deleted"}


# Pixie AI Onboarding - Get onboarding steps

