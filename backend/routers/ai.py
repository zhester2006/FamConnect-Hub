from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, File, Form
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText
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

@router.post("/ai/chore-tips")
async def ai_chore_tips(request: Request, data: dict):
    """Get AI tips for completing a chore"""
    await get_current_user(request)
    
    chore_title = data.get('title', '')
    child_age = data.get('child_age', 10)
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"tips_{uuid.uuid4().hex[:8]}",
        system_message="You are a friendly family assistant helping children with chores."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Give 3-4 quick, helpful tips for a {child_age}-year-old to complete this chore: "{chore_title}"

Make tips:
- Fun and encouraging
- Age-appropriate
- Practical and actionable

Keep each tip to 1-2 sentences."""
    
    response = await chat.send_message(UserMessage(text=prompt))
    return {"tips": response}

@router.post("/ai/family-activity")
async def ai_family_activity(request: Request, data: dict):
    """Get AI-suggested family activities"""
    await get_current_user(request)
    
    num_kids = data.get('num_kids', 2)
    ages = data.get('ages', [])
    weather = data.get('weather', 'any')
    duration = data.get('duration', '1-2 hours')
    indoor_outdoor = data.get('setting', 'any')
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"activity_{uuid.uuid4().hex[:8]}",
        system_message="You are a family activity planner. Respond ONLY with valid JSON."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Suggest 3 fun family activities.
Family: {num_kids} kids (ages: {', '.join(map(str, ages)) if ages else 'various'})
Weather: {weather}
Duration: {duration}
Setting preference: {indoor_outdoor}

Respond in this JSON format:
{{
  "activities": [
    {{
      "name": "Activity name",
      "description": "Brief description",
      "duration": "1 hour",
      "setting": "indoor/outdoor",
      "supplies_needed": ["item1", "item2"],
      "fun_factor": "High"
    }}
  ]
}}"""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    import json
    try:
        clean_response = response.strip()
        if clean_response.startswith('```'):
            clean_response = clean_response.split('```')[1]
            if clean_response.startswith('json'):
                clean_response = clean_response[4:]
        parsed = json.loads(clean_response)
        return {"success": True, "data": parsed}
    except Exception:
        return {"success": False, "suggestion": response}

@router.post("/ai/pixie")
async def pixie_assistant(request: Request, data: dict):
    """Pixie - The family's AI assistant that can help with various questions and uses weather for activity suggestions"""
    current_user = await get_current_user(request)
    
    message = data.get('message', '')
    # Use nickname if available, otherwise use name
    user_name = current_user.get('nickname') or current_user.get('name', 'Friend')
    user_role = current_user.get('role', 'child')
    context = data.get('context', [])
    lat = data.get('lat')
    lng = data.get('lng')
    
    # Get family members to reference by nickname
    family_id = current_user.get('family_id') or current_user.get('parent_id', current_user['user_id'])
    family_members = await db.users.find(
        {"$or": [{"family_id": family_id}, {"parent_id": family_id}, {"user_id": family_id}]},
        {"_id": 0, "name": 1, "nickname": 1, "role": 1}
    ).to_list(20)
    family_names = ", ".join([m.get('nickname') or m.get('name', 'Unknown') for m in family_members])
    
    # Fetch weather data if location available or if message seems to be about activities/weather
    weather_info = ""
    activity_keywords = ['activity', 'activities', 'do today', 'outside', 'weather', 'play', 'fun', 'weekend', 'plans']
    should_include_weather = any(kw in message.lower() for kw in activity_keywords)
    
    if should_include_weather:
        try:
            # Try to get weather - use default location if not provided
            weather_lat = lat or 40.7128  # Default to NYC
            weather_lng = lng or -74.0060
            
            weather_api_key = os.environ.get('OPENWEATHER_API_KEY', '')
            if weather_api_key:
                weather_url = f"https://api.openweathermap.org/data/2.5/weather?lat={weather_lat}&lon={weather_lng}&appid={weather_api_key}&units=imperial"
                async with httpx.AsyncClient() as client:
                    weather_resp = await client.get(weather_url, timeout=5)
                    if weather_resp.status_code == 200:
                        w = weather_resp.json()
                        temp = w.get('main', {}).get('temp', 70)
                        desc = w.get('weather', [{}])[0].get('description', 'clear')
                        weather_info = f"\n\nCurrent Weather: {temp:.0f}°F, {desc}. "
                        if temp < 40:
                            weather_info += "It's cold outside - suggest indoor activities."
                        elif temp > 85:
                            weather_info += "It's hot - suggest water activities or indoor fun."
                        elif 'rain' in desc.lower():
                            weather_info += "It's rainy - suggest indoor activities."
                        else:
                            weather_info += "Nice weather for outdoor activities!"
            else:
                # Simulated weather if no API key
                weather_info = "\n\nCurrent Weather: Around 72°F, partly cloudy. Great for outdoor or indoor activities!"
        except Exception as e:
            print(f"Weather fetch for Pixie failed: {e}")
            weather_info = ""
    
    # Build context from previous messages
    context_str = ""
    if context:
        # Handle both dict format and string format for context
        context_items = []
        for m in context[-3:]:
            if isinstance(m, dict):
                role = 'User' if m.get('role') == 'user' else 'Pixie'
                content = m.get('content', str(m))
                context_items.append(f"{role}: {content}")
            elif isinstance(m, str):
                context_items.append(m)
        context_str = "\n".join(context_items)
    
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"pixie_{uuid.uuid4().hex[:8]}",
        system_message=f"""You are Pixie, a friendly and helpful AI assistant for families in the FamFocus Hub app. 
You have a warm, encouraging personality and love helping families.
You're talking to {user_name} who is a {user_role}.
Family members: {family_names}
{weather_info}

Your capabilities:
- Suggest family dinner ideas
- Recommend family activities (consider weather when suggesting outdoor vs indoor)
- Provide homework help and study tips
- Give chore tips and motivation
- Offer parenting advice (for parents)
- Share fun facts and educational content
- Help with scheduling and organization
- Reference family members by their nicknames when relevant

Personality traits:
- Friendly and warm (use emojis occasionally)
- Encouraging and positive
- Age-appropriate in your responses
- Helpful but concise (keep responses under 150 words)
- Sometimes playful with younger users
- When suggesting activities, mention the weather conditions

If asked about something you can't help with, kindly redirect to something you can help with."""
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Previous conversation:
{context_str}

User's message: {message}

Respond helpfully as Pixie:"""
    
    response = await chat.send_message(UserMessage(text=prompt))
    
    return {"response": response}

@router.post("/ai/pixie/proactive-suggestions")
async def pixie_proactive_suggestions(request: Request):
    """Pixie generates proactive suggestions based on family activity patterns"""
    current_user = await get_current_user(request)
    family_id = current_user.get('family_id') or current_user.get('parent_id', current_user['user_id'])

    # Gather family context
    pending_chores = await db.chores.find(
        {"family_id": family_id, "status": "pending"}, {"_id": 0, "title": 1, "assigned_to": 1, "scheduled_date": 1}
    ).to_list(10)
    upcoming_events = await db.events.find(
        {"family_id": family_id, "event_date": {"$gte": datetime.now(timezone.utc).strftime("%Y-%m-%d")}},
        {"_id": 0, "title": 1, "event_date": 1}
    ).sort("event_date", 1).to_list(5)
    family_members = await db.users.find(
        {"$or": [{"family_id": family_id}, {"parent_id": family_id}, {"user_id": family_id}]},
        {"_id": 0, "name": 1, "nickname": 1, "role": 1, "points": 1}
    ).to_list(20)
    recent_meals = await db.dinner_plans.find(
        {"family_id": family_id}, {"_id": 0, "meal_name": 1}
    ).sort("created_at", -1).to_list(5)

    today = datetime.now(timezone.utc).strftime("%A, %B %d")
    chore_summary = ", ".join([c['title'] for c in pending_chores[:5]]) or "None pending"
    events_summary = ", ".join([f"{e['title']} on {e['event_date']}" for e in upcoming_events[:3]]) or "No upcoming events"
    member_names = ", ".join([m.get('nickname') or m['name'] for m in family_members])
    meal_summary = ", ".join([m.get('meal_name', '') for m in recent_meals]) or "No recent meals"

    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"proactive_{uuid.uuid4().hex[:8]}",
        system_message="You are Pixie, the family AI assistant. Generate proactive, helpful suggestions. Respond ONLY with valid JSON."
    ).with_model("openai", "gpt-5.2")

    prompt = f"""Based on this family's current data, generate 3-4 proactive suggestions.

Today: {today}
Family members: {member_names}
Pending chores: {chore_summary}
Upcoming events: {events_summary}
Recent meals: {meal_summary}

Generate suggestions in this JSON format:
{{
  "suggestions": [
    {{
      "type": "chore" | "meal" | "activity" | "schedule",
      "icon": "emoji",
      "title": "Short title",
      "description": "1-2 sentence actionable suggestion",
      "priority": "high" | "medium" | "low"
    }}
  ]
}}"""

    response = await chat.send_message(UserMessage(text=prompt))
    try:
        clean = response.strip()
        if clean.startswith('```'):
            clean = clean.split('```')[1]
            if clean.startswith('json'):
                clean = clean[4:]
        parsed = json.loads(clean)
        return {"success": True, "suggestions": parsed.get("suggestions", [])}
    except Exception:
        return {"success": True, "suggestions": [
            {"type": "activity", "icon": "🌟", "title": "Family Game Night", "description": "It's a great evening for a board game! Gather the family for some quality time.", "priority": "medium"},
            {"type": "chore", "icon": "🧹", "title": "Quick Tidy Up", "description": "A 15-minute family cleanup before dinner can make the evening more relaxing.", "priority": "low"},
            {"type": "meal", "icon": "🍕", "title": "Try Something New", "description": "How about making homemade pizza together tonight?", "priority": "low"}
        ]}

@router.post("/ai/pixie/daily-digest")
async def pixie_daily_digest(request: Request):
    """Generate a personalized daily digest for the family"""
    current_user = await get_current_user(request)
    family_id = current_user.get('family_id') or current_user.get('parent_id', current_user['user_id'])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_display = datetime.now(timezone.utc).strftime("%A, %B %d")

    # Check cache — one digest per family per day
    cached = await db.daily_digests.find_one(
        {"family_id": family_id, "date": today}, {"_id": 0}
    )
    if cached:
        return {"success": True, "digest": cached["digest"], "cached": True}

    # Gather family data
    members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0, "user_id": 1, "name": 1, "nickname": 1, "role": 1, "points": 1}
    ).to_list(20)

    todays_chores = await db.chores.find(
        {"family_id": family_id, "scheduled_date": today}, {"_id": 0, "title": 1, "assigned_to": 1, "status": 1}
    ).to_list(20)

    todays_events = await db.events.find(
        {"family_id": family_id, "event_date": today}, {"_id": 0, "title": 1, "event_time": 1}
    ).to_list(10)

    recent_meals = await db.dinner_plans.find(
        {"family_id": family_id}, {"_id": 0, "meal_name": 1}
    ).sort("created_at", -1).to_list(3)

    # Build context strings
    member_info = []
    for m in members:
        name = m.get('nickname') or m['name']
        role = m.get('role', 'member')
        pts = m.get('points', 0)
        assigned = [c['title'] for c in todays_chores if c.get('assigned_to') == m['user_id']]
        member_info.append(f"- {name} ({role}, {pts} pts): chores today = {', '.join(assigned) or 'none'}")

    events_text = ", ".join([f"{e['title']} at {e.get('event_time','TBD')}" for e in todays_events]) or "No events today"
    meals_text = ", ".join([m.get('meal_name','') for m in recent_meals]) or "No recent meals planned"
    pending = sum(1 for c in todays_chores if c['status'] == 'pending')
    done = sum(1 for c in todays_chores if c['status'] == 'completed')

    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"digest_{uuid.uuid4().hex[:8]}",
        system_message="You are Pixie, a warm and encouraging family AI assistant. Generate a morning daily digest. Be concise, upbeat, and personal. Respond ONLY with valid JSON."
    ).with_model("openai", "gpt-5.2")

    prompt = f"""Generate a family daily digest for {today_display}.

Family members:
{chr(10).join(member_info)}

Today's events: {events_text}
Chores: {pending} pending, {done} completed
Recent meals: {meals_text}

Respond in this JSON format:
{{
  "greeting": "Good morning greeting for the family (1 sentence)",
  "overview": "Brief summary of what's happening today (2-3 sentences)",
  "member_highlights": [
    {{
      "name": "member name",
      "message": "personalized motivational message (1 sentence)",
      "emoji": "fitting emoji"
    }}
  ],
  "tip_of_day": "One practical family tip or fun activity idea (1 sentence)",
  "fun_fact": "A fun or inspiring fact to start the day (1 sentence)"
}}"""

    try:
        response = await chat.send_message(UserMessage(text=prompt))
        clean = response.strip()
        if clean.startswith('```'):
            clean = clean.split('```')[1]
            if clean.startswith('json'):
                clean = clean[4:]
        digest = json.loads(clean)
    except Exception:
        # Fallback digest
        digest = {
            "greeting": f"Good morning, family! Happy {today_display}!",
            "overview": f"You have {pending} chores to tackle and {len(todays_events)} events today. Let's make it a great day!",
            "member_highlights": [
                {"name": m.get('nickname') or m['name'], "message": "You're doing amazing — keep it up!", "emoji": "⭐"}
                for m in members[:4]
            ],
            "tip_of_day": "Try doing a 5-minute family stretch before starting the day — it's a great energy boost!",
            "fun_fact": "Families who eat together at least 3 times a week report feeling happier and more connected."
        }

    # Cache the digest
    await db.daily_digests.insert_one({
        "family_id": family_id,
        "date": today,
        "digest": digest,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # Create notification
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "type": "daily_digest",
        "family_id": family_id,
        "message": f"Pixie's Daily Digest: {digest.get('greeting', 'Good morning!')}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {"success": True, "digest": digest, "cached": False}

@router.post("/ai/voice-transcribe")
async def voice_transcribe(request: Request, audio: UploadFile = File(...)):
    """Transcribe audio to text using OpenAI Whisper"""
    await get_current_user(request)

    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    try:
        stt = OpenAISpeechToText(api_key=api_key)
        audio_bytes = await audio.read()

        import tempfile
        suffix = ".webm"
        if audio.content_type:
            ext_map = {
                "audio/webm": ".webm", "audio/wav": ".wav", "audio/mp3": ".mp3",
                "audio/mpeg": ".mp3", "audio/mp4": ".mp4", "audio/ogg": ".webm",
                "audio/m4a": ".m4a"
            }
            suffix = ext_map.get(audio.content_type, ".webm")

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        with open(tmp_path, "rb") as audio_file:
            response = await stt.transcribe(
                file=audio_file,
                model="whisper-1",
                response_format="json",
                language="en"
            )

        os.unlink(tmp_path)
        transcribed_text = response.text if hasattr(response, 'text') else str(response)
        return {"text": transcribed_text, "success": True}

    except Exception as e:
        logging.error(f"Voice transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.post("/ai/pixie/voice")
async def pixie_voice_command(request: Request, audio: UploadFile = File(...), context: str = Form(default="[]")):
    """Voice command for Pixie: transcribe audio then get Pixie's response"""
    current_user = await get_current_user(request)

    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    # Step 1: Transcribe
    try:
        stt = OpenAISpeechToText(api_key=api_key)
        audio_bytes = await audio.read()

        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        with open(tmp_path, "rb") as audio_file:
            stt_response = await stt.transcribe(
                file=audio_file,
                model="whisper-1",
                response_format="json",
                language="en"
            )

        os.unlink(tmp_path)
        transcribed_text = stt_response.text if hasattr(stt_response, 'text') else str(stt_response)

        if not transcribed_text.strip():
            return {"transcription": "", "response": "I couldn't hear anything. Could you try again?", "success": True}

    except Exception as e:
        logging.error(f"Voice transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    # Step 2: Send to Pixie
    user_name = current_user.get('nickname') or current_user.get('name', 'Friend')
    user_role = current_user.get('role', 'child')
    family_id = current_user.get('family_id') or current_user.get('parent_id', current_user['user_id'])

    family_members = await db.users.find(
        {"$or": [{"family_id": family_id}, {"parent_id": family_id}, {"user_id": family_id}]},
        {"_id": 0, "name": 1, "nickname": 1, "role": 1}
    ).to_list(20)
    family_names = ", ".join([m.get('nickname') or m.get('name', 'Unknown') for m in family_members])

    # Parse context
    try:
        ctx = json.loads(context) if context else []
    except Exception:
        ctx = []

    context_str = ""
    if ctx:
        context_items = []
        for m in ctx[-3:]:
            if isinstance(m, dict):
                role = 'User' if m.get('role') == 'user' else 'Pixie'
                content = m.get('content', str(m))
                context_items.append(f"{role}: {content}")
        context_str = "\n".join(context_items)

    chat = LlmChat(
        api_key=api_key,
        session_id=f"pixie_voice_{uuid.uuid4().hex[:8]}",
        system_message=f"""You are Pixie, a friendly and helpful AI assistant for families in the FamFocus Hub app.
You have a warm, encouraging personality and love helping families.
You're talking to {user_name} who is a {user_role}.
Family members: {family_names}

This message was sent via voice command - keep your response conversational and concise (under 100 words).

Your capabilities:
- Suggest family dinner ideas
- Recommend family activities
- Provide homework help and study tips
- Give chore tips and motivation
- Offer parenting advice (for parents)
- Share fun facts and educational content
- Help with scheduling and organization

Personality: Friendly, warm, encouraging, concise, age-appropriate."""
    ).with_model("openai", "gpt-5.2")

    prompt = f"""Previous conversation:
{context_str}

User's voice message: {transcribed_text}

Respond helpfully as Pixie:"""

    pixie_response = await chat.send_message(UserMessage(text=prompt))

    return {"transcription": transcribed_text, "response": pixie_response, "success": True}

