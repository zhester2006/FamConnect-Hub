"""
FamFocus Hub API Tests - Iteration 13
Tests for:
1. Dev login flow for both parent and child roles
2. Reading logs submission with book_title (was failing, now fixed)
3. Reading logs approval flow
4. Chore creation, listing, claiming, and completion
5. Points adjustment API for parents
6. Family wall post creation and retrieval
7. Chat message sending and retrieval
8. Leaderboard API
9. Weather API with lat/lon parameters
10. Health check endpoint
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Store session tokens for parent and child
PARENT_TOKEN = None
CHILD_TOKEN = None
PARENT_USER_ID = None
CHILD_USER_ID = None


class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health_check(self):
        """Test GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert data["service"] == "famfocus-api"
        print("✓ Health check passed")


class TestDevLogin:
    """Test dev login flow for both parent and child roles"""
    
    def test_dev_login_parent(self):
        """Test POST /api/auth/dev-login with parent role"""
        global PARENT_TOKEN, PARENT_USER_ID
        
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": "test_parent@famfocus.demo", "name": "Test Parent", "role": "parent"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["role"] == "parent"
        
        PARENT_TOKEN = data["session_token"]
        PARENT_USER_ID = data["user"]["user_id"]
        print(f"✓ Parent dev login passed - user_id: {PARENT_USER_ID}")
    
    def test_dev_login_child(self):
        """Test POST /api/auth/dev-login with child role"""
        global CHILD_TOKEN, CHILD_USER_ID
        
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": "test_child@famfocus.demo", "name": "Test Child", "role": "child"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["role"] == "child"
        
        CHILD_TOKEN = data["session_token"]
        CHILD_USER_ID = data["user"]["user_id"]
        print(f"✓ Child dev login passed - user_id: {CHILD_USER_ID}")
    
    def test_auth_me_with_parent_token(self):
        """Test /api/auth/me with parent token"""
        global PARENT_TOKEN
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data
        assert data["role"] == "parent"
        print("✓ Auth me with parent token passed")
    
    def test_auth_me_with_child_token(self):
        """Test /api/auth/me with child token"""
        global CHILD_TOKEN
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data
        assert data["role"] == "child"
        print("✓ Auth me with child token passed")


class TestReadingLogs:
    """Test reading logs submission and approval flow"""
    
    def test_create_reading_log_with_book_title(self):
        """Test POST /api/reading-logs with book_title field (was failing, now fixed)"""
        global CHILD_TOKEN
        
        log_data = {
            "book_title": "TEST_Harry Potter",  # Using book_title instead of book_name
            "pages_read": 50,
            "summary": "Harry discovers he's a wizard",
            "date": datetime.now().date().isoformat()
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reading-logs",
            json=log_data,
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Backend should accept book_title and store it
        assert data["book_name"] == "TEST_Harry Potter" or data.get("book_title") == "TEST_Harry Potter"
        assert data["status"] == "pending"
        assert "log_id" in data
        print(f"✓ Reading log with book_title created - log_id: {data['log_id']}")
        return data["log_id"]
    
    def test_create_reading_log_with_book_name(self):
        """Test POST /api/reading-logs with book_name field"""
        global CHILD_TOKEN
        
        log_data = {
            "book_name": "TEST_The Hobbit",  # Using book_name
            "pages_read": 30,
            "summary": "Bilbo meets Gandalf",
            "date": datetime.now().date().isoformat()
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reading-logs",
            json=log_data,
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["book_name"] == "TEST_The Hobbit"
        assert data["status"] == "pending"
        print(f"✓ Reading log with book_name created - log_id: {data['log_id']}")
        return data["log_id"]
    
    def test_get_reading_logs(self):
        """Test GET /api/reading-logs"""
        global PARENT_TOKEN
        
        response = requests.get(
            f"{BASE_URL}/api/reading-logs",
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "logs" in data
        assert isinstance(data["logs"], list)
        print(f"✓ Get reading logs passed - {len(data['logs'])} logs found")
    
    def test_approve_reading_log(self):
        """Test PUT /api/reading-logs/{log_id}/approve"""
        global PARENT_TOKEN, CHILD_TOKEN
        
        # First create a log
        log_data = {
            "book_title": "TEST_Approval Test Book",
            "pages_read": 20,
            "summary": "Test summary for approval",
            "date": datetime.now().date().isoformat()
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/reading-logs",
            json=log_data,
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert create_response.status_code == 200
        log_id = create_response.json()["log_id"]
        
        # Now approve it as parent
        approve_response = requests.put(
            f"{BASE_URL}/api/reading-logs/{log_id}/approve",
            json={"approved": True},
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert approve_response.status_code == 200
        
        data = approve_response.json()
        assert data["status"] == "approved"
        print(f"✓ Reading log approval passed - log_id: {log_id}")


class TestChores:
    """Test chore creation, listing, claiming, and completion"""
    
    def test_create_chore(self):
        """Test POST /api/chores creates a new chore"""
        global PARENT_TOKEN
        
        today = datetime.now().date().isoformat()
        chore_data = {
            "title": "TEST_Wash dishes",
            "description": "Test chore for API testing",
            "scheduled_date": today,
            "points": 15
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chores",
            json=chore_data,
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["title"] == "TEST_Wash dishes"
        assert data["points"] == 15
        assert data["status"] == "pending"
        assert "chore_id" in data
        print(f"✓ Chore created - chore_id: {data['chore_id']}")
        return data["chore_id"]
    
    def test_get_chores(self):
        """Test GET /api/chores returns chores list"""
        global PARENT_TOKEN
        
        response = requests.get(
            f"{BASE_URL}/api/chores",
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "chores" in data
        assert isinstance(data["chores"], list)
        print(f"✓ Get chores passed - {len(data['chores'])} chores found")
    
    def test_claim_chore(self):
        """Test PUT /api/chores/{chore_id}/claim"""
        global PARENT_TOKEN, CHILD_TOKEN
        
        # First create an unassigned chore
        today = datetime.now().date().isoformat()
        chore_data = {
            "title": "TEST_Claim test chore",
            "scheduled_date": today,
            "points": 10
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/chores",
            json=chore_data,
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert create_response.status_code == 200
        chore_id = create_response.json()["chore_id"]
        
        # Now claim it as child
        claim_response = requests.put(
            f"{BASE_URL}/api/chores/{chore_id}/claim",
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert claim_response.status_code == 200
        
        data = claim_response.json()
        assert data["assigned_to"] is not None
        print(f"✓ Chore claim passed - chore_id: {chore_id}")
        return chore_id
    
    def test_complete_chore(self):
        """Test PUT /api/chores/{chore_id}/complete"""
        global PARENT_TOKEN, CHILD_TOKEN
        
        # First create and claim a chore
        today = datetime.now().date().isoformat()
        chore_data = {
            "title": "TEST_Complete test chore",
            "scheduled_date": today,
            "points": 10
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/chores",
            json=chore_data,
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        chore_id = create_response.json()["chore_id"]
        
        # Claim it
        requests.put(
            f"{BASE_URL}/api/chores/{chore_id}/claim",
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        
        # Complete it
        complete_response = requests.put(
            f"{BASE_URL}/api/chores/{chore_id}/complete",
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert complete_response.status_code == 200
        
        data = complete_response.json()
        assert data["status"] == "completed"
        print(f"✓ Chore completion passed - chore_id: {chore_id}")


class TestPointsAdjustment:
    """Test points adjustment API for parents"""
    
    def test_modify_child_points_add(self):
        """Test POST /api/users/{user_id}/points to add points"""
        global PARENT_TOKEN, CHILD_USER_ID
        
        response = requests.post(
            f"{BASE_URL}/api/users/{CHILD_USER_ID}/points",
            json={"amount": 50, "reason": "TEST_Bonus points"},
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "points" in data
        assert data["change"] == 50
        print(f"✓ Add points passed - new total: {data['points']}")
    
    def test_modify_child_points_remove(self):
        """Test POST /api/users/{user_id}/points to remove points"""
        global PARENT_TOKEN, CHILD_USER_ID
        
        response = requests.post(
            f"{BASE_URL}/api/users/{CHILD_USER_ID}/points",
            json={"amount": -10, "reason": "TEST_Penalty"},
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "points" in data
        assert data["change"] == -10
        print(f"✓ Remove points passed - new total: {data['points']}")
    
    def test_child_cannot_modify_points(self):
        """Test that child cannot modify points"""
        global CHILD_TOKEN, CHILD_USER_ID
        
        response = requests.post(
            f"{BASE_URL}/api/users/{CHILD_USER_ID}/points",
            json={"amount": 100, "reason": "TEST_Unauthorized"},
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert response.status_code == 403
        print("✓ Child cannot modify points - correctly returns 403")


class TestFamilyWall:
    """Test family wall post creation and retrieval"""
    
    def test_create_text_post(self):
        """Test POST /api/family-wall creates text post"""
        global PARENT_TOKEN
        
        post_data = {
            "content": "TEST_Hello family!",
            "type": "text"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/family-wall",
            json=post_data,
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["content"] == "TEST_Hello family!"
        assert "post_id" in data
        print(f"✓ Text post created - post_id: {data['post_id']}")
    
    def test_create_poll_post(self):
        """Test POST /api/family-wall creates poll post"""
        global PARENT_TOKEN
        
        post_data = {
            "content": "TEST_What should we have for dinner?",
            "type": "poll",
            "poll_options": ["Pizza", "Tacos", "Pasta"]  # String array
        }
        
        response = requests.post(
            f"{BASE_URL}/api/family-wall",
            json=post_data,
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["type"] == "poll"
        assert "poll_options" in data
        assert len(data["poll_options"]) == 3
        print(f"✓ Poll post created - post_id: {data['post_id']}")
    
    def test_get_family_wall(self):
        """Test GET /api/family-wall returns posts"""
        global PARENT_TOKEN
        
        response = requests.get(
            f"{BASE_URL}/api/family-wall",
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "posts" in data
        assert isinstance(data["posts"], list)
        print(f"✓ Get family wall passed - {len(data['posts'])} posts found")


class TestChatMessages:
    """Test chat message sending and retrieval"""
    
    def test_send_message(self):
        """Test POST /api/messages sends a message"""
        global PARENT_TOKEN
        
        message_data = {
            "content": "TEST_Hello from parent!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/messages",
            json=message_data,
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["content"] == "TEST_Hello from parent!"
        assert "message_id" in data
        print(f"✓ Message sent - message_id: {data['message_id']}")
        return data["message_id"]
    
    def test_get_messages(self):
        """Test GET /api/messages returns messages"""
        global PARENT_TOKEN
        
        response = requests.get(
            f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "messages" in data
        assert isinstance(data["messages"], list)
        print(f"✓ Get messages passed - {len(data['messages'])} messages found")
    
    def test_child_send_message(self):
        """Test child can send message"""
        global CHILD_TOKEN
        
        message_data = {
            "content": "TEST_Hello from child!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/messages",
            json=message_data,
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["content"] == "TEST_Hello from child!"
        print(f"✓ Child message sent - message_id: {data['message_id']}")


class TestLeaderboard:
    """Test leaderboard API"""
    
    def test_get_leaderboard(self):
        """Test GET /api/leaderboard returns children rankings"""
        global PARENT_TOKEN
        
        response = requests.get(
            f"{BASE_URL}/api/leaderboard",
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        print(f"✓ Get leaderboard passed - {len(data['leaderboard'])} children found")
    
    def test_child_get_leaderboard(self):
        """Test child can view leaderboard"""
        global CHILD_TOKEN
        
        response = requests.get(
            f"{BASE_URL}/api/leaderboard",
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        print("✓ Child can view leaderboard")


class TestWeatherAPI:
    """Test weather API with lat/lon parameters"""
    
    def test_get_weather_with_coords(self):
        """Test GET /api/weather with lat/lon parameters"""
        global PARENT_TOKEN
        
        # Test with New York coordinates
        response = requests.get(
            f"{BASE_URL}/api/weather?lat=40.7128&lon=-74.0060",
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        
        # Weather API might return 200 or error depending on API key
        if response.status_code == 200:
            data = response.json()
            assert "temperature" in data or "temp" in data or "main" in data
            print("✓ Weather API with coords passed")
        else:
            # API key might be invalid or rate limited
            print(f"⚠ Weather API returned {response.status_code} - may need valid API key")
    
    def test_get_weather_without_auth(self):
        """Test weather API works without authentication (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/weather?lat=40.7128&lon=-74.0060")
        # Weather API is a public endpoint - doesn't require auth
        assert response.status_code == 200
        print("✓ Weather API works without auth (public endpoint)")


# Cleanup test data after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after tests"""
    yield
    # Cleanup after tests
    import subprocess
    subprocess.run([
        'mongosh', '--quiet', '--eval', '''
        use('test_database');
        db.chores.deleteMany({title: /^TEST_/});
        db.family_wall.deleteMany({content: /^TEST_/});
        db.reading_logs.deleteMany({book_name: /^TEST_/});
        db.reading_logs.deleteMany({book_title: /^TEST_/});
        db.messages.deleteMany({content: /^TEST_/});
        db.points_history.deleteMany({reason: /^TEST_/});
        print('Test data cleaned up');
        '''
    ], capture_output=True, text=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
