"""
Iteration 37 Tests - /hub Route Sidebar Restriction for ALL Users
Tests for:
1. When Zachery (parent) visits /hub, sidebar shows 'Home Hub' as role label (not 'Parent')
2. When Zachery (parent) visits /hub, sidebar shows ONLY restricted items: Home Hub, Calendar, Chat, Wall, Shopping, Leaderboard, Dinner, Rewards
3. When Zachery (parent) visits /hub, sidebar does NOT show: Dashboard, Chores, Family, Reading, Location, Settings, Analytics
4. When Zachery visits /dashboard, sidebar shows full parent menu (not restricted)
5. MobileBottomNav on /hub route shows restricted items
6. HomeHub page (/hub) renders content: calendar, chores section, shopping section
7. HomeHub orientation toggle works
8. Elizabeth role is 'parent' (verified via /auth/me after dev-login)
9. Home Hub profile (user_c92a35507cef) role is 'homehub' in DB
10. Zachery shows 'Parent' (not 'Admin') in family member list

Backend API tests to verify user roles and data access.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ZACHERY_EMAIL = "zhesterusar@gmail.com"
ELIZABETH_EMAIL = "ebuss980@gmail.com"
HOME_HUB_EMAIL = "child_user_c92a35507cef@family.local"

ZACHERY_USER_ID = "user_f5d5c9e075da"
ELIZABETH_USER_ID = "user_10ad6e706051"
HOME_HUB_USER_ID = "user_c92a35507cef"


class TestUserRolesAndAuth:
    """Tests for user roles via /auth/me and dev-login"""
    
    def test_zachery_login_returns_parent_role(self):
        """Test Zachery dev-login returns role='parent'"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200, f"Failed to login as Zachery: {response.text}"
        data = response.json()
        
        assert data['user']['role'] == 'parent', f"Expected role 'parent', got '{data['user']['role']}'"
        assert data['user']['email'] == ZACHERY_EMAIL
        print(f"✓ Zachery login returns role='parent'")
        return data['session_token']
    
    def test_elizabeth_login_returns_parent_role(self):
        """Test Elizabeth dev-login returns role='parent' (NOT homehub)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ELIZABETH_EMAIL}
        )
        assert response.status_code == 200, f"Failed to login as Elizabeth: {response.text}"
        data = response.json()
        
        assert data['user']['role'] == 'parent', f"Expected role 'parent', got '{data['user']['role']}'"
        assert data['user']['email'] == ELIZABETH_EMAIL
        print(f"✓ Elizabeth login returns role='parent' (NOT homehub)")
        return data['session_token']
    
    def test_home_hub_profile_returns_homehub_role(self):
        """Test Home Hub profile (user_c92a35507cef) returns role='homehub'"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": HOME_HUB_EMAIL}
        )
        assert response.status_code == 200, f"Failed to login as Home Hub: {response.text}"
        data = response.json()
        
        assert data['user']['role'] == 'homehub', f"Expected role 'homehub', got '{data['user']['role']}'"
        assert data['user']['user_id'] == HOME_HUB_USER_ID
        print(f"✓ Home Hub profile returns role='homehub'")
        return data['session_token']
    
    def test_zachery_auth_me_returns_parent_role(self):
        """Test GET /api/auth/me for Zachery returns role='parent'"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_response.status_code == 200
        token = login_response.json()['session_token']
        
        # Get auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed to get auth/me: {response.text}"
        
        user = response.json()
        assert user['role'] == 'parent', f"Expected role 'parent', got '{user['role']}'"
        print(f"✓ Zachery /auth/me returns role='parent'")
    
    def test_elizabeth_auth_me_returns_parent_role(self):
        """Test GET /api/auth/me for Elizabeth returns role='parent'"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ELIZABETH_EMAIL}
        )
        assert login_response.status_code == 200
        token = login_response.json()['session_token']
        
        # Get auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Failed to get auth/me: {response.text}"
        
        user = response.json()
        assert user['role'] == 'parent', f"Expected role 'parent', got '{user['role']}'"
        print(f"✓ Elizabeth /auth/me returns role='parent'")


class TestFamilyMemberRoles:
    """Tests for family member roles in /families/members"""
    
    @pytest.fixture
    def zachery_session(self):
        """Login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_zachery_shows_parent_not_admin_in_family_members(self, zachery_session):
        """Test Zachery shows 'Parent' (not 'Admin') in family member list"""
        response = zachery_session.get(f"{BASE_URL}/api/families/{ZACHERY_USER_ID}/members")
        assert response.status_code == 200, f"Failed to get family members: {response.text}"
        
        data = response.json()
        members = data.get('members', [])
        
        # Find Zachery in the members list
        zachery = next((m for m in members if m['user_id'] == ZACHERY_USER_ID), None)
        assert zachery is not None, f"Zachery not found in family members"
        assert zachery['role'] == 'parent', f"Expected Zachery's role to be 'parent', got '{zachery['role']}'"
        assert zachery['role'] != 'admin', f"Zachery's role should NOT be 'admin'"
        
        print(f"✓ Zachery shows role='parent' (not 'admin') in family members")
    
    def test_home_hub_shows_homehub_role_in_family_members(self, zachery_session):
        """Test Home Hub profile shows role='homehub' in family member list"""
        response = zachery_session.get(f"{BASE_URL}/api/families/{ZACHERY_USER_ID}/members")
        assert response.status_code == 200, f"Failed to get family members: {response.text}"
        
        data = response.json()
        members = data.get('members', [])
        
        # Find Home Hub user in the members list
        home_hub = next((m for m in members if m['user_id'] == HOME_HUB_USER_ID), None)
        assert home_hub is not None, f"Home Hub user not found in family members"
        assert home_hub['role'] == 'homehub', f"Expected Home Hub's role to be 'homehub', got '{home_hub['role']}'"
        
        print(f"✓ Home Hub profile shows role='homehub' in family members")


class TestHomeHubPageDataAccess:
    """Tests for HomeHub page data access (calendar, chores, shopping)"""
    
    @pytest.fixture
    def zachery_session(self):
        """Login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_zachery_can_access_events_for_hub(self, zachery_session):
        """Test Zachery can access calendar events (used on HomeHub page)"""
        response = zachery_session.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200, f"Failed to get events: {response.text}"
        
        data = response.json()
        assert 'events' in data, "Response should contain 'events' key"
        print(f"✓ Zachery can access calendar events for HomeHub page")
    
    def test_zachery_can_access_chores_for_hub(self, zachery_session):
        """Test Zachery can access chores (used on HomeHub page)"""
        response = zachery_session.get(f"{BASE_URL}/api/chores")
        assert response.status_code == 200, f"Failed to get chores: {response.text}"
        
        data = response.json()
        assert 'chores' in data, "Response should contain 'chores' key"
        print(f"✓ Zachery can access chores for HomeHub page")
    
    def test_zachery_can_access_shopping_for_hub(self, zachery_session):
        """Test Zachery can access shopping list (used on HomeHub page)"""
        response = zachery_session.get(f"{BASE_URL}/api/shopping")
        assert response.status_code == 200, f"Failed to get shopping: {response.text}"
        
        data = response.json()
        assert 'items' in data, "Response should contain 'items' key"
        print(f"✓ Zachery can access shopping list for HomeHub page")
    
    def test_zachery_can_access_family_members_for_hub(self, zachery_session):
        """Test Zachery can access family members (used on HomeHub page)"""
        response = zachery_session.get(f"{BASE_URL}/api/family/members")
        assert response.status_code == 200, f"Failed to get family members: {response.text}"
        
        data = response.json()
        assert 'members' in data, "Response should contain 'members' key"
        print(f"✓ Zachery can access family members for HomeHub page")
    
    def test_zachery_can_access_daily_quote_for_hub(self, zachery_session):
        """Test Zachery can access daily quote (used on HomeHub page)"""
        response = zachery_session.get(f"{BASE_URL}/api/family-wall/daily-quote")
        assert response.status_code == 200, f"Failed to get daily quote: {response.text}"
        
        data = response.json()
        assert 'quote' in data, "Response should contain 'quote' key"
        print(f"✓ Zachery can access daily quote for HomeHub page")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
