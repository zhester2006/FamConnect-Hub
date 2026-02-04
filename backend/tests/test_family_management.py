"""
Test Family Management Endpoints
- GET /api/families - returns list of user's families
- POST /api/families - creates new family
- POST /api/families/{family_id}/invite - sends invitation
- GET /api/families/invites/pending - returns pending invites
- POST /api/families/invites/{invite_id}/accept - accepts invite
- POST /api/families/invites/{invite_id}/decline - declines invite
- POST /api/families/switch/{family_id} - switches active family
- DELETE /api/families/{family_id}/leave - leaves a family
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials created via mongosh
USER1_SESSION = "test_family_session_1770177893176"
USER2_SESSION = "test_family_session2_1770177893176"
USER2_EMAIL = "test.family2.1770177893176@example.com"
USER1_ID = "test-family-user-1770177893176"


class TestFamilyEndpointsAuth:
    """Test authentication requirements for family endpoints"""
    
    def test_get_families_requires_auth(self):
        """GET /api/families should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/families")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: GET /api/families requires authentication")
    
    def test_create_family_requires_auth(self):
        """POST /api/families should return 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/families",
            json={"name": "Test Family"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: POST /api/families requires authentication")
    
    def test_pending_invites_requires_auth(self):
        """GET /api/families/invites/pending should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/families/invites/pending")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: GET /api/families/invites/pending requires authentication")


class TestGetFamilies:
    """Test GET /api/families endpoint"""
    
    def test_get_families_authenticated(self):
        """GET /api/families should return user's families"""
        response = requests.get(
            f"{BASE_URL}/api/families",
            headers={"Authorization": f"Bearer {USER1_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "families" in data, "Response should contain 'families' key"
        assert isinstance(data["families"], list), "families should be a list"
        
        # Parent user should have at least their own family
        if len(data["families"]) > 0:
            family = data["families"][0]
            assert "family_id" in family, "Family should have family_id"
            assert "name" in family, "Family should have name"
            assert "role" in family, "Family should have role"
            print(f"PASS: GET /api/families returns {len(data['families'])} families")
        else:
            print("PASS: GET /api/families returns empty list (no families yet)")


class TestCreateFamily:
    """Test POST /api/families endpoint"""
    
    def test_create_family_success(self):
        """POST /api/families should create a new family"""
        family_name = "TEST_Family_Creation"
        response = requests.post(
            f"{BASE_URL}/api/families",
            headers={
                "Authorization": f"Bearer {USER1_SESSION}",
                "Content-Type": "application/json"
            },
            json={"name": family_name}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "family_id" in data, "Response should contain family_id"
        assert "name" in data, "Response should contain name"
        assert data["name"] == family_name, f"Expected name '{family_name}', got '{data['name']}'"
        
        # Store for later tests
        TestCreateFamily.created_family_id = data["family_id"]
        print(f"PASS: Created family with ID: {data['family_id']}")
    
    def test_verify_family_in_list(self):
        """Verify created family appears in GET /api/families"""
        response = requests.get(
            f"{BASE_URL}/api/families",
            headers={"Authorization": f"Bearer {USER1_SESSION}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        family_ids = [f["family_id"] for f in data["families"]]
        
        if hasattr(TestCreateFamily, 'created_family_id'):
            assert TestCreateFamily.created_family_id in family_ids, \
                f"Created family {TestCreateFamily.created_family_id} not found in families list"
            print("PASS: Created family appears in families list")
        else:
            pytest.skip("No family was created in previous test")


class TestFamilyInvite:
    """Test family invitation endpoints"""
    
    def test_invite_to_family(self):
        """POST /api/families/{family_id}/invite should send invitation"""
        # Use user1's own family (user_id as family_id for parent)
        family_id = USER1_ID
        
        response = requests.post(
            f"{BASE_URL}/api/families/{family_id}/invite",
            headers={
                "Authorization": f"Bearer {USER1_SESSION}",
                "Content-Type": "application/json"
            },
            json={
                "email": USER2_EMAIL,
                "role": "member"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "invite_id" in data, "Response should contain invite_id"
        assert data["status"] == "pending", f"Expected status 'pending', got '{data['status']}'"
        
        TestFamilyInvite.invite_id = data["invite_id"]
        print(f"PASS: Created invite with ID: {data['invite_id']}")
    
    def test_get_pending_invites(self):
        """GET /api/families/invites/pending should return pending invites for user2"""
        response = requests.get(
            f"{BASE_URL}/api/families/invites/pending",
            headers={"Authorization": f"Bearer {USER2_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "invites" in data, "Response should contain 'invites' key"
        assert isinstance(data["invites"], list), "invites should be a list"
        
        # Should have at least the invite we just created
        if hasattr(TestFamilyInvite, 'invite_id'):
            invite_ids = [inv["invite_id"] for inv in data["invites"]]
            assert TestFamilyInvite.invite_id in invite_ids, \
                f"Invite {TestFamilyInvite.invite_id} not found in pending invites"
            print(f"PASS: Found {len(data['invites'])} pending invites including our test invite")
        else:
            print(f"PASS: GET /api/families/invites/pending returns {len(data['invites'])} invites")
    
    def test_decline_invite(self):
        """POST /api/families/invites/{invite_id}/decline should decline invitation"""
        if not hasattr(TestFamilyInvite, 'invite_id'):
            pytest.skip("No invite was created in previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/families/invites/{TestFamilyInvite.invite_id}/decline",
            headers={"Authorization": f"Bearer {USER2_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        print("PASS: Declined invite successfully")
    
    def test_create_and_accept_invite(self):
        """Test full invite flow: create invite -> accept invite"""
        # Create new invite
        family_id = USER1_ID
        
        response = requests.post(
            f"{BASE_URL}/api/families/{family_id}/invite",
            headers={
                "Authorization": f"Bearer {USER1_SESSION}",
                "Content-Type": "application/json"
            },
            json={
                "email": USER2_EMAIL,
                "role": "member"
            }
        )
        assert response.status_code == 200, f"Failed to create invite: {response.text}"
        invite_id = response.json()["invite_id"]
        
        # Accept the invite as user2
        response = requests.post(
            f"{BASE_URL}/api/families/invites/{invite_id}/accept",
            headers={"Authorization": f"Bearer {USER2_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "family_id" in data, "Response should contain family_id"
        
        TestFamilyInvite.joined_family_id = data["family_id"]
        print(f"PASS: Accepted invite and joined family {data['family_id']}")


class TestSwitchFamily:
    """Test POST /api/families/switch/{family_id} endpoint"""
    
    def test_switch_family_success(self):
        """POST /api/families/switch/{family_id} should switch active family"""
        # User2 should now be a member of user1's family
        if not hasattr(TestFamilyInvite, 'joined_family_id'):
            pytest.skip("User2 hasn't joined any family yet")
        
        family_id = TestFamilyInvite.joined_family_id
        
        response = requests.post(
            f"{BASE_URL}/api/families/switch/{family_id}",
            headers={"Authorization": f"Bearer {USER2_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert data.get("current_family_id") == family_id, \
            f"Expected current_family_id '{family_id}', got '{data.get('current_family_id')}'"
        print(f"PASS: Switched to family {family_id}")
    
    def test_switch_to_non_member_family_fails(self):
        """POST /api/families/switch/{family_id} should fail for non-member"""
        # Try to switch to a family user1 is not a member of
        fake_family_id = "fake_family_12345"
        
        response = requests.post(
            f"{BASE_URL}/api/families/switch/{fake_family_id}",
            headers={"Authorization": f"Bearer {USER1_SESSION}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("PASS: Cannot switch to non-member family")


class TestLeaveFamily:
    """Test DELETE /api/families/{family_id}/leave endpoint"""
    
    def test_leave_family_success(self):
        """DELETE /api/families/{family_id}/leave should remove membership"""
        if not hasattr(TestFamilyInvite, 'joined_family_id'):
            pytest.skip("User2 hasn't joined any family yet")
        
        family_id = TestFamilyInvite.joined_family_id
        
        response = requests.delete(
            f"{BASE_URL}/api/families/{family_id}/leave",
            headers={"Authorization": f"Bearer {USER2_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        print(f"PASS: Left family {family_id}")
    
    def test_cannot_leave_own_family(self):
        """DELETE /api/families/{family_id}/leave should fail for own family"""
        # User1 trying to leave their own family (where they are parent)
        family_id = USER1_ID
        
        response = requests.delete(
            f"{BASE_URL}/api/families/{family_id}/leave",
            headers={"Authorization": f"Bearer {USER1_SESSION}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("PASS: Cannot leave own family as parent")


class TestInviteEdgeCases:
    """Test edge cases for invite endpoints"""
    
    def test_accept_nonexistent_invite(self):
        """POST /api/families/invites/{invite_id}/accept should fail for nonexistent invite"""
        response = requests.post(
            f"{BASE_URL}/api/families/invites/fake_invite_12345/accept",
            headers={"Authorization": f"Bearer {USER2_SESSION}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Cannot accept nonexistent invite")
    
    def test_decline_nonexistent_invite(self):
        """POST /api/families/invites/{invite_id}/decline should fail for nonexistent invite"""
        response = requests.post(
            f"{BASE_URL}/api/families/invites/fake_invite_12345/decline",
            headers={"Authorization": f"Bearer {USER2_SESSION}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Cannot decline nonexistent invite")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
