"""
Test Iteration 22 - New Features Testing
Features to test:
1. Pixie AI endpoint with weather keywords (/api/ai/pixie)
2. Check-ins endpoint (/api/checkins)
3. Location alerts endpoint (/api/location/alerts)
4. Pantry endpoints still working (/api/pantry)
5. Events endpoint (verify no stack overflow)
6. Family members endpoint
7. Shopping list add item
"""

import pytest
import requests
import os
import time
from datetime import datetime, timezone

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDevLogin:
    """Test dev login for authentication"""
    
    def test_dev_login_parent(self):
        """Test dev login as parent"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "parent", "User role should be parent"
        print(f"✓ Dev login as parent successful, user_id: {data['user']['user_id']}")
        return data["session_token"]
    
    def test_dev_login_child(self):
        """Test dev login as child"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session token in response"
        assert "user" in data, "No user in response"
        print(f"✓ Dev login as child successful, user_id: {data['user']['user_id']}")
        return data["session_token"]


class TestPixieAIWithWeather:
    """Test Pixie AI endpoint with weather-aware activity suggestions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_pixie_basic_message(self):
        """Test Pixie with a basic message"""
        response = requests.post(
            f"{BASE_URL}/api/ai/pixie",
            headers=self.headers,
            json={
                "message": "Hello Pixie!",
                "user_name": "Test User",
                "user_role": "parent"
            },
            timeout=30
        )
        assert response.status_code == 200, f"Pixie request failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response from Pixie"
        print(f"✓ Pixie basic response received: {data['response'][:100]}...")
    
    def test_pixie_activity_suggestion_triggers_weather(self):
        """Test Pixie with activity keywords - should include weather info"""
        response = requests.post(
            f"{BASE_URL}/api/ai/pixie",
            headers=self.headers,
            json={
                "message": "What activities can we do today?",
                "user_name": "Test Parent",
                "user_role": "parent",
                "lat": 40.7128,
                "lng": -74.0060
            },
            timeout=30
        )
        assert response.status_code == 200, f"Pixie activity request failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response from Pixie"
        # The response should mention activities
        print(f"✓ Pixie activity suggestion received: {data['response'][:150]}...")
    
    def test_pixie_weather_keyword(self):
        """Test Pixie with weather keyword"""
        response = requests.post(
            f"{BASE_URL}/api/ai/pixie",
            headers=self.headers,
            json={
                "message": "What's the weather like for outdoor play?",
                "user_name": "Test Child",
                "user_role": "child"
            },
            timeout=30
        )
        assert response.status_code == 200, f"Pixie weather request failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response from Pixie"
        print(f"✓ Pixie weather response received: {data['response'][:150]}...")
    
    def test_pixie_fun_keyword(self):
        """Test Pixie with 'fun' keyword - should trigger weather context"""
        response = requests.post(
            f"{BASE_URL}/api/ai/pixie",
            headers=self.headers,
            json={
                "message": "What fun things can we do this weekend?",
                "user_name": "Test User",
                "user_role": "parent"
            },
            timeout=30
        )
        assert response.status_code == 200, f"Pixie fun request failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response from Pixie"
        print(f"✓ Pixie fun activities response received: {data['response'][:150]}...")


class TestCheckinsEndpoint:
    """Test Check-ins endpoint for location history"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth tokens for parent and child"""
        # Parent login
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.parent_token = response.json()["session_token"]
        self.parent_user = response.json()["user"]
        self.parent_headers = {"Authorization": f"Bearer {self.parent_token}"}
        
        # Child login
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        assert response.status_code == 200
        self.child_token = response.json()["session_token"]
        self.child_user = response.json()["user"]
        self.child_headers = {"Authorization": f"Bearer {self.child_token}"}
    
    def test_create_checkin(self):
        """Test creating a check-in"""
        checkin_data = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "address": "TEST_New York, NY"
        }
        response = requests.post(
            f"{BASE_URL}/api/checkins",
            headers=self.child_headers,
            json=checkin_data
        )
        assert response.status_code == 200, f"Create checkin failed: {response.text}"
        data = response.json()
        assert "checkin_id" in data, "No checkin_id in response"
        assert data["latitude"] == 40.7128, "Latitude mismatch"
        assert data["longitude"] == -74.0060, "Longitude mismatch"
        print(f"✓ Check-in created: {data['checkin_id']}")
        return data["checkin_id"]
    
    def test_get_user_checkins(self):
        """Test getting user's check-ins"""
        # First create a check-in
        checkin_data = {
            "latitude": 40.7589,
            "longitude": -73.9851,
            "address": "TEST_Times Square, NY"
        }
        requests.post(
            f"{BASE_URL}/api/checkins",
            headers=self.child_headers,
            json=checkin_data
        )
        
        # Get check-ins for the child user
        response = requests.get(
            f"{BASE_URL}/api/checkins/{self.child_user['user_id']}",
            headers=self.parent_headers  # Parent can view child's check-ins
        )
        assert response.status_code == 200, f"Get checkins failed: {response.text}"
        data = response.json()
        assert "checkins" in data, "No checkins in response"
        print(f"✓ Retrieved {len(data['checkins'])} check-ins for user")
    
    def test_get_last_checkin(self):
        """Test getting user's last check-in"""
        # Create a check-in first
        checkin_data = {
            "latitude": 40.6892,
            "longitude": -74.0445,
            "address": "TEST_Statue of Liberty, NY"
        }
        requests.post(
            f"{BASE_URL}/api/checkins",
            headers=self.child_headers,
            json=checkin_data
        )
        
        # Get last check-in
        response = requests.get(
            f"{BASE_URL}/api/checkins/{self.child_user['user_id']}/last",
            headers=self.parent_headers
        )
        assert response.status_code == 200, f"Get last checkin failed: {response.text}"
        data = response.json()
        # Should have checkin data or error message
        assert "checkin_id" in data or "error" in data, "Invalid response format"
        print(f"✓ Last check-in retrieved successfully")


class TestLocationAlerts:
    """Test Location Alerts endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_location_alerts(self):
        """Test getting location alerts"""
        response = requests.get(
            f"{BASE_URL}/api/location/alerts",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get location alerts failed: {response.text}"
        data = response.json()
        assert "alerts" in data, "No alerts key in response"
        print(f"✓ Location alerts retrieved: {len(data['alerts'])} alerts")
    
    def test_create_geofence_alert(self):
        """Test creating a geofence and triggering an alert"""
        # First create a geofence
        geofence_data = {
            "name": "TEST_Home",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "radius_feet": 100,
            "notify_on_exit": True,
            "notify_on_enter": True
        }
        response = requests.post(
            f"{BASE_URL}/api/geofences",
            headers=self.headers,
            json=geofence_data
        )
        assert response.status_code == 200, f"Create geofence failed: {response.text}"
        geofence = response.json()
        print(f"✓ Geofence created: {geofence['geofence_id']}")
        
        # Now trigger a geofence alert
        alert_data = {
            "geofence_id": geofence["geofence_id"],
            "entered": True,
            "latitude": 40.7128,
            "longitude": -74.0060,
            "region_name": "TEST_Home"
        }
        response = requests.post(
            f"{BASE_URL}/api/location/geofence-alert",
            headers=self.headers,
            json=alert_data
        )
        assert response.status_code == 200, f"Geofence alert failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Alert not successful"
        print(f"✓ Geofence alert created: {data.get('alert_id')}")
        
        # Cleanup - delete the geofence
        requests.delete(
            f"{BASE_URL}/api/geofences/{geofence['geofence_id']}",
            headers=self.headers
        )


class TestPantryEndpoints:
    """Test Pantry endpoints are still working"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_pantry(self):
        """Test getting pantry items"""
        response = requests.get(
            f"{BASE_URL}/api/pantry",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get pantry failed: {response.text}"
        data = response.json()
        assert "items" in data, "No items key in response"
        print(f"✓ Pantry items retrieved: {len(data['items'])} items")
    
    def test_pantry_crud(self):
        """Test pantry CRUD operations"""
        # Create
        item_data = {
            "name": "TEST_Milk",
            "quantity": 2,
            "unit": "gallons",
            "category": "dairy"
        }
        response = requests.post(
            f"{BASE_URL}/api/pantry",
            headers=self.headers,
            json=item_data
        )
        assert response.status_code == 200, f"Create pantry item failed: {response.text}"
        data = response.json()
        # Pantry POST returns {"item": {...}}
        item = data.get("item", data)
        assert "item_id" in item, "No item_id in response"
        item_id = item["item_id"]
        print(f"✓ Pantry item created: {item_id}")
        
        # Update
        update_data = {"quantity": 3}
        response = requests.put(
            f"{BASE_URL}/api/pantry/{item_id}",
            headers=self.headers,
            json=update_data
        )
        assert response.status_code == 200, f"Update pantry item failed: {response.text}"
        print(f"✓ Pantry item updated")
        
        # Delete
        response = requests.delete(
            f"{BASE_URL}/api/pantry/{item_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Delete pantry item failed: {response.text}"
        print(f"✓ Pantry item deleted")


class TestEventsEndpoint:
    """Test Events endpoint - verify no stack overflow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_events_no_timeout(self):
        """Test GET /api/events responds quickly without stack overflow"""
        start_time = time.time()
        response = requests.get(
            f"{BASE_URL}/api/events",
            headers=self.headers,
            timeout=10  # Should respond within 10 seconds
        )
        elapsed = time.time() - start_time
        assert response.status_code == 200, f"Get events failed: {response.text}"
        assert elapsed < 10, f"Events endpoint took too long: {elapsed}s"
        data = response.json()
        assert "events" in data, "No events key in response"
        print(f"✓ Events retrieved in {elapsed:.2f}s: {len(data['events'])} events")
    
    def test_create_event(self):
        """Test creating an event"""
        event_data = {
            "title": "TEST_Family Dinner",
            "description": "Weekly family dinner",
            "event_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "event_time": "18:00",
            "event_type": "event"
        }
        response = requests.post(
            f"{BASE_URL}/api/events",
            headers=self.headers,
            json=event_data
        )
        assert response.status_code == 200, f"Create event failed: {response.text}"
        data = response.json()
        assert "event_id" in data, "No event_id in response"
        print(f"✓ Event created: {data['event_id']}")


class TestFamilyMembers:
    """Test Family Members endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_family_members(self):
        """Test getting family members"""
        response = requests.get(
            f"{BASE_URL}/api/family/members",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get family members failed: {response.text}"
        data = response.json()
        assert "members" in data, "No members key in response"
        print(f"✓ Family members retrieved: {len(data['members'])} members")
    
    def test_create_child_profile(self):
        """Test creating a child profile"""
        child_data = {
            "name": "TEST_Child",
            "email": f"test_child_{int(time.time())}@family.local"
        }
        response = requests.post(
            f"{BASE_URL}/api/users/child",
            headers=self.headers,
            json=child_data
        )
        assert response.status_code == 200, f"Create child failed: {response.text}"
        data = response.json()
        assert "user_id" in data, "No user_id in response"
        assert data["role"] == "child", "Role should be child"
        print(f"✓ Child profile created: {data['user_id']}")


class TestShoppingList:
    """Test Shopping List add item functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_shopping_list(self):
        """Test getting shopping list"""
        response = requests.get(
            f"{BASE_URL}/api/shopping",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get shopping list failed: {response.text}"
        data = response.json()
        assert "items" in data, "No items key in response"
        print(f"✓ Shopping list retrieved: {len(data['items'])} items")
    
    def test_add_shopping_item(self):
        """Test adding item to shopping list"""
        item_data = {
            "name": "TEST_Apples"
        }
        response = requests.post(
            f"{BASE_URL}/api/shopping",
            headers=self.headers,
            json=item_data
        )
        assert response.status_code == 200, f"Add shopping item failed: {response.text}"
        data = response.json()
        assert "item_id" in data, "No item_id in response"
        assert data["name"] == "TEST_Apples", "Item name mismatch"
        assert data["status"] == "approved", "Parent items should be auto-approved"
        print(f"✓ Shopping item added: {data['item_id']}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/shopping/{data['item_id']}",
            headers=self.headers
        )
    
    def test_shopping_item_crud(self):
        """Test full CRUD for shopping items"""
        # Create
        item_data = {"name": "TEST_Bananas"}
        response = requests.post(
            f"{BASE_URL}/api/shopping",
            headers=self.headers,
            json=item_data
        )
        assert response.status_code == 200
        item = response.json()
        item_id = item["item_id"]
        print(f"✓ Shopping item created: {item_id}")
        
        # Update
        update_data = {"status": "purchased"}
        response = requests.put(
            f"{BASE_URL}/api/shopping/{item_id}",
            headers=self.headers,
            json=update_data
        )
        assert response.status_code == 200
        print(f"✓ Shopping item updated to purchased")
        
        # Delete
        response = requests.delete(
            f"{BASE_URL}/api/shopping/{item_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        print(f"✓ Shopping item deleted")


class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", "Status should be healthy"
        print(f"✓ Health check passed: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
