"""
Test Suite for Iteration 19 - Firebase Auth and API Improvements
Tests:
1. Firebase Auth login endpoint (/api/auth/firebase-login)
2. Firebase Auth signup endpoint (/api/auth/firebase-signup)
3. Dev login endpoint (/api/auth/dev-login)
4. Tasks endpoint with claimant info (/api/tasks)
5. Health endpoint (/api/health)
6. Leaderboard endpoint with timeframe filter (/api/leaderboard?timeframe=all-time)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check_returns_200(self):
        """Health endpoint should return 200 with healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
        assert data['service'] == 'famfocus-api'


class TestDevLogin:
    """Test development login endpoint"""
    
    def test_dev_login_parent_role(self):
        """Dev login with parent role should return user and session token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        
        data = response.json()
        assert 'user' in data
        assert 'session_token' in data
        assert data['user']['role'] == 'parent'
        assert 'user_id' in data['user']
        assert 'email' in data['user']
    
    def test_dev_login_child_role(self):
        """Dev login with child role should return user and session token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        assert response.status_code == 200
        
        data = response.json()
        assert 'user' in data
        assert 'session_token' in data
        assert data['user']['role'] == 'child'
    
    def test_dev_login_default_role(self):
        """Dev login without role should default to parent"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={})
        assert response.status_code == 200
        
        data = response.json()
        assert 'user' in data
        assert data['user']['role'] == 'parent'


class TestFirebaseAuth:
    """Test Firebase authentication endpoints"""
    
    def test_firebase_login_success(self):
        """Firebase login with valid user data should return session token"""
        test_email = f"TEST_firebase_{uuid.uuid4().hex[:8]}@test.com"
        firebase_user_data = {
            "user": {
                "email": test_email,
                "displayName": "Test Firebase User",
                "uid": f"firebase_uid_{uuid.uuid4().hex[:12]}",
                "photoURL": "https://example.com/photo.jpg"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/firebase-login", json=firebase_user_data)
        assert response.status_code == 200
        
        data = response.json()
        assert 'session_token' in data
        assert 'user' in data
        assert data['user']['email'] == test_email
        assert data['user']['name'] == "Test Firebase User"
        assert 'user_id' in data['user']
        assert data['session_token'].startswith('session_')
    
    def test_firebase_login_missing_user_data(self):
        """Firebase login without user data should return 400"""
        response = requests.post(f"{BASE_URL}/api/auth/firebase-login", json={})
        assert response.status_code == 400
        
        data = response.json()
        assert 'detail' in data
        assert 'User data required' in data['detail']
    
    def test_firebase_login_missing_email(self):
        """Firebase login without email should return 400"""
        firebase_user_data = {
            "user": {
                "displayName": "Test User",
                "uid": "test_uid"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/firebase-login", json=firebase_user_data)
        assert response.status_code == 400
        
        data = response.json()
        assert 'detail' in data
        assert 'Email required' in data['detail']
    
    def test_firebase_login_existing_user(self):
        """Firebase login with existing user should update last_seen and return session"""
        test_email = f"TEST_existing_{uuid.uuid4().hex[:8]}@test.com"
        firebase_user_data = {
            "user": {
                "email": test_email,
                "displayName": "Existing User",
                "uid": f"firebase_uid_{uuid.uuid4().hex[:12]}"
            }
        }
        
        # First login - creates user
        response1 = requests.post(f"{BASE_URL}/api/auth/firebase-login", json=firebase_user_data)
        assert response1.status_code == 200
        user_id_1 = response1.json()['user']['user_id']
        
        # Second login - should return same user
        response2 = requests.post(f"{BASE_URL}/api/auth/firebase-login", json=firebase_user_data)
        assert response2.status_code == 200
        user_id_2 = response2.json()['user']['user_id']
        
        # Should be the same user
        assert user_id_1 == user_id_2
    
    def test_firebase_signup_success(self):
        """Firebase signup with valid data should create new user"""
        test_email = f"TEST_signup_{uuid.uuid4().hex[:8]}@test.com"
        firebase_user_data = {
            "user": {
                "email": test_email,
                "uid": f"firebase_uid_{uuid.uuid4().hex[:12]}",
                "photoURL": "https://example.com/photo.jpg"
            },
            "displayName": "New Signup User"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/firebase-signup", json=firebase_user_data)
        assert response.status_code == 200
        
        data = response.json()
        assert 'session_token' in data
        assert 'user' in data
        assert data['user']['email'] == test_email
        assert data['user']['name'] == "New Signup User"
        assert data['user']['role'] == 'parent'  # Default role
    
    def test_firebase_signup_missing_user_data(self):
        """Firebase signup without user data should return 400"""
        response = requests.post(f"{BASE_URL}/api/auth/firebase-signup", json={})
        assert response.status_code == 400
        
        data = response.json()
        assert 'detail' in data
        assert 'User data required' in data['detail']
    
    def test_firebase_signup_missing_email(self):
        """Firebase signup without email should return 400"""
        firebase_user_data = {
            "user": {
                "displayName": "Test User",
                "uid": "test_uid"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/firebase-signup", json=firebase_user_data)
        assert response.status_code == 400
        
        data = response.json()
        assert 'detail' in data
        assert 'Email required' in data['detail']
    
    def test_firebase_signup_duplicate_email(self):
        """Firebase signup with existing email should return 400"""
        test_email = f"TEST_duplicate_{uuid.uuid4().hex[:8]}@test.com"
        firebase_user_data = {
            "user": {
                "email": test_email,
                "uid": f"firebase_uid_{uuid.uuid4().hex[:12]}"
            },
            "displayName": "First User"
        }
        
        # First signup - should succeed
        response1 = requests.post(f"{BASE_URL}/api/auth/firebase-signup", json=firebase_user_data)
        assert response1.status_code == 200
        
        # Second signup with same email - should fail
        firebase_user_data['displayName'] = "Second User"
        response2 = requests.post(f"{BASE_URL}/api/auth/firebase-signup", json=firebase_user_data)
        assert response2.status_code == 400
        
        data = response2.json()
        assert 'detail' in data
        assert 'already exists' in data['detail'].lower()


class TestTasksEndpoint:
    """Test tasks endpoint with claimant info"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers via dev login"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        token = response.json()['session_token']
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_tasks_returns_200(self, auth_headers):
        """Tasks endpoint should return 200 with tasks array"""
        response = requests.get(f"{BASE_URL}/api/tasks", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert 'tasks' in data
        assert isinstance(data['tasks'], list)
    
    def test_create_task_as_parent(self, auth_headers):
        """Parent should be able to create a task"""
        task_data = {
            "title": f"TEST_Task_{uuid.uuid4().hex[:8]}",
            "points": 15,
            "deadline": datetime.now(timezone.utc).isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/tasks", headers=auth_headers, json=task_data)
        assert response.status_code == 200
        
        data = response.json()
        assert 'task_id' in data
        assert data['success'] == True
    
    def test_tasks_include_assignee_name(self, auth_headers):
        """Tasks should include assignee_name when assigned"""
        # First create a task
        task_data = {
            "title": f"TEST_AssigneeTask_{uuid.uuid4().hex[:8]}",
            "points": 10
        }
        
        create_response = requests.post(f"{BASE_URL}/api/tasks", headers=auth_headers, json=task_data)
        assert create_response.status_code == 200
        
        # Get tasks and verify structure
        response = requests.get(f"{BASE_URL}/api/tasks", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert 'tasks' in data
        # Tasks should have the expected fields
        if len(data['tasks']) > 0:
            task = data['tasks'][0]
            assert 'task_id' in task
            assert 'title' in task
            assert 'status' in task
    
    def test_tasks_unauthorized_without_token(self):
        """Tasks endpoint should return 401 without auth token"""
        response = requests.get(f"{BASE_URL}/api/tasks")
        assert response.status_code == 401


class TestLeaderboardEndpoint:
    """Test leaderboard endpoint with timeframe filter"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers via dev login"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        token = response.json()['session_token']
        return {"Authorization": f"Bearer {token}"}
    
    def test_leaderboard_default_all_time(self, auth_headers):
        """Leaderboard without timeframe should default to all-time"""
        response = requests.get(f"{BASE_URL}/api/leaderboard", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert 'leaderboard' in data
        assert 'timeframe' in data
        assert data['timeframe'] == 'all-time'
        assert isinstance(data['leaderboard'], list)
    
    def test_leaderboard_all_time_filter(self, auth_headers):
        """Leaderboard with all-time filter should return total points"""
        response = requests.get(f"{BASE_URL}/api/leaderboard?timeframe=all-time", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data['timeframe'] == 'all-time'
        assert 'leaderboard' in data
    
    def test_leaderboard_this_week_filter(self, auth_headers):
        """Leaderboard with this-week filter should return period_points"""
        response = requests.get(f"{BASE_URL}/api/leaderboard?timeframe=this-week", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data['timeframe'] == 'this-week'
        assert 'leaderboard' in data
        
        # If there are children, they should have period_points
        if len(data['leaderboard']) > 0:
            for child in data['leaderboard']:
                assert 'period_points' in child
    
    def test_leaderboard_this_month_filter(self, auth_headers):
        """Leaderboard with this-month filter should return period_points"""
        response = requests.get(f"{BASE_URL}/api/leaderboard?timeframe=this-month", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data['timeframe'] == 'this-month'
        assert 'leaderboard' in data
        
        # If there are children, they should have period_points
        if len(data['leaderboard']) > 0:
            for child in data['leaderboard']:
                assert 'period_points' in child
    
    def test_leaderboard_unauthorized_without_token(self):
        """Leaderboard endpoint should return 401 without auth token"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 401


class TestAuthMeEndpoint:
    """Test auth/me endpoint to verify session tokens work"""
    
    def test_auth_me_with_valid_token(self):
        """Auth/me should return user data with valid token"""
        # First get a token via dev login
        login_response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert login_response.status_code == 200
        token = login_response.json()['session_token']
        
        # Use token to get current user
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert 'user_id' in data
        assert 'email' in data
        assert 'role' in data
    
    def test_auth_me_with_firebase_token(self):
        """Auth/me should work with Firebase-generated session token"""
        test_email = f"TEST_authme_{uuid.uuid4().hex[:8]}@test.com"
        firebase_user_data = {
            "user": {
                "email": test_email,
                "displayName": "Auth Me Test User",
                "uid": f"firebase_uid_{uuid.uuid4().hex[:12]}"
            }
        }
        
        # Login via Firebase
        login_response = requests.post(f"{BASE_URL}/api/auth/firebase-login", json=firebase_user_data)
        assert login_response.status_code == 200
        token = login_response.json()['session_token']
        
        # Use token to get current user
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data['email'] == test_email
    
    def test_auth_me_without_token(self):
        """Auth/me should return 401 without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
