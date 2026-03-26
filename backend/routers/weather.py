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

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/weather")
async def get_weather(lat: float = 40.7128, lon: float = -74.0060):
    """Fetch current weather from OpenWeatherMap API"""
    api_key = os.environ.get('OPENWEATHER_API_KEY')
    
    # Map OpenWeatherMap conditions to our simplified conditions
    condition_map = {
        'Clear': 'sunny',
        'Clouds': 'cloudy',
        'Rain': 'rainy',
        'Drizzle': 'rainy',
        'Thunderstorm': 'stormy',
        'Snow': 'snowy',
        'Mist': 'cloudy',
        'Fog': 'cloudy',
        'Wind': 'windy'
    }
    
    if not api_key:
        # Return simulated weather if no API key configured
        import random
        conditions = ['sunny', 'cloudy', 'rainy', 'windy']
        temps = [65, 68, 72, 75, 78, 80, 82]
        return {
            "temp": random.choice(temps),
            "condition": random.choice(conditions),
            "description": "Simulated weather (no API key)",
            "is_mocked": True
        }
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "lat": lat,
                    "lon": lon,
                    "appid": api_key,
                    "units": "imperial"
                },
                timeout=10
            )
            res.raise_for_status()
            data = res.json()
            
            weather_main = data.get("weather", [{}])[0].get("main", "Clear")
            condition = condition_map.get(weather_main, 'cloudy')
            
            return {
                "temp": round(data.get("main", {}).get("temp", 72)),
                "condition": condition,
                "description": data.get("weather", [{}])[0].get("description", ""),
                "humidity": data.get("main", {}).get("humidity"),
                "wind_speed": data.get("wind", {}).get("speed"),
                "city": data.get("name"),
                "is_mocked": False
            }
    except httpx.HTTPStatusError as e:
        logger.error(f"Weather API error: {e}")
        # Fallback to simulated on API errors (401, 403, etc.)
        import random
        return {
            "temp": random.choice([65, 68, 72, 75, 78]),
            "condition": random.choice(['sunny', 'cloudy']),
            "description": "Weather API key may need activation (can take up to 2 hours)",
            "is_mocked": True
        }
    except Exception as e:
        logger.error(f"Weather fetch error: {e}")
        # Fallback to simulated on error
        import random
        return {
            "temp": random.choice([65, 68, 72, 75, 78]),
            "condition": random.choice(['sunny', 'cloudy']),
            "description": "Weather unavailable",
            "is_mocked": True
        }

@router.get("/weather/forecast")
async def get_weather_forecast(lat: float = 40.7128, lon: float = -74.0060, days: int = 3):
    """Fetch weather forecast for multiple days from OpenWeatherMap API"""
    api_key = os.environ.get('OPENWEATHER_API_KEY')
    
    condition_map = {
        'Clear': 'sunny',
        'Clouds': 'cloudy',
        'Rain': 'rainy',
        'Drizzle': 'rainy',
        'Thunderstorm': 'stormy',
        'Snow': 'snowy',
        'Mist': 'cloudy',
        'Fog': 'cloudy',
        'Wind': 'windy'
    }
    
    if not api_key:
        # Return simulated forecast if no API key
        import random
        from datetime import datetime, timedelta
        forecast = []
        for i in range(days):
            date = datetime.now() + timedelta(days=i)
            forecast.append({
                "date": date.strftime("%Y-%m-%d"),
                "day_name": date.strftime("%A"),
                "temp_high": random.randint(70, 85),
                "temp_low": random.randint(55, 68),
                "condition": random.choice(['sunny', 'cloudy', 'rainy']),
                "description": "Simulated forecast"
            })
        return {"forecast": forecast, "is_mocked": True}
    
    try:
        async with httpx.AsyncClient() as client:
            # Use 5-day forecast API (free tier)
            res = await client.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={
                    "lat": lat,
                    "lon": lon,
                    "appid": api_key,
                    "units": "imperial",
                    "cnt": days * 8  # 8 forecasts per day (3-hour intervals)
                },
                timeout=10
            )
            res.raise_for_status()
            data = res.json()
            
            # Process forecast data - group by day
            from datetime import datetime
            daily_forecasts = {}
            
            for item in data.get("list", []):
                dt = datetime.fromtimestamp(item["dt"])
                date_str = dt.strftime("%Y-%m-%d")
                
                if date_str not in daily_forecasts:
                    daily_forecasts[date_str] = {
                        "date": date_str,
                        "day_name": dt.strftime("%A"),
                        "temps": [],
                        "conditions": [],
                        "descriptions": []
                    }
                
                daily_forecasts[date_str]["temps"].append(item["main"]["temp"])
                weather_main = item.get("weather", [{}])[0].get("main", "Clear")
                daily_forecasts[date_str]["conditions"].append(condition_map.get(weather_main, 'cloudy'))
                daily_forecasts[date_str]["descriptions"].append(item.get("weather", [{}])[0].get("description", ""))
            
            # Calculate daily summaries
            forecast = []
            for date_str in sorted(daily_forecasts.keys())[:days]:
                day_data = daily_forecasts[date_str]
                temps = day_data["temps"]
                conditions = day_data["conditions"]
                
                # Most common condition
                condition_counts = {}
                for c in conditions:
                    condition_counts[c] = condition_counts.get(c, 0) + 1
                most_common_condition = max(condition_counts, key=condition_counts.get)
                
                forecast.append({
                    "date": day_data["date"],
                    "day_name": day_data["day_name"],
                    "temp_high": round(max(temps)),
                    "temp_low": round(min(temps)),
                    "condition": most_common_condition,
                    "description": day_data["descriptions"][0] if day_data["descriptions"] else ""
                })
            
            return {
                "forecast": forecast,
                "city": data.get("city", {}).get("name"),
                "is_mocked": False
            }
    except Exception as e:
        logger.error(f"Weather forecast error: {e}")
        import random
        from datetime import datetime, timedelta
        forecast = []
        for i in range(days):
            date = datetime.now() + timedelta(days=i)
            forecast.append({
                "date": date.strftime("%Y-%m-%d"),
                "day_name": date.strftime("%A"),
                "temp_high": random.randint(70, 85),
                "temp_low": random.randint(55, 68),
                "condition": random.choice(['sunny', 'cloudy']),
                "description": "Forecast unavailable"
            })
        return {"forecast": forecast, "is_mocked": True}

