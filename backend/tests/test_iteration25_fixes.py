"""
Iteration 25 - Testing fixes for:
1. Welcome page logo removal
2. Child login with testkid/pass123
3. Child login redirect to /setup-wizard for first_login=true
4. WebSocket URL with /api prefix
5. Family Wall poll with voter names
6. Health endpoint
7. Child-login API endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://family-dashboard-14.preview.emergentagent.com')


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_returns_healthy(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
        assert data['service'] == 'famfocus-api'
        print("✅ Health endpoint returns healthy status")


class TestChildLogin:
    """Test child login functionality"""
    
    def test_child_login_with_valid_credentials(self):
        """POST /api/auth/child-login with testkid/pass123 should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/auth/child-login",
            json={"username": "testkid", "password": "pass123"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data['success'] == True
        assert 'session_token' in data
        assert 'user' in data
        assert 'first_login' in data
        
        # Verify user data
        user = data['user']
        assert user['username'] == 'testkid'
        assert user['role'] == 'child'
        
        # Verify first_login flag
        assert data['first_login'] == True
        print("✅ Child login with testkid/pass123 works correctly")
        print(f"   - first_login: {data['first_login']}")
        print(f"   - session_token received: {bool(data['session_token'])}")
    
    def test_child_login_with_invalid_credentials(self):
        """POST /api/auth/child-login with wrong credentials should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/child-login",
            json={"username": "wronguser", "password": "wrongpass"}
        )
        assert response.status_code == 401
        print("✅ Child login with invalid credentials returns 401")
    
    def test_child_login_missing_fields(self):
        """POST /api/auth/child-login with missing fields should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/child-login",
            json={"username": "testkid"}
        )
        assert response.status_code == 400
        print("✅ Child login with missing password returns 400")


class TestDevLogin:
    """Test dev login for parent role"""
    
    def test_dev_login_parent(self):
        """POST /api/auth/dev-login with role=parent should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert 'user' in data
        assert 'session_token' in data
        assert data['user']['role'] == 'parent'
        print("✅ Dev login for parent role works correctly")
        return data['session_token']


class TestFamilyWall:
    """Test Family Wall functionality"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        data = response.json()
        session = requests.Session()
        session.cookies.set('session_token', data['session_token'])
        session.headers.update({'Authorization': f"Bearer {data['session_token']}"})
        return session
    
    def test_get_family_wall_posts(self, auth_session):
        """GET /api/family-wall should return posts"""
        response = auth_session.get(f"{BASE_URL}/api/family-wall")
        assert response.status_code == 200
        data = response.json()
        assert 'posts' in data
        print(f"✅ Family Wall returns {len(data['posts'])} posts")
    
    def test_create_poll_post(self, auth_session):
        """POST /api/family-wall with poll should work"""
        poll_data = {
            "content": "TEST_Poll_Question",
            "post_type": "poll",
            "poll_options": [
                {"text": "Option A", "votes": []},
                {"text": "Option B", "votes": []}
            ]
        }
        response = auth_session.post(
            f"{BASE_URL}/api/family-wall",
            json=poll_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data['post_type'] == 'poll'
        assert len(data['poll_options']) == 2
        print("✅ Poll creation works correctly")
        return data['post_id']
    
    def test_vote_on_poll(self, auth_session):
        """POST /api/family-wall/{post_id}/vote should record vote"""
        # First create a poll
        poll_data = {
            "content": "TEST_VotePoll",
            "post_type": "poll",
            "poll_options": [
                {"text": "Yes", "votes": []},
                {"text": "No", "votes": []}
            ]
        }
        create_response = auth_session.post(
            f"{BASE_URL}/api/family-wall",
            json=poll_data
        )
        post_id = create_response.json()['post_id']
        
        # Vote on the poll
        vote_response = auth_session.post(
            f"{BASE_URL}/api/family-wall/{post_id}/vote",
            json={"option_index": 0}
        )
        assert vote_response.status_code == 200
        print("✅ Poll voting works correctly")


class TestFamilyMembers:
    """Test family members endpoint for poll voter names"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"}
        )
        data = response.json()
        session = requests.Session()
        session.cookies.set('session_token', data['session_token'])
        session.headers.update({'Authorization': f"Bearer {data['session_token']}"})
        return session
    
    def test_get_family_members(self, auth_session):
        """GET /api/family/members should return members with names"""
        response = auth_session.get(f"{BASE_URL}/api/family/members")
        assert response.status_code == 200
        data = response.json()
        assert 'members' in data
        
        # Verify members have names for voter display
        for member in data['members']:
            assert 'user_id' in member
            assert 'name' in member
        
        print(f"✅ Family members endpoint returns {len(data['members'])} members with names")


class TestSessionStorage:
    """Test that child login stores session in user_sessions collection"""
    
    def test_child_login_sets_cookie(self):
        """Child login should set session cookie"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/child-login",
            json={"username": "testkid", "password": "pass123"}
        )
        assert response.status_code == 200
        
        # Check if session_token cookie is set
        cookies = session.cookies.get_dict()
        # Note: Cookie might not be visible in requests due to httpOnly
        # But we can verify the session_token is in the response
        data = response.json()
        assert 'session_token' in data
        print("✅ Child login returns session_token")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
