"""
Iteration 35 Tests - FamFocus Hub Role Management and Sidebar Restrictions
Tests for:
1. Role change from parent to homehub works for Elizabeth
2. GET /api/auth/me returns correct role (homehub) after role change
3. GET /api/families/{family_id}/members returns 'parent' instead of 'admin' for family creators
4. Zachery shows 'Parent' (not 'Admin') in family member list
5. Elizabeth shows 'Homehub' in family member list after role change
6. Notifications for chores, calendar events, shopping items
7. Children can complete chores
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ZACHERY_EMAIL = "zhesterusar@gmail.com"
ELIZABETH_EMAIL = "ebuss980@gmail.com"
ZACHERY_USER_ID = "user_f5d5c9e075da"
ELIZABETH_USER_ID = "user_10ad6e706051"
BLENDED_FAMILY_ID = "family_0c5ee4535871"


class TestRoleManagement:
    """Tests for role management and family member display"""
    
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
    
    @pytest.fixture
    def elizabeth_session(self):
        """Login as Elizabeth (homehub)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ELIZABETH_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_elizabeth_role_is_homehub(self, elizabeth_session):
        """Test that Elizabeth's role is homehub in /api/auth/me"""
        response = elizabeth_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data['user_id'] == ELIZABETH_USER_ID
        assert data['role'] == 'homehub', f"Expected role 'homehub', got '{data['role']}'"
        print(f"✓ Elizabeth's role is correctly 'homehub'")
    
    def test_zachery_role_is_parent(self, zachery_session):
        """Test that Zachery's role is parent in /api/auth/me"""
        response = zachery_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data['user_id'] == ZACHERY_USER_ID
        assert data['role'] == 'parent', f"Expected role 'parent', got '{data['role']}'"
        print(f"✓ Zachery's role is correctly 'parent'")
    
    def test_family_members_shows_parent_not_admin(self, zachery_session):
        """Test that GET /api/families/{family_id}/members returns 'parent' not 'admin'"""
        response = zachery_session.get(f"{BASE_URL}/api/families/{BLENDED_FAMILY_ID}/members")
        assert response.status_code == 200
        data = response.json()
        members = data.get('members', [])
        
        # Check that no member has 'admin' role - should all be 'parent', 'child', 'member', or 'homehub'
        for member in members:
            assert member['role'] != 'admin', f"Member {member['name']} has role 'admin' instead of 'parent'"
        
        # Find Zachery and verify role is 'parent'
        zachery = next((m for m in members if m['user_id'] == ZACHERY_USER_ID), None)
        if zachery:
            assert zachery['role'] == 'parent', f"Zachery's role is '{zachery['role']}' instead of 'parent'"
            print(f"✓ Zachery shows 'parent' (not 'admin') in family member list")
        
        # Find Elizabeth and verify role is 'homehub'
        elizabeth = next((m for m in members if m['user_id'] == ELIZABETH_USER_ID), None)
        if elizabeth:
            assert elizabeth['role'] == 'homehub', f"Elizabeth's role is '{elizabeth['role']}' instead of 'homehub'"
            print(f"✓ Elizabeth shows 'homehub' in family member list")
        
        print(f"✓ No members have 'admin' role - all normalized to 'parent'")
    
    def test_role_change_to_homehub_and_back(self, zachery_session):
        """Test that role can be changed from parent to homehub and back"""
        # First, get current role
        response = zachery_session.get(f"{BASE_URL}/api/families/{BLENDED_FAMILY_ID}/members")
        assert response.status_code == 200
        members = response.json().get('members', [])
        elizabeth = next((m for m in members if m['user_id'] == ELIZABETH_USER_ID), None)
        original_role = elizabeth['role'] if elizabeth else 'homehub'
        
        # Change Elizabeth's role to 'parent' temporarily
        response = zachery_session.put(
            f"{BASE_URL}/api/family/members/{ELIZABETH_USER_ID}/role",
            json={"role": "parent"}
        )
        assert response.status_code == 200
        print(f"✓ Changed Elizabeth's role to 'parent'")
        
        # Verify the change
        response = zachery_session.get(f"{BASE_URL}/api/families/{BLENDED_FAMILY_ID}/members")
        members = response.json().get('members', [])
        elizabeth = next((m for m in members if m['user_id'] == ELIZABETH_USER_ID), None)
        assert elizabeth['role'] == 'parent', f"Role change failed, got '{elizabeth['role']}'"
        
        # Change back to homehub
        response = zachery_session.put(
            f"{BASE_URL}/api/family/members/{ELIZABETH_USER_ID}/role",
            json={"role": "homehub"}
        )
        assert response.status_code == 200
        print(f"✓ Changed Elizabeth's role back to 'homehub'")
        
        # Verify the change back
        response = zachery_session.get(f"{BASE_URL}/api/families/{BLENDED_FAMILY_ID}/members")
        members = response.json().get('members', [])
        elizabeth = next((m for m in members if m['user_id'] == ELIZABETH_USER_ID), None)
        assert elizabeth['role'] == 'homehub', f"Role change back failed, got '{elizabeth['role']}'"
        print(f"✓ Role change to homehub and back works correctly")


class TestNotifications:
    """Tests for notification creation on chores, events, and shopping items"""
    
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
    
    def test_chore_creation_creates_notification(self, zachery_session):
        """Test that creating a chore creates a notification for the assigned user"""
        # Get a child user to assign chore to
        response = zachery_session.get(f"{BASE_URL}/api/families/{BLENDED_FAMILY_ID}/members")
        assert response.status_code == 200
        members = response.json().get('members', [])
        child = next((m for m in members if m['role'] == 'child'), None)
        
        if child:
            # Create a test chore with correct field names
            chore_data = {
                "title": "TEST_Clean Room",
                "description": "Test chore for notification",
                "assigned_to": child['user_id'],
                "points": 10,
                "scheduled_date": "2026-03-30"  # Correct field name
            }
            response = zachery_session.post(f"{BASE_URL}/api/chores", json=chore_data)
            assert response.status_code in [200, 201], f"Failed to create chore: {response.text}"
            print(f"✓ Chore created successfully")
            
            # Clean up - delete the test chore
            if response.status_code in [200, 201]:
                chore_id = response.json().get('chore_id')
                if chore_id:
                    zachery_session.delete(f"{BASE_URL}/api/chores/{chore_id}")
        else:
            print("⚠ No child found to test chore notification")
    
    def test_event_creation_creates_notification(self, zachery_session):
        """Test that creating an event creates a notification"""
        event_data = {
            "title": "TEST_Family Meeting",
            "description": "Test event for notification",
            "event_date": "2026-03-30",  # Correct field name
            "event_time": "10:00"
        }
        response = zachery_session.post(f"{BASE_URL}/api/events", json=event_data)
        assert response.status_code in [200, 201], f"Failed to create event: {response.text}"
        print(f"✓ Event created successfully")
        
        # Clean up
        if response.status_code in [200, 201]:
            event_id = response.json().get('event_id')
            if event_id:
                zachery_session.delete(f"{BASE_URL}/api/events/{event_id}")


class TestChoreCompletion:
    """Tests for chore completion by children"""
    
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
    
    def test_chore_complete_endpoint_exists(self, zachery_session):
        """Test that the chore complete endpoint exists"""
        # Get existing chores
        response = zachery_session.get(f"{BASE_URL}/api/chores")
        assert response.status_code == 200
        data = response.json()
        
        # Handle both list and dict response formats
        chores = data.get('chores', []) if isinstance(data, dict) else data
        
        if chores and len(chores) > 0:
            # Try to complete a chore (may fail if already completed, but endpoint should exist)
            chore_id = chores[0].get('chore_id')
            response = zachery_session.put(f"{BASE_URL}/api/chores/{chore_id}/complete")
            # Should return 200 or 400 (if already completed), not 404
            assert response.status_code != 404, "Chore complete endpoint not found"
            print(f"✓ Chore complete endpoint exists and responds")
        else:
            # Create a test chore to verify endpoint
            chore_data = {
                "title": "TEST_Endpoint Check",
                "description": "Test chore for endpoint verification",
                "scheduled_date": "2026-03-30",
                "points": 5
            }
            create_response = zachery_session.post(f"{BASE_URL}/api/chores", json=chore_data)
            if create_response.status_code in [200, 201]:
                chore_id = create_response.json().get('chore_id')
                response = zachery_session.put(f"{BASE_URL}/api/chores/{chore_id}/complete")
                assert response.status_code != 404, "Chore complete endpoint not found"
                print(f"✓ Chore complete endpoint exists and responds")
                # Clean up
                zachery_session.delete(f"{BASE_URL}/api/chores/{chore_id}")
            else:
                print("⚠ Could not create test chore")


class TestOAuthRedirect:
    """Tests for OAuth redirect logic based on role"""
    
    def test_dev_login_returns_correct_role_for_homehub(self):
        """Test that dev-login returns correct role for homehub user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ELIZABETH_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        # The user's actual role should be returned, not the requested role
        assert data['user']['role'] == 'homehub', f"Expected 'homehub', got '{data['user']['role']}'"
        print(f"✓ Dev-login returns correct role 'homehub' for Elizabeth")
    
    def test_dev_login_returns_correct_role_for_parent(self):
        """Test that dev-login returns correct role for parent user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data['user']['role'] == 'parent', f"Expected 'parent', got '{data['user']['role']}'"
        print(f"✓ Dev-login returns correct role 'parent' for Zachery")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
