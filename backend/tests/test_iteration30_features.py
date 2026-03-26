"""
Iteration 30 - Testing new features:
1. Mobile header padding (pt-16 md:pt-4) - UI test
2. Mobile bottom nav margin (mb-8) - UI test
3. Live Chat GIF/photo sharing - POST /api/messages with media_url/media_type
4. GIF API - GET /api/gifs/trending
5. CheckIns location enforcement modal - UI test
6. DinnerPlanner shopping list integration - POST /api/shopping
7. Notification bell dropdown overflow fix - UI test
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIteration30Features:
    """Test new features for iteration 30"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with dev login"""
        self.session = requests.Session()
        # Dev login as parent
        login_res = self.session.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert login_res.status_code == 200, f"Dev login failed: {login_res.text}"
        self.user = login_res.json()
        yield
        # Cleanup
        self.session.close()
    
    def test_health_check(self):
        """Test health endpoint"""
        res = self.session.get(f"{BASE_URL}/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "healthy"
        print("PASS: Health check working")
    
    def test_gifs_trending_endpoint(self):
        """Test GET /api/gifs/trending returns GIF data"""
        res = self.session.get(f"{BASE_URL}/api/gifs/trending?limit=5")
        assert res.status_code == 200, f"GIF trending failed: {res.text}"
        data = res.json()
        assert "gifs" in data, "Response should have 'gifs' key"
        # GIFs may be empty if Tenor API fails, but structure should be correct
        if len(data["gifs"]) > 0:
            gif = data["gifs"][0]
            assert "id" in gif, "GIF should have 'id'"
            assert "url" in gif or "preview" in gif, "GIF should have 'url' or 'preview'"
            print(f"PASS: GIF trending returned {len(data['gifs'])} GIFs")
        else:
            print("PASS: GIF trending endpoint works (no GIFs returned - may be API limit)")
    
    def test_gifs_search_endpoint(self):
        """Test GET /api/gifs/search returns GIF data"""
        res = self.session.get(f"{BASE_URL}/api/gifs/search?q=happy&limit=5")
        assert res.status_code == 200, f"GIF search failed: {res.text}"
        data = res.json()
        assert "gifs" in data, "Response should have 'gifs' key"
        print(f"PASS: GIF search returned {len(data.get('gifs', []))} GIFs")
    
    def test_post_message_with_media_url(self):
        """Test POST /api/messages with media_url and media_type for image sharing"""
        test_media_url = "https://example.com/test-image.jpg"
        res = self.session.post(
            f"{BASE_URL}/api/messages",
            json={
                "content": "[Image]",
                "media_url": test_media_url,
                "media_type": "image"
            }
        )
        assert res.status_code == 200, f"Post message with media failed: {res.text}"
        data = res.json()
        assert data.get("media_url") == test_media_url, "media_url should be saved"
        assert data.get("media_type") == "image", "media_type should be 'image'"
        assert "message_id" in data, "Should return message_id"
        print(f"PASS: Message with image media created: {data['message_id']}")
    
    def test_post_message_with_gif(self):
        """Test POST /api/messages with GIF media"""
        test_gif_url = "https://media.tenor.com/test.gif"
        res = self.session.post(
            f"{BASE_URL}/api/messages",
            json={
                "content": "[GIF]",
                "media_url": test_gif_url,
                "media_type": "gif"
            }
        )
        assert res.status_code == 200, f"Post GIF message failed: {res.text}"
        data = res.json()
        assert data.get("media_url") == test_gif_url, "media_url should be saved"
        assert data.get("media_type") == "gif", "media_type should be 'gif'"
        print(f"PASS: Message with GIF media created: {data['message_id']}")
    
    def test_get_messages_includes_media(self):
        """Test GET /api/messages returns messages with media fields"""
        res = self.session.get(f"{BASE_URL}/api/messages")
        assert res.status_code == 200, f"Get messages failed: {res.text}"
        data = res.json()
        assert "messages" in data, "Response should have 'messages' key"
        # Check if any message has media_url
        media_messages = [m for m in data["messages"] if m.get("media_url")]
        print(f"PASS: Get messages returned {len(data['messages'])} messages, {len(media_messages)} with media")
    
    def test_shopping_list_add_item(self):
        """Test POST /api/shopping - DinnerPlanner integration"""
        test_item_name = "TEST_Chicken breast from dinner planner"
        res = self.session.post(
            f"{BASE_URL}/api/shopping",
            json={"name": test_item_name}
        )
        assert res.status_code == 200, f"Add shopping item failed: {res.text}"
        data = res.json()
        assert data.get("name") == test_item_name, "Item name should match"
        assert "item_id" in data, "Should return item_id"
        assert data.get("status") in ["approved", "pending"], "Should have status"
        print(f"PASS: Shopping item added: {data['item_id']}")
        
        # Cleanup - delete the test item
        delete_res = self.session.delete(f"{BASE_URL}/api/shopping/{data['item_id']}")
        assert delete_res.status_code == 200, "Cleanup delete should succeed"
    
    def test_shopping_list_get_items(self):
        """Test GET /api/shopping returns items"""
        res = self.session.get(f"{BASE_URL}/api/shopping")
        assert res.status_code == 200, f"Get shopping list failed: {res.text}"
        data = res.json()
        assert "items" in data, "Response should have 'items' key"
        print(f"PASS: Shopping list returned {len(data['items'])} items")
    
    def test_notifications_endpoint(self):
        """Test notifications endpoint for bell dropdown"""
        res = self.session.get(f"{BASE_URL}/api/notifications")
        assert res.status_code == 200, f"Get notifications failed: {res.text}"
        data = res.json()
        assert "notifications" in data, "Response should have 'notifications' key"
        print(f"PASS: Notifications returned {len(data['notifications'])} items")
    
    def test_notifications_unread_count(self):
        """Test notifications unread count endpoint"""
        res = self.session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert res.status_code == 200, f"Get unread count failed: {res.text}"
        data = res.json()
        assert "unread_count" in data, "Response should have 'unread_count' key"
        print(f"PASS: Unread count: {data['unread_count']}")
    
    def test_checkins_endpoint(self):
        """Test checkins endpoint exists"""
        res = self.session.post(
            f"{BASE_URL}/api/checkins",
            json={"latitude": 40.7128, "longitude": -74.0060}
        )
        # Should work or return auth error, not 404
        assert res.status_code in [200, 201, 401, 403], f"Checkins endpoint issue: {res.status_code}"
        print(f"PASS: Checkins endpoint accessible (status: {res.status_code})")
    
    def test_geofences_endpoint(self):
        """Test geofences endpoint for CheckIns page"""
        res = self.session.get(f"{BASE_URL}/api/geofences")
        assert res.status_code == 200, f"Get geofences failed: {res.text}"
        data = res.json()
        assert "geofences" in data, "Response should have 'geofences' key"
        print(f"PASS: Geofences returned {len(data['geofences'])} zones")


class TestMessageReactions:
    """Test message reaction functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with dev login"""
        self.session = requests.Session()
        login_res = self.session.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert login_res.status_code == 200
        self.user = login_res.json()
        yield
        self.session.close()
    
    def test_react_to_message(self):
        """Test adding reaction to a message"""
        # First create a message
        msg_res = self.session.post(
            f"{BASE_URL}/api/messages",
            json={"content": "TEST_Message for reaction test"}
        )
        assert msg_res.status_code == 200
        message_id = msg_res.json()["message_id"]
        
        # Add reaction
        react_res = self.session.post(
            f"{BASE_URL}/api/messages/{message_id}/react",
            json={"reaction": "love"}
        )
        assert react_res.status_code == 200, f"React failed: {react_res.text}"
        data = react_res.json()
        assert data.get("success") == True, "Reaction should succeed"
        print(f"PASS: Reaction added to message {message_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
