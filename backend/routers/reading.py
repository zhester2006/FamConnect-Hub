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

@router.get("/reading-logs")
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

@router.post("/reading-logs")
async def create_reading_log(request: Request, data: dict):
    current_user = await get_current_user(request)
    log_id = f"log_{uuid.uuid4().hex[:12]}"
    
    # Accept either book_name or book_title from frontend
    book_title = data.get('book_name') or data.get('book_title', 'Untitled')
    
    log_doc = {
        "log_id": log_id,
        "user_id": current_user['user_id'],
        "user_name": current_user['name'],
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "book_name": book_title,
        "book_title": book_title,  # Store both for compatibility
        "pages_read": data.get('pages_read', 0),
        "reading_time": data.get('reading_time', 0),  # Accept reading_time from frontend
        "summary": data.get('summary', ''),
        "date": data.get('date', datetime.now(timezone.utc).date().isoformat()),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.reading_logs.insert_one(log_doc)
    return await db.reading_logs.find_one({"log_id": log_id}, {"_id": 0})

@router.put("/reading-logs/{log_id}/approve")
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

