"""
FamFocus Hub API Tests
Tests all major API endpoints for the family-oriented app
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token - will be set by fixture
TEST_SESSION_TOKEN = None

@pytest.fixture(scope="module")
def session_token():
    """Get or create a test session token"""
    import subprocess
    result = subprocess.run([
        'mongosh', '--quiet', '--eval', '''
        use('test_database');
        var session = db.user_sessions.findOne({user_id: 'user_parent001'});
        if (session) {
            print(session.session_token);
        } else {
            var token = 'test_session_' + Date.now();
            db.user_sessions.insertOne({
                user_id: 'user_parent001',
                session_token: token,
                expires_at: new Date(Date.now() + 7*24*60*60*1000),
                created_at: new Date()
            });
            print(token);
        }
        '''
    ], capture_output=True, text=True)
    token = result.stdout.strip().split('\n')[-1]
    return token

@pytest.fixture
def api_client(session_token):
    """Create API client with auth headers"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {session_token}"
    })
    session.cookies.set("session_token", session_token)
    return session


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_auth_me_with_valid_session(self, api_client):
        """Test /api/auth/me returns user data with valid session"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "name" in data
        assert "role" in data
        assert data["role"] == "parent"
    
    def test_auth_me_without_session(self):
        """Test /api/auth/me returns 401 without session"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401


class TestChoresEndpoints:
    """Test chores CRUD operations"""
    
    def test_get_chores(self, api_client):
        """Test GET /api/chores returns chores list"""
        response = api_client.get(f"{BASE_URL}/api/chores")
        assert response.status_code == 200
        
        data = response.json()
        assert "chores" in data
        assert isinstance(data["chores"], list)
        
        # Verify chore structure if chores exist
        if len(data["chores"]) > 0:
            chore = data["chores"][0]
            assert "chore_id" in chore
            assert "title" in chore
            assert "status" in chore
    
    def test_create_chore(self, api_client):
        """Test POST /api/chores creates a new chore"""
        today = datetime.now().date().isoformat()
        chore_data = {
            "title": "TEST_Clean garage",
            "description": "Test chore for API testing",
            "scheduled_date": today,
            "points": 20
        }
        
        response = api_client.post(f"{BASE_URL}/api/chores", json=chore_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["title"] == "TEST_Clean garage"
        assert data["points"] == 20
        assert data["status"] == "pending"
        assert "chore_id" in data
    
    def test_get_chore_types(self, api_client):
        """Test GET /api/chores/types returns chore types"""
        response = api_client.get(f"{BASE_URL}/api/chores/types")
        assert response.status_code == 200
        
        data = response.json()
        assert "chore_types" in data
        assert isinstance(data["chore_types"], list)
        assert len(data["chore_types"]) > 0
    
    def test_get_child_chore_settings(self, api_client):
        """Test GET /api/chores/child-settings/{child_id}"""
        response = api_client.get(f"{BASE_URL}/api/chores/child-settings/user_child001")
        assert response.status_code == 200
        
        data = response.json()
        assert "child" in data
        assert "excluded_chores" in data
        assert "available_chores" in data


class TestShoppingEndpoints:
    """Test shopping list endpoints"""
    
    def test_get_shopping_list(self, api_client):
        """Test GET /api/shopping returns shopping items"""
        response = api_client.get(f"{BASE_URL}/api/shopping")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)
    
    def test_add_shopping_item(self, api_client):
        """Test POST /api/shopping adds new item"""
        item_data = {"name": "TEST_Apples"}
        
        response = api_client.post(f"{BASE_URL}/api/shopping", json=item_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "TEST_Apples"
        assert data["status"] == "approved"  # Parent adds, so auto-approved
        assert "item_id" in data


class TestFamilyWallEndpoints:
    """Test family wall endpoints"""
    
    def test_get_family_wall(self, api_client):
        """Test GET /api/family-wall returns posts"""
        response = api_client.get(f"{BASE_URL}/api/family-wall")
        assert response.status_code == 200
        
        data = response.json()
        assert "posts" in data
        assert isinstance(data["posts"], list)
    
    def test_create_post(self, api_client):
        """Test POST /api/family-wall creates new post"""
        post_data = {
            "content": "TEST_This is a test post!",
            "post_type": "text"
        }
        
        response = api_client.post(f"{BASE_URL}/api/family-wall", json=post_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["content"] == "TEST_This is a test post!"
        assert data["post_type"] == "text"
        assert "post_id" in data
    
    def test_create_poll(self, api_client):
        """Test creating a poll post"""
        poll_data = {
            "content": "TEST_What should we have for dinner?",
            "post_type": "poll",
            "poll_options": [
                {"text": "Pizza", "votes": []},
                {"text": "Tacos", "votes": []}
            ]
        }
        
        response = api_client.post(f"{BASE_URL}/api/family-wall", json=poll_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["post_type"] == "poll"
        assert "poll_options" in data
        assert len(data["poll_options"]) == 2
    
    def test_get_daily_quote(self, api_client):
        """Test GET /api/family-wall/daily-quote returns AI quote"""
        response = api_client.get(f"{BASE_URL}/api/family-wall/daily-quote")
        assert response.status_code == 200
        
        data = response.json()
        assert "quote" in data
        assert len(data["quote"]) > 0


class TestReadingLogsEndpoints:
    """Test reading logs endpoints"""
    
    def test_get_reading_logs(self, api_client):
        """Test GET /api/reading-logs returns logs"""
        response = api_client.get(f"{BASE_URL}/api/reading-logs")
        assert response.status_code == 200
        
        data = response.json()
        assert "logs" in data
        assert isinstance(data["logs"], list)
    
    def test_create_reading_log(self, api_client):
        """Test POST /api/reading-logs creates new log"""
        log_data = {
            "book_name": "TEST_The Hobbit",
            "pages_read": 30,
            "summary": "Bilbo meets Gandalf and the dwarves",
            "date": datetime.now().date().isoformat()
        }
        
        response = api_client.post(f"{BASE_URL}/api/reading-logs", json=log_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["book_name"] == "TEST_The Hobbit"
        assert data["status"] == "pending"
        assert "log_id" in data


class TestFamilyMembersEndpoints:
    """Test family members endpoints"""
    
    def test_get_family_members(self, api_client):
        """Test GET /api/family/members returns family members"""
        response = api_client.get(f"{BASE_URL}/api/family/members")
        assert response.status_code == 200
        
        data = response.json()
        assert "members" in data
        assert isinstance(data["members"], list)
        
        # Should have at least the parent
        assert len(data["members"]) >= 1


class TestEventsEndpoints:
    """Test events/calendar endpoints"""
    
    def test_get_events(self, api_client):
        """Test GET /api/events returns events"""
        response = api_client.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        assert isinstance(data["events"], list)
    
    def test_create_event(self, api_client):
        """Test POST /api/events creates new event"""
        event_data = {
            "title": "TEST_Birthday Party",
            "event_date": datetime.now().date().isoformat(),
            "event_type": "appointment"
        }
        
        response = api_client.post(f"{BASE_URL}/api/events", json=event_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["title"] == "TEST_Birthday Party"
        assert data["status"] == "approved"  # Parent creates, auto-approved
        assert "event_id" in data


class TestLeaderboardEndpoints:
    """Test leaderboard endpoints"""
    
    def test_get_leaderboard(self, api_client):
        """Test GET /api/leaderboard returns children rankings"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)


class TestRewardsEndpoints:
    """Test rewards endpoints"""
    
    def test_get_rewards(self, api_client):
        """Test GET /api/rewards returns rewards"""
        response = api_client.get(f"{BASE_URL}/api/rewards")
        assert response.status_code == 200
        
        data = response.json()
        assert "rewards" in data
        assert isinstance(data["rewards"], list)


class TestMessagesEndpoints:
    """Test messages/chat endpoints"""
    
    def test_get_messages(self, api_client):
        """Test GET /api/messages returns messages"""
        response = api_client.get(f"{BASE_URL}/api/messages")
        assert response.status_code == 200
        
        data = response.json()
        assert "messages" in data
        assert isinstance(data["messages"], list)


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
        db.shopping_items.deleteMany({name: /^TEST_/});
        db.family_wall.deleteMany({content: /^TEST_/});
        db.reading_logs.deleteMany({book_name: /^TEST_/});
        db.events.deleteMany({title: /^TEST_/});
        print('Test data cleaned up');
        '''
    ], capture_output=True, text=True)
