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

@router.get("/gifs/search")
async def search_gifs(q: str, limit: int = 20):
    """Search for GIFs using Tenor API"""
    # Tenor API key (free anonymous key)
    api_key = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://tenor.googleapis.com/v2/search",
                params={
                    "key": api_key,
                    "q": q,
                    "limit": limit,
                    "contentfilter": "high",  # Family-friendly
                    "media_filter": "gif,tinygif"
                },
                timeout=10
            )
            res.raise_for_status()
            data = res.json()
            
            gifs = []
            for gif in data.get("results", []):
                media = gif.get("media_formats", {})
                gifs.append({
                    "id": gif.get("id"),
                    "title": gif.get("content_description", ""),
                    "url": media.get("gif", {}).get("url", ""),
                    "preview": media.get("tinygif", {}).get("url", "") or media.get("gif", {}).get("url", ""),
                    "width": media.get("gif", {}).get("dims", [200])[0],
                    "height": media.get("gif", {}).get("dims", [200, 200])[1] if len(media.get("gif", {}).get("dims", [])) > 1 else 200
                })
            
            return {"gifs": gifs}
    except Exception as e:
        logger.error(f"GIF search error: {e}")
        return {"gifs": [], "error": str(e)}

# GIF Trending
@router.get("/gifs/trending")
async def trending_gifs(limit: int = 20):
    """Get trending GIFs using Tenor API"""
    api_key = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://tenor.googleapis.com/v2/featured",
                params={
                    "key": api_key,
                    "limit": limit,
                    "contentfilter": "high",
                    "media_filter": "gif,tinygif"
                },
                timeout=10
            )
            res.raise_for_status()
            data = res.json()
            
            gifs = []
            for gif in data.get("results", []):
                media = gif.get("media_formats", {})
                gifs.append({
                    "id": gif.get("id"),
                    "title": gif.get("content_description", ""),
                    "url": media.get("gif", {}).get("url", ""),
                    "preview": media.get("tinygif", {}).get("url", "") or media.get("gif", {}).get("url", ""),
                    "width": media.get("gif", {}).get("dims", [200])[0],
                    "height": media.get("gif", {}).get("dims", [200, 200])[1] if len(media.get("gif", {}).get("dims", [])) > 1 else 200
                })
            
            return {"gifs": gifs}
    except Exception as e:
        logger.error(f"GIF trending error: {e}")
        return {"gifs": [], "error": str(e)}

# Advanced AI Chore Scheduling

