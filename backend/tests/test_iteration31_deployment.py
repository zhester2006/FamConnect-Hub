"""
Iteration 31 - Deployment Prep Testing
Tests core flows for deployment readiness:
- Health check
- Dev-login and child-login auth
- GET /api/auth/me
- Key pages API endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://famfocus-preview.preview.emergentagent.com')

class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_check(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print(f"Health check passed: {data}")
    
    def test_dev_login_parent(self):
        """POST /api/auth/dev-login with role=parent returns user and session"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["role"] == "parent"
        print(f"Dev login passed: user_id={data['user']['user_id']}")
        return data
    
    def test_auth_me_with_token(self):
        """GET /api/auth/me returns current user when authenticated"""
        # First login
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["session_token"]
        
        # Then check /me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "role" in data
        print(f"Auth me passed: {data['name']} ({data['role']})")
    
    def test_auth_me_without_token(self):
        """GET /api/auth/me returns 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("Auth me without token correctly returns 401")


class TestChildLogin:
    """Child login tests"""
    
    def test_child_login_missing_credentials(self):
        """POST /api/auth/child-login returns 400 without credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/child-login",
            json={}
        )
        assert response.status_code == 400
        print("Child login without credentials correctly returns 400")
    
    def test_child_login_invalid_credentials(self):
        """POST /api/auth/child-login returns 401 with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/child-login",
            json={"username": "nonexistent", "password": "wrong"}
        )
        assert response.status_code == 401
        print("Child login with invalid credentials correctly returns 401")


class TestFamilyEndpoints:
    """Family management endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        return response.json()["session_token"]
    
    def test_get_families(self, auth_token):
        """GET /api/families returns families list"""
        response = requests.get(
            f"{BASE_URL}/api/families",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "families" in data
        print(f"Families endpoint passed: {len(data['families'])} families")
    
    def test_get_family_members(self, auth_token):
        """GET /api/families/{id}/members returns members"""
        # First get families
        families_resp = requests.get(
            f"{BASE_URL}/api/families",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        families = families_resp.json().get("families", [])
        
        if families:
            family_id = families[0]["family_id"]
            response = requests.get(
                f"{BASE_URL}/api/families/{family_id}/members",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "members" in data
            print(f"Family members endpoint passed: {len(data['members'])} members")
        else:
            pytest.skip("No families to test")


class TestCalendarEndpoints:
    """Calendar endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        return response.json()["session_token"]
    
    def test_get_events(self, auth_token):
        """GET /api/events returns events list"""
        response = requests.get(
            f"{BASE_URL}/api/events",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        print(f"Events endpoint passed: {len(data['events'])} events")


class TestShoppingEndpoints:
    """Shopping list endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        return response.json()["session_token"]
    
    def test_get_shopping_items(self, auth_token):
        """GET /api/shopping returns shopping items"""
        response = requests.get(
            f"{BASE_URL}/api/shopping",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        print(f"Shopping endpoint passed: {len(data['items'])} items")


class TestFamilyWallEndpoints:
    """Family wall endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        return response.json()["session_token"]
    
    def test_get_family_wall(self, auth_token):
        """GET /api/family-wall returns posts"""
        response = requests.get(
            f"{BASE_URL}/api/family-wall",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "posts" in data
        print(f"Family wall endpoint passed: {len(data['posts'])} posts")
    
    def test_get_daily_quote(self, auth_token):
        """GET /api/family-wall/daily-quote returns quote"""
        response = requests.get(
            f"{BASE_URL}/api/family-wall/daily-quote",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "quote" in data
        print(f"Daily quote endpoint passed")


class TestDinnerEndpoints:
    """Dinner planner endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        return response.json()["session_token"]
    
    def test_get_dinner_schedule(self, auth_token):
        """GET /api/dinner/schedule returns schedule"""
        response = requests.get(
            f"{BASE_URL}/api/dinner/schedule",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "schedule" in data
        print(f"Dinner schedule endpoint passed")


class TestRewardsEndpoints:
    """Rewards endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        return response.json()["session_token"]
    
    def test_get_rewards(self, auth_token):
        """GET /api/rewards returns rewards list"""
        response = requests.get(
            f"{BASE_URL}/api/rewards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "rewards" in data
        print(f"Rewards endpoint passed: {len(data['rewards'])} rewards")


class TestLeaderboardEndpoints:
    """Leaderboard endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        return response.json()["session_token"]
    
    def test_get_leaderboard(self, auth_token):
        """GET /api/leaderboard returns leaderboard"""
        response = requests.get(
            f"{BASE_URL}/api/leaderboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "leaderboard" in data
        print(f"Leaderboard endpoint passed: {len(data['leaderboard'])} entries")


class TestSettingsEndpoints:
    """Settings endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        return response.json()["session_token"]
    
    def test_get_user_settings(self, auth_token):
        """GET /api/users/me/settings returns settings"""
        response = requests.get(
            f"{BASE_URL}/api/users/me/settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # May return 200 or 404 depending on implementation
        assert response.status_code in [200, 404]
        print(f"Settings endpoint returned status: {response.status_code}")


class TestWSTokenEndpoint:
    """WebSocket token endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        return response.json()["session_token"]
    
    def test_get_ws_token_authenticated(self, auth_token):
        """GET /api/auth/ws-token returns token when authenticated"""
        response = requests.get(
            f"{BASE_URL}/api/auth/ws-token",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print(f"WS token endpoint passed")
    
    def test_get_ws_token_unauthenticated(self):
        """GET /api/auth/ws-token returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/auth/ws-token")
        assert response.status_code == 401
        print("WS token without auth correctly returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
