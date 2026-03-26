from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, File, Form
from emergentintegrations.llm.chat import LlmChat, UserMessage
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

@router.post("/dinner/suggest")
async def suggest_dinner(request: Request, data: dict):
    await get_current_user(request)
    
    ingredients = data.get('ingredients', '')
    preferences = data.get('preferences', '')
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"dinner_{uuid.uuid4().hex[:8]}",
        system_message="You are a family cooking assistant. ALWAYS respond with valid JSON only, no markdown."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Suggest a family-friendly dinner meal.
Ingredients available: {ingredients if ingredients else 'any'}
Preferences: {preferences if preferences else 'none'}

IMPORTANT: Respond ONLY with a JSON object (no markdown, no code blocks):
{{
  "meal_name": "Chicken Stir Fry",
  "description": "Quick Asian-style stir fry with fresh veggies",
  "prep_time": "15 min",
  "cook_time": "20 min",
  "ingredients": ["chicken breast", "bell peppers", "broccoli", "soy sauce", "garlic", "ginger", "rice"],
  "steps": ["Cut chicken into strips", "Stir fry vegetables", "Add sauce and serve over rice"]
}}

Keep meal name short (2-5 words). List 5-10 ingredients."""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    structured = None
    try:
        clean = response.strip()
        if clean.startswith('```'):
            clean = clean.split('```')[1]
            if clean.startswith('json'):
                clean = clean[4:]
            clean = clean.strip()
        structured = json.loads(clean)
    except:
        structured = None
    
    return {"suggestion": response, "structured": structured}

# AI Assistant endpoint with structured output
@router.post("/ai/meal-plan")
async def ai_meal_plan(request: Request, data: dict):
    """Get structured AI meal suggestion with ingredients for shopping list"""
    await get_current_user(request)
    
    preferences = data.get('preferences', '')
    servings = data.get('servings', 4)
    meal_type = data.get('meal_type', 'dinner')  # breakfast, lunch, dinner, snack
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"meal_{uuid.uuid4().hex[:8]}",
        system_message="You are a helpful family meal planning assistant. Always respond in valid JSON format."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Suggest a family-friendly {meal_type} for {servings} people.
Preferences: {preferences if preferences else 'none specified'}

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{{
  "meal_name": "Name of the meal",
  "description": "Brief 1-2 sentence description",
  "prep_time": "15 mins",
  "cook_time": "30 mins",
  "servings": {servings},
  "difficulty": "Easy",
  "ingredients": [
    {{"name": "ingredient name", "amount": "2 cups", "category": "produce"}},
    {{"name": "another ingredient", "amount": "1 lb", "category": "meat"}}
  ],
  "steps": [
    "Step 1 instruction",
    "Step 2 instruction"
  ],
  "tips": ["Helpful tip 1", "Helpful tip 2"],
  "nutrition": {{"calories": "350 per serving", "protein": "25g"}}
}}"""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    # Try to parse as JSON, fallback to text
    import json
    try:
        # Clean the response - remove markdown code blocks if present
        clean_response = response.strip()
        if clean_response.startswith('```'):
            clean_response = clean_response.split('```')[1]
            if clean_response.startswith('json'):
                clean_response = clean_response[4:]
        parsed = json.loads(clean_response)
        return {"success": True, "meal": parsed}
    except:
        return {"success": False, "suggestion": response}


@router.post("/dinner/weekly-plan")
async def create_weekly_meal_plan(request: Request, data: dict):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    family_size = data.get('family_size', 4)
    preferences = data.get('preferences', '')
    budget = data.get('budget', 'moderate')
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"mealplan_{uuid.uuid4().hex[:8]}",
        system_message="You are a family meal planning assistant. ALWAYS respond with valid JSON only, no markdown."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Create a weekly dinner plan for a family of {family_size}.
Preferences: {preferences if preferences else 'Family-friendly meals'}
Budget: {budget}

IMPORTANT: Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{{
  "days": [
    {{
      "day": "Monday",
      "meal_name": "Grilled Chicken Tacos",
      "description": "Quick and flavorful tacos with seasoned chicken",
      "prep_time": "15 min",
      "cook_time": "20 min",
      "ingredients": ["chicken breast", "taco shells", "lettuce", "tomatoes", "cheese", "sour cream", "taco seasoning"]
    }},
    {{
      "day": "Tuesday",
      "meal_name": "Pasta Bolognese",
      "description": "Classic Italian meat sauce over spaghetti",
      "prep_time": "10 min",
      "cook_time": "30 min",
      "ingredients": ["ground beef", "spaghetti", "tomato sauce", "onion", "garlic", "olive oil", "parmesan"]
    }}
  ]
}}

Include ALL 7 days Monday through Sunday. Keep meal names short (2-5 words). List 5-8 key ingredients per meal."""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    # Parse structured JSON response
    structured_plan = None
    try:
        clean = response.strip()
        if clean.startswith('```'):
            clean = clean.split('```')[1]
            if clean.startswith('json'):
                clean = clean[4:]
            clean = clean.strip()
        structured_plan = json.loads(clean)
    except:
        structured_plan = None
    
    # Store the meal plan
    plan_id = f"mealplan_{uuid.uuid4().hex[:12]}"
    plan_doc = {
        "plan_id": plan_id,
        "family_id": family_id,
        "week_start": datetime.now(timezone.utc).date().isoformat(),
        "plan": response,
        "structured_plan": structured_plan,
        "preferences": preferences,
        "budget": budget,
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.meal_plans.insert_one(plan_doc)
    
    return {
        "plan_id": plan_id,
        "plan": response,
        "structured_plan": structured_plan
    }

# Get pantry summary for dinner planner
@router.get("/dinner/pantry-summary")
async def get_pantry_for_dinner(request: Request):
    """Get a summary of pantry items organized for meal planning"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    items = await db.pantry.find(
        {"family_id": family_id, "quantity": {"$gt": 0}},
        {"_id": 0, "name": 1, "category": 1, "quantity": 1}
    ).to_list(100)
    
    # Group by category
    by_category = {}
    for item in items:
        cat = item.get('category', 'other')
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(item)
    
    # Count totals
    protein_count = len(by_category.get('meat', []))
    produce_count = len(by_category.get('produce', []))
    grains_count = len(by_category.get('grains', []))
    dairy_count = len(by_category.get('dairy', []))
    
    return {
        "total_items": len(items),
        "categories": by_category,
        "summary": {
            "protein": protein_count,
            "produce": produce_count,
            "grains": grains_count,
            "dairy": dairy_count,
        },
        "item_names": [item['name'] for item in items]
    }

# Get saved meal plans
@router.get("/dinner/plans")
async def get_meal_plans(request: Request):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    plans = await db.meal_plans.find(
        {"family_id": family_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {"plans": plans}

# ===== Dinner Schedule =====

@router.get("/dinner/schedule")
async def get_dinner_schedule(request: Request, week_start: Optional[str] = None):
    """Get the dinner schedule for the week"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    if not week_start:
        today = datetime.now(timezone.utc).date()
        # Find Monday of current week
        monday = today - timedelta(days=today.weekday())
        week_start = monday.isoformat()
    
    sunday = (datetime.fromisoformat(week_start) + timedelta(days=6)).date().isoformat()
    
    schedule = await db.dinner_schedule.find(
        {"family_id": family_id, "date": {"$gte": week_start, "$lte": sunday}},
        {"_id": 0}
    ).sort("date", 1).to_list(7)
    
    return {"schedule": schedule, "week_start": week_start}


@router.post("/dinner/schedule")
async def add_to_dinner_schedule(request: Request, data: dict):
    """Add meals to the dinner schedule and auto-create calendar events"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    meals = data.get('meals', [])  # [{date: "2026-03-26", meal_name: "Pasta Night", description: "..."}]
    added = []
    
    for meal in meals:
        date = meal.get('date')
        meal_name = meal.get('meal_name', '').strip()
        if not date or not meal_name:
            continue
        
        schedule_id = f"ds_{uuid.uuid4().hex[:12]}"
        doc = {
            "schedule_id": schedule_id,
            "family_id": family_id,
            "date": date,
            "meal_name": meal_name,
            "description": meal.get('description', ''),
            "added_by": current_user['user_id'],
            "added_by_name": current_user.get('name', ''),
            "source": meal.get('source', 'manual'),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Upsert — replace existing meal for that date
        await db.dinner_schedule.update_one(
            {"family_id": family_id, "date": date},
            {"$set": doc},
            upsert=True
        )
        
        # Auto-create calendar event for the meal
        event_id = f"event_dinner_{date.replace('-', '')}"
        event_doc = {
            "event_id": event_id,
            "family_id": family_id,
            "title": f"Dinner: {meal_name}",
            "description": meal.get('description', ''),
            "event_date": date,
            "event_time": "18:00",
            "event_type": "meal",
            "created_by": current_user['user_id'],
            "created_by_name": current_user.get('name', ''),
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.events.update_one(
            {"event_id": event_id},
            {"$set": event_doc},
            upsert=True
        )
        
        added.append({"schedule_id": schedule_id, "date": date, "meal_name": meal_name})
    
    return {"added": added, "count": len(added)}


@router.delete("/dinner/schedule/{date}")
async def remove_from_dinner_schedule(date: str, request: Request):
    """Remove a meal from the dinner schedule"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    await db.dinner_schedule.delete_one({"family_id": family_id, "date": date})
    # Also remove the auto-created calendar event
    event_id = f"event_dinner_{date.replace('-', '')}"
    await db.events.delete_one({"event_id": event_id})
    
    return {"message": "Removed from schedule"}


@router.put("/dinner/schedule/{date}")
async def update_dinner_schedule(date: str, request: Request, data: dict):
    """Update a meal in the dinner schedule (rename, change description)"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    update_fields = {}
    if 'meal_name' in data:
        update_fields['meal_name'] = data['meal_name']
    if 'description' in data:
        update_fields['description'] = data['description']
    
    if not update_fields:
        return {"error": "Nothing to update"}
    
    await db.dinner_schedule.update_one(
        {"family_id": family_id, "date": date},
        {"$set": update_fields}
    )
    
    # Update the calendar event too
    event_id = f"event_dinner_{date.replace('-', '')}"
    event_update = {}
    if 'meal_name' in update_fields:
        event_update['title'] = f"Dinner: {update_fields['meal_name']}"
    if 'description' in update_fields:
        event_update['description'] = update_fields['description']
    if event_update:
        await db.events.update_one({"event_id": event_id}, {"$set": event_update})
    
    return {"message": "Updated", "date": date}


@router.post("/dinner/schedule/move")
async def move_dinner_schedule(request: Request, data: dict):
    """Move a meal from one date to another (swap if target has a meal)"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    from_date = data.get('from_date')
    to_date = data.get('to_date')
    if not from_date or not to_date or from_date == to_date:
        return {"error": "Invalid dates"}
    
    # Get both meals
    from_meal = await db.dinner_schedule.find_one({"family_id": family_id, "date": from_date}, {"_id": 0})
    to_meal = await db.dinner_schedule.find_one({"family_id": family_id, "date": to_date}, {"_id": 0})
    
    if not from_meal:
        return {"error": "No meal on source date"}
    
    # Move from_meal to to_date
    await db.dinner_schedule.update_one(
        {"family_id": family_id, "date": from_date},
        {"$set": {"date": to_date, "meal_name": from_meal['meal_name'], "description": from_meal.get('description', '')}}
    )
    # Update calendar event for from -> to
    old_event_id = f"event_dinner_{from_date.replace('-', '')}"
    new_event_id = f"event_dinner_{to_date.replace('-', '')}"
    await db.events.delete_one({"event_id": old_event_id})
    await db.events.update_one(
        {"event_id": new_event_id},
        {"$set": {
            "event_id": new_event_id, "family_id": family_id,
            "title": f"Dinner: {from_meal['meal_name']}", "description": from_meal.get('description', ''),
            "event_date": to_date, "event_time": "18:00", "event_type": "meal",
            "created_by": current_user['user_id'], "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    if to_meal:
        # Swap: move to_meal to from_date
        await db.dinner_schedule.update_one(
            {"family_id": family_id, "date": to_date, "meal_name": to_meal['meal_name']},
            {"$set": {"date": from_date}}
        )
        from_event_id = f"event_dinner_{from_date.replace('-', '')}"
        await db.events.update_one(
            {"event_id": from_event_id},
            {"$set": {
                "event_id": from_event_id, "family_id": family_id,
                "title": f"Dinner: {to_meal['meal_name']}", "description": to_meal.get('description', ''),
                "event_date": from_date, "event_time": "18:00", "event_type": "meal",
                "created_by": current_user['user_id'], "status": "approved",
                "created_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    else:
        # Just remove the old entry since we moved it
        await db.dinner_schedule.delete_one({"family_id": family_id, "date": from_date, "meal_name": from_meal['meal_name']})
    
    return {"message": "Moved", "from_date": from_date, "to_date": to_date, "swapped": to_meal is not None}


@router.post("/dinner/schedule/ai-fill")
async def ai_fill_schedule(request: Request, data: dict):
    """Get AI suggestions for unplanned days"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    preferences = data.get('preferences', '')
    unplanned_days = data.get('unplanned_days', [])  # ["2026-03-27", "2026-03-28"]
    
    if not unplanned_days:
        return {"suggestions": []}
    
    # Get already planned meals for context
    planned = await db.dinner_schedule.find(
        {"family_id": family_id},
        {"_id": 0, "meal_name": 1, "date": 1}
    ).sort("date", -1).limit(14).to_list(14)
    
    recent_meals = [p['meal_name'] for p in planned]
    
    day_names_map = {0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday', 5: 'Saturday', 6: 'Sunday'}
    day_labels = []
    for d in unplanned_days:
        try:
            dt = datetime.fromisoformat(d)
            day_labels.append(f"{day_names_map.get(dt.weekday(), 'Day')} ({d})")
        except:
            day_labels.append(d)
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"schedule_{uuid.uuid4().hex[:8]}",
        system_message="You are a family meal planner. Respond ONLY with valid JSON array."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Suggest dinner meals for these unplanned days: {', '.join(day_labels)}
Preferences: {preferences if preferences else 'Family-friendly'}
Recent meals to AVOID repeating: {', '.join(recent_meals[:7]) if recent_meals else 'none'}

Respond ONLY with a JSON array like this:
[
  {{"date": "2026-03-27", "meal_name": "Chicken Stir Fry", "description": "Quick and easy Asian-style stir fry with veggies"}},
  {{"date": "2026-03-28", "meal_name": "Taco Night", "description": "Build-your-own tacos with ground beef and fresh toppings"}}
]
Only include the dates I specified. Keep meal names short (2-4 words). Descriptions should be 1 sentence."""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    try:
        clean = response.strip()
        if clean.startswith('```'):
            clean = clean.split('```')[1]
            if clean.startswith('json'):
                clean = clean[4:]
        suggestions = json.loads(clean)
        return {"suggestions": suggestions}
    except:
        return {"suggestions": [], "raw": response}

# Get online family members
