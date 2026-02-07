"""
Test Suite for Iteration 21 - Pantry System and Stack Overflow Fixes
Tests:
- Pantry CRUD endpoints (GET, POST, PUT, DELETE)
- Pantry AI suggestions
- Pantry AI shopping suggestions
- Events endpoint (stack overflow fix verification)
- Family Wall endpoint (stack overflow fix verification)
- Dev login for parent and child
- Shopping list CRUD
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDevLogin:
    """Test dev login for parent and child roles"""
    
    def test_dev_login_parent(self):
        """Test dev login with parent role"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        data = response.json()
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["role"] == "parent"
        print(f"✓ Parent dev login successful - user_id: {data['user']['user_id']}")
        return data
    
    def test_dev_login_child(self):
        """Test dev login with child role"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "child"}
        )
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        data = response.json()
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["role"] == "child"
        print(f"✓ Child dev login successful - user_id: {data['user']['user_id']}")
        return data


class TestPantryCRUD:
    """Test Pantry CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data["session_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        self.user_id = data["user"]["user_id"]
    
    def test_get_pantry_items_empty(self):
        """Test getting pantry items (may be empty initially)"""
        response = requests.get(
            f"{BASE_URL}/api/pantry",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get pantry failed: {response.text}"
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        print(f"✓ GET /api/pantry - returned {len(data['items'])} items")
    
    def test_add_pantry_item(self):
        """Test adding an item to the pantry"""
        item_data = {
            "name": f"TEST_Milk_{uuid.uuid4().hex[:6]}",
            "category": "dairy",
            "quantity": 2
        }
        response = requests.post(
            f"{BASE_URL}/api/pantry",
            headers=self.headers,
            json=item_data
        )
        assert response.status_code == 200, f"Add pantry item failed: {response.text}"
        data = response.json()
        assert "item" in data
        assert data["item"]["name"] == item_data["name"]
        assert data["item"]["category"] == "dairy"
        assert data["item"]["quantity"] == 2
        assert "item_id" in data["item"]
        print(f"✓ POST /api/pantry - created item: {data['item']['item_id']}")
        return data["item"]
    
    def test_add_and_update_pantry_item(self):
        """Test adding and then updating a pantry item"""
        # First add an item
        item_data = {
            "name": f"TEST_Eggs_{uuid.uuid4().hex[:6]}",
            "category": "dairy",
            "quantity": 12
        }
        add_response = requests.post(
            f"{BASE_URL}/api/pantry",
            headers=self.headers,
            json=item_data
        )
        assert add_response.status_code == 200
        item = add_response.json()["item"]
        item_id = item["item_id"]
        
        # Update the item
        update_data = {
            "quantity": 6,
            "category": "protein"
        }
        update_response = requests.put(
            f"{BASE_URL}/api/pantry/{item_id}",
            headers=self.headers,
            json=update_data
        )
        assert update_response.status_code == 200, f"Update pantry item failed: {update_response.text}"
        data = update_response.json()
        assert data["success"] == True
        print(f"✓ PUT /api/pantry/{item_id} - updated successfully")
    
    def test_add_and_delete_pantry_item(self):
        """Test adding and then deleting a pantry item"""
        # First add an item
        item_data = {
            "name": f"TEST_Bread_{uuid.uuid4().hex[:6]}",
            "category": "bakery",
            "quantity": 1
        }
        add_response = requests.post(
            f"{BASE_URL}/api/pantry",
            headers=self.headers,
            json=item_data
        )
        assert add_response.status_code == 200
        item = add_response.json()["item"]
        item_id = item["item_id"]
        
        # Delete the item
        delete_response = requests.delete(
            f"{BASE_URL}/api/pantry/{item_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200, f"Delete pantry item failed: {delete_response.text}"
        data = delete_response.json()
        assert data["success"] == True
        print(f"✓ DELETE /api/pantry/{item_id} - deleted successfully")
    
    def test_delete_nonexistent_pantry_item(self):
        """Test deleting a non-existent pantry item returns 404"""
        fake_id = f"pantry_nonexistent_{uuid.uuid4().hex[:8]}"
        response = requests.delete(
            f"{BASE_URL}/api/pantry/{fake_id}",
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ DELETE /api/pantry/{fake_id} - correctly returned 404")


class TestPantryAI:
    """Test Pantry AI suggestion endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data["session_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_ai_suggestions_empty_pantry(self):
        """Test AI suggestions with empty pantry returns default suggestions"""
        response = requests.post(
            f"{BASE_URL}/api/pantry/ai-suggestions",
            headers=self.headers,
            json={"items": []}
        )
        assert response.status_code == 200, f"AI suggestions failed: {response.text}"
        data = response.json()
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        assert len(data["suggestions"]) > 0
        print(f"✓ POST /api/pantry/ai-suggestions (empty) - returned {len(data['suggestions'])} suggestions")
    
    def test_ai_suggestions_with_items(self):
        """Test AI suggestions with existing pantry items"""
        pantry_items = [
            {"name": "Milk"},
            {"name": "Eggs"},
            {"name": "Bread"}
        ]
        response = requests.post(
            f"{BASE_URL}/api/pantry/ai-suggestions",
            headers=self.headers,
            json={"items": pantry_items}
        )
        assert response.status_code == 200, f"AI suggestions failed: {response.text}"
        data = response.json()
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        print(f"✓ POST /api/pantry/ai-suggestions (with items) - returned {len(data['suggestions'])} suggestions")
    
    def test_ai_shopping_suggestions_empty(self):
        """Test AI shopping suggestions with empty pantry"""
        response = requests.post(
            f"{BASE_URL}/api/pantry/ai-shopping",
            headers=self.headers,
            json={"items": []}
        )
        assert response.status_code == 200, f"AI shopping suggestions failed: {response.text}"
        data = response.json()
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        print(f"✓ POST /api/pantry/ai-shopping (empty) - returned {len(data['suggestions'])} suggestions")
    
    def test_ai_shopping_suggestions_with_items(self):
        """Test AI shopping suggestions with existing pantry items"""
        pantry_items = [
            {"name": "Chicken"},
            {"name": "Rice"},
            {"name": "Onions"}
        ]
        response = requests.post(
            f"{BASE_URL}/api/pantry/ai-shopping",
            headers=self.headers,
            json={"items": pantry_items}
        )
        assert response.status_code == 200, f"AI shopping suggestions failed: {response.text}"
        data = response.json()
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        print(f"✓ POST /api/pantry/ai-shopping (with items) - returned {len(data['suggestions'])} suggestions")


class TestEventsStackOverflowFix:
    """Test Events endpoint - verify stack overflow fix"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data["session_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_events_no_stack_overflow(self):
        """Test GET /api/events doesn't cause stack overflow"""
        response = requests.get(
            f"{BASE_URL}/api/events",
            headers=self.headers,
            timeout=30  # Should respond quickly, not hang
        )
        assert response.status_code == 200, f"Get events failed: {response.text}"
        data = response.json()
        assert "events" in data
        assert isinstance(data["events"], list)
        print(f"✓ GET /api/events - returned {len(data['events'])} events (no stack overflow)")
    
    def test_get_events_with_date_filter(self):
        """Test GET /api/events with date filters"""
        response = requests.get(
            f"{BASE_URL}/api/events",
            headers=self.headers,
            params={
                "start_date": "2025-01-01",
                "end_date": "2025-12-31"
            },
            timeout=30
        )
        assert response.status_code == 200, f"Get events with filter failed: {response.text}"
        data = response.json()
        assert "events" in data
        print(f"✓ GET /api/events (with date filter) - returned {len(data['events'])} events")
    
    def test_create_event(self):
        """Test creating an event"""
        event_data = {
            "title": f"TEST_Event_{uuid.uuid4().hex[:6]}",
            "description": "Test event for iteration 21",
            "event_date": "2025-02-01",
            "event_time": "14:00",
            "event_type": "appointment"
        }
        response = requests.post(
            f"{BASE_URL}/api/events",
            headers=self.headers,
            json=event_data
        )
        assert response.status_code == 200, f"Create event failed: {response.text}"
        data = response.json()
        assert data["title"] == event_data["title"]
        assert "event_id" in data
        print(f"✓ POST /api/events - created event: {data['event_id']}")


class TestFamilyWallStackOverflowFix:
    """Test Family Wall endpoint - verify stack overflow fix"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data["session_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_family_wall_no_stack_overflow(self):
        """Test GET /api/family-wall doesn't cause stack overflow"""
        response = requests.get(
            f"{BASE_URL}/api/family-wall",
            headers=self.headers,
            timeout=30  # Should respond quickly, not hang
        )
        assert response.status_code == 200, f"Get family wall failed: {response.text}"
        data = response.json()
        assert "posts" in data
        assert isinstance(data["posts"], list)
        print(f"✓ GET /api/family-wall - returned {len(data['posts'])} posts (no stack overflow)")
    
    def test_create_family_wall_post(self):
        """Test creating a family wall post"""
        post_data = {
            "content": f"TEST_Post_{uuid.uuid4().hex[:6]} - Testing iteration 21",
            "type": "text"
        }
        response = requests.post(
            f"{BASE_URL}/api/family-wall",
            headers=self.headers,
            json=post_data
        )
        assert response.status_code == 200, f"Create post failed: {response.text}"
        data = response.json()
        assert "post_id" in data
        assert data["content"] == post_data["content"]
        print(f"✓ POST /api/family-wall - created post: {data['post_id']}")
    
    def test_create_poll_post(self):
        """Test creating a poll post"""
        poll_data = {
            "content": f"TEST_Poll_{uuid.uuid4().hex[:6]} - What's for dinner?",
            "type": "poll",
            "poll_options": ["Pizza", "Tacos", "Pasta"]
        }
        response = requests.post(
            f"{BASE_URL}/api/family-wall",
            headers=self.headers,
            json=poll_data
        )
        assert response.status_code == 200, f"Create poll failed: {response.text}"
        data = response.json()
        assert "post_id" in data
        assert data["type"] == "poll"
        assert len(data["poll_options"]) == 3
        print(f"✓ POST /api/family-wall (poll) - created poll: {data['post_id']}")


class TestShoppingListCRUD:
    """Test Shopping List CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data["session_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_shopping_list(self):
        """Test getting shopping list"""
        response = requests.get(
            f"{BASE_URL}/api/shopping",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get shopping list failed: {response.text}"
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        print(f"✓ GET /api/shopping - returned {len(data['items'])} items")
    
    def test_add_shopping_item(self):
        """Test adding a shopping item"""
        item_data = {
            "name": f"TEST_ShoppingItem_{uuid.uuid4().hex[:6]}"
        }
        response = requests.post(
            f"{BASE_URL}/api/shopping",
            headers=self.headers,
            json=item_data
        )
        assert response.status_code == 200, f"Add shopping item failed: {response.text}"
        data = response.json()
        assert data["name"] == item_data["name"]
        assert "item_id" in data
        # Parent-added items should be auto-approved
        assert data["status"] == "approved"
        print(f"✓ POST /api/shopping - created item: {data['item_id']}")
        return data
    
    def test_update_shopping_item(self):
        """Test updating a shopping item"""
        # First create an item
        item_data = {"name": f"TEST_UpdateItem_{uuid.uuid4().hex[:6]}"}
        create_response = requests.post(
            f"{BASE_URL}/api/shopping",
            headers=self.headers,
            json=item_data
        )
        assert create_response.status_code == 200
        item = create_response.json()
        item_id = item["item_id"]
        
        # Update the item
        update_data = {"status": "purchased"}
        update_response = requests.put(
            f"{BASE_URL}/api/shopping/{item_id}",
            headers=self.headers,
            json=update_data
        )
        assert update_response.status_code == 200, f"Update shopping item failed: {update_response.text}"
        data = update_response.json()
        assert data["status"] == "purchased"
        print(f"✓ PUT /api/shopping/{item_id} - updated to purchased")
    
    def test_delete_shopping_item(self):
        """Test deleting a shopping item"""
        # First create an item
        item_data = {"name": f"TEST_DeleteItem_{uuid.uuid4().hex[:6]}"}
        create_response = requests.post(
            f"{BASE_URL}/api/shopping",
            headers=self.headers,
            json=item_data
        )
        assert create_response.status_code == 200
        item = create_response.json()
        item_id = item["item_id"]
        
        # Delete the item
        delete_response = requests.delete(
            f"{BASE_URL}/api/shopping/{item_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200, f"Delete shopping item failed: {delete_response.text}"
        print(f"✓ DELETE /api/shopping/{item_id} - deleted successfully")


class TestHealthAndAuth:
    """Test health check and auth endpoints"""
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ GET /api/health - service is healthy")
    
    def test_auth_me_with_token(self):
        """Test /api/auth/me with valid token"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert login_response.status_code == 200
        token = login_response.json()["session_token"]
        
        # Then check auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        print(f"✓ GET /api/auth/me - returned user: {data['user_id']}")


# Cleanup fixture to remove test data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests complete"""
    yield
    # Note: In a real scenario, we'd clean up TEST_ prefixed items
    # For now, we leave them as they don't affect functionality
    print("\n✓ Test session completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
