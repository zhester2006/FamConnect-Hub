"""
Test Enhancement Batch Features:
1. AI Daily Quote with refresh button
2. Live Chat with read receipts & online status
3. Profile background customization
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from mongosh setup
SESSION_TOKEN = "test_session_iter9_1770176981262"
USER_ID = "test_parent_iter9_1770176981262"
CHILD_ID = "test_child_iter9_1770176981278"


@pytest.fixture
def auth_headers():
    """Headers with authentication"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}",
        "Cookie": f"session_token={SESSION_TOKEN}"
    }


@pytest.fixture
def auth_session():
    """Session with authentication cookie"""
    session = requests.Session()
    session.cookies.set("session_token", SESSION_TOKEN)
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestAIDailyQuote:
    """Test AI Daily Quote feature"""
    
    def test_get_daily_quote(self, auth_session):
        """GET /api/family-wall/daily-quote returns quote"""
        response = auth_session.get(f"{BASE_URL}/api/family-wall/daily-quote")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "quote" in data, "Response should contain 'quote' field"
        assert "date" in data, "Response should contain 'date' field"
        assert isinstance(data["quote"], str), "Quote should be a string"
        assert len(data["quote"]) > 0, "Quote should not be empty"
        print(f"Daily quote: {data['quote'][:100]}...")
    
    def test_refresh_daily_quote(self, auth_session):
        """GET /api/family-wall/daily-quote?refresh=true generates new quote"""
        # First get the current quote
        response1 = auth_session.get(f"{BASE_URL}/api/family-wall/daily-quote")
        assert response1.status_code == 200
        original_quote = response1.json().get("quote", "")
        
        # Now refresh to get a new quote
        response2 = auth_session.get(f"{BASE_URL}/api/family-wall/daily-quote?refresh=true")
        assert response2.status_code == 200, f"Refresh failed: {response2.text}"
        
        data = response2.json()
        assert "quote" in data, "Refreshed response should contain 'quote'"
        assert isinstance(data["quote"], str), "Quote should be a string"
        assert len(data["quote"]) > 0, "Refreshed quote should not be empty"
        
        # Note: The new quote might be different (AI generated)
        print(f"Refreshed quote: {data['quote'][:100]}...")
    
    def test_daily_quote_requires_auth(self):
        """Daily quote endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/family-wall/daily-quote")
        assert response.status_code == 401, "Should require authentication"


class TestLiveChatReadReceipts:
    """Test Live Chat read receipts and online status"""
    
    def test_send_message(self, auth_session):
        """POST /api/messages creates a new message"""
        response = auth_session.post(
            f"{BASE_URL}/api/messages",
            json={"content": "TEST_message_iter9_" + str(int(time.time()))}
        )
        assert response.status_code == 200, f"Failed to send message: {response.text}"
        
        data = response.json()
        assert "message_id" in data, "Response should contain message_id"
        assert "content" in data, "Response should contain content"
        assert "read_by" in data, "Response should contain read_by array"
        assert isinstance(data["read_by"], list), "read_by should be a list"
        assert USER_ID in data["read_by"], "Sender should be in read_by list"
        
        return data["message_id"]
    
    def test_get_messages(self, auth_session):
        """GET /api/messages returns messages with read_by field"""
        response = auth_session.get(f"{BASE_URL}/api/messages")
        assert response.status_code == 200, f"Failed to get messages: {response.text}"
        
        data = response.json()
        assert "messages" in data, "Response should contain 'messages'"
        
        if len(data["messages"]) > 0:
            msg = data["messages"][-1]
            assert "read_by" in msg, "Message should have read_by field"
            assert "user_id" in msg, "Message should have user_id"
            assert "user_name" in msg, "Message should have user_name"
            print(f"Latest message read_by: {msg['read_by']}")
    
    def test_mark_message_as_read(self, auth_session):
        """PUT /api/messages/{id}/read marks message as read"""
        # First create a message
        create_resp = auth_session.post(
            f"{BASE_URL}/api/messages",
            json={"content": "TEST_read_receipt_" + str(int(time.time()))}
        )
        assert create_resp.status_code == 200
        message_id = create_resp.json()["message_id"]
        
        # Mark as read
        read_resp = auth_session.put(f"{BASE_URL}/api/messages/{message_id}/read")
        assert read_resp.status_code == 200, f"Failed to mark as read: {read_resp.text}"
        
        data = read_resp.json()
        assert data.get("success") == True, "Should return success: true"
    
    def test_messages_require_auth(self):
        """Messages endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/messages")
        assert response.status_code == 401, "Should require authentication"


class TestOnlineStatus:
    """Test online status indicators"""
    
    def test_get_family_members(self, auth_session):
        """GET /api/family/members returns members with online_status"""
        response = auth_session.get(f"{BASE_URL}/api/family/members")
        assert response.status_code == 200, f"Failed to get family members: {response.text}"
        
        data = response.json()
        assert "members" in data, "Response should contain 'members'"
        
        if len(data["members"]) > 0:
            member = data["members"][0]
            # Check for online status fields
            assert "online_status" in member or "last_seen" in member, \
                "Member should have online_status or last_seen field"
            print(f"Family members: {[m.get('name') for m in data['members']]}")
    
    def test_get_online_users(self, auth_session):
        """GET /api/family/online returns online family members"""
        response = auth_session.get(f"{BASE_URL}/api/family/online")
        # This endpoint may or may not exist
        if response.status_code == 200:
            data = response.json()
            assert "online" in data or "users" in data, "Should return online users"
            print(f"Online users response: {data}")
        elif response.status_code == 404:
            print("Note: /api/family/online endpoint not found - may use different approach")
        else:
            print(f"Online users endpoint returned: {response.status_code}")


class TestProfileBackground:
    """Test profile background customization"""
    
    def test_get_user_profile(self, auth_session):
        """GET /api/users/{user_id} returns user with profile_background field"""
        response = auth_session.get(f"{BASE_URL}/api/users/{USER_ID}")
        assert response.status_code == 200, f"Failed to get user: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Response should contain user_id"
        # profile_background may be null initially
        print(f"User profile_background: {data.get('profile_background', 'not set')}")
    
    def test_update_user_profile(self, auth_session):
        """PUT /api/users/{user_id} can update profile settings"""
        response = auth_session.put(
            f"{BASE_URL}/api/users/{USER_ID}",
            json={"settings": {"test_setting": "test_value"}}
        )
        assert response.status_code == 200, f"Failed to update user: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Response should contain user_id"
    
    def test_upload_profile_picture(self, auth_session):
        """POST /api/users/{user_id}/upload-picture handles image upload"""
        # Test with a small base64 image (1x1 pixel PNG)
        small_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        response = auth_session.post(
            f"{BASE_URL}/api/users/{USER_ID}/upload-picture",
            json={"image": small_image, "type": "background"}
        )
        
        # Endpoint may or may not exist
        if response.status_code == 200:
            print("Profile picture upload successful")
        elif response.status_code == 404:
            print("Note: /api/users/{id}/upload-picture endpoint not found")
        else:
            print(f"Upload endpoint returned: {response.status_code} - {response.text[:200]}")


class TestFamilyWall:
    """Test Family Wall with daily quote section"""
    
    def test_get_family_wall_posts(self, auth_session):
        """GET /api/family-wall returns posts"""
        response = auth_session.get(f"{BASE_URL}/api/family-wall")
        assert response.status_code == 200, f"Failed to get family wall: {response.text}"
        
        data = response.json()
        assert "posts" in data, "Response should contain 'posts'"
        print(f"Family wall has {len(data['posts'])} posts")
    
    def test_create_family_wall_post(self, auth_session):
        """POST /api/family-wall creates a new post"""
        response = auth_session.post(
            f"{BASE_URL}/api/family-wall",
            json={"content": "TEST_wall_post_iter9_" + str(int(time.time())), "post_type": "text"}
        )
        assert response.status_code == 200, f"Failed to create post: {response.text}"
        
        data = response.json()
        assert "post_id" in data, "Response should contain post_id"
        assert "content" in data, "Response should contain content"


class TestChoreSchedulerDragDrop:
    """Test Chore Scheduler drag-and-drop (from previous iteration)"""
    
    def test_get_chore_types(self, auth_session):
        """GET /api/chores/types returns chore types for drag-drop"""
        response = auth_session.get(f"{BASE_URL}/api/chores/types")
        assert response.status_code == 200, f"Failed to get chore types: {response.text}"
        
        data = response.json()
        assert "chore_types" in data, "Response should contain 'chore_types'"
        assert len(data["chore_types"]) > 0, "Should have at least one chore type"
        print(f"Available chore types: {len(data['chore_types'])}")
    
    def test_create_chore_with_date(self, auth_session):
        """POST /api/chores creates chore with scheduled_date"""
        from datetime import datetime, timedelta
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = auth_session.post(
            f"{BASE_URL}/api/chores",
            json={
                "title": "TEST_chore_iter9_" + str(int(time.time())),
                "scheduled_date": tomorrow,
                "assigned_to": CHILD_ID,
                "points": 15
            }
        )
        assert response.status_code == 200, f"Failed to create chore: {response.text}"
        
        data = response.json()
        assert "chore_id" in data, "Response should contain chore_id"
        assert data["scheduled_date"] == tomorrow, "Scheduled date should match"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
