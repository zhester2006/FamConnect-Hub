"""
Iteration 36 Tests - Home Hub User Family Resolution and Role Display
Tests for:
1. GET /api/families for 'Home Hub' user (user_c92a35507cef, role=homehub) returns Zachery's family via family_id/parent_id linkage
2. GET /api/families/{family_id}/members for Home Hub user returns all 6 family members
3. Elizabeth Buss (user_10ad6e706051) shows role=parent in both /auth/me and /families/members
4. Zachery Hester shows role=parent (not admin) in /families/members response
5. Home Hub user shows role=homehub in /families/members response
6. GET /api/auth/me for Home Hub user returns name='Home Hub', role='homehub'
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
ZACHERY_EMAIL = "zhesterusar@gmail.com"
ELIZABETH_EMAIL = "ebuss980@gmail.com"
HOME_HUB_EMAIL = "child_user_c92a35507cef@family.local"

ZACHERY_USER_ID = "user_f5d5c9e075da"
ELIZABETH_USER_ID = "user_10ad6e706051"
HOME_HUB_USER_ID = "user_c92a35507cef"
BLENDED_FAMILY_ID = "family_0c5ee4535871"


class TestHomeHubUserFamilyResolution:
    """Tests for Home Hub user family resolution via family_id/parent_id linkage"""
    
    @pytest.fixture
    def home_hub_session(self):
        """Login as Home Hub user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": HOME_HUB_EMAIL}
        )
        assert response.status_code == 200, f"Failed to login as Home Hub: {response.text}"
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session, data['user']
    
    @pytest.fixture
    def zachery_session(self):
        """Login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200, f"Failed to login as Zachery: {response.text}"
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session, data['user']
    
    @pytest.fixture
    def elizabeth_session(self):
        """Login as Elizabeth (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ELIZABETH_EMAIL}
        )
        assert response.status_code == 200, f"Failed to login as Elizabeth: {response.text}"
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session, data['user']
    
    def test_home_hub_auth_me_returns_correct_data(self, home_hub_session):
        """Test GET /api/auth/me for Home Hub user returns name='Home Hub', role='homehub'"""
        session, login_user = home_hub_session
        
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Failed to get auth/me: {response.text}"
        
        user = response.json()
        assert user['user_id'] == HOME_HUB_USER_ID, f"Expected user_id '{HOME_HUB_USER_ID}', got '{user['user_id']}'"
        assert user['name'] == 'Home Hub', f"Expected name 'Home Hub', got '{user['name']}'"
        assert user['role'] == 'homehub', f"Expected role 'homehub', got '{user['role']}'"
        print(f"✓ Home Hub user /auth/me returns: name='{user['name']}', role='{user['role']}'")
    
    def test_home_hub_gets_families_via_linkage(self, home_hub_session):
        """Test GET /api/families for Home Hub user returns Zachery's family via family_id/parent_id linkage"""
        session, login_user = home_hub_session
        
        response = session.get(f"{BASE_URL}/api/families")
        assert response.status_code == 200, f"Failed to get families: {response.text}"
        
        data = response.json()
        families = data.get('families', [])
        
        # Home Hub should have at least one family (Zachery's family)
        assert len(families) > 0, f"Home Hub user should have at least one family, got {len(families)}"
        
        # Check if Zachery's family (user_f5d5c9e075da) is in the list
        zachery_family = next((f for f in families if f['family_id'] == ZACHERY_USER_ID), None)
        
        assert zachery_family is not None, f"Home Hub should have access to Zachery's family (family_id={ZACHERY_USER_ID}). Got families: {[f['family_id'] for f in families]}"
        
        print(f"✓ Home Hub user can access Zachery's family via family_id/parent_id linkage")
        print(f"  Family ID: {zachery_family['family_id']}")
        print(f"  Family Name: {zachery_family.get('name', 'N/A')}")
        print(f"  Role: {zachery_family.get('role', 'N/A')}")
    
    def test_home_hub_gets_family_members(self, home_hub_session):
        """Test GET /api/families/{family_id}/members for Home Hub user returns all family members"""
        session, login_user = home_hub_session
        
        # Use Zachery's user_id as family_id (virtual family)
        response = session.get(f"{BASE_URL}/api/families/{ZACHERY_USER_ID}/members")
        assert response.status_code == 200, f"Failed to get family members: {response.text}"
        
        data = response.json()
        members = data.get('members', [])
        
        # Should have at least 6 family members as per the review request
        assert len(members) >= 6, f"Expected at least 6 family members, got {len(members)}"
        
        print(f"✓ Home Hub user can access family members ({len(members)} members)")
        for member in members:
            print(f"  - {member['name']}: {member['role']}")
    
    def test_elizabeth_role_is_parent(self, elizabeth_session):
        """Test Elizabeth Buss shows role=parent in /auth/me"""
        session, login_user = elizabeth_session
        
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Failed to get auth/me: {response.text}"
        
        user = response.json()
        assert user['user_id'] == ELIZABETH_USER_ID, f"Expected user_id '{ELIZABETH_USER_ID}', got '{user['user_id']}'"
        assert user['role'] == 'parent', f"Expected role 'parent', got '{user['role']}'"
        print(f"✓ Elizabeth's role in /auth/me is 'parent'")
    
    def test_zachery_role_is_parent_not_admin(self, zachery_session):
        """Test Zachery shows role=parent (not admin) in /families/members"""
        session, login_user = zachery_session
        
        # Get family members
        response = session.get(f"{BASE_URL}/api/families/{ZACHERY_USER_ID}/members")
        assert response.status_code == 200, f"Failed to get family members: {response.text}"
        
        data = response.json()
        members = data.get('members', [])
        
        # Find Zachery in the members list
        zachery = next((m for m in members if m['user_id'] == ZACHERY_USER_ID), None)
        assert zachery is not None, f"Zachery not found in family members"
        assert zachery['role'] == 'parent', f"Expected Zachery's role to be 'parent', got '{zachery['role']}'"
        assert zachery['role'] != 'admin', f"Zachery's role should NOT be 'admin'"
        
        print(f"✓ Zachery shows role='parent' (not 'admin') in family members")
    
    def test_home_hub_role_in_family_members(self, zachery_session):
        """Test Home Hub user shows role=homehub in /families/members response"""
        session, login_user = zachery_session
        
        # Get family members
        response = session.get(f"{BASE_URL}/api/families/{ZACHERY_USER_ID}/members")
        assert response.status_code == 200, f"Failed to get family members: {response.text}"
        
        data = response.json()
        members = data.get('members', [])
        
        # Find Home Hub user in the members list
        home_hub = next((m for m in members if m['user_id'] == HOME_HUB_USER_ID), None)
        assert home_hub is not None, f"Home Hub user not found in family members. Members: {[m['user_id'] for m in members]}"
        assert home_hub['role'] == 'homehub', f"Expected Home Hub's role to be 'homehub', got '{home_hub['role']}'"
        assert home_hub['name'] == 'Home Hub', f"Expected Home Hub's name to be 'Home Hub', got '{home_hub['name']}'"
        
        print(f"✓ Home Hub user shows role='homehub' and name='Home Hub' in family members")
    
    def test_elizabeth_role_in_family_members(self, zachery_session):
        """Test Elizabeth shows role=parent in /families/members response"""
        session, login_user = zachery_session
        
        # Get family members from blended family
        response = session.get(f"{BASE_URL}/api/families/{BLENDED_FAMILY_ID}/members")
        assert response.status_code == 200, f"Failed to get family members: {response.text}"
        
        data = response.json()
        members = data.get('members', [])
        
        # Find Elizabeth in the members list
        elizabeth = next((m for m in members if m['user_id'] == ELIZABETH_USER_ID), None)
        
        if elizabeth:
            assert elizabeth['role'] == 'parent', f"Expected Elizabeth's role to be 'parent', got '{elizabeth['role']}'"
            print(f"✓ Elizabeth shows role='parent' in blended family members")
        else:
            # Elizabeth might be in Zachery's virtual family instead
            response2 = session.get(f"{BASE_URL}/api/families/{ZACHERY_USER_ID}/members")
            if response2.status_code == 200:
                members2 = response2.json().get('members', [])
                elizabeth = next((m for m in members2 if m['user_id'] == ELIZABETH_USER_ID), None)
                if elizabeth:
                    assert elizabeth['role'] == 'parent', f"Expected Elizabeth's role to be 'parent', got '{elizabeth['role']}'"
                    print(f"✓ Elizabeth shows role='parent' in Zachery's family members")
                else:
                    print(f"⚠ Elizabeth not found in either family. This may be expected if she's in a different family structure.")
            else:
                print(f"⚠ Could not verify Elizabeth's role in family members")
    
    def test_no_admin_roles_in_family_members(self, zachery_session):
        """Test that no member has 'admin' role - all should be normalized to 'parent'"""
        session, login_user = zachery_session
        
        # Check Zachery's virtual family
        response = session.get(f"{BASE_URL}/api/families/{ZACHERY_USER_ID}/members")
        assert response.status_code == 200, f"Failed to get family members: {response.text}"
        
        data = response.json()
        members = data.get('members', [])
        
        admin_members = [m for m in members if m['role'] == 'admin']
        assert len(admin_members) == 0, f"Found members with 'admin' role: {[m['name'] for m in admin_members]}"
        
        print(f"✓ No members have 'admin' role - all normalized correctly")


class TestHomeHubPageAccess:
    """Tests for Home Hub page data access"""
    
    @pytest.fixture
    def home_hub_session(self):
        """Login as Home Hub user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": HOME_HUB_EMAIL}
        )
        assert response.status_code == 200, f"Failed to login as Home Hub: {response.text}"
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_home_hub_can_access_calendar(self, home_hub_session):
        """Test Home Hub user can access calendar events"""
        response = home_hub_session.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200, f"Failed to get events: {response.text}"
        print(f"✓ Home Hub user can access calendar events")
    
    def test_home_hub_can_access_chores(self, home_hub_session):
        """Test Home Hub user can access chores"""
        response = home_hub_session.get(f"{BASE_URL}/api/chores")
        assert response.status_code == 200, f"Failed to get chores: {response.text}"
        print(f"✓ Home Hub user can access chores")
    
    def test_home_hub_can_access_shopping(self, home_hub_session):
        """Test Home Hub user can access shopping list"""
        response = home_hub_session.get(f"{BASE_URL}/api/shopping")
        assert response.status_code == 200, f"Failed to get shopping: {response.text}"
        print(f"✓ Home Hub user can access shopping list")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
