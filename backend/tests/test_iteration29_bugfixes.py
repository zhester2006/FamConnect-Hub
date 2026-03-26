"""
Iteration 29 - Bug Fixes Testing
Tests for:
1. GET /api/auth/ws-token - Returns session token for WebSocket connections
2. GET /api/family-wall - Polls have post_type='poll' normalized from 'type' field
3. POST /api/family-wall/{post_id}/vote - Voting on polls works correctly
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWSTokenEndpoint:
    """Test the new /api/auth/ws-token endpoint for WebSocket authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get session"""
        self.session = requests.Session()
        # Dev login to get session cookie
        response = self.session.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        self.user = response.json().get('user')
        self.session_token = response.json().get('session_token')
    
    def test_ws_token_returns_token_when_authenticated(self):
        """GET /api/auth/ws-token should return token when user is authenticated"""
        response = self.session.get(f"{BASE_URL}/api/auth/ws-token")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'token' in data, "Response should contain 'token' field"
        assert isinstance(data['token'], str), "Token should be a string"
        assert len(data['token']) > 0, "Token should not be empty"
        print(f"WS Token endpoint returned token: {data['token'][:20]}...")
    
    def test_ws_token_fails_without_auth(self):
        """GET /api/auth/ws-token should fail without authentication"""
        # Create new session without auth
        new_session = requests.Session()
        response = new_session.get(f"{BASE_URL}/api/auth/ws-token")
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"WS Token correctly rejected unauthenticated request with {response.status_code}")


class TestFamilyWallPolls:
    """Test Family Wall polls with post_type normalization"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get session"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        self.user = response.json().get('user')
    
    def test_get_family_wall_returns_posts(self):
        """GET /api/family-wall should return posts array"""
        response = self.session.get(f"{BASE_URL}/api/family-wall")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'posts' in data, "Response should contain 'posts' field"
        assert isinstance(data['posts'], list), "Posts should be a list"
        print(f"Family Wall returned {len(data['posts'])} posts")
    
    def test_create_poll_and_verify_post_type(self):
        """Create a poll and verify it has post_type='poll' in GET response"""
        # Create a poll
        poll_data = {
            "content": "TEST_What should we have for dinner?",
            "post_type": "poll",
            "poll_options": [
                {"text": "Pizza", "votes": []},
                {"text": "Tacos", "votes": []},
                {"text": "Pasta", "votes": []}
            ]
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/family-wall",
            json=poll_data
        )
        assert create_response.status_code == 200, f"Failed to create poll: {create_response.text}"
        
        created_poll = create_response.json()
        poll_id = created_poll.get('post_id')
        assert poll_id, "Created poll should have post_id"
        print(f"Created poll with ID: {poll_id}")
        
        # Fetch family wall and find our poll
        get_response = self.session.get(f"{BASE_URL}/api/family-wall")
        assert get_response.status_code == 200
        
        posts = get_response.json().get('posts', [])
        our_poll = next((p for p in posts if p.get('post_id') == poll_id), None)
        
        assert our_poll is not None, f"Could not find created poll {poll_id} in posts"
        
        # CRITICAL: Verify post_type is 'poll' (this was the bug - it was stored as 'type')
        assert our_poll.get('post_type') == 'poll', f"Poll should have post_type='poll', got: {our_poll.get('post_type')}"
        print(f"Poll has correct post_type: {our_poll.get('post_type')}")
        
        # Verify poll_options structure
        poll_options = our_poll.get('poll_options', [])
        assert len(poll_options) == 3, f"Poll should have 3 options, got {len(poll_options)}"
        
        for opt in poll_options:
            assert 'text' in opt, "Each poll option should have 'text'"
            assert 'votes' in opt, "Each poll option should have 'votes'"
        
        print(f"Poll options verified: {[opt['text'] for opt in poll_options]}")
        
        return poll_id
    
    def test_vote_on_poll(self):
        """Test voting on a poll works correctly"""
        # First create a poll
        poll_data = {
            "content": "TEST_Vote test poll",
            "post_type": "poll",
            "poll_options": [
                {"text": "Option A", "votes": []},
                {"text": "Option B", "votes": []}
            ]
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/family-wall",
            json=poll_data
        )
        assert create_response.status_code == 200
        poll_id = create_response.json().get('post_id')
        
        # Vote on option 0
        vote_response = self.session.post(
            f"{BASE_URL}/api/family-wall/{poll_id}/vote",
            json={"option_index": 0}
        )
        assert vote_response.status_code == 200, f"Vote failed: {vote_response.text}"
        
        vote_result = vote_response.json()
        
        # Verify vote was recorded
        poll_options = vote_result.get('poll_options', [])
        assert len(poll_options) >= 1, "Poll should have options"
        
        # Check that user's vote is in option 0
        option_0_votes = poll_options[0].get('votes', [])
        assert self.user['user_id'] in option_0_votes, f"User's vote should be in option 0. Votes: {option_0_votes}"
        
        # Check user_voted_option is returned
        assert vote_result.get('user_voted_option') == 0, f"user_voted_option should be 0, got: {vote_result.get('user_voted_option')}"
        
        print(f"Vote recorded successfully. Option 0 votes: {option_0_votes}")
    
    def test_cannot_vote_twice(self):
        """Test that user cannot vote twice on same poll"""
        # Create a poll
        poll_data = {
            "content": "TEST_Double vote test",
            "post_type": "poll",
            "poll_options": [
                {"text": "Yes", "votes": []},
                {"text": "No", "votes": []}
            ]
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/family-wall",
            json=poll_data
        )
        assert create_response.status_code == 200
        poll_id = create_response.json().get('post_id')
        
        # First vote
        vote1 = self.session.post(
            f"{BASE_URL}/api/family-wall/{poll_id}/vote",
            json={"option_index": 0}
        )
        assert vote1.status_code == 200
        
        # Second vote should fail
        vote2 = self.session.post(
            f"{BASE_URL}/api/family-wall/{poll_id}/vote",
            json={"option_index": 1}
        )
        assert vote2.status_code == 400, f"Second vote should fail with 400, got {vote2.status_code}"
        print("Double voting correctly prevented")


class TestHealthAndBasicEndpoints:
    """Basic health and endpoint tests"""
    
    def test_health_check(self):
        """Health check endpoint should return healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print("Health check passed")
    
    def test_dev_login(self):
        """Dev login should work and return user + session_token"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        
        data = response.json()
        assert 'user' in data, "Response should contain 'user'"
        assert 'session_token' in data, "Response should contain 'session_token'"
        assert data['user'].get('role') == 'parent', "User role should be parent"
        print(f"Dev login successful: {data['user'].get('name')}")


class TestNotifications:
    """Test notification endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
    
    def test_notifications_unread_count(self):
        """GET /api/notifications/unread-count should return count"""
        response = self.session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 200
        
        data = response.json()
        assert 'unread_count' in data, "Response should contain 'unread_count'"
        assert isinstance(data['unread_count'], int), "unread_count should be integer"
        print(f"Unread notifications: {data['unread_count']}")
    
    def test_notifications_list(self):
        """GET /api/notifications should return notifications array"""
        response = self.session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        
        data = response.json()
        assert 'notifications' in data, "Response should contain 'notifications'"
        assert isinstance(data['notifications'], list), "notifications should be a list"
        print(f"Notifications count: {len(data['notifications'])}")


class TestDailyDigest:
    """Test Daily Digest endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
    
    def test_daily_quote(self):
        """GET /api/family-wall/daily-quote should return quote"""
        response = self.session.get(f"{BASE_URL}/api/family-wall/daily-quote?quote_type=inspiration")
        assert response.status_code == 200
        
        data = response.json()
        assert 'quote' in data, "Response should contain 'quote'"
        assert isinstance(data['quote'], str), "quote should be a string"
        print(f"Daily quote: {data['quote'][:50]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
