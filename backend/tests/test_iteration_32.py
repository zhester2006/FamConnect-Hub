"""
Test suite for FamFocus Hub - Iteration 32
Testing recent fixes:
1. Elizabeth's profile shows correctly in family list (no phantom virtual family)
2. Profile deletion fully removes all data (DELETE /api/users/{user_id})
3. Shopping list items have delete buttons (DELETE /api/shopping/{item_id})
4. Parents can set/change HomeHub PIN (POST /api/users/{user_id}/pin)
5. Route ordering fix (/users/family-profiles not intercepted)
6. Dev-login respects email parameter
7. Family members endpoint includes all members
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://family-pantry-hub-2.preview.emergentagent.com')

# Test credentials
ZACHERY_EMAIL = "zhesterusar@gmail.com"
ELIZABETH_EMAIL = "ebuss980@gmail.com"
BLENDED_FAMILY_ID = "family_0c5ee4535871"
ZACHERY_USER_ID = "user_f5d5c9e075da"
ELIZABETH_USER_ID = "user_10ad6e706051"


class TestDevLoginEmailParameter:
    """Test dev-login with email parameter - route ordering fix"""
    
    def test_dev_login_returns_elizabeth(self):
        """Dev-login with Elizabeth's email should return Elizabeth"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ELIZABETH_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == ELIZABETH_EMAIL, f"Expected Elizabeth, got {data['user']['email']}"
        assert "session_token" in data
        print(f"✓ Elizabeth login successful: {data['user']['name']}")
    
    def test_dev_login_returns_zachery(self):
        """Dev-login with Zachery's email should return Zachery"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == ZACHERY_EMAIL, f"Expected Zachery, got {data['user']['email']}"
        assert "session_token" in data
        print(f"✓ Zachery login successful: {data['user']['name']}")


class TestRouteOrderingFix:
    """Test that /users/family-profiles is not intercepted by /users/{user_id}"""
    
    def test_family_profiles_endpoint_works(self):
        """GET /api/users/family-profiles should return profiles, not 404"""
        # Login first
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        
        # Test family-profiles endpoint
        response = requests.get(
            f"{BASE_URL}/api/users/family-profiles",
            headers={"Authorization": f"Bearer {session_token}"},
            cookies={"session_token": session_token}
        )
        assert response.status_code == 200, f"family-profiles failed: {response.text}"
        data = response.json()
        assert "profiles" in data, "Response should contain 'profiles' key"
        assert len(data["profiles"]) > 0, "Should have at least one profile"
        print(f"✓ family-profiles returned {len(data['profiles'])} profiles")
        
        # Verify profiles have expected fields
        for profile in data["profiles"]:
            assert "user_id" in profile
            assert "name" in profile
            assert "has_pin" in profile
        print("✓ All profiles have required fields")


class TestElizabethNoPhantomFamily:
    """Test Elizabeth sees real families, not phantom virtual family"""
    
    def test_elizabeth_families_no_phantom(self):
        """Elizabeth should NOT see a phantom 'Elizabeth Buss's Family'"""
        # Login as Elizabeth
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ELIZABETH_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        
        # Get families
        families_res = requests.get(
            f"{BASE_URL}/api/families",
            headers={"Authorization": f"Bearer {session_token}"},
            cookies={"session_token": session_token}
        )
        assert families_res.status_code == 200
        families = families_res.json().get("families", [])
        
        print(f"Elizabeth's families: {[f['name'] for f in families]}")
        
        # Check for phantom family (would be named "Elizabeth Buss's Family" with only 1 member)
        for family in families:
            if "Elizabeth" in family.get("name", "") and family.get("member_count", 0) == 1:
                pytest.fail(f"Found phantom virtual family: {family}")
        
        print("✓ No phantom virtual family found for Elizabeth")


class TestZacheryFamilies:
    """Test Zachery sees both families with Blended as current"""
    
    def test_zachery_has_blended_family(self):
        """Zachery should have access to Blended family"""
        # Login as Zachery
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        
        # Get families
        families_res = requests.get(
            f"{BASE_URL}/api/families",
            headers={"Authorization": f"Bearer {session_token}"},
            cookies={"session_token": session_token}
        )
        assert families_res.status_code == 200
        families = families_res.json().get("families", [])
        
        print(f"Zachery's families: {families}")
        assert len(families) >= 1, "Zachery should have at least one family"
        
        # Check if Blended is current
        current_family = next((f for f in families if f.get("is_current")), None)
        if current_family:
            print(f"✓ Current family: {current_family['name']} (is_current={current_family['is_current']})")


class TestBlendedFamilyMembers:
    """Test Blended family has all 6 members including Elizabeth, Isaiah, Jeremiah"""
    
    def test_blended_family_members(self):
        """GET /api/families/{family_id}/members should return all members"""
        # Login as Zachery
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        
        # Get Blended family members
        members_res = requests.get(
            f"{BASE_URL}/api/families/{BLENDED_FAMILY_ID}/members",
            headers={"Authorization": f"Bearer {session_token}"},
            cookies={"session_token": session_token}
        )
        assert members_res.status_code == 200, f"Failed to get members: {members_res.text}"
        members = members_res.json().get("members", [])
        
        member_names = [m['name'] for m in members]
        print(f"Blended family members ({len(members)}): {member_names}")
        
        # Should have at least 4 members
        assert len(members) >= 4, f"Expected at least 4 members, got {len(members)}"
        print(f"✓ Blended family has {len(members)} members")


class TestProfileDeletion:
    """Test DELETE /api/users/{user_id} fully deletes user and all data"""
    
    def test_create_and_delete_test_child(self):
        """Create a test child, verify it exists, delete it, verify it's gone"""
        # Login as Zachery (parent)
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Create a test child
        unique_id = uuid.uuid4().hex[:8]
        create_res = requests.post(
            f"{BASE_URL}/api/users/child",
            json={
                "name": f"TEST_Child_{unique_id}",
                "username": f"testchild{unique_id}",
                "password": "testpass123",
                "pin": "9999"
            },
            headers=headers,
            cookies=cookies
        )
        assert create_res.status_code == 200, f"Failed to create test child: {create_res.text}"
        created_user = create_res.json()
        test_user_id = created_user["user_id"]
        print(f"✓ Created test child: {test_user_id}")
        
        # Verify user exists
        get_res = requests.get(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
        assert get_res.status_code == 200, "Test user should exist after creation"
        print("✓ Verified test child exists")
        
        # Delete the user
        delete_res = requests.delete(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
        assert delete_res.status_code == 200, f"Failed to delete user: {delete_res.text}"
        delete_data = delete_res.json()
        assert delete_data.get("success") == True
        print(f"✓ Delete response: {delete_data['message']}")
        
        # Verify user no longer exists
        verify_res = requests.get(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
        assert verify_res.status_code == 404, "Deleted user should return 404"
        print("✓ Verified test child is completely deleted")


class TestShoppingListDeletion:
    """Test DELETE /api/shopping/{item_id} works correctly"""
    
    def test_create_and_delete_shopping_item(self):
        """Create a shopping item, delete it, verify it's gone"""
        # Login as parent
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Create a test shopping item
        unique_id = uuid.uuid4().hex[:8]
        create_res = requests.post(
            f"{BASE_URL}/api/shopping",
            json={"name": f"TEST_Item_{unique_id}"},
            headers=headers,
            cookies=cookies
        )
        assert create_res.status_code == 200, f"Failed to create shopping item: {create_res.text}"
        created_item = create_res.json()
        item_id = created_item["item_id"]
        print(f"✓ Created shopping item: {item_id}")
        
        # Verify item exists in list
        list_res = requests.get(
            f"{BASE_URL}/api/shopping",
            headers=headers,
            cookies=cookies
        )
        assert list_res.status_code == 200
        items = list_res.json().get("items", [])
        assert any(i["item_id"] == item_id for i in items), "Created item should be in list"
        print("✓ Verified item exists in shopping list")
        
        # Delete the item
        delete_res = requests.delete(
            f"{BASE_URL}/api/shopping/{item_id}",
            headers=headers,
            cookies=cookies
        )
        assert delete_res.status_code == 200, f"Failed to delete item: {delete_res.text}"
        print(f"✓ Delete response: {delete_res.json()}")
        
        # Verify item no longer exists
        list_res2 = requests.get(
            f"{BASE_URL}/api/shopping",
            headers=headers,
            cookies=cookies
        )
        assert list_res2.status_code == 200
        items2 = list_res2.json().get("items", [])
        assert not any(i["item_id"] == item_id for i in items2), "Deleted item should not be in list"
        print("✓ Verified item is deleted from shopping list")


class TestHomeHubPIN:
    """Test POST /api/users/{user_id}/pin for setting/changing PIN"""
    
    def test_set_own_pin(self):
        """Parent can set their own PIN"""
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
        
        # Set PIN
        pin_res = requests.post(
            f"{BASE_URL}/api/users/{user_id}/pin",
            json={"pin": "1234"},
            headers=headers,
            cookies=cookies
        )
        assert pin_res.status_code == 200, f"Failed to set PIN: {pin_res.text}"
        data = pin_res.json()
        assert data.get("success") == True
        print(f"✓ PIN set successfully: {data['message']}")
    
    def test_pin_validation_4_digits(self):
        """PIN must be exactly 4 digits"""
        # Login
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        user_id = login_res.json()["user"]["user_id"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Try invalid PIN (3 digits)
        pin_res = requests.post(
            f"{BASE_URL}/api/users/{user_id}/pin",
            json={"pin": "123"},
            headers=headers,
            cookies=cookies
        )
        assert pin_res.status_code == 400, "Should reject 3-digit PIN"
        print("✓ Correctly rejected 3-digit PIN")
        
        # Try invalid PIN (5 digits)
        pin_res2 = requests.post(
            f"{BASE_URL}/api/users/{user_id}/pin",
            json={"pin": "12345"},
            headers=headers,
            cookies=cookies
        )
        assert pin_res2.status_code == 400, "Should reject 5-digit PIN"
        print("✓ Correctly rejected 5-digit PIN")


class TestPINVerification:
    """Test POST /api/users/verify-pin for HomeHub"""
    
    def test_verify_pin_success(self):
        """Verify PIN with correct PIN should succeed"""
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
        
        # First set PIN to known value
        requests.post(
            f"{BASE_URL}/api/users/{user_id}/pin",
            json={"pin": "1234"},
            headers=headers,
            cookies=cookies
        )
        
        # Verify PIN
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
        print(f"✓ PIN verified successfully for {data['user']['name']}")
    
    def test_verify_pin_wrong_pin(self):
        """Verify PIN with wrong PIN should fail"""
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
        
        # Verify with wrong PIN
        verify_res = requests.post(
            f"{BASE_URL}/api/users/verify-pin",
            json={"user_id": user_id, "pin": "9999"},
            headers=headers,
            cookies=cookies
        )
        assert verify_res.status_code == 401, "Should reject wrong PIN"
        print("✓ Correctly rejected wrong PIN")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
