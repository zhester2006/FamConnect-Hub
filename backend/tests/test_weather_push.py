"""
Backend API Tests for Weather API and Push Notifications - FamFocus Hub v3
Tests the new Weather API endpoint and Push Notification endpoints
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWeatherAPI:
    """Weather API endpoint tests - MOCKED since no OPENWEATHER_API_KEY is set"""
    
    def test_weather_endpoint_returns_data(self):
        """Test that /api/weather returns weather data"""
        response = requests.get(f"{BASE_URL}/api/weather")
        assert response.status_code == 200
        
        data = response.json()
        assert "temp" in data
        assert "condition" in data
        assert isinstance(data["temp"], (int, float))
        assert data["condition"] in ["sunny", "cloudy", "rainy", "windy", "snowy", "stormy"]
    
    def test_weather_endpoint_with_coordinates(self):
        """Test weather endpoint with lat/lon parameters"""
        response = requests.get(f"{BASE_URL}/api/weather?lat=40.7128&lon=-74.0060")
        assert response.status_code == 200
        
        data = response.json()
        assert "temp" in data
        assert "condition" in data
        # Since no API key, should return mocked data
        assert data.get("is_mocked") == True
        assert "description" in data
    
    def test_weather_returns_mocked_flag(self):
        """Test that weather API indicates when data is mocked"""
        response = requests.get(f"{BASE_URL}/api/weather")
        assert response.status_code == 200
        
        data = response.json()
        # Without OPENWEATHER_API_KEY, should be mocked
        assert data.get("is_mocked") == True
        assert "Simulated" in data.get("description", "")


class TestPushNotificationAPI:
    """Push Notification API endpoint tests"""
    
    def test_vapid_key_endpoint(self):
        """Test that /api/push/vapid-key returns public key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key")
        assert response.status_code == 200
        
        data = response.json()
        assert "publicKey" in data
        assert isinstance(data["publicKey"], str)
        assert len(data["publicKey"]) > 0
        # VAPID keys are base64url encoded
        assert data["publicKey"].startswith("B")
    
    def test_push_subscribe_requires_auth(self):
        """Test that /api/push/subscribe requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={
                "endpoint": "https://test.push.endpoint/test",
                "keys": {"p256dh": "test_key", "auth": "test_auth"}
            }
        )
        # Should return 401 without auth
        assert response.status_code == 401
    
    def test_push_unsubscribe_requires_auth(self):
        """Test that /api/push/unsubscribe requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/push/unsubscribe")
        # Should return 401 without auth
        assert response.status_code == 401


class TestPushNotificationWithAuth:
    """Push Notification tests with authentication"""
    
    @pytest.fixture
    def auth_session(self):
        """Create authenticated session"""
        session = requests.Session()
        # Get session token from environment or create one
        session_token = os.environ.get('TEST_SESSION_TOKEN')
        if session_token:
            session.cookies.set('session_token', session_token)
        return session
    
    @pytest.fixture
    def session_token(self):
        """Get session token for testing"""
        return os.environ.get('TEST_SESSION_TOKEN')
    
    def test_push_subscribe_with_auth(self, session_token):
        """Test push subscription with authentication"""
        if not session_token:
            pytest.skip("No TEST_SESSION_TOKEN available")
        
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            headers={"Cookie": f"session_token={session_token}"},
            json={
                "endpoint": f"https://test.push.endpoint/test_{datetime.now().timestamp()}",
                "keys": {"p256dh": "test_p256dh_key", "auth": "test_auth_key"}
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "subscription_id" in data
    
    def test_push_unsubscribe_with_auth(self, session_token):
        """Test push unsubscription with authentication"""
        if not session_token:
            pytest.skip("No TEST_SESSION_TOKEN available")
        
        response = requests.delete(
            f"{BASE_URL}/api/push/unsubscribe",
            headers={"Cookie": f"session_token={session_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True


class TestWeatherConditionMapping:
    """Test weather condition mapping logic"""
    
    def test_weather_condition_is_valid(self):
        """Test that weather condition is one of the expected values"""
        response = requests.get(f"{BASE_URL}/api/weather")
        assert response.status_code == 200
        
        data = response.json()
        valid_conditions = ['sunny', 'cloudy', 'rainy', 'windy', 'snowy', 'stormy']
        assert data["condition"] in valid_conditions
    
    def test_weather_temp_is_reasonable(self):
        """Test that temperature is within reasonable range"""
        response = requests.get(f"{BASE_URL}/api/weather")
        assert response.status_code == 200
        
        data = response.json()
        # Temperature should be in Fahrenheit, reasonable range
        assert -50 <= data["temp"] <= 150


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
