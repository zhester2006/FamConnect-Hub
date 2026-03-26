from fastapi import APIRouter, HTTPException, Request, Response
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

@router.get("/family-wall")
async def get_family_wall(request: Request):
    current_user = await get_current_user(request)
    posts = await db.family_wall.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Sanitize and add user_voted_option for each post
    for post in posts:
        # Sanitize author picture to prevent large base64 data
        post['author_picture'] = sanitize_picture(post.get('author_picture'), fallback_name=post.get('author_name'))
        
        # Normalize field names for frontend compatibility
        if not post.get('user_name'):
            post['user_name'] = post.get('author_name', 'Unknown')
        if not post.get('user_picture'):
            post['user_picture'] = post.get('author_picture')
        
        # Normalize type field (some docs use 'type', others 'post_type')
        if not post.get('post_type'):
            post['post_type'] = post.get('type', 'text')
        
        if post.get('type') == 'poll' or post.get('post_type') == 'poll':
            poll_options = post.get('poll_options', [])
            for idx, opt in enumerate(poll_options):
                if current_user['user_id'] in opt.get('votes', []):
                    post['user_voted_option'] = idx
                    break
    
    return {"posts": posts}

@router.post("/family-wall")
async def create_post(request: Request, data: dict):
    current_user = await get_current_user(request)
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    family_id = current_user.get('parent_id', current_user['user_id'])
    
    # Accept both 'type' and 'post_type' for backward compatibility
    post_type = data.get('type') or data.get('post_type', 'text')
    
    # Process poll_options - convert string array to objects if needed
    poll_options = data.get('poll_options')
    if poll_options and isinstance(poll_options, list):
        poll_options = [
            {"text": opt, "votes": [], "voter_names": []} if isinstance(opt, str) else opt
            for opt in poll_options
        ]
    
    author_name = current_user.get('nickname') or current_user['name']
    post_doc = {
        "post_id": post_id,
        "family_id": family_id,
        "author_id": current_user['user_id'],
        "author_name": author_name,
        "author_picture": sanitize_picture(current_user.get('picture'), fallback_name=author_name),
        "content": data.get('content', ''),
        "gif_url": data.get('gif_url'),
        "image_url": data.get('image_url'),
        "type": post_type,
        "poll_options": poll_options,
        "likes_count": 0,
        "liked_by": [],
        "comments_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.family_wall.insert_one(post_doc)
    
    # Notify other family members about new post
    family_members = await db.users.find(
        {"$or": [{"user_id": family_id}, {"parent_id": family_id}]},
        {"_id": 0, "user_id": 1}
    ).to_list(100)
    
    author_name = current_user.get('nickname') or current_user.get('name', 'Someone')
    post_type_text = "created a poll" if post_type == "poll" else "shared a photo" if post_type == "photo" else "shared a GIF" if post_type == "gif" else "shared a post"
    
    for member in family_members:
        if member['user_id'] != current_user['user_id']:
            notification_doc = {
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": member['user_id'],
                "type": "family_wall",
                "title": "New Family Wall Post",
                "message": f"{author_name} {post_type_text}",
                "data": {"post_id": post_id, "author_id": current_user['user_id'], "post_type": post_type},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification_doc)
    
    return await db.family_wall.find_one({"post_id": post_id}, {"_id": 0})

@router.post("/family-wall/{post_id}/vote")
async def vote_on_poll(post_id: str, request: Request, data: dict):
    current_user = await get_current_user(request)
    option_index = data.get('option_index')
    
    post = await db.family_wall.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check both 'type' and 'post_type' for backward compatibility
    post_type = post.get('type') or post.get('post_type')
    if post_type != 'poll':
        raise HTTPException(status_code=400, detail="Post is not a poll")
    
    poll_options = post.get('poll_options', [])
    if option_index is None or option_index < 0 or option_index >= len(poll_options):
        raise HTTPException(status_code=400, detail="Invalid option index")
    
    # Check if user already voted
    for opt in poll_options:
        if current_user['user_id'] in opt.get('votes', []):
            raise HTTPException(status_code=400, detail="Already voted")
    
    # Add vote with voter info
    voter_name = current_user.get('nickname') or current_user['name']
    poll_options[option_index]['votes'] = poll_options[option_index].get('votes', []) + [current_user['user_id']]
    poll_options[option_index]['voter_names'] = poll_options[option_index].get('voter_names', []) + [voter_name]
    
    # Determine which option the user voted for
    user_voted_option = option_index
    
    await db.family_wall.update_one(
        {"post_id": post_id},
        {"$set": {"poll_options": poll_options}}
    )
    
    result = await db.family_wall.find_one({"post_id": post_id}, {"_id": 0})
    result['user_voted_option'] = user_voted_option
    return result

# AI Daily Quote
@router.get("/family-wall/daily-quote")
async def get_daily_quote(request: Request, refresh: bool = False, quote_type: str = "inspiration"):
    await get_current_user(request)
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Check for existing quote if not forcing refresh
    if not refresh:
        existing_quote = await db.daily_quotes.find_one({"date": today, "type": quote_type}, {"_id": 0})
        if existing_quote:
            return existing_quote
    
    # Generate new quote with AI
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"quote_{today}_{uuid.uuid4().hex[:8]}",
        system_message="You are a warm, encouraging motivational assistant for families. Create quotes that inspire togetherness, love, and positive action."
    ).with_model("openai", "gpt-5.2")
    
    import random
    
    if quote_type == "bible":
        # Bible verse themes
        themes = [
            "family love", "children", "patience", "gratitude", "faith", 
            "kindness", "forgiveness", "peace", "hope", "unity"
        ]
        theme = random.choice(themes)
        prompt = f"Share an uplifting Bible verse about {theme} that's appropriate for a family setting. Include the verse reference (book, chapter:verse). Format: 'Verse text' - Book Chapter:Verse"
    else:
        themes = [
            "family bonding", "teamwork", "gratitude", "kindness", 
            "perseverance", "love", "growth", "joy", "togetherness"
        ]
        theme = random.choice(themes)
        prompt = f"Generate a short, heartfelt inspirational quote for a family about {theme}. Make it uplifting and actionable. Return only the quote text, no quotation marks or attribution."
    
    response = await chat.send_message(UserMessage(
        text=prompt
    ))
    
    # Ensure response is a string and clean it
    quote_text = str(response).strip().strip('"').strip("'")
    
    # If refreshing, update existing quote; otherwise insert new
    quote_doc = {
        "date": today, 
        "quote": quote_text, 
        "theme": theme, 
        "type": quote_type,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    if refresh:
        await db.daily_quotes.update_one(
            {"date": today, "type": quote_type},
            {"$set": quote_doc},
            upsert=True
        )
    else:
        await db.daily_quotes.insert_one(quote_doc.copy())
    
    return quote_doc

# Messages/Chat

