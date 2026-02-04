"""
Test suite for Chat features (emoji reactions, voice messages) and Notification system
Tests: POST /api/messages/{id}/react, PUT /api/notifications/{id}/read, PUT /api/notifications/read-all
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSetup:
    """Setup test user and session"""
    
    @pytest.fixture(scope="class")
    def session_token(self):
        """Create test user and session via dev-login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        data = response.json()
        return data.get('session_token')
    
    @pytest.fixture(scope="class")
    def auth_headers(self, session_token):
        """Get auth headers with Bearer token"""
        return {"Authorization": f"Bearer {session_token}"}


class TestMessageReactions(TestSetup):
    """Test message reaction endpoints"""
    
    def test_create_message_for_reactions(self, auth_headers):
        """Create a test message to react to"""
        response = requests.post(
            f"{BASE_URL}/api/messages",
            json={"content": f"TEST_reaction_message_{uuid.uuid4().hex[:8]}"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to create message: {response.text}"
        data = response.json()
        assert "message_id" in data
        # Store for later tests
        TestMessageReactions.test_message_id = data["message_id"]
        print(f"Created test message: {data['message_id']}")
    
    def test_add_reaction_to_message(self, auth_headers):
        """Test POST /api/messages/{id}/react - add reaction"""
        message_id = getattr(TestMessageReactions, 'test_message_id', None)
        if not message_id:
            pytest.skip("No test message created")
        
        response = requests.post(
            f"{BASE_URL}/api/messages/{message_id}/react",
            json={"reaction": "love"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to add reaction: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print("SUCCESS: Added 'love' reaction to message")
    
    def test_verify_reaction_added(self, auth_headers):
        """Verify reaction was added to message"""
        response = requests.get(
            f"{BASE_URL}/api/messages",
            headers=auth_headers
        )
        assert response.status_code == 200
        messages = response.json().get("messages", [])
        
        message_id = getattr(TestMessageReactions, 'test_message_id', None)
        test_message = next((m for m in messages if m.get("message_id") == message_id), None)
        
        if test_message:
            reactions = test_message.get("reactions", {})
            assert "love" in reactions, f"Reaction not found. Reactions: {reactions}"
            print(f"SUCCESS: Verified reaction exists: {reactions}")
        else:
            print("WARNING: Test message not found in messages list")
    
    def test_remove_reaction_toggle(self, auth_headers):
        """Test POST /api/messages/{id}/react - toggle removes reaction"""
        message_id = getattr(TestMessageReactions, 'test_message_id', None)
        if not message_id:
            pytest.skip("No test message created")
        
        # Toggle same reaction should remove it
        response = requests.post(
            f"{BASE_URL}/api/messages/{message_id}/react",
            json={"reaction": "love"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to toggle reaction: {response.text}"
        print("SUCCESS: Toggled reaction (should be removed)")
    
    def test_add_multiple_reactions(self, auth_headers):
        """Test adding multiple different reactions"""
        message_id = getattr(TestMessageReactions, 'test_message_id', None)
        if not message_id:
            pytest.skip("No test message created")
        
        reactions_to_add = ["like", "laugh", "sad"]
        for reaction in reactions_to_add:
            response = requests.post(
                f"{BASE_URL}/api/messages/{message_id}/react",
                json={"reaction": reaction},
                headers=auth_headers
            )
            assert response.status_code == 200, f"Failed to add {reaction} reaction"
        
        print(f"SUCCESS: Added multiple reactions: {reactions_to_add}")
    
    def test_reaction_without_type_fails(self, auth_headers):
        """Test that reaction without type returns 400"""
        message_id = getattr(TestMessageReactions, 'test_message_id', None)
        if not message_id:
            pytest.skip("No test message created")
        
        response = requests.post(
            f"{BASE_URL}/api/messages/{message_id}/react",
            json={},
            headers=auth_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("SUCCESS: Empty reaction type returns 400")
    
    def test_reaction_on_nonexistent_message(self, auth_headers):
        """Test reaction on non-existent message returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/messages/nonexistent_msg_123/react",
            json={"reaction": "love"},
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: Reaction on non-existent message returns 404")
    
    def test_reaction_without_auth_fails(self):
        """Test that reaction without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/messages/any_message/react",
            json={"reaction": "love"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Reaction without auth returns 401")


class TestNotifications(TestSetup):
    """Test notification endpoints"""
    
    def test_get_notifications(self, auth_headers):
        """Test GET /api/notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get notifications: {response.text}"
        data = response.json()
        assert "notifications" in data
        print(f"SUCCESS: Got {len(data['notifications'])} notifications")
    
    def test_get_notifications_without_auth(self):
        """Test GET /api/notifications without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Get notifications without auth returns 401")
    
    def test_mark_notification_read(self, auth_headers):
        """Test PUT /api/notifications/{id}/read"""
        # First create a notification by triggering a geofence alert
        # For now, test with a fake notification_id (should handle gracefully)
        fake_notif_id = f"notif_{uuid.uuid4().hex[:12]}"
        
        response = requests.put(
            f"{BASE_URL}/api/notifications/{fake_notif_id}/read",
            headers=auth_headers
        )
        # Should succeed even if notification doesn't exist (MongoDB update_one)
        assert response.status_code == 200, f"Failed to mark notification read: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print("SUCCESS: Mark notification read endpoint works")
    
    def test_mark_notification_read_without_auth(self):
        """Test PUT /api/notifications/{id}/read without auth returns 401"""
        response = requests.put(
            f"{BASE_URL}/api/notifications/any_notif/read"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Mark notification read without auth returns 401")
    
    def test_mark_all_notifications_read(self, auth_headers):
        """Test PUT /api/notifications/read-all"""
        response = requests.put(
            f"{BASE_URL}/api/notifications/read-all",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to mark all read: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print("SUCCESS: Mark all notifications read endpoint works")
    
    def test_mark_all_read_without_auth(self):
        """Test PUT /api/notifications/read-all without auth returns 401"""
        response = requests.put(f"{BASE_URL}/api/notifications/read-all")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Mark all read without auth returns 401")
    
    def test_clear_all_notifications(self, auth_headers):
        """Test DELETE /api/notifications/clear"""
        response = requests.delete(
            f"{BASE_URL}/api/notifications/clear",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to clear notifications: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print("SUCCESS: Clear all notifications endpoint works")
    
    def test_clear_notifications_without_auth(self):
        """Test DELETE /api/notifications/clear without auth returns 401"""
        response = requests.delete(f"{BASE_URL}/api/notifications/clear")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Clear notifications without auth returns 401")


class TestVoiceMessages(TestSetup):
    """Test voice message endpoint"""
    
    def test_voice_message_endpoint_exists(self, auth_headers):
        """Test POST /api/messages/voice endpoint exists"""
        # Send empty form data to check endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/messages/voice",
            headers=auth_headers,
            files={}  # Empty files
        )
        # Should return 422 (validation error) not 404
        assert response.status_code in [422, 400], f"Expected 422/400, got {response.status_code}"
        print("SUCCESS: Voice message endpoint exists (returns validation error for empty data)")
    
    def test_voice_message_without_auth(self):
        """Test POST /api/messages/voice without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/messages/voice",
            files={}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Voice message without auth returns 401")


class TestMessagesEndpoint(TestSetup):
    """Test general messages endpoint"""
    
    def test_get_messages(self, auth_headers):
        """Test GET /api/messages"""
        response = requests.get(
            f"{BASE_URL}/api/messages",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get messages: {response.text}"
        data = response.json()
        assert "messages" in data
        print(f"SUCCESS: Got {len(data['messages'])} messages")
    
    def test_send_message(self, auth_headers):
        """Test POST /api/messages"""
        response = requests.post(
            f"{BASE_URL}/api/messages",
            json={"content": f"TEST_message_{uuid.uuid4().hex[:8]}"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to send message: {response.text}"
        data = response.json()
        assert "message_id" in data
        assert "content" in data
        print(f"SUCCESS: Sent message with ID: {data['message_id']}")
    
    def test_mark_message_read(self, auth_headers):
        """Test PUT /api/messages/{id}/read"""
        # First get a message
        response = requests.get(
            f"{BASE_URL}/api/messages",
            headers=auth_headers
        )
        messages = response.json().get("messages", [])
        
        if messages:
            message_id = messages[0]["message_id"]
            response = requests.put(
                f"{BASE_URL}/api/messages/{message_id}/read",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Failed to mark read: {response.text}"
            print(f"SUCCESS: Marked message {message_id} as read")
        else:
            print("WARNING: No messages to mark as read")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
