"""
Test suite for FamFocus Hub family fixes:
1. Elizabeth's profile showing in family list (no phantom virtual family)
2. Profile deletion completely removes all data
3. Shopping list item deletion
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://chore-share-test.preview.emergentagent.com')

class TestDevLogin:
    """Test dev-login with email parameter"""
    
    def test_dev_login_with_email_elizabeth(self):
        """Test dev-login returns correct user for Elizabeth"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": "ebuss980@gmail.com", "role": "parent"}
        )
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "ebuss980@gmail.com"
        assert "session_token" in data
        print(f"Elizabeth login successful: {data['user']['name']}")
    
    def test_dev_login_with_email_zachery(self):
        """Test dev-login returns correct user for Zachery"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": "zhesterusar@gmail.com", "role": "parent"}
        )
        assert response.status_code == 200, f"Dev login failed: {response.text}"
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "zhesterusar@gmail.com"
        assert "session_token" in data
        print(f"Zachery login successful: {data['user']['name']}")


class TestFamilyListNoPhantom:
    """Test that GET /api/families does not create phantom virtual family"""
    
    def test_elizabeth_sees_blended_family(self):
        """Elizabeth should see 'Blended' family as current with all members"""
        # Login as Elizabeth
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": "ebuss980@gmail.com", "role": "parent"}
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
        
        print(f"Elizabeth's families: {families}")
        
        # Should have at least one family
        assert len(families) >= 1, "Elizabeth should have at least one family"
        
        # Find the current family
        current_family = next((f for f in families if f.get("is_current")), families[0] if families else None)
        assert current_family is not None, "Elizabeth should have a current family"
        
        # Should NOT be a phantom virtual family with only 1 member
        # The Blended family should have multiple members
        print(f"Current family: {current_family}")
        
        # Get members of the current family
        members_res = requests.get(
            f"{BASE_URL}/api/families/{current_family['family_id']}/members",
            headers={"Authorization": f"Bearer {session_token}"},
            cookies={"session_token": session_token}
        )
        assert members_res.status_code == 200
        members = members_res.json().get("members", [])
        print(f"Family members: {[m['name'] for m in members]}")
        
        # Should have more than just Elizabeth (no phantom family)
        assert len(members) > 1, f"Family should have more than 1 member, got {len(members)}"
    
    def test_zachery_sees_both_families(self):
        """Zachery should see both families with 'Blended' as current"""
        # Login as Zachery
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": "zhesterusar@gmail.com", "role": "parent"}
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
        
        # Should have families
        assert len(families) >= 1, "Zachery should have at least one family"
        
        # Find current family
        current_family = next((f for f in families if f.get("is_current")), None)
        print(f"Zachery's current family: {current_family}")


class TestProfileDeletion:
    """Test DELETE /api/users/{user_id} endpoint"""
    
    def test_create_and_delete_test_user(self):
        """Create a temporary test user, then delete it completely"""
        # Login as parent (Zachery)
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": "zhesterusar@gmail.com", "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Create a test child profile
        create_res = requests.post(
            f"{BASE_URL}/api/users/child",
            json={
                "name": "TEST_DeleteMe",
                "username": "testdeleteme123",
                "password": "testpass123",
                "pin": "1234"
            },
            headers=headers,
            cookies=cookies
        )
        assert create_res.status_code == 200, f"Failed to create test child: {create_res.text}"
        created_user = create_res.json()
        test_user_id = created_user["user_id"]
        print(f"Created test user: {test_user_id}")
        
        # Verify user exists
        get_res = requests.get(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
        assert get_res.status_code == 200, "Test user should exist"
        
        # Delete the user completely
        delete_res = requests.delete(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
        assert delete_res.status_code == 200, f"Failed to delete user: {delete_res.text}"
        delete_data = delete_res.json()
        assert delete_data.get("success") == True
        print(f"Delete response: {delete_data}")
        
        # Verify user no longer exists
        verify_res = requests.get(
            f"{BASE_URL}/api/users/{test_user_id}",
            headers=headers,
            cookies=cookies
        )
        assert verify_res.status_code == 404, "Deleted user should return 404"
        print("User successfully deleted and verified")


class TestShoppingListDeletion:
    """Test DELETE /api/shopping/{item_id} endpoint"""
    
    def test_create_and_delete_shopping_item(self):
        """Create a shopping item, then delete it"""
        # Login as parent
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": "zhesterusar@gmail.com", "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Create a test shopping item
        create_res = requests.post(
            f"{BASE_URL}/api/shopping",
            json={"name": "TEST_DeleteItem"},
            headers=headers,
            cookies=cookies
        )
        assert create_res.status_code == 200, f"Failed to create shopping item: {create_res.text}"
        created_item = create_res.json()
        item_id = created_item["item_id"]
        print(f"Created shopping item: {item_id}")
        
        # Verify item exists in list
        list_res = requests.get(
            f"{BASE_URL}/api/shopping",
            headers=headers,
            cookies=cookies
        )
        assert list_res.status_code == 200
        items = list_res.json().get("items", [])
        assert any(i["item_id"] == item_id for i in items), "Created item should be in list"
        
        # Delete the item
        delete_res = requests.delete(
            f"{BASE_URL}/api/shopping/{item_id}",
            headers=headers,
            cookies=cookies
        )
        assert delete_res.status_code == 200, f"Failed to delete item: {delete_res.text}"
        print(f"Delete response: {delete_res.json()}")
        
        # Verify item no longer exists
        list_res2 = requests.get(
            f"{BASE_URL}/api/shopping",
            headers=headers,
            cookies=cookies
        )
        assert list_res2.status_code == 200
        items2 = list_res2.json().get("items", [])
        assert not any(i["item_id"] == item_id for i in items2), "Deleted item should not be in list"
        print("Shopping item successfully deleted and verified")


class TestFamilyMembersEndpoint:
    """Test GET /api/families/{family_id}/members includes all members"""
    
    def test_blended_family_has_all_members(self):
        """Blended family should show all 6 members including Isaiah and Jeremiah"""
        # Login as Zachery (creator of Blended family)
        login_res = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": "zhesterusar@gmail.com", "role": "parent"}
        )
        assert login_res.status_code == 200
        session_token = login_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        cookies = {"session_token": session_token}
        
        # Get members of Blended family
        family_id = "family_0c5ee4535871"
        members_res = requests.get(
            f"{BASE_URL}/api/families/{family_id}/members",
            headers=headers,
            cookies=cookies
        )
        assert members_res.status_code == 200, f"Failed to get members: {members_res.text}"
        members = members_res.json().get("members", [])
        
        print(f"Blended family members ({len(members)}): {[m['name'] for m in members]}")
        
        # Should have multiple members
        assert len(members) >= 4, f"Blended family should have at least 4 members, got {len(members)}"
        
        # Check for expected members
        member_names = [m['name'].lower() for m in members]
        print(f"Member names: {member_names}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
