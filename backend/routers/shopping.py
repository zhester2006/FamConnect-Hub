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

@router.get("/shopping")
async def get_shopping_list(request: Request):
    await get_current_user(request)  # validates auth
    items = await db.shopping_items.find({}, {"_id": 0}).to_list(1000)
    return {"items": items}

@router.post("/shopping")
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
    
    # If child created item, notify parent it needs approval
    if current_user['role'] == 'child':
        parent_id = current_user.get('parent_id')
        if parent_id:
            notif = {
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": parent_id,
                "type": "shopping_pending",
                "title": "Shopping Item Request",
                "message": f"{current_user.get('name', 'A family member')} wants to add '{data['name']}' to the shopping list",
                "data": {"item_id": item_id},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notif)
    
    return await db.shopping_items.find_one({"item_id": item_id}, {"_id": 0})

@router.put("/shopping/{item_id}")
async def update_shopping_item(item_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent' and data.get('status') == 'approved':
        raise HTTPException(status_code=403, detail="Only parents can approve items")
    
    item = await db.shopping_items.find_one({"item_id": item_id}, {"_id": 0})
    
    await db.shopping_items.update_one({"item_id": item_id}, {"$set": data})
    
    # Notify requester about approval/denial
    new_status = data.get('status')
    if new_status in ['approved', 'rejected'] and item and item.get('requested_by'):
        requester_id = item['requested_by']
        if requester_id != current_user['user_id']:
            notif = {
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": requester_id,
                "type": "shopping_decision",
                "title": f"Shopping Item {'Approved' if new_status == 'approved' else 'Denied'}",
                "message": f"Your request for '{item.get('name', 'item')}' was {'approved' if new_status == 'approved' else 'denied'}",
                "data": {"item_id": item_id, "status": new_status},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notif)
    
    return await db.shopping_items.find_one({"item_id": item_id}, {"_id": 0})

@router.delete("/shopping/{item_id}")
async def delete_shopping_item(item_id: str, request: Request):
    await get_current_user(request)  # validates auth
    result = await db.shopping_items.delete_one({"item_id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}

# Family Wall

