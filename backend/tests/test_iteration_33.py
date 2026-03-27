"""
Test suite for FamFocus Hub - Iteration 33
Testing new features:
1. FamilyManagement: Change Role modal shows 4 options: parent, member, child, homehub
2. FamilyManagement: Invite modal shows 4 role options including homehub
3. FamilyManagement: Edit Profile button appears for ALL family members
4. FamilyManagement: Edit Profile modal has fields for: Name, Email, Username, Password, PIN
5. Backend PUT /api/users/{user_id}/credentials accepts name, email, username, password, pin
6. FamilyManagement: Edit Family Name button works - updates family name via PUT /api/families/{family_id}
7. HomeHub: Orientation toggle button visible
8. HomeHub: PIN verification still required for homehub role
9. CheckIns/Location: Family member tabs are equal-sized grid cards
10. Backend role change to 'homehub' works via PUT /api/family/members/{member_id}/role
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://chore-share-test.preview.emergentagent.com')

# Test credentials
ZACHERY_EMAIL = "zhesterusar@gmail.com"
ELIZABETH_EMAIL = "ebuss980@gmail.com"
BLENDED_FAMILY_ID = "family_0c5ee4535871"
ZACHERY_USER_ID = "user_f5d5c9e075da"
NIVEA_USER_ID = "user_9cf69734c1ef"  # child
ELI_USER_ID = "user_597d242235c8"  # child


class TestRoleChangeToHomehub:
    """Test role change to 'homehub' via PUT /api/family/members/{member_id}/role"""
    
    def test_change_role_to_homehub(self):
        """Parent can change a member's role to 'homehub'"""
        # Login as Zachery (parent)
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Create a test child to change role
        unique_id = uuid.uuid4().hex[:8]
        create_res = requests.post(
            f"{BASE_URL}/api/users/child",
            json={
                "name": f"TEST_RoleChange_{unique_id}",
                "username": f"testrole{unique_id}",
                "password": "testpass123",
                "pin": "9999"
            },
            headers=headers,
            cookies=cookies
        )
        assert create_res.status_code == 200, f"Failed to create test child: {create_res.text}"
        test_user_id = create_res.json()["user_id"]
        print(f"✓ Created test user: {test_user_id}")
        
        # Change role to homehub
        role_res = requests.put(
            f"{BASE_URL}/api/family/members/{test_user_id}/role",
            json={"role": "homehub"},
            headers=headers,
            cookies=cookies
        )
        assert role_res.status_code == 200, f"Failed to change role to homehub: {role_res.text}"
        data = role_res.json()
        assert data.get("success") == True or data.get("new_role") == "homehub"
        print(f"✓ Role changed to homehub successfully")
        
        # Verify role was changed
        user_res = requests.get(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
        assert user_res.status_code == 200
        user_data = user_res.json()
        assert user_data.get("role") == "homehub", f"Expected role 'homehub', got '{user_data.get('role')}'"
        print(f"✓ Verified user role is now 'homehub'")
        
        # Cleanup - delete test user
        requests.delete(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
        print(f"✓ Cleaned up test user")
    
    def test_change_role_to_all_valid_roles(self):
        """Test changing role to all valid options: parent, member, child, homehub"""
        # Login as Zachery
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Create test user
        unique_id = uuid.uuid4().hex[:8]
        create_res = requests.post(
            f"{BASE_URL}/api/users/child",
            json={
                "name": f"TEST_AllRoles_{unique_id}",
                "username": f"testallroles{unique_id}",
                "password": "testpass123",
                "pin": "9999"
            },
            headers=headers,
            cookies=cookies
        )
        assert create_res.status_code == 200
        test_user_id = create_res.json()["user_id"]
        
        # Test each role
        for role in ["member", "homehub", "child", "parent"]:
            role_res = requests.put(
                f"{BASE_URL}/api/family/members/{test_user_id}/role",
                json={"role": role},
                headers=headers,
                cookies=cookies
            )
            assert role_res.status_code == 200, f"Failed to change role to {role}: {role_res.text}"
            print(f"✓ Successfully changed role to '{role}'")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
        print(f"✓ Cleaned up test user")


class TestCredentialsUpdate:
    """Test PUT /api/users/{user_id}/credentials accepts name, email, username, password, pin"""
    
    def test_update_all_credential_fields(self):
        """Parent can update name, email, username, password, and PIN for a family member"""
        # Login as Zachery
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Create test user
        unique_id = uuid.uuid4().hex[:8]
        create_res = requests.post(
            f"{BASE_URL}/api/users/child",
            json={
                "name": f"TEST_Creds_{unique_id}",
                "username": f"testcreds{unique_id}",
                "password": "testpass123",
                "pin": "1111"
            },
            headers=headers,
            cookies=cookies
        )
        assert create_res.status_code == 200
        test_user_id = create_res.json()["user_id"]
        print(f"✓ Created test user: {test_user_id}")
        
        # Update all credential fields
        new_unique = uuid.uuid4().hex[:6]
        update_res = requests.put(
            f"{BASE_URL}/api/users/{test_user_id}/credentials",
            json={
                "name": f"Updated Name {new_unique}",
                "email": f"test{new_unique}@example.com",
                "username": f"updated{new_unique}",
                "password": "newpassword456",
                "pin": "2222"
            },
            headers=headers,
            cookies=cookies
        )
        assert update_res.status_code == 200, f"Failed to update credentials: {update_res.text}"
        data = update_res.json()
        assert data.get("success") == True
        print(f"✓ Credentials updated successfully")
        
        # Verify changes
        user_res = requests.get(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
        assert user_res.status_code == 200
        user_data = user_res.json()
        assert f"Updated Name {new_unique}" in user_data.get("name", ""), "Name not updated"
        assert user_data.get("email") == f"test{new_unique}@example.com", "Email not updated"
        assert user_data.get("username") == f"updated{new_unique}", "Username not updated"
        print(f"✓ Verified name, email, username were updated")
        
        # Verify PIN by trying to verify it
        verify_res = requests.post(
            f"{BASE_URL}/api/users/verify-pin",
            json={"user_id": test_user_id, "pin": "2222"},
            headers=headers,
            cookies=cookies
        )
        assert verify_res.status_code == 200, "PIN was not updated correctly"
        print(f"✓ Verified PIN was updated")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
        print(f"✓ Cleaned up test user")
    
    def test_update_name_only(self):
        """Can update just the name field"""
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Create test user
        unique_id = uuid.uuid4().hex[:8]
        create_res = requests.post(
            f"{BASE_URL}/api/users/child",
            json={
                "name": f"TEST_NameOnly_{unique_id}",
                "username": f"testnameonly{unique_id}",
                "password": "testpass123",
                "pin": "1111"
            },
            headers=headers,
            cookies=cookies
        )
        assert create_res.status_code == 200
        test_user_id = create_res.json()["user_id"]
        
        # Update only name
        update_res = requests.put(
            f"{BASE_URL}/api/users/{test_user_id}/credentials",
            json={"name": "New Display Name"},
            headers=headers,
            cookies=cookies
        )
        assert update_res.status_code == 200, f"Failed to update name: {update_res.text}"
        print(f"✓ Name-only update successful")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
    
    def test_update_email_for_google_signin(self):
        """Can attach email for future Google sign-in"""
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Create test user without email
        unique_id = uuid.uuid4().hex[:8]
        create_res = requests.post(
            f"{BASE_URL}/api/users/child",
            json={
                "name": f"TEST_Email_{unique_id}",
                "username": f"testemail{unique_id}",
                "password": "testpass123",
                "pin": "1111"
            },
            headers=headers,
            cookies=cookies
        )
        assert create_res.status_code == 200
        test_user_id = create_res.json()["user_id"]
        
        # Add email
        update_res = requests.put(
            f"{BASE_URL}/api/users/{test_user_id}/credentials",
            json={"email": f"child{unique_id}@gmail.com"},
            headers=headers,
            cookies=cookies
        )
        assert update_res.status_code == 200, f"Failed to add email: {update_res.text}"
        print(f"✓ Email attached for Google sign-in")
        
        # Verify email was set
        user_res = requests.get(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
        assert user_res.status_code == 200
        assert user_res.json().get("email") == f"child{unique_id}@gmail.com"
        print(f"✓ Verified email was attached")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )


class TestFamilyNameUpdate:
    """Test PUT /api/families/{family_id} updates family name"""
    
    def test_update_family_name(self):
        """Parent can update family name and it syncs"""
        # Login as Zachery
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Get current families
        families_res = requests.get(
            f"{BASE_URL}/api/families",
            headers=headers,
            cookies=cookies
        )
        assert families_res.status_code == 200
        families = families_res.json().get("families", [])
        assert len(families) > 0, "No families found"
        
        # Get current family
        current_family = next((f for f in families if f.get("is_current")), families[0])
        family_id = current_family["family_id"]
        original_name = current_family["name"]
        print(f"Current family: {original_name} ({family_id})")
        
        # Update family name
        new_name = f"Test Family {uuid.uuid4().hex[:6]}"
        update_res = requests.put(
            f"{BASE_URL}/api/families/{family_id}",
            json={"name": new_name},
            headers=headers,
            cookies=cookies
        )
        assert update_res.status_code == 200, f"Failed to update family name: {update_res.text}"
        data = update_res.json()
        assert data.get("success") == True
        assert data.get("name") == new_name
        print(f"✓ Family name updated to: {new_name}")
        
        # Verify change persisted
        families_res2 = requests.get(
            f"{BASE_URL}/api/families",
            headers=headers,
            cookies=cookies
        )
        assert families_res2.status_code == 200
        families2 = families_res2.json().get("families", [])
        updated_family = next((f for f in families2 if f["family_id"] == family_id), None)
        assert updated_family is not None
        assert updated_family["name"] == new_name, f"Name not persisted: {updated_family['name']}"
        print(f"✓ Verified family name change persisted")
        
        # Restore original name
        restore_res = requests.put(
            f"{BASE_URL}/api/families/{family_id}",
            json={"name": original_name},
            headers=headers,
            cookies=cookies
        )
        assert restore_res.status_code == 200
        print(f"✓ Restored original family name: {original_name}")


class TestInviteWithHomehubRole:
    """Test invite endpoint accepts 'homehub' role"""
    
    def test_invite_with_homehub_role(self):
        """Can send invite with homehub role"""
        # Login as Zachery
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Get current family
        families_res = requests.get(
            f"{BASE_URL}/api/families",
            headers=headers,
            cookies=cookies
        )
        assert families_res.status_code == 200
        families = families_res.json().get("families", [])
        current_family = next((f for f in families if f.get("is_current")), families[0])
        family_id = current_family["family_id"]
        
        # Send invite with homehub role
        unique_id = uuid.uuid4().hex[:8]
        invite_res = requests.post(
            f"{BASE_URL}/api/families/{family_id}/invite",
            json={
                "email": f"testhomehub{unique_id}@example.com",
                "role": "homehub"
            },
            headers=headers,
            cookies=cookies
        )
        assert invite_res.status_code == 200, f"Failed to send invite with homehub role: {invite_res.text}"
        data = invite_res.json()
        assert "invite_id" in data or "family_code" in data
        print(f"✓ Invite sent with homehub role")
        print(f"  Family code: {data.get('family_code')}")


class TestPINVerificationForHomehub:
    """Test PIN verification is required for homehub role actions"""
    
    def test_verify_pin_endpoint_works(self):
        """POST /api/users/verify-pin works correctly"""
        # Login as Zachery
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        user_id = login_res.json()["user"]["user_id"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Set PIN to known value
        requests.post(
            f"{BASE_URL}/api/users/{user_id}/pin",
            json={"pin": "1234"},
            headers=headers,
            cookies=cookies
        )
        
        # Verify correct PIN
        verify_res = requests.post(
            f"{BASE_URL}/api/users/verify-pin",
            json={"user_id": user_id, "pin": "1234"},
            headers=headers,
            cookies=cookies
        )
        assert verify_res.status_code == 200, f"PIN verification failed: {verify_res.text}"
        data = verify_res.json()
        assert data.get("success") == True
        assert "user" in data
        print(f"✓ PIN verification successful for {data['user']['name']}")
        
        # Verify wrong PIN fails
        wrong_res = requests.post(
            f"{BASE_URL}/api/users/verify-pin",
            json={"user_id": user_id, "pin": "0000"},
            headers=headers,
            cookies=cookies
        )
        assert wrong_res.status_code == 401, "Wrong PIN should be rejected"
        print(f"✓ Wrong PIN correctly rejected")


class TestFamilyMembersEndpoint:
    """Test GET /api/families/{family_id}/members returns all members with required fields"""
    
    def test_members_have_required_fields(self):
        """Members should have user_id, name, role, has_pin, email, username"""
        # Login as Zachery
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Get family members
        members_res = requests.get(
            f"{BASE_URL}/api/families/{BLENDED_FAMILY_ID}/members",
            headers=headers,
            cookies=cookies
        )
        assert members_res.status_code == 200, f"Failed to get members: {members_res.text}"
        members = members_res.json().get("members", [])
        
        assert len(members) > 0, "Should have at least one member"
        print(f"Found {len(members)} members")
        
        # Check required fields
        required_fields = ["user_id", "name", "role", "has_pin"]
        for member in members:
            for field in required_fields:
                assert field in member, f"Member missing field: {field}"
            print(f"  - {member['name']} ({member['role']}) has_pin={member['has_pin']}")
        
        print(f"✓ All members have required fields")


class TestUserRoleEndpoint:
    """Test PUT /api/users/{user_id}/role accepts homehub"""
    
    def test_user_role_accepts_homehub(self):
        """PUT /api/users/{user_id}/role should accept 'homehub' role"""
        # Login as Zachery
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Create test user
        unique_id = uuid.uuid4().hex[:8]
        create_res = requests.post(
            f"{BASE_URL}/api/users/child",
            json={
                "name": f"TEST_UserRole_{unique_id}",
                "username": f"testuserrole{unique_id}",
                "password": "testpass123",
                "pin": "1111"
            },
            headers=headers,
            cookies=cookies
        )
        assert create_res.status_code == 200
        test_user_id = create_res.json()["user_id"]
        
        # Change role via /api/users/{user_id}/role
        role_res = requests.put(
            f"{BASE_URL}/api/users/{test_user_id}/role",
            json={"role": "homehub"},
            headers=headers,
            cookies=cookies
        )
        assert role_res.status_code == 200, f"Failed to change role: {role_res.text}"
        data = role_res.json()
        assert data.get("role") == "homehub", f"Expected role 'homehub', got '{data.get('role')}'"
        print(f"✓ User role changed to 'homehub' via /api/users/{test_user_id}/role")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
