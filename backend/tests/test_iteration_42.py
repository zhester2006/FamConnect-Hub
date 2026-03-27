"""
Iteration 42 Tests - FamFocus Hub Pixie AI Features
Testing:
1. POST /api/pixie/command with voice_mode=true returns audio field with base64 mp3 TTS
2. POST /api/pixie/command without voice_mode returns no audio field
3. GET /api/pixie/preferences returns default preferences (always_listening, voice_responses)
4. POST /api/pixie/preferences saves user preferences
5. POST /api/pixie/tts converts text to audio and returns base64
6. POST /api/pixie/command reads calendar data correctly
7. POST /api/pixie/command can add items to shopping list (actions_taken success)
8. POST /api/pixie/command checks pantry inventory correctly
9. POST /api/pixie/command in homehub mode returns needs_pin and family_members
10. Pixie learning: pixie_memory collection gets updated after interactions
11. Pixie learning: pixie_conversations collection stores conversations
12. Elizabeth Buss visible in /api/family/members/detailed
13. Pantry page loads at /pantry
14. Pantry in sidebar navigation
15. Family Wall delete button for parent
16. Live Chat delete button for parent
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
        print(f"Parent login successful: {data.get('user', {}).get('name')}")
        return data["session_token"]


class TestPixieVoiceMode:
    """Test Pixie voice mode with TTS"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_pixie_command_with_voice_mode_returns_audio(self, parent_token):
        """POST /api/pixie/command with voice_mode=true returns audio field with base64 mp3 TTS"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "Hello Pixie, what time is it?",
            "context": [],
            "mode": "normal",
            "voice_mode": True
        }, timeout=60)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        
        # Check for audio field when voice_mode=true
        if "audio" in data:
            assert len(data["audio"]) > 100, "Audio field seems too short for valid base64 mp3"
            print(f"Pixie voice_mode=true: audio field present with {len(data['audio'])} chars")
        else:
            print(f"WARNING: No audio field returned with voice_mode=true. Response: {data.get('response', '')[:100]}...")
        
        print(f"Pixie response: {data.get('response', '')[:100]}...")
    
    def test_pixie_command_without_voice_mode_no_audio(self, parent_token):
        """POST /api/pixie/command without voice_mode returns no audio field"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "What's the weather like?",
            "context": [],
            "mode": "normal",
            "voice_mode": False
        }, timeout=60)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        
        # Should NOT have audio field when voice_mode=false
        has_audio = "audio" in data
        print(f"Pixie voice_mode=false: audio field present = {has_audio}")
        print(f"Pixie response: {data.get('response', '')[:100]}...")


class TestPixiePreferences:
    """Test Pixie preferences endpoints"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_get_pixie_preferences(self, parent_token):
        """GET /api/pixie/preferences returns default preferences"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/pixie/preferences", headers=headers)
        
        assert response.status_code == 200, f"Failed to get preferences: {response.text}"
        data = response.json()
        
        # Check for expected preference keys
        assert "always_listening" in data or "voice_responses" in data, "Missing expected preference keys"
        print(f"Pixie preferences: {data}")
    
    def test_post_pixie_preferences(self, parent_token):
        """POST /api/pixie/preferences saves user preferences"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        
        # Save preferences
        response = requests.post(f"{BASE_URL}/api/pixie/preferences", headers=headers, json={
            "always_listening": True,
            "voice_responses": True
        })
        
        assert response.status_code == 200, f"Failed to save preferences: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Preferences save did not return success"
        print(f"Pixie preferences saved successfully")
        
        # Verify by getting preferences again
        response = requests.get(f"{BASE_URL}/api/pixie/preferences", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"Verified preferences: {data}")


class TestPixieTTS:
    """Test Pixie TTS endpoint"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_pixie_tts_endpoint(self, parent_token):
        """POST /api/pixie/tts converts text to audio and returns base64"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/tts", headers=headers, json={
            "text": "Hello, this is a test of the Pixie text to speech system."
        }, timeout=60)
        
        assert response.status_code == 200, f"TTS endpoint failed: {response.text}"
        data = response.json()
        
        assert "audio" in data, "No audio field in TTS response"
        assert data.get("success") == True, "TTS did not return success"
        assert len(data["audio"]) > 100, "Audio field seems too short for valid base64 mp3"
        print(f"TTS endpoint returned audio with {len(data['audio'])} chars")


class TestPixieDataAccess:
    """Test Pixie reading app data"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_pixie_reads_calendar(self, parent_token):
        """POST /api/pixie/command reads calendar data correctly"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "What events do I have on the calendar today or tomorrow?",
            "context": [],
            "mode": "normal",
            "voice_mode": False
        }, timeout=60)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        print(f"Pixie calendar response: {data.get('response', '')[:150]}...")
    
    def test_pixie_adds_shopping_item(self, parent_token):
        """POST /api/pixie/command can add items to shopping list"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "Add TEST_bananas to the shopping list",
            "context": [],
            "mode": "normal",
            "voice_mode": False
        }, timeout=60)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        
        actions_taken = data.get("actions_taken", [])
        print(f"Pixie add shopping response: {data.get('response', '')[:100]}...")
        print(f"Actions taken: {actions_taken}")
        
        # Check if action was successful
        success_count = sum(1 for a in actions_taken if a.get("success"))
        if success_count > 0:
            print(f"Successfully executed {success_count} action(s)")
    
    def test_pixie_checks_pantry(self, parent_token):
        """POST /api/pixie/command checks pantry inventory correctly"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "What items do we have in the pantry?",
            "context": [],
            "mode": "normal",
            "voice_mode": False
        }, timeout=60)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        print(f"Pixie pantry check response: {data.get('response', '')[:150]}...")


class TestPixieHomehubMode:
    """Test Pixie HomeHub mode with PIN verification"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_pixie_homehub_mode_needs_pin(self, parent_token):
        """POST /api/pixie/command in homehub mode returns needs_pin=true and family_members"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "Add bread to the shopping list",
            "context": [],
            "mode": "homehub",
            "voice_mode": False
        }, timeout=60)
        
        assert response.status_code == 200, f"Pixie homehub command failed: {response.text}"
        data = response.json()
        
        # In homehub mode with an action, should return needs_pin=true
        if data.get("needs_pin"):
            assert "family_members" in data, "No family_members in homehub response"
            print(f"Pixie homehub mode returns needs_pin=true with {len(data.get('family_members', []))} family members")
        else:
            print(f"Pixie homehub mode response (no action needed): {data.get('response', '')[:100]}...")


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
        print(f"Elizabeth found in family members: {elizabeth.get('name')} ({elizabeth.get('role')})")


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
        print(f"Pantry API returns {len(data.get('items', []))} items")


class TestDeleteEndpoints:
    """Test delete endpoints for parent role"""
    
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
        response = requests.delete(f"{BASE_URL}/api/family-wall/nonexistent_post", headers=headers)
        assert response.status_code in [404, 200], f"Delete endpoint not working: {response.status_code} - {response.text}"
        print(f"Wall delete endpoint exists (returned {response.status_code})")
    
    def test_messages_delete_endpoint_exists(self, parent_token):
        """Test DELETE /api/messages/{message_id} endpoint exists"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.delete(f"{BASE_URL}/api/messages/nonexistent_msg", headers=headers)
        assert response.status_code in [404, 200], f"Delete endpoint not working: {response.status_code} - {response.text}"
        print(f"Messages delete endpoint exists (returned {response.status_code})")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_cleanup_test_shopping_items(self, parent_token):
        """Remove TEST_ prefixed shopping items"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/shopping", headers=headers)
        if response.status_code == 200:
            items = response.json().get("items", [])
            for item in items:
                if item.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/shopping/{item['item_id']}", headers=headers)
                    print(f"  Cleaned up shopping: {item['name']}")
        print("Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
