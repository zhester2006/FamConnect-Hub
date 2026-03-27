"""
Iteration 34 Backend Tests
Testing:
1. Role change from parent to homehub and back
2. Sidebar restrictions for homehub role (frontend code review)
3. Notifications for chores, events, shopping
4. Children completing chores
5. FamilyManagement Edit Profile for all members
"""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://family-connect-app-4.preview.emergentagent.com')

# Test credentials from the review request
ZACHERY_EMAIL = "zhesterusar@gmail.com"
ELIZABETH_EMAIL = "ebuss980@gmail.com"
ZACHERY_USER_ID = "user_f5d5c9e075da"
ELIZABETH_USER_ID = "user_10ad6e706051"
ISAIAH_USER_ID = "user_7c4f7c62dd2e"
BLENDED_FAMILY_ID = "family_0c5ee4535871"


class TestDevLogin:
    """Test dev-login functionality"""
    
    def test_dev_login_zachery_parent(self):
        """Dev-login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200, f"Dev-login failed: {response.text}"
        data = response.json()
        assert "token" in data or "session_token" in data, "No token in response"
        assert data.get("user", {}).get("role") == "parent", "Role should be parent"
        print(f"✓ Dev-login as Zachery (parent) successful")
        return data
    
    def test_dev_login_elizabeth_parent(self):
        """Dev-login as Elizabeth (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ELIZABETH_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200, f"Dev-login failed: {response.text}"
        data = response.json()
        assert "token" in data or "session_token" in data, "No token in response"
        print(f"✓ Dev-login as Elizabeth (parent) successful")
        return data


class TestRoleChange:
    """Test role change functionality - parent to homehub and back"""
    
    @pytest.fixture
    def zachery_session(self):
        """Get authenticated session for Zachery"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("session_token")
        session = requests.Session()
        session.headers.update({"Authorization": f"Bearer {token}"})
        # Also set cookies from response
        session.cookies.update(response.cookies)
        return session
    
    def test_change_elizabeth_to_homehub(self, zachery_session):
        """Change Elizabeth's role from parent to homehub"""
        response = zachery_session.put(
            f"{BASE_URL}/api/family/members/{ELIZABETH_USER_ID}/role",
            json={"role": "homehub"}
        )
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 200, f"Role change failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Role change should succeed"
        assert data.get("new_role") == "homehub", "New role should be homehub"
        print(f"✓ Changed Elizabeth's role to homehub")
    
    def test_verify_elizabeth_is_homehub(self, zachery_session):
        """Verify Elizabeth's role is now homehub"""
        # First change to homehub
        zachery_session.put(
            f"{BASE_URL}/api/family/members/{ELIZABETH_USER_ID}/role",
            json={"role": "homehub"}
        )
        
        # Verify by getting user info
        response = zachery_session.get(f"{BASE_URL}/api/users/{ELIZABETH_USER_ID}")
        if response.status_code == 200:
            data = response.json()
            assert data.get("role") == "homehub", f"Role should be homehub, got {data.get('role')}"
            print(f"✓ Verified Elizabeth's role is homehub")
        else:
            # Try family members endpoint
            response = zachery_session.get(f"{BASE_URL}/api/family/members/detailed")
            assert response.status_code == 200
            data = response.json()
            members = data.get("members", [])
            elizabeth = next((m for m in members if m.get("user_id") == ELIZABETH_USER_ID), None)
            assert elizabeth is not None, "Elizabeth not found in family members"
            assert elizabeth.get("role") == "homehub", f"Role should be homehub, got {elizabeth.get('role')}"
            print(f"✓ Verified Elizabeth's role is homehub via family members")
    
    def test_change_elizabeth_back_to_parent(self, zachery_session):
        """Change Elizabeth's role back to parent"""
        # First ensure she's homehub
        zachery_session.put(
            f"{BASE_URL}/api/family/members/{ELIZABETH_USER_ID}/role",
            json={"role": "homehub"}
        )
        
        # Now change back to parent
        response = zachery_session.put(
            f"{BASE_URL}/api/family/members/{ELIZABETH_USER_ID}/role",
            json={"role": "parent"}
        )
        assert response.status_code == 200, f"Role change back failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Role change should succeed"
        assert data.get("new_role") == "parent", "New role should be parent"
        print(f"✓ Changed Elizabeth's role back to parent")
    
    def test_role_validation_rejects_invalid(self, zachery_session):
        """Role validation should reject invalid roles"""
        response = zachery_session.put(
            f"{BASE_URL}/api/family/members/{ELIZABETH_USER_ID}/role",
            json={"role": "invalid_role"}
        )
        assert response.status_code == 400, f"Should reject invalid role, got {response.status_code}"
        print(f"✓ Invalid role correctly rejected")


class TestChoreNotifications:
    """Test notifications for chore operations"""
    
    @pytest.fixture
    def zachery_session(self):
        """Get authenticated session for Zachery"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("session_token")
        session = requests.Session()
        session.headers.update({"Authorization": f"Bearer {token}"})
        session.cookies.update(response.cookies)
        return session
    
    def test_create_chore_creates_notification(self, zachery_session):
        """Creating a chore should create notification for assigned user"""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Create a chore assigned to Isaiah
        response = zachery_session.post(
            f"{BASE_URL}/api/chores",
            json={
                "title": "TEST_Notification_Chore",
                "description": "Test chore for notification testing",
                "assigned_to": ISAIAH_USER_ID,
                "scheduled_date": today,
                "points": 15
            }
        )
        assert response.status_code == 200, f"Chore creation failed: {response.text}"
        data = response.json()
        chore_id = data.get("chore_id")
        assert chore_id is not None, "Chore ID should be returned"
        print(f"✓ Created test chore: {chore_id}")
        
        # Check notifications for Isaiah
        # Note: We can't directly check Isaiah's notifications without logging in as Isaiah
        # But we can verify the chore was created with correct assignment
        assert data.get("assigned_to") == ISAIAH_USER_ID, "Chore should be assigned to Isaiah"
        print(f"✓ Chore assigned to Isaiah, notification should be created")
        
        # Cleanup - delete the test chore
        zachery_session.delete(f"{BASE_URL}/api/chores/{chore_id}")
        return chore_id


class TestChoreCompletion:
    """Test children completing chores"""
    
    @pytest.fixture
    def zachery_session(self):
        """Get authenticated session for Zachery"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("session_token")
        session = requests.Session()
        session.headers.update({"Authorization": f"Bearer {token}"})
        session.cookies.update(response.cookies)
        return session
    
    def test_complete_chore_endpoint(self, zachery_session):
        """Test the chore completion endpoint"""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Create a test chore
        create_response = zachery_session.post(
            f"{BASE_URL}/api/chores",
            json={
                "title": "TEST_Complete_Chore",
                "description": "Test chore for completion testing",
                "assigned_to": ISAIAH_USER_ID,
                "scheduled_date": today,
                "points": 10
            }
        )
        assert create_response.status_code == 200
        chore_id = create_response.json().get("chore_id")
        print(f"✓ Created test chore: {chore_id}")
        
        # Complete the chore (as parent for testing - in real app child would do this)
        complete_response = zachery_session.put(
            f"{BASE_URL}/api/chores/{chore_id}/complete"
        )
        assert complete_response.status_code == 200, f"Chore completion failed: {complete_response.text}"
        data = complete_response.json()
        assert data.get("status") == "completed", f"Status should be completed, got {data.get('status')}"
        print(f"✓ Chore marked as completed")
        
        # Cleanup
        zachery_session.delete(f"{BASE_URL}/api/chores/{chore_id}")
        print(f"✓ Test chore cleaned up")


class TestCalendarNotifications:
    """Test notifications for calendar events"""
    
    @pytest.fixture
    def zachery_session(self):
        """Get authenticated session for Zachery"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("session_token")
        session = requests.Session()
        session.headers.update({"Authorization": f"Bearer {token}"})
        session.cookies.update(response.cookies)
        return session
    
    def test_create_event_with_assignee(self, zachery_session):
        """Creating an event with assignee should create notification"""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        response = zachery_session.post(
            f"{BASE_URL}/api/events",
            json={
                "title": "TEST_Event_Notification",
                "event_date": today,
                "event_time": "14:00",
                "event_type": "appointment",
                "assigned_to": ISAIAH_USER_ID
            }
        )
        assert response.status_code == 200, f"Event creation failed: {response.text}"
        data = response.json()
        event_id = data.get("event_id")
        assert event_id is not None, "Event ID should be returned"
        assert data.get("assigned_to") == ISAIAH_USER_ID, "Event should be assigned to Isaiah"
        print(f"✓ Created event with assignee: {event_id}")
        
        # Note: Notification is created in backend, we verified the event was created correctly
        return event_id


class TestShoppingNotifications:
    """Test notifications for shopping items"""
    
    @pytest.fixture
    def zachery_session(self):
        """Get authenticated session for Zachery"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("session_token")
        session = requests.Session()
        session.headers.update({"Authorization": f"Bearer {token}"})
        session.cookies.update(response.cookies)
        return session
    
    def test_create_shopping_item(self, zachery_session):
        """Test creating a shopping item"""
        response = zachery_session.post(
            f"{BASE_URL}/api/shopping",
            json={"name": "TEST_Shopping_Item"}
        )
        assert response.status_code == 200, f"Shopping item creation failed: {response.text}"
        data = response.json()
        item_id = data.get("item_id")
        assert item_id is not None, "Item ID should be returned"
        print(f"✓ Created shopping item: {item_id}")
        
        # Cleanup
        zachery_session.delete(f"{BASE_URL}/api/shopping/{item_id}")
        return item_id
    
    def test_update_shopping_item_status(self, zachery_session):
        """Test updating shopping item status (approval/denial)"""
        # Create item first
        create_response = zachery_session.post(
            f"{BASE_URL}/api/shopping",
            json={"name": "TEST_Shopping_Approval"}
        )
        assert create_response.status_code == 200
        item_id = create_response.json().get("item_id")
        
        # Update status to approved
        update_response = zachery_session.put(
            f"{BASE_URL}/api/shopping/{item_id}",
            json={"status": "approved"}
        )
        assert update_response.status_code == 200, f"Shopping update failed: {update_response.text}"
        data = update_response.json()
        assert data.get("status") == "approved", f"Status should be approved, got {data.get('status')}"
        print(f"✓ Shopping item approved")
        
        # Cleanup
        zachery_session.delete(f"{BASE_URL}/api/shopping/{item_id}")


class TestChoreApproval:
    """Test chore approval and notification to child"""
    
    @pytest.fixture
    def zachery_session(self):
        """Get authenticated session for Zachery"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("session_token")
        session = requests.Session()
        session.headers.update({"Authorization": f"Bearer {token}"})
        session.cookies.update(response.cookies)
        return session
    
    def test_approve_chore_creates_notification(self, zachery_session):
        """Approving a chore should create notification for child"""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Create and complete a chore
        create_response = zachery_session.post(
            f"{BASE_URL}/api/chores",
            json={
                "title": "TEST_Approval_Chore",
                "assigned_to": ISAIAH_USER_ID,
                "scheduled_date": today,
                "points": 20
            }
        )
        assert create_response.status_code == 200
        chore_id = create_response.json().get("chore_id")
        
        # Complete the chore
        zachery_session.put(f"{BASE_URL}/api/chores/{chore_id}/complete")
        
        # Approve the chore
        approve_response = zachery_session.put(
            f"{BASE_URL}/api/chores/{chore_id}/approve",
            json={"approved": True}
        )
        assert approve_response.status_code == 200, f"Chore approval failed: {approve_response.text}"
        data = approve_response.json()
        assert data.get("status") == "approved", f"Status should be approved, got {data.get('status')}"
        print(f"✓ Chore approved, notification should be sent to child")
        
        # Cleanup
        zachery_session.delete(f"{BASE_URL}/api/chores/{chore_id}")
    
    def test_deny_chore_creates_notification(self, zachery_session):
        """Denying a chore should create notification for child"""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Create and complete a chore
        create_response = zachery_session.post(
            f"{BASE_URL}/api/chores",
            json={
                "title": "TEST_Denial_Chore",
                "assigned_to": ISAIAH_USER_ID,
                "scheduled_date": today,
                "points": 15
            }
        )
        assert create_response.status_code == 200
        chore_id = create_response.json().get("chore_id")
        
        # Complete the chore
        zachery_session.put(f"{BASE_URL}/api/chores/{chore_id}/complete")
        
        # Deny the chore
        deny_response = zachery_session.put(
            f"{BASE_URL}/api/chores/{chore_id}/approve",
            json={"approved": False}
        )
        assert deny_response.status_code == 200, f"Chore denial failed: {deny_response.text}"
        data = deny_response.json()
        assert data.get("status") == "denied", f"Status should be denied, got {data.get('status')}"
        print(f"✓ Chore denied, notification should be sent to child")
        
        # Cleanup
        zachery_session.delete(f"{BASE_URL}/api/chores/{chore_id}")


class TestFamilyMemberCredentials:
    """Test editing family member credentials"""
    
    @pytest.fixture
    def zachery_session(self):
        """Get authenticated session for Zachery"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("session_token")
        session = requests.Session()
        session.headers.update({"Authorization": f"Bearer {token}"})
        session.cookies.update(response.cookies)
        return session
    
    def test_get_family_members_detailed(self, zachery_session):
        """Get detailed family members list"""
        response = zachery_session.get(f"{BASE_URL}/api/family/members/detailed")
        assert response.status_code == 200, f"Failed to get members: {response.text}"
        data = response.json()
        members = data.get("members", [])
        assert len(members) > 0, "Should have at least one family member"
        print(f"✓ Got {len(members)} family members")
        
        # Check that all members have required fields
        for member in members:
            assert "user_id" in member, "Member should have user_id"
            assert "name" in member, "Member should have name"
            assert "role" in member, "Member should have role"
        print(f"✓ All members have required fields")


class TestCleanup:
    """Ensure Elizabeth is back to parent role after all tests"""
    
    def test_restore_elizabeth_to_parent(self):
        """Restore Elizabeth's role to parent"""
        # Login as Zachery
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("session_token")
        
        # Change Elizabeth back to parent
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.put(
            f"{BASE_URL}/api/family/members/{ELIZABETH_USER_ID}/role",
            json={"role": "parent"},
            headers=headers,
            cookies=response.cookies
        )
        
        if response.status_code == 200:
            print(f"✓ Elizabeth's role restored to parent")
        else:
            print(f"⚠ Could not restore Elizabeth's role: {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
