"""
Test HomeHub Login and Creation Features - Iteration 37
Tests:
1. POST /api/auth/homehub-login - Login HomeHub users with email/password
2. POST /api/family/homehub/create - Parent creates HomeHub profile
3. Validation and error handling
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from context
TEST_HOMEHUB_EMAIL = "kitchenhub@family.test"
TEST_HOMEHUB_PASSWORD = "hub1234"
DEV_LOGIN_EMAIL = "zhesterusar@gmail.com"


class TestHomeHubLogin:
    """Test HomeHub login endpoint"""
    
    def test_homehub_login_success(self):
        """Test successful HomeHub login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/homehub-login",
            json={"email": TEST_HOMEHUB_EMAIL, "password": TEST_HOMEHUB_PASSWORD}
        )
        print(f"HomeHub login response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "success" in data, "Response should have 'success' field"
        assert data["success"] == True, "Login should be successful"
        assert "session_token" in data, "Response should have session_token"
        assert "user" in data, "Response should have user data"
        
        # Verify user data
        user = data["user"]
        assert user["email"] == TEST_HOMEHUB_EMAIL, f"Email mismatch: {user['email']}"
        assert user["role"] == "homehub", f"Role should be 'homehub', got: {user['role']}"
        assert "user_id" in user, "User should have user_id"
        assert "password_hash" not in user, "Password hash should not be returned"
        
        print(f"✓ HomeHub login successful for {user['name']} (role: {user['role']})")
    
    def test_homehub_login_invalid_password(self):
        """Test HomeHub login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/homehub-login",
            json={"email": TEST_HOMEHUB_EMAIL, "password": "wrongpassword"}
        )
        print(f"Invalid password response: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Should have error detail"
        print(f"✓ Correctly rejected invalid password: {data['detail']}")
    
    def test_homehub_login_invalid_email(self):
        """Test HomeHub login with non-existent email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/homehub-login",
            json={"email": "nonexistent@test.com", "password": "anypassword"}
        )
        print(f"Invalid email response: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Should have error detail"
        print(f"✓ Correctly rejected non-existent email: {data['detail']}")
    
    def test_homehub_login_missing_fields(self):
        """Test HomeHub login with missing fields"""
        # Missing password
        response = requests.post(
            f"{BASE_URL}/api/auth/homehub-login",
            json={"email": TEST_HOMEHUB_EMAIL}
        )
        assert response.status_code == 400, f"Expected 400 for missing password, got {response.status_code}"
        
        # Missing email
        response = requests.post(
            f"{BASE_URL}/api/auth/homehub-login",
            json={"password": "somepassword"}
        )
        assert response.status_code == 400, f"Expected 400 for missing email, got {response.status_code}"
        
        print("✓ Correctly rejected requests with missing fields")
    
    def test_homehub_login_rejects_non_homehub_account(self):
        """Test that HomeHub login rejects non-homehub accounts (e.g., parent accounts)"""
        # Try to login with a parent account email using homehub-login endpoint
        response = requests.post(
            f"{BASE_URL}/api/auth/homehub-login",
            json={"email": DEV_LOGIN_EMAIL, "password": "anypassword"}
        )
        print(f"Non-homehub account response: {response.status_code} - {response.text[:200]}")
        
        # Should reject because the account is not a homehub role
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Should have error detail"
        # The error could be "not a Home Hub profile" or "invalid credentials"
        print(f"✓ Correctly rejected non-homehub account: {data['detail']}")


class TestHomeHubCreation:
    """Test HomeHub profile creation by parents"""
    
    @pytest.fixture
    def parent_session(self):
        """Get a parent session for testing"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": DEV_LOGIN_EMAIL, "role": "parent"}
        )
        if response.status_code != 200:
            pytest.skip("Could not get parent session for testing")
        
        data = response.json()
        session_token = data.get("session_token")
        return session_token
    
    def test_create_homehub_profile_success(self, parent_session):
        """Test parent can create a HomeHub profile"""
        unique_email = f"testhub_{uuid.uuid4().hex[:8]}@family.test"
        
        response = requests.post(
            f"{BASE_URL}/api/family/homehub/create",
            headers={"Authorization": f"Bearer {parent_session}"},
            json={
                "name": "Test Kitchen Hub",
                "email": unique_email,
                "password": "testhub123"
            }
        )
        print(f"Create HomeHub response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response
        assert data.get("success") == True, "Creation should be successful"
        assert "user" in data, "Response should have user data"
        assert "message" in data, "Response should have success message"
        
        # Verify user data
        user = data["user"]
        assert user["email"] == unique_email, f"Email mismatch"
        assert user["role"] == "homehub", f"Role should be 'homehub', got: {user['role']}"
        assert user["name"] == "Test Kitchen Hub", f"Name mismatch"
        assert "family_id" in user, "User should be assigned to a family"
        assert "password_hash" not in user, "Password hash should not be returned"
        
        print(f"✓ HomeHub profile created: {user['name']} ({user['email']})")
        
        # Verify the new HomeHub can login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/homehub-login",
            json={"email": unique_email, "password": "testhub123"}
        )
        assert login_response.status_code == 200, f"New HomeHub should be able to login"
        print(f"✓ New HomeHub can login successfully")
    
    def test_create_homehub_duplicate_email(self, parent_session):
        """Test that duplicate email is rejected"""
        # Try to create with existing email
        response = requests.post(
            f"{BASE_URL}/api/family/homehub/create",
            headers={"Authorization": f"Bearer {parent_session}"},
            json={
                "name": "Duplicate Hub",
                "email": TEST_HOMEHUB_EMAIL,  # Already exists
                "password": "test1234"
            }
        )
        print(f"Duplicate email response: {response.status_code} - {response.text[:200]}")
        
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Should have error detail"
        assert "already exists" in data["detail"].lower(), f"Error should mention duplicate: {data['detail']}"
        print(f"✓ Correctly rejected duplicate email: {data['detail']}")
    
    def test_create_homehub_missing_fields(self, parent_session):
        """Test validation for missing required fields"""
        # Missing name
        response = requests.post(
            f"{BASE_URL}/api/family/homehub/create",
            headers={"Authorization": f"Bearer {parent_session}"},
            json={"email": "test@test.com", "password": "test1234"}
        )
        assert response.status_code == 400, f"Expected 400 for missing name"
        
        # Missing email
        response = requests.post(
            f"{BASE_URL}/api/family/homehub/create",
            headers={"Authorization": f"Bearer {parent_session}"},
            json={"name": "Test Hub", "password": "test1234"}
        )
        assert response.status_code == 400, f"Expected 400 for missing email"
        
        # Missing password
        response = requests.post(
            f"{BASE_URL}/api/family/homehub/create",
            headers={"Authorization": f"Bearer {parent_session}"},
            json={"name": "Test Hub", "email": "test@test.com"}
        )
        assert response.status_code == 400, f"Expected 400 for missing password"
        
        # Password too short
        response = requests.post(
            f"{BASE_URL}/api/family/homehub/create",
            headers={"Authorization": f"Bearer {parent_session}"},
            json={"name": "Test Hub", "email": "test@test.com", "password": "123"}
        )
        assert response.status_code == 400, f"Expected 400 for short password"
        
        print("✓ Correctly validated required fields")
    
    def test_create_homehub_requires_parent_role(self):
        """Test that only parents can create HomeHub profiles"""
        # Login as a child
        child_response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "child"}
        )
        if child_response.status_code != 200:
            pytest.skip("Could not get child session")
        
        child_token = child_response.json().get("session_token")
        
        # Try to create HomeHub as child
        response = requests.post(
            f"{BASE_URL}/api/family/homehub/create",
            headers={"Authorization": f"Bearer {child_token}"},
            json={
                "name": "Unauthorized Hub",
                "email": f"unauthorized_{uuid.uuid4().hex[:8]}@test.com",
                "password": "test1234"
            }
        )
        print(f"Child create HomeHub response: {response.status_code}")
        
        assert response.status_code == 403, f"Expected 403 for non-parent, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Should have error detail"
        print(f"✓ Correctly rejected non-parent: {data['detail']}")


class TestAuthSessionEndpoint:
    """Test the Google auth session endpoint"""
    
    def test_session_endpoint_requires_session_id(self):
        """Test that /api/auth/session requires X-Session-ID header"""
        response = requests.post(f"{BASE_URL}/api/auth/session")
        print(f"Session without header: {response.status_code}")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Should have error detail"
        print(f"✓ Correctly requires session ID: {data['detail']}")
    
    def test_session_endpoint_invalid_session_id(self):
        """Test that /api/auth/session rejects invalid session ID"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            headers={"X-Session-ID": "invalid_session_id_12345"}
        )
        print(f"Invalid session ID response: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Should have error detail"
        print(f"✓ Correctly rejects invalid session ID: {data['detail']}")


class TestAuthMeEndpoint:
    """Test the /api/auth/me endpoint"""
    
    def test_auth_me_with_valid_session(self):
        """Test /api/auth/me returns user data with valid session"""
        # First login to get a session
        login_response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": DEV_LOGIN_EMAIL, "role": "parent"}
        )
        if login_response.status_code != 200:
            pytest.skip("Could not login for testing")
        
        session_token = login_response.json().get("session_token")
        
        # Test /api/auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        print(f"Auth me response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "user_id" in data, "Should have user_id"
        assert "email" in data, "Should have email"
        assert "role" in data, "Should have role"
        print(f"✓ Auth me returned user: {data.get('name')} ({data.get('role')})")
    
    def test_auth_me_without_session(self):
        """Test /api/auth/me returns 401 without session"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        print(f"Auth me without session: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
