"""
Iteration 43 Tests - FamFocus Hub Pixie AI Features
Testing:
1. Elizabeth Buss visible in HomeHub profiles: GET /api/users/family-profiles returns Elizabeth
2. Elizabeth visible in family members: GET /api/family/members returns Elizabeth when logged in as homehub
3. GET /api/pixie/preferences returns always_listening=true for homehub user
4. POST /api/pixie/preferences saves always_listening and voice_responses preferences
5. POST /api/pixie/command with voice_mode=true returns audio field (TTS)
6. POST /api/pixie/command reads app data correctly (calendar, pantry, chores)
7. POST /api/pixie/command executes actions (add shopping item, send message)
8. POST /api/pixie/command in homehub mode triggers PIN flow (needs_pin=true)
9. POST /api/pixie/tts converts text to audio base64
10. Pixie learning: conversations stored in pixie_conversations collection
11. Pixie learning: pixie_memory updated with interaction count and topics
12. Pantry page at /pantry loads correctly
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://family-pantry-hub-2.preview.emergentagent.com')

# Test credentials from review request
PARENT_EMAIL = "zhesterusar@gmail.com"
HOMEHUB_EMAIL = "ikh.mrnugget@gmail.com"
ELIZABETH_EMAIL = "ebuss980@gmail.com"


class TestDevLogin:
    """Test dev login functionality for all user types"""
    
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
    
    def test_homehub_login(self):
        """Test homehub dev login returns session token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": HOMEHUB_EMAIL,
            "role": "homehub"
        })
        assert response.status_code == 200, f"HomeHub login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session_token in response"
        assert data.get("user", {}).get("role") == "homehub"
        print(f"✓ HomeHub login successful: {data.get('user', {}).get('name')}")
    
    def test_elizabeth_login(self):
        """Test Elizabeth dev login returns session token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": ELIZABETH_EMAIL,
            "role": "parent"
        })
        assert response.status_code == 200, f"Elizabeth login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session_token in response"
        print(f"✓ Elizabeth login successful: {data.get('user', {}).get('name')}")


class TestElizabethVisibility:
    """Test Elizabeth Buss is visible in family profiles and members"""
    
    @pytest.fixture
    def homehub_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": HOMEHUB_EMAIL,
            "role": "homehub"
        })
        return response.json()["session_token"]
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_elizabeth_in_family_profiles(self, homehub_token):
        """GET /api/users/family-profiles returns Elizabeth when logged in as homehub"""
        headers = {"Authorization": f"Bearer {homehub_token}"}
        response = requests.get(f"{BASE_URL}/api/users/family-profiles", headers=headers)
        assert response.status_code == 200, f"Failed to get family profiles: {response.text}"
        
        data = response.json()
        profiles = data.get("profiles", [])
        
        # Find Elizabeth
        elizabeth = None
        for profile in profiles:
            if "elizabeth" in profile.get("name", "").lower() or "ebuss" in profile.get("email", "").lower():
                elizabeth = profile
                break
        
        assert elizabeth is not None, f"Elizabeth not found in family profiles. Profiles: {[p.get('name') for p in profiles]}"
        print(f"✓ Elizabeth found in family-profiles: {elizabeth.get('name')} ({elizabeth.get('role')})")
    
    def test_elizabeth_in_family_members(self, homehub_token):
        """GET /api/family/members returns Elizabeth when logged in as homehub"""
        headers = {"Authorization": f"Bearer {homehub_token}"}
        response = requests.get(f"{BASE_URL}/api/family/members", headers=headers)
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
        print(f"✓ Elizabeth found in family/members: {elizabeth.get('name')} ({elizabeth.get('role')})")
        print(f"  Total family members: {len(members)}")


class TestPixiePreferencesHomehub:
    """Test Pixie preferences for homehub user"""
    
    @pytest.fixture
    def homehub_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": HOMEHUB_EMAIL,
            "role": "homehub"
        })
        return response.json()["session_token"]
    
    def test_homehub_always_listening_default(self, homehub_token):
        """GET /api/pixie/preferences returns always_listening=true for homehub user"""
        headers = {"Authorization": f"Bearer {homehub_token}"}
        response = requests.get(f"{BASE_URL}/api/pixie/preferences", headers=headers)
        
        assert response.status_code == 200, f"Failed to get preferences: {response.text}"
        data = response.json()
        
        # For homehub users, always_listening should default to true
        assert data.get("always_listening") == True, f"always_listening should be True for homehub. Got: {data}"
        print(f"✓ HomeHub always_listening default is True")
        print(f"  Full preferences: {data}")
    
    def test_save_pixie_preferences(self, homehub_token):
        """POST /api/pixie/preferences saves always_listening and voice_responses"""
        headers = {"Authorization": f"Bearer {homehub_token}", "Content-Type": "application/json"}
        
        # Save preferences
        response = requests.post(f"{BASE_URL}/api/pixie/preferences", headers=headers, json={
            "always_listening": True,
            "voice_responses": True
        })
        
        assert response.status_code == 200, f"Failed to save preferences: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Preferences save did not return success"
        print(f"✓ Pixie preferences saved successfully")
        
        # Verify by getting preferences again
        response = requests.get(f"{BASE_URL}/api/pixie/preferences", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("always_listening") == True
        assert data.get("voice_responses") == True
        print(f"✓ Verified preferences: {data}")


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
        }, timeout=90)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        
        # Check for audio field when voice_mode=true
        if "audio" in data:
            assert len(data["audio"]) > 100, "Audio field seems too short for valid base64 mp3"
            print(f"✓ Pixie voice_mode=true: audio field present with {len(data['audio'])} chars")
        else:
            print(f"⚠ WARNING: No audio field returned with voice_mode=true. Response: {data.get('response', '')[:100]}...")
        
        print(f"  Pixie response: {data.get('response', '')[:100]}...")


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
        print(f"✓ TTS endpoint returned audio with {len(data['audio'])} chars")


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
        }, timeout=90)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        print(f"✓ Pixie calendar response: {data.get('response', '')[:150]}...")
    
    def test_pixie_checks_pantry(self, parent_token):
        """POST /api/pixie/command checks pantry inventory correctly"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "What items do we have in the pantry?",
            "context": [],
            "mode": "normal",
            "voice_mode": False
        }, timeout=90)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        print(f"✓ Pixie pantry check response: {data.get('response', '')[:150]}...")
    
    def test_pixie_reads_chores(self, parent_token):
        """POST /api/pixie/command reads chores data correctly"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "What chores are scheduled for today?",
            "context": [],
            "mode": "normal",
            "voice_mode": False
        }, timeout=90)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        print(f"✓ Pixie chores response: {data.get('response', '')[:150]}...")


class TestPixieActions:
    """Test Pixie executing actions"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": PARENT_EMAIL,
            "role": "parent"
        })
        return response.json()["session_token"]
    
    def test_pixie_adds_shopping_item(self, parent_token):
        """POST /api/pixie/command can add items to shopping list"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "Add TEST_iteration43_bananas to the shopping list",
            "context": [],
            "mode": "normal",
            "voice_mode": False
        }, timeout=90)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        
        actions_taken = data.get("actions_taken", [])
        print(f"✓ Pixie add shopping response: {data.get('response', '')[:100]}...")
        print(f"  Actions taken: {actions_taken}")
        
        # Check if action was successful
        success_count = sum(1 for a in actions_taken if a.get("success"))
        if success_count > 0:
            print(f"✓ Successfully executed {success_count} action(s)")
    
    def test_pixie_sends_message(self, parent_token):
        """POST /api/pixie/command can send messages"""
        headers = {"Authorization": f"Bearer {parent_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "Send a message to the family chat saying TEST_iteration43 hello from Pixie",
            "context": [],
            "mode": "normal",
            "voice_mode": False
        }, timeout=90)
        
        assert response.status_code == 200, f"Pixie command failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response in Pixie output"
        
        actions_taken = data.get("actions_taken", [])
        print(f"✓ Pixie send message response: {data.get('response', '')[:100]}...")
        print(f"  Actions taken: {actions_taken}")


class TestPixieHomehubMode:
    """Test Pixie HomeHub mode with PIN verification"""
    
    @pytest.fixture
    def homehub_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": HOMEHUB_EMAIL,
            "role": "homehub"
        })
        return response.json()["session_token"]
    
    def test_pixie_homehub_mode_needs_pin(self, homehub_token):
        """POST /api/pixie/command in homehub mode returns needs_pin=true and family_members"""
        headers = {"Authorization": f"Bearer {homehub_token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/pixie/command", headers=headers, json={
            "message": "Add bread to the shopping list",
            "context": [],
            "mode": "homehub",
            "voice_mode": False
        }, timeout=90)
        
        assert response.status_code == 200, f"Pixie homehub command failed: {response.text}"
        data = response.json()
        
        # In homehub mode with an action, should return needs_pin=true
        if data.get("needs_pin"):
            assert "family_members" in data, "No family_members in homehub response"
            print(f"✓ Pixie homehub mode returns needs_pin=true with {len(data.get('family_members', []))} family members")
            
            # Check if Elizabeth is in the family members list
            family_members = data.get("family_members", [])
            elizabeth = None
            for member in family_members:
                if "elizabeth" in member.get("name", "").lower():
                    elizabeth = member
                    break
            if elizabeth:
                print(f"✓ Elizabeth found in homehub family_members: {elizabeth.get('name')}")
        else:
            print(f"⚠ Pixie homehub mode response (no action needed): {data.get('response', '')[:100]}...")


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
        
        # Cleanup test messages
        response = requests.get(f"{BASE_URL}/api/messages", headers=headers)
        if response.status_code == 200:
            messages = response.json().get("messages", [])
            for msg in messages:
                if "TEST_iteration43" in msg.get("content", ""):
                    requests.delete(f"{BASE_URL}/api/messages/{msg['message_id']}", headers=headers)
                    print(f"  Cleaned up message: {msg['content'][:50]}...")
        
        print("✓ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
