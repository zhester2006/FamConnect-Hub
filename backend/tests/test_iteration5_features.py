"""
Test Suite for FamFocus Hub Iteration 5 Features:
- Weather API (Real OpenWeatherMap integration)
- GIF Search/Trending (Tenor API)
- AI Chore Scheduler
- Child Nicknames
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_1770163520318"

@pytest.fixture
def auth_headers():
    """Return headers with session cookie for authenticated requests"""
    return {"Cookie": f"session_token={SESSION_TOKEN}"}

@pytest.fixture
def auth_json_headers():
    """Return headers with session cookie and JSON content type"""
    return {
        "Cookie": f"session_token={SESSION_TOKEN}",
        "Content-Type": "application/json"
    }


class TestWeatherAPI:
    """Weather API tests - Now using REAL OpenWeatherMap data"""
    
    def test_weather_returns_real_data(self):
        """GET /api/weather should return real weather data"""
        response = requests.get(f"{BASE_URL}/api/weather")
        assert response.status_code == 200
        
        data = response.json()
        assert "temp" in data
        assert "condition" in data
        assert "is_mocked" in data
        # Weather API should now return real data
        assert data["is_mocked"] == False, "Weather API should return real data (not mocked)"
        assert "city" in data
        assert "humidity" in data
        assert "wind_speed" in data
    
    def test_weather_with_coordinates(self):
        """GET /api/weather with lat/lon should return location-specific weather"""
        response = requests.get(f"{BASE_URL}/api/weather?lat=40.7128&lon=-74.0060")
        assert response.status_code == 200
        
        data = response.json()
        assert "temp" in data
        assert "condition" in data
        assert data["is_mocked"] == False
    
    def test_weather_condition_mapping(self):
        """Weather condition should be one of the mapped values"""
        response = requests.get(f"{BASE_URL}/api/weather")
        assert response.status_code == 200
        
        data = response.json()
        valid_conditions = ['sunny', 'cloudy', 'rainy', 'windy', 'snowy', 'stormy']
        assert data["condition"] in valid_conditions


class TestGIFAPI:
    """GIF Search and Trending API tests - Using Tenor API"""
    
    def test_gif_search(self):
        """GET /api/gifs/search should return GIFs matching query"""
        response = requests.get(f"{BASE_URL}/api/gifs/search?q=happy&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "gifs" in data
        assert len(data["gifs"]) > 0
        
        # Verify GIF structure
        gif = data["gifs"][0]
        assert "id" in gif
        assert "url" in gif
        assert "preview" in gif
        assert "title" in gif
    
    def test_gif_search_with_limit(self):
        """GET /api/gifs/search should respect limit parameter"""
        response = requests.get(f"{BASE_URL}/api/gifs/search?q=family&limit=3")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["gifs"]) <= 3
    
    def test_gif_trending(self):
        """GET /api/gifs/trending should return trending GIFs"""
        response = requests.get(f"{BASE_URL}/api/gifs/trending?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "gifs" in data
        assert len(data["gifs"]) > 0
        
        # Verify GIF structure
        gif = data["gifs"][0]
        assert "id" in gif
        assert "url" in gif
        assert "preview" in gif
    
    def test_gif_search_empty_query(self):
        """GET /api/gifs/search with empty query should still work"""
        response = requests.get(f"{BASE_URL}/api/gifs/search?q=&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "gifs" in data


class TestAIChoreScheduler:
    """AI Chore Scheduler tests"""
    
    def test_ai_schedule_requires_auth(self):
        """POST /api/chores/ai-schedule should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/chores/ai-schedule",
            json={"days": 3}
        )
        assert response.status_code == 401
    
    def test_ai_schedule_generation(self, auth_json_headers):
        """POST /api/chores/ai-schedule should generate a schedule"""
        response = requests.post(
            f"{BASE_URL}/api/chores/ai-schedule",
            headers=auth_json_headers,
            json={"preferences": "Balance workload fairly", "days": 3}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "schedule_id" in data
        assert "schedule" in data
        assert len(data["schedule"]) > 0
    
    def test_get_chore_schedules(self, auth_headers):
        """GET /api/chores/schedules should return saved schedules"""
        response = requests.get(
            f"{BASE_URL}/api/chores/schedules",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "schedules" in data
        assert isinstance(data["schedules"], list)
        
        if len(data["schedules"]) > 0:
            schedule = data["schedules"][0]
            assert "schedule_id" in schedule
            assert "schedule" in schedule
            assert "days" in schedule
            assert "created_at" in schedule
    
    def test_ai_schedule_with_preferences(self, auth_json_headers):
        """POST /api/chores/ai-schedule should use preferences"""
        response = requests.post(
            f"{BASE_URL}/api/chores/ai-schedule",
            headers=auth_json_headers,
            json={
                "preferences": "Alex should do more outdoor chores",
                "days": 5
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "schedule" in data
        # Schedule should mention Alex
        assert "Alex" in data["schedule"]


class TestChildNicknames:
    """Child nickname feature tests"""
    
    def test_update_nickname_requires_auth(self):
        """PUT /api/users/{id}/nickname should require authentication"""
        response = requests.put(
            f"{BASE_URL}/api/users/user_child001/nickname",
            json={"nickname": "Test"}
        )
        assert response.status_code == 401
    
    def test_update_nickname(self, auth_json_headers):
        """PUT /api/users/{id}/nickname should update nickname"""
        response = requests.put(
            f"{BASE_URL}/api/users/user_child001/nickname",
            headers=auth_json_headers,
            json={"nickname": "Superstar"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["nickname"] == "Superstar"
    
    def test_nickname_max_length(self, auth_json_headers):
        """PUT /api/users/{id}/nickname should reject nicknames > 20 chars"""
        response = requests.put(
            f"{BASE_URL}/api/users/user_child001/nickname",
            headers=auth_json_headers,
            json={"nickname": "ThisNicknameIsTooLongForTheLimit"}
        )
        assert response.status_code == 400
        assert "too long" in response.json().get("detail", "").lower()
    
    def test_clear_nickname(self, auth_json_headers):
        """PUT /api/users/{id}/nickname with empty string should clear nickname"""
        response = requests.put(
            f"{BASE_URL}/api/users/user_child001/nickname",
            headers=auth_json_headers,
            json={"nickname": ""}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("nickname", "") == ""
    
    def test_nickname_user_not_found(self, auth_json_headers):
        """PUT /api/users/{id}/nickname should return 404 for invalid user"""
        response = requests.put(
            f"{BASE_URL}/api/users/nonexistent_user/nickname",
            headers=auth_json_headers,
            json={"nickname": "Test"}
        )
        assert response.status_code == 404


class TestFamilyWallGIF:
    """Family Wall GIF posting tests"""
    
    def test_post_with_gif(self, auth_json_headers):
        """POST /api/family-wall should accept GIF posts"""
        response = requests.post(
            f"{BASE_URL}/api/family-wall",
            headers=auth_json_headers,
            json={
                "content": "Check out this GIF!",
                "post_type": "gif",
                "media_url": "https://media.tenor.com/example.gif"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["post_type"] == "gif"
        assert data["media_url"] == "https://media.tenor.com/example.gif"
    
    def test_get_family_wall_posts(self, auth_headers):
        """GET /api/family-wall should return posts including GIFs"""
        response = requests.get(
            f"{BASE_URL}/api/family-wall",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "posts" in data
        assert isinstance(data["posts"], list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
