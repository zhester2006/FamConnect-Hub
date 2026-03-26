"""
Iteration 28 - Testing Pixie Daily Digest Feature
Tests:
1. POST /api/ai/pixie/daily-digest - returns digest with greeting, overview, member_highlights, tip_of_day, fun_fact
2. Second call returns cached:true (same family, same day)
3. Proactive suggestions endpoint still works
4. Notification bell endpoints work
5. Health check
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDailyDigestFeature:
    """Tests for the new Pixie Daily Digest feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with parent login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as parent via dev-login
        login_res = self.session.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert login_res.status_code == 200, f"Dev login failed: {login_res.text}"
        
        # Store cookies for authenticated requests
        self.cookies = login_res.cookies
        yield
    
    def test_health_check(self):
        """Test health endpoint"""
        res = self.session.get(f"{BASE_URL}/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "healthy"
        print("PASS: Health check returns healthy status")
    
    def test_daily_digest_returns_success(self):
        """Test POST /api/ai/pixie/daily-digest returns success with digest structure"""
        res = self.session.post(f"{BASE_URL}/api/ai/pixie/daily-digest", cookies=self.cookies)
        assert res.status_code == 200, f"Daily digest failed: {res.text}"
        
        data = res.json()
        assert data.get("success") == True, "Expected success:true"
        assert "digest" in data, "Expected 'digest' key in response"
        
        digest = data["digest"]
        # Verify digest structure
        assert "greeting" in digest, "Digest missing 'greeting'"
        assert "overview" in digest, "Digest missing 'overview'"
        assert "member_highlights" in digest, "Digest missing 'member_highlights'"
        assert "tip_of_day" in digest, "Digest missing 'tip_of_day'"
        assert "fun_fact" in digest, "Digest missing 'fun_fact'"
        
        # Verify member_highlights is a list
        assert isinstance(digest["member_highlights"], list), "member_highlights should be a list"
        
        # If there are highlights, verify structure
        if len(digest["member_highlights"]) > 0:
            highlight = digest["member_highlights"][0]
            assert "name" in highlight, "Highlight missing 'name'"
            assert "message" in highlight, "Highlight missing 'message'"
            assert "emoji" in highlight, "Highlight missing 'emoji'"
        
        print(f"PASS: Daily digest returned with greeting: {digest['greeting'][:50]}...")
        print(f"PASS: Digest has {len(digest['member_highlights'])} member highlights")
    
    def test_daily_digest_cached_on_second_call(self):
        """Test that second call to daily-digest returns cached:true"""
        # First call
        res1 = self.session.post(f"{BASE_URL}/api/ai/pixie/daily-digest", cookies=self.cookies)
        assert res1.status_code == 200
        
        # Second call should return cached:true
        res2 = self.session.post(f"{BASE_URL}/api/ai/pixie/daily-digest", cookies=self.cookies)
        assert res2.status_code == 200
        
        data2 = res2.json()
        assert data2.get("success") == True
        assert data2.get("cached") == True, "Expected cached:true on second call"
        
        print("PASS: Second call to daily-digest returns cached:true")
    
    def test_proactive_suggestions_still_works(self):
        """Test POST /api/ai/pixie/proactive-suggestions still works"""
        res = self.session.post(f"{BASE_URL}/api/ai/pixie/proactive-suggestions", cookies=self.cookies)
        assert res.status_code == 200, f"Proactive suggestions failed: {res.text}"
        
        data = res.json()
        assert data.get("success") == True
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        
        if len(data["suggestions"]) > 0:
            suggestion = data["suggestions"][0]
            assert "title" in suggestion
            assert "description" in suggestion
            assert "icon" in suggestion
        
        print(f"PASS: Proactive suggestions returned {len(data['suggestions'])} suggestions")
    
    def test_notifications_unread_count(self):
        """Test GET /api/notifications/unread-count"""
        res = self.session.get(f"{BASE_URL}/api/notifications/unread-count", cookies=self.cookies)
        assert res.status_code == 200
        
        data = res.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
        
        print(f"PASS: Notifications unread count: {data['unread_count']}")
    
    def test_notifications_list(self):
        """Test GET /api/notifications"""
        res = self.session.get(f"{BASE_URL}/api/notifications", cookies=self.cookies)
        assert res.status_code == 200
        
        data = res.json()
        assert "notifications" in data
        assert isinstance(data["notifications"], list)
        
        print(f"PASS: Notifications list returned {len(data['notifications'])} notifications")


class TestChildLogin:
    """Test child login still works"""
    
    def test_child_login(self):
        """Test child login with testkid/pass123"""
        session = requests.Session()
        res = session.post(f"{BASE_URL}/api/auth/child-login", json={
            "username": "testkid",
            "password": "pass123"
        })
        assert res.status_code == 200, f"Child login failed: {res.text}"
        
        data = res.json()
        assert data.get("success") == True
        assert "session_token" in data
        
        print("PASS: Child login with testkid/pass123 works")


class TestExistingFeatures:
    """Test existing features still work"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with parent login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_res = self.session.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert login_res.status_code == 200
        self.cookies = login_res.cookies
        yield
    
    def test_chores_endpoint(self):
        """Test GET /api/chores"""
        res = self.session.get(f"{BASE_URL}/api/chores", cookies=self.cookies)
        assert res.status_code == 200
        data = res.json()
        assert "chores" in data
        print(f"PASS: Chores endpoint returned {len(data['chores'])} chores")
    
    def test_family_wall_endpoint(self):
        """Test GET /api/family-wall"""
        res = self.session.get(f"{BASE_URL}/api/family-wall", cookies=self.cookies)
        assert res.status_code == 200
        data = res.json()
        assert "posts" in data
        print(f"PASS: Family wall endpoint returned {len(data['posts'])} posts")
    
    def test_events_endpoint(self):
        """Test GET /api/events"""
        res = self.session.get(f"{BASE_URL}/api/events", cookies=self.cookies)
        assert res.status_code == 200
        data = res.json()
        assert "events" in data
        print(f"PASS: Events endpoint returned {len(data['events'])} events")
    
    def test_family_members_endpoint(self):
        """Test GET /api/family/members"""
        res = self.session.get(f"{BASE_URL}/api/family/members", cookies=self.cookies)
        assert res.status_code == 200
        data = res.json()
        assert "members" in data
        print(f"PASS: Family members endpoint returned {len(data['members'])} members")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
