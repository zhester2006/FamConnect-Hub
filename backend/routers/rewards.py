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

@router.get("/rewards")
async def get_rewards(request: Request):
    await get_current_user(request)
    rewards = await db.rewards.find({}, {"_id": 0}).to_list(100)
    return {"rewards": rewards}

@router.post("/rewards")
async def create_reward(request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can create rewards")
    
    reward_id = f"reward_{uuid.uuid4().hex[:12]}"
    reward_doc = {
        "reward_id": reward_id,
        "family_id": current_user['user_id'],
        "name": data['name'],
        "description": data.get('description'),
        "points_required": data['points_required'],
        "image_url": data.get('image_url'),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.rewards.insert_one(reward_doc)
    return await db.rewards.find_one({"reward_id": reward_id}, {"_id": 0})

@router.put("/rewards/{reward_id}")
async def update_reward(reward_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can modify rewards")
    
    update_data = {}
    if 'name' in data:
        update_data['name'] = data['name']
    if 'description' in data:
        update_data['description'] = data['description']
    if 'points_required' in data:
        update_data['points_required'] = data['points_required']
    if 'image_url' in data:
        update_data['image_url'] = data['image_url']
    
    await db.rewards.update_one({"reward_id": reward_id}, {"$set": update_data})
    return await db.rewards.find_one({"reward_id": reward_id}, {"_id": 0})

@router.delete("/rewards/{reward_id}")
async def delete_reward(reward_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can delete rewards")
    
    await db.rewards.delete_one({"reward_id": reward_id})
    return {"success": True}

@router.post("/rewards/{reward_id}/redeem")
async def redeem_reward(reward_id: str, request: Request):
    current_user = await get_current_user(request)
    reward = await db.rewards.find_one({"reward_id": reward_id}, {"_id": 0})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    if current_user['points'] < reward['points_required']:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    # Create pending redemption instead of immediately deducting points
    redemption_id = f"redemption_{uuid.uuid4().hex[:12]}"
    redemption = {
        "redemption_id": redemption_id,
        "reward_id": reward_id,
        "reward_name": reward['name'],
        "points_cost": reward['points_required'],
        "child_id": current_user['user_id'],
        "child_name": current_user.get('nickname') or current_user['name'],
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.redemptions.insert_one(redemption)
    
    return {"success": True, "message": "Redemption submitted for approval", "redemption_id": redemption_id}

# Alternative endpoint for reward redemption request
@router.post("/rewards/redeem")
async def redeem_reward_alt(request: Request):
    data = await request.json()
    reward_id = data.get('reward_id')
    current_user = await get_current_user(request)
    reward = await db.rewards.find_one({"reward_id": reward_id}, {"_id": 0})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    if current_user['points'] < reward['points_required']:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    redemption_id = f"redemption_{uuid.uuid4().hex[:12]}"
    redemption = {
        "redemption_id": redemption_id,
        "reward_id": reward_id,
        "reward_name": reward['name'],
        "points_cost": reward['points_required'],
        "child_id": current_user['user_id'],
        "child_name": current_user.get('nickname') or current_user['name'],
        "family_id": current_user.get('parent_id', current_user['user_id']),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.redemptions.insert_one(redemption)
    
    return {"success": True, "message": "Redemption submitted for approval"}

# Get pending redemptions (parent)
@router.get("/rewards/pending")
async def get_pending_redemptions(request: Request):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        return {"pending": []}
    
    pending = await db.redemptions.find(
        {"family_id": current_user['user_id'], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"pending": pending}

# Approve/deny redemption
@router.post("/rewards/redemptions/{redemption_id}/approve")
async def approve_redemption(redemption_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can approve redemptions")
    
    redemption = await db.redemptions.find_one({"redemption_id": redemption_id}, {"_id": 0})
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption not found")
    
    approved = data.get('approved', False)
    
    if approved:
        # Deduct points from child
        await db.users.update_one(
            {"user_id": redemption['child_id']},
            {"$inc": {"points": -redemption['points_cost']}}
        )
        await db.redemptions.update_one(
            {"redemption_id": redemption_id},
            {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.redemptions.update_one(
            {"redemption_id": redemption_id},
            {"$set": {"status": "denied", "denied_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"success": True, "status": "approved" if approved else "denied"}

# Tasks CRUD
@router.get("/tasks")
async def get_tasks(request: Request):
    current_user = await get_current_user(request)
    parent_id = current_user.get('parent_id', current_user['user_id'])
    
    # Get all family members for assignee lookup
    family_members = await db.users.find(
        {"$or": [{"user_id": parent_id}, {"parent_id": parent_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1, "picture": 1, "role": 1}
    ).to_list(100)
    # Sanitize pictures to prevent large base64 data
    member_map = {}
    for m in family_members:
        m['picture'] = sanitize_picture(m.get('picture'))
        member_map[m['user_id']] = m
    
    # Include all tasks including completed ones for history view
    tasks = await db.tasks.find(
        {"family_id": parent_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich tasks with assignee details (already sanitized)
    for task in tasks:
        assignee_id = task.get('assigned_to')
        if assignee_id and assignee_id in member_map:
            assignee = member_map[assignee_id]
            task['assignee_name'] = assignee.get('nickname') or assignee.get('name')
            task['assignee_picture'] = assignee.get('picture')
        
        completed_by_id = task.get('completed_by')
        if completed_by_id and completed_by_id in member_map:
            completer = member_map[completed_by_id]
            task['completed_by_name'] = completer.get('nickname') or completer.get('name')
            task['completed_by_picture'] = completer.get('picture')
        
        # Also add claimed_by_name for consistency
        claimed_by_id = task.get('claimed_by')
        if claimed_by_id and claimed_by_id in member_map:
            claimer = member_map[claimed_by_id]
            task['claimed_by_name'] = claimer.get('nickname') or claimer.get('name')
    
    return {"tasks": tasks}

@router.post("/tasks")
async def create_task(request: Request):
    data = await request.json()
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can create tasks")
    
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    task = {
        "task_id": task_id,
        "family_id": current_user['user_id'],
        "title": data['title'],
        "points": data.get('points', 10),
        "assigned_to": data.get('assigned_to'),  # Optional assignee
        "deadline": data.get('deadline'),
        "status": "pending",
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tasks.insert_one(task)
    
    return {"task_id": task_id, "success": True}

@router.post("/tasks/{task_id}/complete")
async def complete_task(task_id: str, request: Request):
    current_user = await get_current_user(request)
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if current_user['role'] == 'child':
        # Get child's name/nickname for display
        child_name = current_user.get('nickname') or current_user.get('name', 'Child')
        
        # Submit for approval
        await db.tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "status": "pending_approval",
                "completed_by": current_user['user_id'],
                "completed_by_name": child_name,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Parents complete instantly
        await db.tasks.update_one(
            {"task_id": task_id},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"success": True}

# Claim a task (child only) - reserves the task for this child
@router.post("/tasks/{task_id}/claim")
async def claim_task(task_id: str, request: Request):
    current_user = await get_current_user(request)
    
    if current_user['role'] != 'child':
        raise HTTPException(status_code=403, detail="Only children can claim tasks")
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if already claimed by someone else
    if task.get('claimed_by') and task['claimed_by'] != current_user['user_id']:
        raise HTTPException(status_code=400, detail="Task already claimed by another family member")
    
    child_name = current_user.get('nickname') or current_user.get('name', 'Child')
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "claimed_by": current_user['user_id'],
            "claimed_by_name": child_name,
            "claimed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": f"Task claimed by {child_name}"}

# Unclaim a task (child only)
@router.post("/tasks/{task_id}/unclaim")
async def unclaim_task(task_id: str, request: Request):
    current_user = await get_current_user(request)
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Only allow unclaim if this child claimed it
    if task.get('claimed_by') != current_user['user_id']:
        raise HTTPException(status_code=403, detail="You can only unclaim tasks you claimed")
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$unset": {"claimed_by": "", "claimed_by_name": "", "claimed_at": ""}}
    )
    
    return {"success": True}

# Approve task completion (parent only)
@router.put("/tasks/{task_id}/approve")
async def approve_task(task_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can approve tasks")
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    approved = data.get('approved', True)
    
    if approved:
        # Mark as approved and award points
        await db.tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "status": "approved",
                "approved_at": datetime.now(timezone.utc).isoformat(),
                "approved_by": current_user['user_id']
            }}
        )
        
        # Award points to the child who completed it
        if task.get('completed_by'):
            points = task.get('points', 0)
            if points > 0:
                await db.users.update_one(
                    {"user_id": task['completed_by']},
                    {"$inc": {"points": points}}
                )
    else:
        # Deny - reset task to available
        await db.tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "status": "available"
            },
            "$unset": {
                "completed_by": "",
                "completed_by_name": "",
                "completed_at": "",
                "claimed_by": "",
                "claimed_by_name": "",
                "claimed_at": ""
            }}
        )
    
    return {"success": True}

# Award points to child (parent only)
@router.post("/users/award-points")
async def award_points(request: Request):
    data = await request.json()
    current_user = await get_current_user(request)
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can award points")
    
    child_id = data.get('user_id')
    points = data.get('points', 0)
    reason = data.get('reason', 'Parent bonus')
    
    if points <= 0:
        raise HTTPException(status_code=400, detail="Points must be positive")
    
    child = await db.users.find_one({"user_id": child_id}, {"_id": 0})
    if not child or child.get('parent_id') != current_user['user_id']:
        raise HTTPException(status_code=404, detail="Child not found")
    
    await db.users.update_one(
        {"user_id": child_id},
        {"$inc": {"points": points}}
    )
    
    # Log the award
    await db.point_awards.insert_one({
        "award_id": f"award_{uuid.uuid4().hex[:12]}",
        "child_id": child_id,
        "child_name": child.get('nickname') or child['name'],
        "points": points,
        "reason": reason,
        "awarded_by": current_user['user_id'],
        "awarded_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "new_points": child.get('points', 0) + points}

# Leaderboard
@router.get("/leaderboard")
async def get_leaderboard(request: Request, timeframe: str = "all-time"):
    current_user = await get_current_user(request)
    parent_id = current_user.get('parent_id', current_user['user_id'])
    
    # Get all children
    children = await db.users.find(
        {"parent_id": parent_id, "role": "child"},
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1, "picture": 1, "points": 1, "badges": 1}
    ).to_list(100)
    
    # Sanitize pictures to prevent large base64 data in responses
    for child in children:
        child['picture'] = sanitize_picture(child.get('picture'))
    
    # If timeframe filter is applied, calculate points for that period
    if timeframe in ['this-week', 'this-month']:
        now = datetime.now(timezone.utc)
        
        if timeframe == 'this-week':
            # Get start of current week (Monday)
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        else:  # this-month
            # Get start of current month
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        start_date_str = start_date.isoformat()
        
        # Calculate points earned in this period from approved chores
        for child in children:
            period_points = 0
            
            # Get approved chores in the time period
            approved_chores = await db.chores.find({
                "assigned_to": child['user_id'],
                "status": "approved",
                "approved_at": {"$gte": start_date_str}
            }).to_list(1000)
            
            for chore in approved_chores:
                period_points += chore.get('points', 10)
            
            # Get points awarded in this period
            point_logs = await db.point_logs.find({
                "user_id": child['user_id'],
                "created_at": {"$gte": start_date_str}
            }).to_list(1000)
            
            for log in point_logs:
                period_points += log.get('amount', 0)
            
            child['period_points'] = period_points
        
        # Sort by period points
        children.sort(key=lambda x: x.get('period_points', 0), reverse=True)
    else:
        # Sort by total points (all-time)
        children.sort(key=lambda x: x.get('points', 0), reverse=True)
    
    return {"leaderboard": children, "timeframe": timeframe}

# Check-ins

