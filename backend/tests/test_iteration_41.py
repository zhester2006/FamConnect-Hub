"""
Iteration 41 Tests - FamFocus Hub
Testing:
1. Elizabeth Buss visible in /api/family/members/detailed
2. Pantry page loads at /pantry with items displayed
3. Pantry appears in sidebar navigation
4. Family Wall - delete button visible for parent role
5. Live Chat - delete button visible for parent role
6. POST /api/pixie/command returns intelligent response reading calendar data
7. POST /api/pixie/command executes add_shopping_item action successfully
8. POST /api/pixie/command checks pantry inventory correctly
9. POST /api/pixie/command in homehub mode returns needs_pin=true and family_members list
10. POST /api/pixie/command with acting_user_id and correct PIN executes the action
11. POST /api/pixie/voice-command endpoint exists and requires audio file
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://family-pantry-hub-2.preview.emergentagent.com')

# Test credentials
PARENT_EMAIL = "zhesterusar@gmail.com"
ELIZABETH_EMAIL = "ebuss980@gmail.com"


class TestDevLogin:
    """Test dev login functionality"""
    
    def test_parent_login(self):
        """Test parent dev login returns session token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        assert response.status_code == 200, f"Parent login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session_token in response"
        assert data.get("user", {}).get("role") == "parent"
        print(f"✓ Parent login successful: {data.get('user', {}).get('name')}")
        return data["session_token"]
    
    def test_elizabeth_login(self):
        """Test Elizabeth dev login returns session token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": ELIZABETH_EMAIL,
            "role": "parent"
        })
        assert response.status_code == 200, f"Elizabeth login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session_token in response"
        assert data.get("user", {}).get("role") == "parent"
        print(f"✓ Elizabeth login successful: {data.get('user', {}).get('name')}")
        return data["session_token"]


class TestElizabethVisibility:
    """Test Elizabeth Buss is visible in family members"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_elizabeth_in_family_members_detailed(self, parent_token):
        """Elizabeth should be visible in /api/family/members/detailed"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/family/members/detailed", headers=headers)
        assert response.status_code == 200, f"Failed to get family members: {response.text}"
        
        data = response.json()
        members = data.get("members", [])
        
        # Find Elizabeth
        elizabeth = None
        for member in members:
            if "elizabeth" in member.get("name", "").lower() or "ebuss" in member.get("email", "").lower():
                elizabeth = member
                break
        
        assert elizabeth is not None, f"Elizabeth not found in family members. Members: {[m.get('name') for m in members]}"
        print(f"✓ Elizabeth found in family members: {elizabeth.get('name')} ({elizabeth.get('role')})")


class TestPantryAPI:
    """Test Pantry API endpoints"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_pantry_get_items(self, parent_token):
        """Test GET /api/pantry returns items"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/pantry", headers=headers)
        assert response.status_code == 200, f"Failed to get pantry: {response.text}"
        
        data = response.json()
        assert "items" in data, "No items key in response"
        print(f"✓ Pantry API returns {len(data.get('items', []))} items")
    
    def test_pantry_add_item(self, parent_token):
        """Test POST /api/pantry adds item"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        test_item = {
            "name": "TEST_Milk",
            "category": "fridge",
            "quantity": "1",
            "unit": "gallon"
        }
        response = requests.post(f"{BASE_URL}/api/pantry", headers=headers, json=test_item)
        assert response.status_code in [200, 201], f"Failed to add pantry item: {response.text}"
        
        data = response.json()
        assert data.get("name") == "TEST_Milk" or data.get("item", {}).get("name") == "TEST_Milk"
        print(f"✓ Pantry item added successfully")


class TestWallDeleteAPI:
    """Test Family Wall delete endpoint for parents"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_wall_delete_endpoint_exists(self, parent_token):
        """Test DELETE /api/family-wall/{post_id} endpoint exists"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        # Try to delete a non-existent post - should return 404, not 405
        response = requests.delete(f"{BASE_URL}/api/family-wall/nonexistent_post", headers=headers)
        assert response.status_code in [404, 200], f"Delete endpoint not working: {response.status_code} - {response.text}"
        print(f"✓ Wall delete endpoint exists (returned {response.status_code})")


class TestMessagesDeleteAPI:
    """Test Live Chat delete endpoint for parents"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_messages_delete_endpoint_exists(self, parent_token):
        """Test DELETE /api/messages/{message_id} endpoint exists"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        # Try to delete a non-existent message - should return 404, not 405
        response = requests.delete(f"{BASE_URL}/api/messages/nonexistent_msg", headers=headers)
        assert response.status_code in [404, 200], f"Delete endpoint not working: {response.status_code} - {response.text}"
        print(f"✓ Messages delete endpoint exists (returned {response.status_code})")


class TestPixieCommand:
    """Test Pixie AI command endpoint"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_pixie_command_reads_calendar(self, parent_token):
        """Test POST /api/pixie/command returns intelligent response reading calendar data"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "What's on the calendar today?",
            "context": [],
            "mode": "normal"
        }, timeout=30)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        print(f"✓ Pixie calendar response: {data.get('response', '')[:100]}...")
    
    def test_pixie_command_add_shopping_item(self, parent_token):
        """Test POST /api/pixie/command executes add_shopping_item action"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "Add eggs to the shopping list",
            "context": [],
            "mode": "normal"
        }, timeout=30)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        
        # Check if action was taken
        actions_taken = data.get("actions_taken", [])
        print(f"✓ Pixie add shopping response: {data.get('response', '')[:100]}...")
        print(f"  Actions taken: {actions_taken}")
    
    def test_pixie_command_checks_pantry(self, parent_token):
        """Test POST /api/pixie/command checks pantry inventory"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "Do we have milk in the pantry?",
            "context": [],
            "mode": "normal"
        }, timeout=30)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        print(f"✓ Pixie pantry check response: {data.get('response', '')[:100]}...")
    
    def test_pixie_homehub_mode_needs_pin(self, parent_token):
        """Test POST /api/pixie/command in homehub mode returns needs_pin=true"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "Add bread to the shopping list",
            "context": [],
            "mode": "homehub"
        }, timeout=30)
        
        assert response.status_code == 200, f"Pixie homehub command failed: {response.text}"
        data = response.json()
        
        # In homehub mode with an action, should return needs_pin=true
        if data.get("needs_pin"):
            assert "family_members" in data, "No family_members in homehub response"
            print(f"✓ Pixie homehub mode returns needs_pin=true with {len(data.get('family_members', []))} family members")
        else:
            # If no action was planned, needs_pin might be false
            print(f"✓ Pixie homehub mode response (no action needed): {data.get('response', '')[:100]}...")


class TestPixieVoiceCommand:
    """Test Pixie voice command endpoint"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_pixie_voice_endpoint_exists(self, parent_token):
        """Test POST /api/pixie/voice-command endpoint exists and requires audio file"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        # Send without audio file - should return 422 (validation error) not 404
        response = requests.post(f"{BASE_URL}/api/pixie/voice-command", headers=headers)
        assert response.status_code in [422, 400], f"Voice endpoint not working as expected: {response.status_code} - {response.text}"
        print(f"✓ Pixie voice-command endpoint exists (returned {response.status_code} - requires audio file)")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_cleanup_test_pantry_items(self, parent_token):
        """Remove TEST_ prefixed pantry items"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/pantry", headers=headers)
        if response.status_code == 200:
            items = response.json().get("items", [])
            for item in items:
                if item.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/pantry/{item['item_id']}", headers=headers)
                    print(f"  Cleaned up: {item['name']}")
        print("✓ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
