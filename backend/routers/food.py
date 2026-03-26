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
    
    ingredients = data.get('ingredients', [])
    preferences = data.get('preferences', '')
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"dinner_{uuid.uuid4().hex[:8]}",
        system_message="You are a helpful cooking assistant for families."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Suggest a family-friendly dinner meal.
Ingredients available: {', '.join(ingredients) if ingredients else 'any'}
Preferences: {preferences}

Provide: meal name, ingredients list, and simple cooking instructions."""
    
    response = await chat.send_message(UserMessage(text=prompt))
    return {"suggestion": response}

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
    use_pantry = data.get('use_pantry', True)  # Whether to check pantry items
    
    # Get pantry items to suggest meals based on available ingredients
    pantry_items = []
    pantry_text = ""
    if use_pantry:
        items = await db.pantry.find(
            {"family_id": family_id, "quantity": {"$gt": 0}},
            {"_id": 0, "name": 1, "category": 1, "quantity": 1}
        ).to_list(100)
        
        pantry_items = [item['name'] for item in items]
        if pantry_items:
            by_category = {}
            for item in items:
                cat = item.get('category', 'other')
                if cat not in by_category:
                    by_category[cat] = []
                by_category[cat].append(f"{item['name']} ({item.get('quantity', 1)})")
            
            pantry_text = "\n".join([f"- {cat.title()}: {', '.join(items)}" for cat, items in by_category.items()])
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"mealplan_{uuid.uuid4().hex[:8]}",
        system_message="You are a helpful family meal planning assistant. Prioritize using available pantry items when possible."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Create a weekly dinner plan for a family of {family_size}.
Preferences: {preferences if preferences else 'Family-friendly meals'}
Budget: {budget}
"""
    
    if pantry_text:
        prompt += f"""
AVAILABLE IN PANTRY (prioritize using these):
{pantry_text}

Please create meals that USE these pantry ingredients when possible. Indicate which meals use pantry items.
"""
    
    prompt += """
For each day (Monday-Sunday), provide:
1. Meal name (mark with 🏠 if using pantry items)
2. Brief description
3. Estimated prep time
4. Key ingredients (mark pantry items with ✓)
5. Missing ingredients to buy

Format as a clear list for each day."""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    # Store the meal plan
    plan_id = f"mealplan_{uuid.uuid4().hex[:12]}"
    plan_doc = {
        "plan_id": plan_id,
        "family_id": family_id,
        "week_start": datetime.now(timezone.utc).date().isoformat(),
        "plan": response,
        "preferences": preferences,
        "budget": budget,
        "pantry_items_used": pantry_items[:20] if use_pantry else [],
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.meal_plans.insert_one(plan_doc)
    
    return {"plan_id": plan_id, "plan": response, "pantry_items_used": pantry_items[:20]}

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

# Get online family members
