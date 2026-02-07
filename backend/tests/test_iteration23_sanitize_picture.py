"""
Test Iteration 23 - Sanitize Picture Feature Testing
Verify that sanitize_picture() helper function works correctly across all endpoints
to prevent Maximum call stack size exceeded errors from large base64 image data.

Endpoints to test:
1. GET /api/family/members - should return members with sanitized picture data
2. GET /api/chores - should return chores with assignee details (sanitized pictures)
3. GET /api/family-wall - should return posts with sanitized author pictures
4. GET /api/messages - should return messages with sanitized user pictures
5. GET /api/events - should return events with creator details (sanitized pictures)
6. GET /api/tasks - should return tasks with assignee details
7. GET /api/leaderboard - should return children with sanitized pictures
8. POST /api/ai/pixie - AI assistant should respond correctly
9. Firebase Auth endpoints - /api/auth/firebase-login, /api/auth/firebase-signup
"""

import pytest
import requests
import os
import time
from datetime import datetime, timezone

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Helper to check if picture is sanitized (either None, HTTP URL, or short string)
def is_sanitized_picture(picture):
    """Check if picture data is properly sanitized"""
    if picture is None:
        return True
    if isinstance(picture, str):
        if picture.startswith('http'):
            return True
        # Should be <= 500 chars if not HTTP URL
        return len(picture) <= 500
    return False


class TestHealthAndAuth:
    """Test health check and authentication"""
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", "Status should be healthy"
        print(f"✓ Health check passed: {data}")
    
    def test_dev_login_parent(self):
        """Test dev login as parent"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "parent", "User role should be parent"
        print(f"✓ Dev login as parent successful, user_id: {data['user']['user_id']}")
    
    def test_dev_login_child(self):
        """Test dev login as child"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session token in response"
        assert "user" in data, "No user in response"
        print(f"✓ Dev login as child successful, user_id: {data['user']['user_id']}")


class TestFamilyMembersSanitization:
    """Test GET /api/family/members - should return members with sanitized picture data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_family_members_returns_200(self):
        """Test GET /api/family/members returns 200"""
        start_time = time.time()
        response = requests.get(
            f"{BASE_URL}/api/family/members",
            headers=self.headers,
            timeout=10
        )
        elapsed = time.time() - start_time
        assert response.status_code == 200, f"Get family members failed: {response.text}"
        assert elapsed < 10, f"Endpoint took too long: {elapsed}s (possible stack overflow)"
        data = response.json()
        assert "members" in data, "No members key in response"
        print(f"✓ Family members retrieved in {elapsed:.2f}s: {len(data['members'])} members")
    
    def test_family_members_pictures_sanitized(self):
        """Test that all member pictures are sanitized"""
        response = requests.get(
            f"{BASE_URL}/api/family/members",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        for member in data.get("members", []):
            picture = member.get("picture")
            assert is_sanitized_picture(picture), f"Picture not sanitized for user {member.get('user_id')}: length={len(picture) if picture else 0}"
        
        print(f"✓ All {len(data['members'])} member pictures are properly sanitized")


class TestChoresSanitization:
    """Test GET /api/chores - should return chores with assignee details (sanitized pictures)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_chores_returns_200(self):
        """Test GET /api/chores returns 200 without stack overflow"""
        start_time = time.time()
        response = requests.get(
            f"{BASE_URL}/api/chores",
            headers=self.headers,
            timeout=10
        )
        elapsed = time.time() - start_time
        assert response.status_code == 200, f"Get chores failed: {response.text}"
        assert elapsed < 10, f"Endpoint took too long: {elapsed}s (possible stack overflow)"
        data = response.json()
        assert "chores" in data, "No chores key in response"
        print(f"✓ Chores retrieved in {elapsed:.2f}s: {len(data['chores'])} chores")
    
    def test_chores_assignee_pictures_sanitized(self):
        """Test that all chore assignee pictures are sanitized"""
        response = requests.get(
            f"{BASE_URL}/api/chores",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        for chore in data.get("chores", []):
            assignee_picture = chore.get("assignee_picture")
            completed_by_picture = chore.get("completed_by_picture")
            
            if assignee_picture is not None:
                assert is_sanitized_picture(assignee_picture), f"Assignee picture not sanitized for chore {chore.get('chore_id')}"
            if completed_by_picture is not None:
                assert is_sanitized_picture(completed_by_picture), f"Completed by picture not sanitized for chore {chore.get('chore_id')}"
        
        print(f"✓ All chore assignee/completer pictures are properly sanitized")


class TestFamilyWallSanitization:
    """Test GET /api/family-wall - should return posts with sanitized author pictures"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_family_wall_returns_200(self):
        """Test GET /api/family-wall returns 200 without stack overflow"""
        start_time = time.time()
        response = requests.get(
            f"{BASE_URL}/api/family-wall",
            headers=self.headers,
            timeout=10
        )
        elapsed = time.time() - start_time
        assert response.status_code == 200, f"Get family wall failed: {response.text}"
        assert elapsed < 10, f"Endpoint took too long: {elapsed}s (possible stack overflow)"
        data = response.json()
        assert "posts" in data, "No posts key in response"
        print(f"✓ Family wall posts retrieved in {elapsed:.2f}s: {len(data['posts'])} posts")
    
    def test_family_wall_author_pictures_sanitized(self):
        """Test that all post author pictures are sanitized"""
        response = requests.get(
            f"{BASE_URL}/api/family-wall",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        for post in data.get("posts", []):
            author_picture = post.get("author_picture")
            assert is_sanitized_picture(author_picture), f"Author picture not sanitized for post {post.get('post_id')}: length={len(author_picture) if author_picture else 0}"
        
        print(f"✓ All {len(data['posts'])} post author pictures are properly sanitized")


class TestMessagesSanitization:
    """Test GET /api/messages - should return messages with sanitized user pictures"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_messages_returns_200(self):
        """Test GET /api/messages returns 200 without stack overflow"""
        start_time = time.time()
        response = requests.get(
            f"{BASE_URL}/api/messages",
            headers=self.headers,
            timeout=10
        )
        elapsed = time.time() - start_time
        assert response.status_code == 200, f"Get messages failed: {response.text}"
        assert elapsed < 10, f"Endpoint took too long: {elapsed}s (possible stack overflow)"
        data = response.json()
        assert "messages" in data, "No messages key in response"
        print(f"✓ Messages retrieved in {elapsed:.2f}s: {len(data['messages'])} messages")
    
    def test_messages_user_pictures_sanitized(self):
        """Test that all message user pictures are sanitized"""
        response = requests.get(
            f"{BASE_URL}/api/messages",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        for msg in data.get("messages", []):
            user_picture = msg.get("user_picture")
            assert is_sanitized_picture(user_picture), f"User picture not sanitized for message {msg.get('message_id')}: length={len(user_picture) if user_picture else 0}"
        
        print(f"✓ All {len(data['messages'])} message user pictures are properly sanitized")


class TestEventsSanitization:
    """Test GET /api/events - should return events with creator details (sanitized pictures)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_events_returns_200(self):
        """Test GET /api/events returns 200 without stack overflow"""
        start_time = time.time()
        response = requests.get(
            f"{BASE_URL}/api/events",
            headers=self.headers,
            timeout=10
        )
        elapsed = time.time() - start_time
        assert response.status_code == 200, f"Get events failed: {response.text}"
        assert elapsed < 10, f"Endpoint took too long: {elapsed}s (possible stack overflow)"
        data = response.json()
        assert "events" in data, "No events key in response"
        print(f"✓ Events retrieved in {elapsed:.2f}s: {len(data['events'])} events")
    
    def test_events_creator_pictures_sanitized(self):
        """Test that all event creator pictures are sanitized"""
        response = requests.get(
            f"{BASE_URL}/api/events",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        for event in data.get("events", []):
            creator_picture = event.get("created_by_picture")
            assignee_picture = event.get("assignee_picture")
            
            if creator_picture is not None:
                assert is_sanitized_picture(creator_picture), f"Creator picture not sanitized for event {event.get('event_id')}"
            if assignee_picture is not None:
                assert is_sanitized_picture(assignee_picture), f"Assignee picture not sanitized for event {event.get('event_id')}"
        
        print(f"✓ All event creator/assignee pictures are properly sanitized")


class TestTasksSanitization:
    """Test GET /api/tasks - should return tasks with assignee details"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_tasks_returns_200(self):
        """Test GET /api/tasks returns 200 without stack overflow"""
        start_time = time.time()
        response = requests.get(
            f"{BASE_URL}/api/tasks",
            headers=self.headers,
            timeout=10
        )
        elapsed = time.time() - start_time
        # Tasks endpoint might return 404 if not implemented, or 200
        assert response.status_code in [200, 404], f"Get tasks failed unexpectedly: {response.text}"
        assert elapsed < 10, f"Endpoint took too long: {elapsed}s (possible stack overflow)"
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Tasks retrieved in {elapsed:.2f}s: {len(data.get('tasks', []))} tasks")
        else:
            print(f"✓ Tasks endpoint returned 404 (not implemented) in {elapsed:.2f}s - no stack overflow")


class TestLeaderboardSanitization:
    """Test GET /api/leaderboard - should return children with sanitized pictures"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_leaderboard_returns_200(self):
        """Test GET /api/leaderboard returns 200 without stack overflow"""
        start_time = time.time()
        response = requests.get(
            f"{BASE_URL}/api/leaderboard",
            headers=self.headers,
            timeout=10
        )
        elapsed = time.time() - start_time
        assert response.status_code == 200, f"Get leaderboard failed: {response.text}"
        assert elapsed < 10, f"Endpoint took too long: {elapsed}s (possible stack overflow)"
        data = response.json()
        assert "leaderboard" in data, "No leaderboard key in response"
        print(f"✓ Leaderboard retrieved in {elapsed:.2f}s: {len(data['leaderboard'])} entries")
    
    def test_leaderboard_pictures_sanitized(self):
        """Test that all leaderboard user pictures are sanitized"""
        response = requests.get(
            f"{BASE_URL}/api/leaderboard",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        for entry in data.get("leaderboard", []):
            picture = entry.get("picture")
            assert is_sanitized_picture(picture), f"Picture not sanitized for leaderboard entry {entry.get('user_id')}: length={len(picture) if picture else 0}"
        
        print(f"✓ All {len(data['leaderboard'])} leaderboard pictures are properly sanitized")


class TestPixieAI:
    """Test POST /api/ai/pixie - AI assistant should respond correctly"""
    
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
    
    def test_pixie_activity_suggestion(self):
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
        print(f"✓ Pixie activity suggestion received: {data['response'][:150]}...")


class TestFirebaseAuth:
    """Test Firebase Auth endpoints - /api/auth/firebase-login, /api/auth/firebase-signup"""
    
    def test_firebase_login_with_valid_user_data(self):
        """Test Firebase login with valid user data"""
        firebase_user = {
            "email": f"test_firebase_{int(time.time())}@example.com",
            "displayName": "Test Firebase User",
            "uid": f"firebase_uid_{int(time.time())}",
            "photoURL": "https://example.com/photo.jpg"
        }
        response = requests.post(
            f"{BASE_URL}/api/auth/firebase-login",
            json={"user": firebase_user}
        )
        assert response.status_code == 200, f"Firebase login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == firebase_user["email"], "Email mismatch"
        print(f"✓ Firebase login successful, user_id: {data['user']['user_id']}")
    
    def test_firebase_login_missing_user_data(self):
        """Test Firebase login with missing user data returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/firebase-login",
            json={}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Firebase login correctly rejects missing user data")
    
    def test_firebase_login_missing_email(self):
        """Test Firebase login with missing email returns 400"""
        firebase_user = {
            "displayName": "Test User",
            "uid": "test_uid"
        }
        response = requests.post(
            f"{BASE_URL}/api/auth/firebase-login",
            json={"user": firebase_user}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Firebase login correctly rejects missing email")
    
    def test_firebase_signup_new_user(self):
        """Test Firebase signup with new user"""
        firebase_user = {
            "email": f"test_signup_{int(time.time())}@example.com",
            "displayName": "New Firebase User",
            "uid": f"firebase_signup_uid_{int(time.time())}",
            "photoURL": "https://example.com/newphoto.jpg"
        }
        response = requests.post(
            f"{BASE_URL}/api/auth/firebase-signup",
            json={"user": firebase_user, "displayName": "New Firebase User"}
        )
        assert response.status_code == 200, f"Firebase signup failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == firebase_user["email"], "Email mismatch"
        print(f"✓ Firebase signup successful, user_id: {data['user']['user_id']}")
    
    def test_firebase_signup_duplicate_email(self):
        """Test Firebase signup with duplicate email returns 400"""
        # First signup
        email = f"test_dup_{int(time.time())}@example.com"
        firebase_user = {
            "email": email,
            "displayName": "First User",
            "uid": f"uid_first_{int(time.time())}"
        }
        response = requests.post(
            f"{BASE_URL}/api/auth/firebase-signup",
            json={"user": firebase_user}
        )
        assert response.status_code == 200, f"First signup failed: {response.text}"
        
        # Second signup with same email
        firebase_user2 = {
            "email": email,
            "displayName": "Second User",
            "uid": f"uid_second_{int(time.time())}"
        }
        response = requests.post(
            f"{BASE_URL}/api/auth/firebase-signup",
            json={"user": firebase_user2}
        )
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        print(f"✓ Firebase signup correctly rejects duplicate email")


class TestResponseTimes:
    """Test that all endpoints respond quickly (no stack overflow)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_all_endpoints_respond_quickly(self):
        """Test that all sanitized endpoints respond within 5 seconds"""
        endpoints = [
            "/api/family/members",
            "/api/chores",
            "/api/family-wall",
            "/api/messages",
            "/api/events",
            "/api/leaderboard"
        ]
        
        results = []
        for endpoint in endpoints:
            start_time = time.time()
            try:
                response = requests.get(
                    f"{BASE_URL}{endpoint}",
                    headers=self.headers,
                    timeout=10
                )
                elapsed = time.time() - start_time
                results.append({
                    "endpoint": endpoint,
                    "status": response.status_code,
                    "time": elapsed,
                    "success": response.status_code == 200 and elapsed < 5
                })
            except requests.exceptions.Timeout:
                results.append({
                    "endpoint": endpoint,
                    "status": "TIMEOUT",
                    "time": 10,
                    "success": False
                })
        
        # Print results
        for r in results:
            status = "✓" if r["success"] else "✗"
            print(f"{status} {r['endpoint']}: {r['status']} in {r['time']:.2f}s")
        
        # Assert all passed
        failed = [r for r in results if not r["success"]]
        assert len(failed) == 0, f"Some endpoints failed or timed out: {failed}"
        print(f"\n✓ All {len(endpoints)} endpoints responded quickly (no stack overflow)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
