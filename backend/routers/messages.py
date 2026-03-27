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

@router.get("/messages")
async def get_messages(request: Request):
    await get_current_user(request)
    messages = await db.messages.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    
    # Sanitize user pictures to prevent large base64 data
    for msg in messages:
        msg['user_picture'] = sanitize_picture(msg.get('user_picture'), fallback_name=msg.get('user_name'))
    
    return {"messages": messages}

@router.post("/messages")
async def send_message(request: Request, data: dict):
    current_user = await get_current_user(request)
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    family_id = current_user.get('parent_id', current_user['user_id'])
    user_name = current_user.get('nickname') or current_user.get('name')
    
    message_doc = {
        "message_id": message_id,
        "family_id": family_id,
        "user_id": current_user['user_id'],
        "user_name": user_name,
        "user_picture": sanitize_picture(current_user.get('picture'), fallback_name=user_name),
        "content": data['content'],
        "encrypted_content": data.get('encrypted_content'),  # E2E encrypted content
        "media_url": data.get('media_url'),
        "media_type": data.get('media_type'),
        "read_by": [current_user['user_id']],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(message_doc)
    
    # Notify other family members about new message
    family_members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0, "user_id": 1}
    ).to_list(100)
    
    sender_name = current_user.get('nickname') or current_user.get('name', 'Someone')
    for member in family_members:
        if member['user_id'] != current_user['user_id']:
            notification_doc = {
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": member['user_id'],
                "type": "chat_message",
                "title": "New Chat Message",
                "message": f"{sender_name}: {data['content'][:50]}{'...' if len(data['content']) > 50 else ''}",
                "data": {"message_id": message_id, "sender_id": current_user['user_id']},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification_doc)
    
    return await db.messages.find_one({"message_id": message_id}, {"_id": 0})

@router.put("/messages/{message_id}/read")
async def mark_message_read(message_id: str, request: Request):
    current_user = await get_current_user(request)
    await db.messages.update_one(
        {"message_id": message_id},
        {"$addToSet": {"read_by": current_user['user_id']}}
    )
    return {"success": True}

@router.post("/messages/{message_id}/react")
async def react_to_message(message_id: str, request: Request, data: dict):
    """Add or remove a reaction from a message"""
    current_user = await get_current_user(request)
    user_id = current_user['user_id']
    reaction_type = data.get('reaction')
    
    if not reaction_type:
        raise HTTPException(status_code=400, detail="Reaction type required")
    
    # Check if user has already reacted with this reaction
    message = await db.messages.find_one({"message_id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    reactions = message.get('reactions', {})
    reaction_users = reactions.get(reaction_type, [])
    
    if user_id in reaction_users:
        # Remove reaction
        await db.messages.update_one(
            {"message_id": message_id},
            {"$pull": {f"reactions.{reaction_type}": user_id}}
        )
    else:
        # Add reaction
        await db.messages.update_one(
            {"message_id": message_id},
            {"$addToSet": {f"reactions.{reaction_type}": user_id}}
        )
    
    return {"success": True}

@router.post("/messages/voice")
async def send_voice_message(request: Request, audio: UploadFile = File(...), duration: int = Form(0)):
    """Send a voice message"""
    current_user = await get_current_user(request)
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    
    # Save audio file
    audio_content = await audio.read()
    audio_base64 = base64.b64encode(audio_content).decode('utf-8')
    
    # In production, upload to cloud storage
    # For now, store as base64 data URL
    audio_url = f"data:audio/webm;base64,{audio_base64}"
    
    message_doc = {
        "message_id": message_id,
        "user_id": current_user['user_id'],
        "user_name": current_user.get('name', 'User'),
        "type": "voice",
        "content": "[Voice Message]",
        "audio_url": audio_url,
        "duration": duration,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read_by": [current_user['user_id']],
        "reactions": {}
    }
    
    await db.messages.insert_one(message_doc)
    return await db.messages.find_one({"message_id": message_id}, {"_id": 0})

@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, request: Request):
    """Delete a chat message - parents only"""
    current_user = await get_current_user(request)
    if current_user.get('role') != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can delete messages")
    result = await db.messages.delete_one({"message_id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Message deleted"}


# Events/Calendar

