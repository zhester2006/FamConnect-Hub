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

@router.get("/onboarding/steps")
async def get_onboarding_steps(request: Request):
    current_user = await get_current_user(request)
    role = current_user.get('role', 'member')
    
    # Check if user has completed onboarding
    if current_user.get('settings', {}).get('onboarding_completed'):
        return {"completed": True, "steps": []}
    
    # Role-specific onboarding steps
    parent_steps = [
        {
            "step": 1,
            "title": "Welcome to FamFocus Hub!",
            "message": "Hey there! I'm Pixie, your family's AI assistant. I'm here to help you get the most out of FamFocus Hub. Let me show you around!",
            "target": None,
            "position": "center"
        },
        {
            "step": 2,
            "title": "Your Dashboard",
            "message": "This is your Parent Dashboard - your command center! Here you can see your children's activities, pending approvals, and manage the family.",
            "target": "parent-dashboard",
            "position": "bottom"
        },
        {
            "step": 3,
            "title": "Home Hub",
            "message": "The Home Hub is perfect for a quick family overview - weather, calendar, chores, and shopping list all in one place!",
            "target": "sidebar-home-hub",
            "position": "right"
        },
        {
            "step": 4,
            "title": "Manage Chores",
            "message": "Create and assign chores to your children. I can even help schedule them fairly using AI! Set point values to motivate everyone.",
            "target": "sidebar-dashboard",
            "position": "right"
        },
        {
            "step": 5,
            "title": "Safe Zones & Location",
            "message": "Set up safe zones like home and school. You'll get notified when your children leave these areas.",
            "target": "sidebar-location",
            "position": "right"
        },
        {
            "step": 6,
            "title": "Rewards Shop",
            "message": "Create rewards that children can earn with their points. It's a great way to motivate good behavior!",
            "target": "sidebar-rewards",
            "position": "right"
        },
        {
            "step": 7,
            "title": "You're All Set!",
            "message": "That's the basics! Explore the app and remember - I'm always here in the Family Wall with daily inspiration. Have fun with your family!",
            "target": None,
            "position": "center"
        }
    ]
    
    child_steps = [
        {
            "step": 1,
            "title": "Welcome to FamFocus Hub!",
            "message": "Hey there, superstar! I'm Pixie, and I'm going to help you explore FamFocus Hub. It's going to be fun!",
            "target": None,
            "position": "center"
        },
        {
            "step": 2,
            "title": "Your Space",
            "message": "This is YOUR space! See your daily missions (chores), earn points, and check your progress.",
            "target": "child-space",
            "position": "bottom"
        },
        {
            "step": 3,
            "title": "Complete Chores, Earn Points!",
            "message": "When you finish a chore, mark it complete. Your parents will approve it, and you'll earn points!",
            "target": "today-missions",
            "position": "bottom"
        },
        {
            "step": 4,
            "title": "Rewards Shop",
            "message": "Spend your hard-earned points on awesome rewards! Check out what's available.",
            "target": "sidebar-rewards",
            "position": "right"
        },
        {
            "step": 5,
            "title": "Family Chat",
            "message": "Chat with your family in real-time! Share updates, ask questions, or just say hi.",
            "target": "sidebar-chat",
            "position": "right"
        },
        {
            "step": 6,
            "title": "Reading Log",
            "message": "Love reading? Log your books here and share summaries with your parents!",
            "target": "sidebar-reading",
            "position": "right"
        },
        {
            "step": 7,
            "title": "You're Ready!",
            "message": "That's it! Go complete some missions, earn points, and have fun with your family!",
            "target": None,
            "position": "center"
        }
    ]
    
    return {
        "completed": False,
        "steps": parent_steps if role == 'parent' else child_steps,
        "total_steps": 7
    }

# Mark onboarding complete
@router.post("/onboarding/complete")
async def complete_onboarding(request: Request):
    current_user = await get_current_user(request)
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"settings.onboarding_completed": True}}
    )
    
    return {"success": True}

# Reset onboarding (for testing)
@router.post("/onboarding/reset")
async def reset_onboarding(request: Request):
    current_user = await get_current_user(request)
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"settings.onboarding_completed": False}}
    )
    
    return {"success": True}

# Enhanced Dinner Planner with weekly meal planning and Pantry sync

@router.get("/family/online")
async def get_online_members(request: Request):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    online_members = await db.users.find(
        {
            "$or": [
                {"user_id": family_id},
                {"parent_id": family_id}
            ],
            "online_status": True
        },
        {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "last_seen": 1}
    ).to_list(50)
    
    return {"online": online_members}

# ==================== ANALYTICS ====================

@router.get("/analytics/overview")
async def get_analytics_overview(request: Request):
    """Get family analytics overview"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    # Get all family members
    members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0}
    ).to_list(20)
    
    children = [m for m in members if m.get('role') == 'child']
    
    # Get chore completion stats
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()
    
    # Weekly chores
    weekly_chores = await db.chores.find({
        "family_id": family_id,
        "created_at": {"$gte": week_ago}
    }, {"_id": 0}).to_list(500)
    
    weekly_completed = len([c for c in weekly_chores if c.get('status') == 'completed'])
    weekly_total = len(weekly_chores)
    
    # Monthly chores
    monthly_chores = await db.chores.find({
        "family_id": family_id,
        "created_at": {"$gte": month_ago}
    }, {"_id": 0}).to_list(2000)
    
    monthly_completed = len([c for c in monthly_chores if c.get('status') == 'completed'])
    monthly_total = len(monthly_chores)
    
    # Points by child
    child_stats = []
    for child in children:
        child_chores = [c for c in monthly_chores if c.get('assigned_to') == child['user_id']]
        completed = len([c for c in child_chores if c.get('status') == 'completed'])
        total_points = sum(c.get('points', 0) for c in child_chores if c.get('status') == 'completed')
        
        child_stats.append({
            "user_id": child['user_id'],
            "name": child.get('nickname') or child['name'],
            "display_name": child.get('nickname') or child['name'],
            "chores_completed": completed,
            "chores_total": len(child_chores),
            "completion_rate": round((completed / len(child_chores) * 100) if child_chores else 0, 1),
            "points_earned": total_points
        })
    
    # Daily activity for the past 7 days
    daily_activity = []
    for i in range(7):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        
        day_chores = [c for c in weekly_chores if day_start <= c.get('created_at', '') <= day_end]
        day_completed = len([c for c in day_chores if c.get('status') == 'completed'])
        
        daily_activity.append({
            "date": day.strftime("%Y-%m-%d"),
            "day": day.strftime("%a"),
            "completed": day_completed,
            "total": len(day_chores)
        })
    
    daily_activity.reverse()
    
    return {
        "weekly": {
            "completed": weekly_completed,
            "total": weekly_total,
            "completion_rate": round((weekly_completed / weekly_total * 100) if weekly_total else 0, 1)
        },
        "monthly": {
            "completed": monthly_completed,
            "total": monthly_total,
            "completion_rate": round((monthly_completed / monthly_total * 100) if monthly_total else 0, 1)
        },
        "children": child_stats,
        "daily_activity": daily_activity,
        "total_family_members": len(members),
        "total_children": len(children)
    }

@router.get("/analytics/trends")
async def get_analytics_trends(request: Request, days: int = 30):
    """Get points and activity trends over time"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).isoformat()
    
    # Get all chores in the period
    chores = await db.chores.find({
        "family_id": family_id,
        "created_at": {"$gte": start_date}
    }, {"_id": 0}).to_list(5000)
    
    # Group by week
    weeks = {}
    for chore in chores:
        if chore.get('created_at'):
            date = datetime.fromisoformat(chore['created_at'].replace('Z', '+00:00'))
            week_start = (date - timedelta(days=date.weekday())).strftime("%Y-%m-%d")
            
            if week_start not in weeks:
                weeks[week_start] = {"completed": 0, "total": 0, "points": 0}
            
            weeks[week_start]["total"] += 1
            if chore.get('status') == 'completed':
                weeks[week_start]["completed"] += 1
                weeks[week_start]["points"] += chore.get('points', 0)
    
    trends = [{"week": k, **v} for k, v in sorted(weeks.items())]
    
    return {"trends": trends, "period_days": days}

# ==================== PANTRY SYSTEM ====================

# ==================== DATA EXPORT ====================

@router.get("/export/chores")
async def export_chores_csv(request: Request):
    """Export chores data as CSV"""
    current_user = await get_current_user(request)
    
    if current_user.get('role') != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can export data")
    
    family_id = current_user['user_id']
    
    # Get all chores
    chores = await db.chores.find(
        {"family_id": family_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(5000)
    
    # Get member names
    members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1}
    ).to_list(50)
    member_names = {m['user_id']: m.get('nickname') or m['name'] for m in members}
    
    # Build CSV
    csv_lines = ["Date,Chore,Assigned To,Status,Points"]
    for chore in chores:
        date = chore.get('created_at', '')[:10]
        name = chore.get('chore_name', chore.get('name', 'Unknown'))
        assigned = member_names.get(chore.get('assigned_to'), 'Unassigned')
        status = chore.get('status', 'pending')
        points = chore.get('points', 0)
        csv_lines.append(f'"{date}","{name}","{assigned}","{status}",{points}')
    
    csv_content = "\n".join(csv_lines)
    
    return {
        "filename": f"famfocus_chores_{datetime.now().strftime('%Y%m%d')}.csv",
        "content": csv_content,
        "mime_type": "text/csv"
    }

@router.get("/export/events")
async def export_events_csv(request: Request):
    """Export events data as CSV"""
    current_user = await get_current_user(request)
    
    if current_user.get('role') != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can export data")
    
    family_id = current_user['user_id']
    
    events = await db.events.find(
        {"family_id": family_id},
        {"_id": 0}
    ).sort("start_date", -1).to_list(2000)
    
    csv_lines = ["Date,Title,Type,Time,Created By"]
    for event in events:
        date = event.get('start_date', event.get('date', ''))[:10]
        title = event.get('title', 'Untitled')
        event_type = event.get('event_type', 'event')
        time = event.get('event_time', '')
        created_by = event.get('created_by_name', '')
        csv_lines.append(f'"{date}","{title}","{event_type}","{time}","{created_by}"')
    
    csv_content = "\n".join(csv_lines)
    
    return {
        "filename": f"famfocus_events_{datetime.now().strftime('%Y%m%d')}.csv",
        "content": csv_content,
        "mime_type": "text/csv"
    }

@router.get("/export/full")
async def export_all_data(request: Request):
    """Export all family data as JSON"""
    current_user = await get_current_user(request)
    
    if current_user.get('role') != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can export data")
    
    family_id = current_user['user_id']
    
    # Get all family data
    members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0, "password_hash": 0}
    ).to_list(50)
    
    chores = await db.chores.find({"family_id": family_id}, {"_id": 0}).to_list(5000)
    events = await db.events.find({"family_id": family_id}, {"_id": 0}).to_list(2000)
    rewards = await db.rewards.find({"family_id": family_id}, {"_id": 0}).to_list(100)
    reading_logs = await db.reading_logs.find({"family_id": family_id}, {"_id": 0}).to_list(1000)
    
    export_data = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "family_id": family_id,
        "members": members,
        "chores": chores,
        "events": events,
        "rewards": rewards,
        "reading_logs": reading_logs
    }
    
    return {
        "filename": f"famfocus_full_export_{datetime.now().strftime('%Y%m%d')}.json",
        "content": export_data,
        "mime_type": "application/json"
    }


# ==================== WELCOME TUTORIAL ====================

@router.get("/tutorial/content")
async def get_tutorial_content(request: Request):
    """Get welcome tutorial content - updated with all new features"""
    current_user = await get_current_user(request)
    role = current_user.get('role', 'member')
    
    # Check if user has seen the tutorial
    if current_user.get('settings', {}).get('tutorial_completed'):
        return {"completed": True, "slides": []}
    
    parent_slides = [
        {
            "id": 1,
            "title": "Welcome to FamFocus Hub!",
            "description": "Your family's command center for organizing tasks, events, meals, and rewards. Let's take a quick tour!",
            "image": "welcome",
            "icon": "home"
        },
        {
            "id": 2,
            "title": "Home Hub Dashboard",
            "description": "See everything at a glance - weather, calendar, chores, shopping list, and quick actions all in one place.",
            "image": "dashboard",
            "icon": "layout-dashboard"
        },
        {
            "id": 3,
            "title": "Smart Chore Management",
            "description": "Create custom chores with AI-generated icons, set points, and let AI schedule them fairly. Approve kids' completed tasks to award points!",
            "image": "chores",
            "icon": "check-circle"
        },
        {
            "id": 4,
            "title": "Family Calendar & Approvals",
            "description": "Track events and appointments. Kids can add events that need your approval before appearing on the calendar.",
            "image": "calendar",
            "icon": "calendar"
        },
        {
            "id": 5,
            "title": "Rewards & Task System",
            "description": "Create rewards for kids to redeem. Kids can claim tasks from the Earn tab, complete them, and wait for your approval to earn points.",
            "image": "rewards",
            "icon": "gift"
        },
        {
            "id": 6,
            "title": "Dinner Planner & Pantry",
            "description": "AI suggests weekly meals based on your pantry! Manage food inventory and add missing ingredients directly to your shopping list.",
            "image": "chores",
            "icon": "restaurant"
        },
        {
            "id": 7,
            "title": "Shopping List & Approvals",
            "description": "Collaborative shopping list. Items added by kids need your approval. Add ingredients from dinner plans with one tap!",
            "image": "dashboard",
            "icon": "cart"
        },
        {
            "id": 8,
            "title": "Family Wall & Chat",
            "description": "Share posts, photos, and polls on the Family Wall. Real-time chat keeps everyone connected!",
            "image": "chat",
            "icon": "chatbubbles"
        },
        {
            "id": 9,
            "title": "Family Management",
            "description": "Share your family code to add members. Manage roles and permissions for each family member.",
            "image": "dashboard",
            "icon": "people"
        },
        {
            "id": 10,
            "title": "Location & Safety",
            "description": "Set up safe zones and get notified when kids arrive or leave important locations.",
            "image": "location",
            "icon": "map-pin"
        },
        {
            "id": 11,
            "title": "Meet Pixie - AI Assistant",
            "description": "Ask Pixie anything! Get help with meal planning, chore scheduling, or daily inspiration including Bible quotes.",
            "image": "welcome",
            "icon": "sparkles"
        },
        {
            "id": 12,
            "title": "You're All Set!",
            "description": "Start by inviting family members with your family code. Have fun organizing your family life!",
            "image": "complete",
            "icon": "party-popper"
        }
    ]
    
    child_slides = [
        {
            "id": 1,
            "title": "Welcome to FamFocus Hub!",
            "description": "Your own space to complete missions, earn points, and claim awesome rewards!",
            "image": "welcome",
            "icon": "rocket"
        },
        {
            "id": 2,
            "title": "Your Daily Missions",
            "description": "Check your chores and mark them complete. Parents will approve and you'll earn points!",
            "image": "missions",
            "icon": "target"
        },
        {
            "id": 3,
            "title": "Claim Tasks & Earn Points",
            "description": "Go to Rewards → Earn tab to claim tasks. Complete them to earn bonus points!",
            "image": "points",
            "icon": "trophy"
        },
        {
            "id": 4,
            "title": "Rewards Shop",
            "description": "Spend your hard-earned points on cool rewards your parents have set up!",
            "image": "rewards",
            "icon": "gift"
        },
        {
            "id": 5,
            "title": "Reading Log",
            "description": "Submit book summaries to earn extra points. Parents will review and approve them!",
            "image": "dashboard",
            "icon": "book"
        },
        {
            "id": 6,
            "title": "Shopping & Calendar",
            "description": "Add items to the shopping list or events to the calendar. They'll be sent to your parents for approval!",
            "image": "calendar",
            "icon": "calendar"
        },
        {
            "id": 7,
            "title": "Family Wall",
            "description": "Share updates, photos, and vote on family polls. Stay connected with everyone!",
            "image": "chat",
            "icon": "chatbubbles"
        },
        {
            "id": 8,
            "title": "Ask Pixie for Help",
            "description": "Tap the magic button to chat with Pixie, your AI helper! Get homework help, fun facts, or daily inspiration.",
            "image": "welcome",
            "icon": "sparkles"
        },
        {
            "id": 9,
            "title": "Ready to Go, Superstar!",
            "description": "Start completing missions and climbing the leaderboard. Good luck! 🌟",
            "image": "complete",
            "icon": "star"
        }
    ]
    
    return {
        "completed": False,
        "slides": parent_slides if role == 'parent' else child_slides,
        "total_slides": len(parent_slides if role == 'parent' else child_slides)
    }

@router.post("/tutorial/complete")
async def complete_tutorial(request: Request):
    """Mark tutorial as completed"""
    current_user = await get_current_user(request)
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"settings.tutorial_completed": True}}
    )
    
    return {"success": True}

@router.post("/tutorial/reset")
async def reset_tutorial(request: Request):
    """Reset tutorial for testing"""
    current_user = await get_current_user(request)
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"settings.tutorial_completed": False}}
    )
    
    return {"success": True}

# ==================== BATTERY STATUS ====================

@router.post("/battery/update")
async def update_battery_status(request: Request, data: dict):
    """Update user's battery status (called from child's device)"""
    current_user = await get_current_user(request)
    
    battery_level = data.get('level')  # 0-100
    is_charging = data.get('is_charging', False)
    
    if battery_level is None or not (0 <= battery_level <= 100):
        raise HTTPException(status_code=400, detail="Invalid battery level")
    
    # Check if user has granted permission to share battery
    if not current_user.get('permissions', {}).get('share_battery', False):
        return {"success": False, "message": "Battery sharing not enabled"}
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {
            "battery": {
                "level": battery_level,
                "is_charging": is_charging,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }}
    )
    
    # Create notification if battery is critically low
    if battery_level <= 15 and not is_charging:
        parent_id = current_user.get('parent_id')
        if parent_id:
            await db.notifications.insert_one({
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "type": "battery_low",
                "user_id": parent_id,
                "family_id": parent_id,
                "message": f"{current_user['name']}'s battery is critically low ({battery_level}%)",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    return {"success": True, "level": battery_level}

@router.get("/battery/family")
async def get_family_battery_status(request: Request):
    """Get battery status for all family members (parents only)"""
    current_user = await get_current_user(request)
    
    if current_user.get('role') != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can view family battery status")
    
    family_id = current_user['user_id']
    
    # Get all children with battery sharing enabled
    children = await db.users.find(
        {
            "parent_id": family_id,
            "permissions.share_battery": True
        },
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1, "picture": 1, "battery": 1}
    ).to_list(20)
    
    battery_status = []
    for child in children:
        battery = child.get('battery', {})
        battery_status.append({
            "user_id": child['user_id'],
            "name": child.get('nickname') or child['name'],
            "picture": child.get('picture'),
            "level": battery.get('level'),
            "is_charging": battery.get('is_charging', False),
            "updated_at": battery.get('updated_at'),
            "is_stale": battery.get('updated_at') and (
                datetime.now(timezone.utc) - datetime.fromisoformat(battery['updated_at'].replace('Z', '+00:00'))
            ).total_seconds() > 3600  # Stale if older than 1 hour
        })
    
    return {"battery_status": battery_status}

@router.put("/permissions/battery")
async def toggle_battery_permission(request: Request, data: dict):
    """Toggle battery sharing permission"""
    current_user = await get_current_user(request)
    
    share_battery = data.get('share_battery', False)
    
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"permissions.share_battery": share_battery}}
    )
    
    return {"success": True, "share_battery": share_battery}

@router.get("/permissions")
async def get_permissions(request: Request):
    """Get user's permission settings"""
    current_user = await get_current_user(request)
    
    return {
        "permissions": current_user.get('permissions', {
            "share_battery": False,
            "share_location": True
        })
    }


# ==================== BUG REPORTS & SUGGESTIONS ====================

@router.post("/bug-reports")
async def submit_bug_report(request: Request, data: dict):
    """Submit a bug report from the mobile app with device info and logs"""
    try:
        current_user = await get_current_user(request)
        user_id = current_user['user_id']
        user_role = current_user.get('role', 'unknown')
        user_email = current_user.get('email', '')
        user_name = current_user.get('nickname') or current_user.get('name', 'User')
    except Exception:
        # Allow anonymous bug reports if user is not authenticated
        user_id = data.get('user_id', 'anonymous')
        user_role = data.get('user_role', 'unknown')
        user_email = data.get('email', '')
        user_name = data.get('name', 'User')
    
    report_id = f"bug_{uuid.uuid4().hex[:12]}"
    
    report_doc = {
        "report_id": report_id,
        "user_id": user_id,
        "user_role": user_role,
        "user_email": user_email,
        "user_name": user_name,
        "description": data.get('description', ''),
        "steps_to_reproduce": data.get('steps_to_reproduce', ''),
        "device_info": data.get('device_info', {}),
        "logs": data.get('logs', []),
        "app_version": data.get('app_version', '1.0.0'),
        "status": "new",  # new, investigating, resolved, closed
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bug_reports.insert_one(report_doc)
    
    # Send email to admin
    if ADMIN_EMAIL:
        device_info = data.get('device_info', {})
        admin_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">🐛 New Bug Report</h2>
            <p><strong>Report ID:</strong> {report_id}</p>
            <p><strong>From:</strong> {user_name} ({user_role})</p>
            <p><strong>App Version:</strong> {data.get('app_version', '1.0.0')}</p>
            <hr style="border: 1px solid #e5e7eb;">
            <h3>Description:</h3>
            <p style="background: #f3f4f6; padding: 12px; border-radius: 8px;">{data.get('description', 'No description provided')}</p>
            <h3>Steps to Reproduce:</h3>
            <p style="background: #f3f4f6; padding: 12px; border-radius: 8px;">{data.get('steps_to_reproduce', 'Not provided')}</p>
            <h3>Device Info:</h3>
            <ul>
                <li>OS: {device_info.get('os', 'Unknown')} {device_info.get('osVersion', '')}</li>
                <li>Device: {device_info.get('brand', '')} {device_info.get('modelName', '')}</li>
            </ul>
        </div>
        """
        await send_email_async(ADMIN_EMAIL, f"[FamFocus] Bug Report: {report_id}", admin_html)
    
    # Send thank you email to user
    if user_email:
        user_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">FamFocus Hub</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
                <h2 style="color: #1f2937;">Thank You for Your Bug Report! 🙏</h2>
                <p style="color: #4b5563; line-height: 1.6;">
                    Hi {user_name},
                </p>
                <p style="color: #4b5563; line-height: 1.6;">
                    We've received your bug report and our team is on it! Your feedback helps us make FamFocus Hub better for everyone.
                </p>
                <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; border-left: 4px solid #6366f1;">
                    <p style="margin: 0; color: #1e40af;"><strong>Report ID:</strong> {report_id}</p>
                </div>
                <p style="color: #4b5563; line-height: 1.6; margin-top: 20px;">
                    We'll investigate this issue and work on a fix. Thank you for helping us improve!
                </p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    With gratitude,<br>
                    <strong>The FamFocus Team</strong> 💜
                </p>
            </div>
        </div>
        """
        await send_email_async(user_email, "Thanks for your FamFocus Bug Report!", user_html)
    
    return {"report_id": report_id, "message": "Bug report submitted successfully. Thank you!"}

@router.post("/suggestions")
async def submit_suggestion(request: Request, data: dict):
    """Submit a suggestion/feature request from the mobile app"""
    try:
        current_user = await get_current_user(request)
        user_id = current_user['user_id']
        user_role = current_user.get('role', 'unknown')
        user_email = current_user.get('email', '')
        user_name = current_user.get('nickname') or current_user.get('name', 'User')
    except Exception:
        # Allow anonymous suggestions if user is not authenticated
        user_id = data.get('user_id', 'anonymous')
        user_role = data.get('user_role', 'unknown')
        user_email = data.get('email', '')
        user_name = data.get('name', 'User')
    
    suggestion_id = f"sug_{uuid.uuid4().hex[:12]}"
    
    suggestion_doc = {
        "suggestion_id": suggestion_id,
        "user_id": user_id,
        "user_role": user_role,
        "user_email": user_email,
        "user_name": user_name,
        "title": data.get('title', ''),
        "description": data.get('description', ''),
        "category": data.get('category', 'general'),  # general, feature, improvement, other
        "app_version": data.get('app_version', '1.0.0'),
        "status": "new",  # new, under_review, planned, implemented, declined
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.suggestions.insert_one(suggestion_doc)
    
    # Send email to admin
    if ADMIN_EMAIL:
        admin_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">💡 New Suggestion</h2>
            <p><strong>Suggestion ID:</strong> {suggestion_id}</p>
            <p><strong>From:</strong> {user_name} ({user_role})</p>
            <p><strong>Category:</strong> {data.get('category', 'general').title()}</p>
            <hr style="border: 1px solid #e5e7eb;">
            <h3>{data.get('title', 'Untitled Suggestion')}</h3>
            <p style="background: #f3f4f6; padding: 12px; border-radius: 8px;">{data.get('description', 'No description provided')}</p>
        </div>
        """
        await send_email_async(ADMIN_EMAIL, f"[FamFocus] Suggestion: {data.get('title', suggestion_id)}", admin_html)
    
    # Send thank you email to user
    if user_email:
        user_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">FamFocus Hub</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
                <h2 style="color: #1f2937;">We Love Your Idea! 💡</h2>
                <p style="color: #4b5563; line-height: 1.6;">
                    Hi {user_name},
                </p>
                <p style="color: #4b5563; line-height: 1.6;">
                    Thank you so much for sharing your suggestion with us! Ideas like yours help shape the future of FamFocus Hub.
                </p>
                <div style="background: #ecfdf5; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
                    <p style="margin: 0 0 8px 0; color: #065f46;"><strong>Your Suggestion:</strong></p>
                    <p style="margin: 0; color: #047857;">{data.get('title', 'Your suggestion')}</p>
                </div>
                <p style="color: #4b5563; line-height: 1.6; margin-top: 20px;">
                    Our team will review your idea and consider it for future updates. We truly appreciate your input in making FamFocus Hub the best it can be for families everywhere!
                </p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    With appreciation,<br>
                    <strong>The FamFocus Team</strong> 💚
                </p>
            </div>
        </div>
        """
        await send_email_async(user_email, "Thanks for your FamFocus Suggestion!", user_html)
    
    return {"suggestion_id": suggestion_id, "message": "Suggestion submitted successfully. Thank you for your feedback!"}

@router.get("/suggestions")
async def get_suggestions(request: Request, status: Optional[str] = None, category: Optional[str] = None):
    """Get suggestions (parent/admin only)"""
    current_user = await get_current_user(request)
    
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can view suggestions")
    
    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    
    suggestions = await db.suggestions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"suggestions": suggestions}

@router.get("/bug-reports")
async def get_bug_reports(request: Request, status: Optional[str] = None):
    """Get bug reports (parent/admin only)"""
    current_user = await get_current_user(request)
    
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can view bug reports")
    
    query = {}
    if status:
        query["status"] = status
    
    reports = await db.bug_reports.find(query, {"_id": 0, "logs": 0}).sort("created_at", -1).to_list(100)
    return {"reports": reports}

@router.put("/bug-reports/{report_id}")
async def update_bug_report(report_id: str, request: Request, data: dict):
    """Update bug report status (parent/admin only)"""
    current_user = await get_current_user(request)
    
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can update bug reports")
    
    update_data = {}
    if 'status' in data:
        update_data['status'] = data['status']
    if 'notes' in data:
        update_data['admin_notes'] = data['notes']
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    update_data['updated_by'] = current_user['user_id']
    
    await db.bug_reports.update_one({"report_id": report_id}, {"$set": update_data})
    return await db.bug_reports.find_one({"report_id": report_id}, {"_id": 0})

# Reset tutorial/onboarding for dev users
@router.post("/dev/reset-tutorial")
async def dev_reset_tutorial(request: Request):
    """Reset tutorial completion status to show onboarding again"""
    # Reset for ALL users (dev endpoint)
    result = await db.users.update_many(
        {},
        {"$set": {"settings.tutorial_completed": False, "settings.onboarding_completed": False}}
    )
    
    return {"success": True, "message": f"Tutorial reset for {result.modified_count} users. Restart app to see onboarding."}

# Sample data endpoint
@router.post("/dev/populate-sample-data")
async def populate_sample_data(request: Request):
    """Populate database with sample data for testing"""
    current_user = await get_current_user(request)
    parent_id = current_user['user_id'] if current_user['role'] == 'parent' else current_user.get('parent_id')
    
    # Sample rewards
    sample_rewards = [
        {"name": "30 min Screen Time", "description": "Extra gaming or TV time", "points_required": 50},
        {"name": "Ice Cream Trip", "description": "Trip to get ice cream", "points_required": 100},
        {"name": "Stay Up 30 min", "description": "Stay up past bedtime", "points_required": 75},
        {"name": "Movie Night Pick", "description": "Choose the family movie", "points_required": 80},
        {"name": "Toy Store Trip", "description": "$10 to spend at toy store", "points_required": 200},
    ]
    
    for r in sample_rewards:
        existing = await db.rewards.find_one({"family_id": parent_id, "name": r["name"]})
        if not existing:
            await db.rewards.insert_one({
                "reward_id": f"reward_{uuid.uuid4().hex[:12]}",
                "family_id": parent_id,
                **r,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Sample tasks
    sample_tasks = [
        {"title": "Read for 20 minutes", "points": 15},
        {"title": "Help with dinner", "points": 20},
        {"title": "Practice instrument", "points": 25},
        {"title": "Help sibling with homework", "points": 30},
    ]
    
    for t in sample_tasks:
        existing = await db.tasks.find_one({"family_id": parent_id, "title": t["title"]})
        if not existing:
            await db.tasks.insert_one({
                "task_id": f"task_{uuid.uuid4().hex[:12]}",
                "family_id": parent_id,
                **t,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Sample chores
    children = await db.users.find({"parent_id": parent_id, "role": "child"}, {"_id": 0}).to_list(10)
    sample_chores = ["Wash dishes", "Take out trash", "Clean room", "Feed pet", "Vacuum living room"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    for i, chore_name in enumerate(sample_chores):
        if children:
            child = children[i % len(children)]
            existing = await db.chores.find_one({"family_id": parent_id, "title": chore_name, "scheduled_date": today})
            if not existing:
                await db.chores.insert_one({
                    "chore_id": f"chore_{uuid.uuid4().hex[:12]}",
                    "family_id": parent_id,
                    "title": chore_name,
                    "assigned_to": child['user_id'],
                    "assigned_to_name": child.get('nickname') or child['name'],
                    "scheduled_date": today,
                    "points": (i + 1) * 5,
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
    
    # Sample calendar events
    sample_events = [
        {"title": "Soccer Practice", "type": "event", "time": "16:00"},
        {"title": "Team Meeting", "type": "work", "time": "10:00"},
        {"title": "Doctor Appointment", "type": "appointment", "time": "14:30"},
        {"title": "Submit Project", "type": "task", "time": "17:00"},
    ]
    
    for event in sample_events:
        existing = await db.calendar_events.find_one({"family_id": parent_id, "title": event["title"], "date": today})
        if not existing:
            await db.calendar_events.insert_one({
                "event_id": f"event_{uuid.uuid4().hex[:12]}",
                "family_id": parent_id,
                "title": event["title"],
                "type": event["type"],
                "date": today,
                "time": event["time"],
                "created_by": current_user['user_id'],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Sample shopping items
    sample_items = [
        {"name": "Milk", "status": "approved"},
        {"name": "Bread", "status": "approved"},
        {"name": "Apples", "status": "pending"},
        {"name": "Cereal", "status": "approved"},
    ]
    
    for item in sample_items:
        existing = await db.shopping_items.find_one({"family_id": parent_id, "name": item["name"]})
        if not existing:
            await db.shopping_items.insert_one({
                "item_id": f"item_{uuid.uuid4().hex[:12]}",
                "family_id": parent_id,
                "name": item["name"],
                "status": item["status"],
                "added_by": current_user['user_id'],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    return {"success": True, "message": "Sample data populated successfully"}


