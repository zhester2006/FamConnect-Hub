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

@router.post("/checkins")
async def create_checkin(request: Request, data: dict):
    current_user = await get_current_user(request)
    checkin_id = f"checkin_{uuid.uuid4().hex[:12]}"
    
    location_name = data.get('address') or data.get('location_name') or 'Unknown location'
    
    checkin_doc = {
        "checkin_id": checkin_id,
        "user_id": current_user['user_id'],
        "user_name": current_user['name'],
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "latitude": data['latitude'],
        "longitude": data['longitude'],
        "address": location_name,
        "is_offline_update": data.get('is_offline_update', False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.checkins.insert_one(checkin_doc)
    
    # Check geofences
    await check_geofences(current_user, data['latitude'], data['longitude'])
    
    # Notify parent of child check-in
    parent_id = current_user.get('parent_id')
    if current_user['role'] == 'child' and parent_id:
        notification_doc = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": parent_id,
            "type": "checkin",
            "title": "Child Check-in",
            "message": f"{current_user.get('nickname') or current_user.get('name', 'Child')} checked in at {location_name}",
            "data": {"checkin_id": checkin_id, "child_id": current_user['user_id'], "latitude": data['latitude'], "longitude": data['longitude']},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
    
    return await db.checkins.find_one({"checkin_id": checkin_id}, {"_id": 0})

@router.get("/checkins")
async def get_all_checkins(request: Request):
    """Get all check-ins for family members (parent only)"""
    current_user = await get_current_user(request)
    
    if current_user['role'] == 'parent':
        # Parents see all family check-ins
        family_id = current_user['user_id']
        # Get all children
        children = await db.users.find({"parent_id": family_id}, {"_id": 0, "user_id": 1}).to_list(20)
        child_ids = [c['user_id'] for c in children]
        
        checkins = await db.checkins.find(
            {"user_id": {"$in": child_ids}},
            {"_id": 0}
        ).sort("created_at", -1).limit(100).to_list(100)
    else:
        # Children only see their own
        checkins = await db.checkins.find(
            {"user_id": current_user['user_id']},
            {"_id": 0}
        ).sort("created_at", -1).limit(50).to_list(50)
    
    return {"checkins": checkins}

@router.get("/checkins/{user_id}")
async def get_user_checkins(user_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent' and current_user['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    checkins = await db.checkins.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    return {"checkins": checkins}

@router.get("/checkins/{user_id}/last")
async def get_last_checkin(user_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent' and current_user['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    checkin = await db.checkins.find_one({"user_id": user_id}, {"_id": 0}, sort=[("created_at", -1)])
    return checkin or {"error": "No checkins found"}

# Geofencing
@router.get("/geofences")
async def get_geofences(request: Request):
    current_user = await get_current_user(request)
    parent_id = current_user.get('parent_id', current_user['user_id'])
    geofences = await db.geofences.find({"family_id": parent_id}, {"_id": 0}).to_list(100)
    return {"geofences": geofences}

@router.post("/geofences")
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

@router.delete("/geofences/{geofence_id}")
async def delete_geofence(geofence_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can delete geofences")
    
    await db.geofences.delete_one({"geofence_id": geofence_id})
    return {"success": True}

# Geofence Alert from Mobile
@router.post("/location/geofence-alert")
async def geofence_alert(request: Request, data: dict):
    """Handle geofence enter/exit alerts from mobile app"""
    current_user = await get_current_user(request)
    
    geofence_id = data.get('geofence_id')
    entered = data.get('entered', False)
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    region_name = data.get('region_name', 'Unknown Zone')
    
    # Get geofence details
    geofence = await db.geofences.find_one({"geofence_id": geofence_id}, {"_id": 0})
    zone_name = geofence['name'] if geofence else region_name
    
    # Create alert record
    alert_doc = {
        "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
        "type": "enter" if entered else "exit",
        "user_id": current_user['user_id'],
        "child_name": current_user['name'],
        "geofence_id": geofence_id,
        "zone_name": zone_name,
        "latitude": latitude,
        "longitude": longitude,
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.location_alerts.insert_one(alert_doc)
    
    # Create notification for parents
    notification_doc = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "type": f"geofence_{'enter' if entered else 'exit'}",
        "user_id": current_user['user_id'],
        "user_name": current_user['name'],
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "message": f"{current_user['name']} {'entered' if entered else 'left'} {zone_name}",
        "geofence_name": zone_name,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    return {"success": True, "alert_id": alert_doc['alert_id']}

# Get Location Alerts
@router.get("/location/alerts")
async def get_location_alerts(request: Request):
    """Get recent location alerts for the family"""
    current_user = await get_current_user(request)
    parent_id = current_user.get('parent_id', current_user['user_id'])
    
    alerts = await db.location_alerts.find(
        {"family_id": parent_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(50).to_list(50)
    
    return {"alerts": alerts}

# Update User Location
@router.post("/location/update")
async def update_location(request: Request, data: dict):
    """Update user's current location"""
    current_user = await get_current_user(request)
    
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    
    if latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="Latitude and longitude required")
    
    # Update user's last known location
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {
            "$set": {
                "last_location": {
                    "latitude": latitude,
                    "longitude": longitude,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    return {"success": True, "message": "Location updated"}

# Get Family Member Locations (for parents)
@router.get("/location/family")
async def get_family_locations(request: Request):
    """Get location of all family members who share location"""
    current_user = await get_current_user(request)
    
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can view family locations")
    
    # Get all family members with location info
    members = await db.users.find(
        {"parent_id": current_user['user_id']},
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1, "picture": 1, "last_location": 1, "permissions": 1, "online_status": 1}
    ).to_list(100)
    
    # Filter to only those sharing location
    members_with_location = []
    for member in members:
        if member.get('permissions', {}).get('share_location', False):
            members_with_location.append({
                "user_id": member['user_id'],
                "name": member.get('nickname') or member['name'],
                "picture": member.get('picture'),
                "last_location": member.get('last_location'),
                "online_status": member.get('online_status', False)
            })
    
    return {"members": members_with_location}

# Get Family Battery Status (for parents)
@router.get("/battery/family-status")
async def get_family_battery_status(request: Request):
    """Get battery status for all family members"""
    current_user = await get_current_user(request)
    
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can view family battery status")
    
    # Get all family members with battery info
    members = await db.users.find(
        {"parent_id": current_user['user_id']},
        {"_id": 0, "user_id": 1, "name": 1, "battery": 1, "permissions": 1}
    ).to_list(100)
    
    # Filter to only those sharing battery
    members_with_battery = []
    for member in members:
        if member.get('permissions', {}).get('share_battery', False) and member.get('battery'):
            members_with_battery.append({
                "user_id": member['user_id'],
                "name": member['name'],
                "battery": member['battery']
            })
    
    return {"members": members_with_battery}

# GPS Status Notification
@router.post("/location/gps-disabled")
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

