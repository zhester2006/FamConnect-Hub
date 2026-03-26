from fastapi import APIRouter, HTTPException, Request, Response
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

# Push notification device registration
@router.post("/notifications/register-device")
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

@router.delete("/notifications/unregister-device")
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


@router.get("/notifications")
async def get_notifications(request: Request):
    current_user = await get_current_user(request)
    # Get notifications for the current user (by user_id OR family-wide notifications)
    user_id = current_user['user_id']
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    notifications = await db.notifications.find(
        {"$or": [
            {"user_id": user_id},  # Direct notifications to this user
            {"family_id": family_id, "user_id": {"$exists": False}},  # Family-wide notifications
        ]}, 
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return {"notifications": notifications}

@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark a notification as read"""
    current_user = await get_current_user(request)
    await db.notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {"read": True}}
    )
    return {"success": True}

@router.put("/notifications/read-all")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read for current user's family"""
    current_user = await get_current_user(request)
    parent_id = current_user.get('parent_id', current_user['user_id'])
    await db.notifications.update_many(
        {"family_id": parent_id},
        {"$set": {"read": True}}
    )
    return {"success": True}

@router.delete("/notifications/clear")
async def clear_all_notifications(request: Request):
    """Clear all notifications for current user's family"""
    current_user = await get_current_user(request)
    parent_id = current_user.get('parent_id', current_user['user_id'])
    await db.notifications.delete_many({"family_id": parent_id})
    return {"success": True}

@router.get("/notifications/unread-count")
async def get_unread_count(request: Request):
    """Get count of unread notifications"""
    current_user = await get_current_user(request)
    user_id = current_user['user_id']
    family_id = current_user.get('parent_id', current_user['user_id'])
    count = await db.notifications.count_documents({
        "$or": [
            {"user_id": user_id, "read": False},
            {"family_id": family_id, "user_id": {"$exists": False}, "read": False},
        ]
    })
    return {"unread_count": count}

@router.post("/push/subscribe")
async def subscribe_push(request: Request, data: dict):
    """Subscribe to web push notifications"""
    current_user = await get_current_user(request)
    subscription = data.get('subscription')
    if not subscription:
        raise HTTPException(status_code=400, detail="Subscription data required")
    await db.push_subscriptions.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {
            "user_id": current_user['user_id'],
            "subscription": subscription,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"success": True}

@router.delete("/push/unsubscribe")
async def unsubscribe_push(request: Request):
    """Unsubscribe from web push notifications"""
    current_user = await get_current_user(request)
    await db.push_subscriptions.delete_one({"user_id": current_user['user_id']})
    return {"success": True}

@router.get("/push/vapid-key")
async def get_vapid_key():
    """Get the public VAPID key for push notifications"""
    return {"publicKey": "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"}
