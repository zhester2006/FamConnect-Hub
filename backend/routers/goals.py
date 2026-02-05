# Personal Goals Router
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/goals", tags=["goals"])

# Database and auth functions will be injected
db = None
get_current_user = None

def init_router(database, auth_func):
    global db, get_current_user
    db = database
    get_current_user = auth_func

@router.get("")
async def get_goals(request: Request):
    """Get user's personal goals"""
    current_user = await get_current_user(request)
    
    goals = await db.personal_goals.find(
        {"user_id": current_user['user_id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return {"goals": goals}

@router.post("")
async def create_goal(request: Request, data: dict):
    """Create a personal goal"""
    current_user = await get_current_user(request)
    
    goal_id = f"goal_{uuid.uuid4().hex[:12]}"
    
    goal = {
        "goal_id": goal_id,
        "user_id": current_user['user_id'],
        "title": data['title'],
        "description": data.get('description', ''),
        "target": data.get('target', 1),
        "current": 0,
        "type": data.get('type', 'custom'),
        "deadline": data.get('deadline'),
        "completed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.personal_goals.insert_one(goal)
    return await db.personal_goals.find_one({"goal_id": goal_id}, {"_id": 0})

@router.put("/{goal_id}")
async def update_goal(goal_id: str, request: Request, data: dict):
    """Update goal progress or details"""
    current_user = await get_current_user(request)
    
    goal = await db.personal_goals.find_one({"goal_id": goal_id, "user_id": current_user['user_id']})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    update_data = {}
    if 'current' in data:
        update_data['current'] = data['current']
        if data['current'] >= goal.get('target', 1):
            update_data['completed'] = True
            update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
    if 'title' in data:
        update_data['title'] = data['title']
    if 'description' in data:
        update_data['description'] = data['description']
    if 'target' in data:
        update_data['target'] = data['target']
    if 'deadline' in data:
        update_data['deadline'] = data['deadline']
    
    await db.personal_goals.update_one(
        {"goal_id": goal_id},
        {"$set": update_data}
    )
    
    return await db.personal_goals.find_one({"goal_id": goal_id}, {"_id": 0})

@router.delete("/{goal_id}")
async def delete_goal(goal_id: str, request: Request):
    """Delete a personal goal"""
    current_user = await get_current_user(request)
    
    result = await db.personal_goals.delete_one({
        "goal_id": goal_id,
        "user_id": current_user['user_id']
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    return {"success": True, "deleted": goal_id}

@router.post("/{goal_id}/increment")
async def increment_goal(goal_id: str, request: Request, data: dict = None):
    """Increment goal progress by 1 (or specified amount)"""
    current_user = await get_current_user(request)
    
    goal = await db.personal_goals.find_one({"goal_id": goal_id, "user_id": current_user['user_id']})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    increment = data.get('amount', 1) if data else 1
    new_current = goal.get('current', 0) + increment
    
    update_data = {"current": new_current}
    if new_current >= goal.get('target', 1):
        update_data['completed'] = True
        update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.personal_goals.update_one(
        {"goal_id": goal_id},
        {"$set": update_data}
    )
    
    return await db.personal_goals.find_one({"goal_id": goal_id}, {"_id": 0})
