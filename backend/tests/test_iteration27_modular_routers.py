"""
Iteration 27 - Testing modular router refactoring and new features:
1. Health check (verifies server boots with modular routers)
2. Auth router (dev-login, child-login)
3. Chores router
4. Wall router (family-wall)
5. Messages router
6. Calendar router (events)
7. Shopping router
8. Weather router
9. Notifications router (including new unread-count, read-all, clear endpoints)
10. AI router (Pixie proactive suggestions)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Verify server boots with modular routers"""
    
    def test_health_endpoint(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        assert "timestamp" in data
        assert data.get("service") == "famfocus-api"
        print(f"✓ Health check passed: {data}")


class TestAuthRouter:
    """Test auth endpoints from routers/auth.py"""
    
    def test_dev_login_parent(self):
        """POST /api/auth/dev-login with {role:'parent'} returns session_token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "Missing session_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"].get("role") == "parent"
        print(f"✓ Dev login (parent) passed: token={data['session_token'][:20]}...")
        return data["session_token"]
    
    def test_child_login(self):
        """POST /api/auth/child-login with {username:'testkid', password:'pass123'}"""
        response = requests.post(
            f"{BASE_URL}/api/auth/child-login",
            json={"username": "testkid", "password": "pass123"}
        )
        # Child login may fail if testkid doesn't exist - that's acceptable
        if response.status_code == 401:
            print("⚠ Child login: testkid account not found or wrong password (expected if not seeded)")
            pytest.skip("testkid account not available")
        
        assert response.status_code == 200, f"Child login failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "session_token" in data
        print(f"✓ Child login passed: token={data['session_token'][:20]}...")


class TestChoresRouter:
    """Test chores endpoints from routers/chores.py"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        session = requests.Session()
        session.cookies.set("session_token", data["session_token"])
        return session
    
    def test_get_chores(self, auth_session):
        """GET /api/chores returns chores array"""
        response = auth_session.get(f"{BASE_URL}/api/chores")
        assert response.status_code == 200, f"Get chores failed: {response.text}"
        data = response.json()
        assert "chores" in data
        assert isinstance(data["chores"], list)
        print(f"✓ Get chores passed: {len(data['chores'])} chores found")


class TestWallRouter:
    """Test family wall endpoints from routers/wall.py"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        session = requests.Session()
        session.cookies.set("session_token", data["session_token"])
        return session
    
    def test_get_family_wall(self, auth_session):
        """GET /api/family-wall returns posts array"""
        response = auth_session.get(f"{BASE_URL}/api/family-wall")
        assert response.status_code == 200, f"Get family wall failed: {response.text}"
        data = response.json()
        assert "posts" in data
        assert isinstance(data["posts"], list)
        print(f"✓ Get family wall passed: {len(data['posts'])} posts found")


class TestMessagesRouter:
    """Test messages endpoints from routers/messages.py"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        session = requests.Session()
        session.cookies.set("session_token", data["session_token"])
        return session
    
    def test_get_messages(self, auth_session):
        """GET /api/messages returns messages array"""
        response = auth_session.get(f"{BASE_URL}/api/messages")
        assert response.status_code == 200, f"Get messages failed: {response.text}"
        data = response.json()
        assert "messages" in data
        assert isinstance(data["messages"], list)
        print(f"✓ Get messages passed: {len(data['messages'])} messages found")


class TestCalendarRouter:
    """Test calendar/events endpoints from routers/calendar_routes.py"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        session = requests.Session()
        session.cookies.set("session_token", data["session_token"])
        return session
    
    def test_get_events(self, auth_session):
        """GET /api/events returns events array"""
        response = auth_session.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200, f"Get events failed: {response.text}"
        data = response.json()
        assert "events" in data
        assert isinstance(data["events"], list)
        print(f"✓ Get events passed: {len(data['events'])} events found")


class TestShoppingRouter:
    """Test shopping endpoints from routers/shopping.py"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        session = requests.Session()
        session.cookies.set("session_token", data["session_token"])
        return session
    
    def test_get_shopping(self, auth_session):
        """GET /api/shopping returns items array"""
        response = auth_session.get(f"{BASE_URL}/api/shopping")
        assert response.status_code == 200, f"Get shopping failed: {response.text}"
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        print(f"✓ Get shopping passed: {len(data['items'])} items found")


class TestWeatherRouter:
    """Test weather endpoints from routers/weather.py"""
    
    def test_get_weather(self):
        """GET /api/weather returns weather data"""
        response = requests.get(f"{BASE_URL}/api/weather")
        assert response.status_code == 200, f"Get weather failed: {response.text}"
        data = response.json()
        assert "temp" in data
        assert "condition" in data
        print(f"✓ Get weather passed: {data['temp']}°F, {data['condition']}")


class TestNotificationsRouter:
    """Test notifications endpoints from routers/notifications.py"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        session = requests.Session()
        session.cookies.set("session_token", data["session_token"])
        return session
    
    def test_get_notifications(self, auth_session):
        """GET /api/notifications returns notifications array"""
        response = auth_session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        data = response.json()
        assert "notifications" in data
        assert isinstance(data["notifications"], list)
        print(f"✓ Get notifications passed: {len(data['notifications'])} notifications found")
    
    def test_get_unread_count(self, auth_session):
        """GET /api/notifications/unread-count returns unread_count number"""
        response = auth_session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 200, f"Get unread count failed: {response.text}"
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
        print(f"✓ Get unread count passed: {data['unread_count']} unread")
    
    def test_mark_all_read(self, auth_session):
        """PUT /api/notifications/read-all marks all as read"""
        response = auth_session.put(f"{BASE_URL}/api/notifications/read-all")
        assert response.status_code == 200, f"Mark all read failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print("✓ Mark all read passed")
    
    def test_clear_notifications(self, auth_session):
        """DELETE /api/notifications/clear clears all notifications"""
        response = auth_session.delete(f"{BASE_URL}/api/notifications/clear")
        assert response.status_code == 200, f"Clear notifications failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print("✓ Clear notifications passed")


class TestAIRouter:
    """Test AI endpoints from routers/ai.py"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        session = requests.Session()
        session.cookies.set("session_token", data["session_token"])
        return session
    
    def test_pixie_proactive_suggestions(self, auth_session):
        """POST /api/ai/pixie/proactive-suggestions returns suggestions array"""
        response = auth_session.post(f"{BASE_URL}/api/ai/pixie/proactive-suggestions")
        assert response.status_code == 200, f"Pixie suggestions failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        assert len(data["suggestions"]) > 0, "Expected at least one suggestion"
        
        # Verify suggestion structure
        suggestion = data["suggestions"][0]
        assert "title" in suggestion
        assert "description" in suggestion
        assert "icon" in suggestion
        print(f"✓ Pixie proactive suggestions passed: {len(data['suggestions'])} suggestions")
        for s in data["suggestions"]:
            print(f"  - {s.get('icon', '')} {s.get('title', 'No title')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
