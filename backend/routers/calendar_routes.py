from fastapi import APIRouter, HTTPException, Request, Response
from deps import db, get_current_user, get_session_token, sanitize_picture, generate_family_code, send_email_async, send_push_notification, check_geofences, ADMIN_EMAIL, resolve_acting_user
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

@router.get("/events")
async def get_events(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None, event_type: Optional[str] = None):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    # Get all family members for creator lookup
    family_members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1, "picture": 1, "role": 1}
    ).to_list(100)
    
    # Build member map with sanitized pictures
    member_map = {}
    for m in family_members:
        m['picture'] = sanitize_picture(m.get('picture'))
        member_map[m['user_id']] = m
    
    query = {"family_id": family_id}
    if start_date and end_date:
        query["event_date"] = {"$gte": start_date, "$lte": end_date}
    if event_type:
        query["event_type"] = event_type
    events = await db.events.find(query, {"_id": 0}).sort("event_date", 1).to_list(1000)
    
    # Enrich events with creator details and attendees
    for event in events:
        creator_id = event.get('created_by')
        if creator_id and creator_id in member_map:
            creator = member_map[creator_id]
            event['created_by_name'] = creator.get('nickname') or creator.get('name')
            event['created_by_picture'] = creator.get('picture')
        
        # Add assignee details if event has assigned_to field
        assignee_id = event.get('assigned_to')
        if assignee_id and assignee_id in member_map:
            assignee = member_map[assignee_id]
            event['assignee_name'] = assignee.get('nickname') or assignee.get('name')
            event['assignee_picture'] = assignee.get('picture')
    
    return {"events": events}

@router.post("/events")
async def create_event(request: Request, data: dict):
    current_user = await get_current_user(request)
    acting_user = await resolve_acting_user(current_user, data)
    event_id = f"event_{uuid.uuid4().hex[:12]}"
    is_parent = acting_user['role'] == 'parent'
    status = "approved" if is_parent else "pending"
    
    event_doc = {
        "event_id": event_id,
        "family_id": acting_user.get('parent_id', acting_user['user_id']),
        "title": data['title'],
        "description": data.get('description'),
        "event_date": data['event_date'],
        "event_time": data.get('event_time'),
        "event_type": data.get('event_type', 'appointment'),
        "work_start_time": data.get('work_start_time'),
        "work_end_time": data.get('work_end_time'),
        "assigned_to": data.get('assigned_to'),  # Optional assignee
        "created_by": acting_user['user_id'],
        "created_by_name": acting_user['name'],
        "created_by_picture": acting_user.get('picture'),
        "status": status,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.events.insert_one(event_doc)
    
    # Notify assigned user about new event
    assigned_to = data.get('assigned_to')
    if assigned_to and assigned_to != current_user['user_id']:
        notif = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": assigned_to,
            "type": "event_assigned",
            "title": "New Event",
            "message": f"You have a new event: '{data['title']}' on {data['event_date']}",
            "data": {"event_id": event_id},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notif)
    
    # If child created event, notify parent it needs approval
    if acting_user['role'] == 'child':
        parent_id = acting_user.get('parent_id')
        if parent_id:
            notif = {
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": parent_id,
                "type": "event_pending",
                "title": "Event Needs Approval",
                "message": f"{acting_user.get('name', 'A family member')} wants to add '{data['title']}' on {data['event_date']}",
                "data": {"event_id": event_id},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notif)
    
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    message = "Event added to calendar" if is_parent else "Event submitted for approval"
    return {"event": event, "message": message, "status": status, "submitted_by_name": acting_user.get('name')}

# Approve/Deny calendar event (parent only)
@router.put("/events/{event_id}/approve")
async def approve_event(event_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can approve events")
    
    approved = data.get('approved', True)
    status = "approved" if approved else "denied"
    
    update_data = {
        "status": status,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": current_user['user_id']
    }
    
    await db.events.update_one({"event_id": event_id}, {"$set": update_data})
    
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    
    # Send notification to event creator
    if event and event.get('created_by'):
        notification_doc = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": event['created_by'],
            "type": "event_approved" if approved else "event_denied",
            "title": f"Event {'Approved' if approved else 'Denied'}",
            "message": f"Your event '{event.get('title', 'Event')}' was {'approved' if approved else 'not approved'} by a parent.",
            "data": {"event_id": event_id, "approved": approved},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
    
    return event

# Get pending events (parent only)
@router.get("/events/pending")
async def get_pending_events(request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        return {"events": []}
    
    family_id = current_user['user_id']
    pending = await db.events.find(
        {"family_id": family_id, "status": "pending"},
        {"_id": 0}
    ).sort("event_date", 1).to_list(50)
    
    return {"events": pending}

# Work Schedule endpoint
@router.post("/events/work-schedule")
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

