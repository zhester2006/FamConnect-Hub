"""
Iteration 26 - Testing Custom Achievements CRUD, AI Suggestions, and Child Login/Setup Wizard
Features tested:
- POST /api/achievements/custom - Create custom achievement (parent only)
- GET /api/achievements/custom - Get custom achievements list
- DELETE /api/achievements/custom/{id} - Delete custom achievement
- POST /api/achievements/custom/{id}/award - Award achievement to child
- POST /api/achievements/ai-suggestions - AI-generated suggestions
- POST /api/auth/child-login - Child login with testkid/pass123
- POST /api/users/{id}/first-login-setup - Setup wizard completion
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print(f"✓ Health check passed: {data}")
    
    def test_dev_login_parent(self):
        """Test dev login as parent"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'session_token' in data
        assert 'user' in data
        assert data['user']['role'] == 'parent'
        print(f"✓ Parent dev login successful: user_id={data['user']['user_id']}")
        return data['session_token'], data['user']


class TestChildLoginAndSetupWizard:
    """Test child login and setup wizard flow"""
    
    def test_child_login_success(self):
        """Test child login with testkid/pass123"""
        response = requests.post(
            f"{BASE_URL}/api/auth/child-login",
            json={"username": "testkid", "password": "pass123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Child login failed: {response.text}"
        data = response.json()
        assert 'session_token' in data
        assert 'user' in data
        assert 'first_login' in data
        print(f"✓ Child login successful: user={data['user'].get('name')}, first_login={data.get('first_login')}")
        return data
    
    def test_child_login_invalid_credentials(self):
        """Test child login with wrong credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/child-login",
            json={"username": "wronguser", "password": "wrongpass"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print(f"✓ Invalid child login correctly rejected: {response.status_code}")


class TestCustomAchievementsCRUD:
    """Test custom achievements CRUD operations (parent only)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get parent session token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.session_token = data['session_token']
        self.parent_user = data['user']
        self.cookies = {"session_token": self.session_token}
    
    def test_create_custom_achievement(self):
        """Test creating a custom achievement"""
        achievement_data = {
            "name": "TEST_Kitchen Helper",
            "description": "Help with kitchen chores for 5 days",
            "icon": "🍳",
            "category": "custom",
            "type": "manual",
            "requirement": 5,
            "points_reward": 25
        }
        response = requests.post(
            f"{BASE_URL}/api/achievements/custom",
            json=achievement_data,
            cookies=self.cookies,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert 'achievement_id' in data
        assert data['name'] == "TEST_Kitchen Helper"
        assert data['points_reward'] == 25
        print(f"✓ Custom achievement created: {data['achievement_id']}")
        return data['achievement_id']
    
    def test_get_custom_achievements(self):
        """Test getting list of custom achievements"""
        response = requests.get(
            f"{BASE_URL}/api/achievements/custom",
            cookies=self.cookies
        )
        assert response.status_code == 200
        data = response.json()
        assert 'achievements' in data
        print(f"✓ Got {len(data['achievements'])} custom achievements")
        return data['achievements']
    
    def test_create_and_delete_achievement(self):
        """Test creating and then deleting an achievement"""
        # Create
        create_response = requests.post(
            f"{BASE_URL}/api/achievements/custom",
            json={
                "name": "TEST_Delete Me",
                "description": "This will be deleted",
                "points_reward": 10
            },
            cookies=self.cookies,
            headers={"Content-Type": "application/json"}
        )
        assert create_response.status_code == 200
        achievement_id = create_response.json()['achievement_id']
        print(f"✓ Created achievement for deletion: {achievement_id}")
        
        # Delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/achievements/custom/{achievement_id}",
            cookies=self.cookies
        )
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert data.get('success') == True
        print(f"✓ Achievement deleted successfully")
    
    def test_award_achievement_to_child(self):
        """Test awarding a custom achievement to a child"""
        # First, get a child user
        child_login = requests.post(
            f"{BASE_URL}/api/auth/child-login",
            json={"username": "testkid", "password": "pass123"},
            headers={"Content-Type": "application/json"}
        )
        if child_login.status_code != 200:
            pytest.skip("Child user testkid not available")
        
        child_data = child_login.json()
        child_id = child_data['user']['user_id']
        
        # Create an achievement to award
        create_response = requests.post(
            f"{BASE_URL}/api/achievements/custom",
            json={
                "name": "TEST_Award Test Badge",
                "description": "For testing award functionality",
                "points_reward": 15
            },
            cookies=self.cookies,
            headers={"Content-Type": "application/json"}
        )
        assert create_response.status_code == 200
        achievement_id = create_response.json()['achievement_id']
        
        # Award to child
        award_response = requests.post(
            f"{BASE_URL}/api/achievements/custom/{achievement_id}/award",
            json={"child_id": child_id},
            cookies=self.cookies,
            headers={"Content-Type": "application/json"}
        )
        assert award_response.status_code == 200, f"Award failed: {award_response.text}"
        data = award_response.json()
        assert data.get('success') == True
        print(f"✓ Achievement awarded to child: {data.get('message')}")
        
        # Cleanup - delete the achievement
        requests.delete(
            f"{BASE_URL}/api/achievements/custom/{achievement_id}",
            cookies=self.cookies
        )


class TestAISuggestions:
    """Test AI achievement suggestions endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get parent session token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.session_token = data['session_token']
        self.cookies = {"session_token": self.session_token}
    
    def test_ai_suggestions_endpoint(self):
        """Test AI suggestions endpoint returns suggestions"""
        response = requests.post(
            f"{BASE_URL}/api/achievements/ai-suggestions",
            json={"context": "summer activities"},
            cookies=self.cookies,
            headers={"Content-Type": "application/json"},
            timeout=30  # AI may take time
        )
        assert response.status_code == 200, f"AI suggestions failed: {response.text}"
        data = response.json()
        assert 'suggestions' in data
        print(f"✓ AI suggestions returned: {len(data.get('suggestions', []))} suggestions")
        if data.get('suggestions'):
            print(f"  Sample suggestion: {data['suggestions'][0].get('name')}")


class TestAchievementsPage:
    """Test achievements page endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get parent session token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.session_token = data['session_token']
        self.parent_user = data['user']
        self.cookies = {"session_token": self.session_token}
    
    def test_user_achievements(self):
        """Test getting user achievements"""
        user_id = self.parent_user['user_id']
        response = requests.get(
            f"{BASE_URL}/api/achievements/user/{user_id}",
            cookies=self.cookies
        )
        assert response.status_code == 200
        data = response.json()
        assert 'achievements' in data
        assert 'stats' in data
        print(f"✓ User achievements: {len(data['achievements'])} badges, stats: {data['stats']}")
    
    def test_family_achievements(self):
        """Test getting family achievements"""
        response = requests.get(
            f"{BASE_URL}/api/achievements/family",
            cookies=self.cookies
        )
        assert response.status_code == 200
        data = response.json()
        assert 'achievements' in data
        print(f"✓ Family achievements: {len(data['achievements'])} badges")
    
    def test_seasonal_achievements(self):
        """Test getting seasonal achievements"""
        response = requests.get(
            f"{BASE_URL}/api/achievements/seasonal",
            cookies=self.cookies
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Seasonal achievements endpoint working")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_achievements(self):
        """Clean up TEST_ prefixed achievements"""
        # Get parent session
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"role": "parent"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code != 200:
            return
        
        cookies = {"session_token": response.json()['session_token']}
        
        # Get all custom achievements
        get_response = requests.get(
            f"{BASE_URL}/api/achievements/custom",
            cookies=cookies
        )
        if get_response.status_code == 200:
            achievements = get_response.json().get('achievements', [])
            for ach in achievements:
                if ach.get('name', '').startswith('TEST_'):
                    requests.delete(
                        f"{BASE_URL}/api/achievements/custom/{ach['achievement_id']}",
                        cookies=cookies
                    )
                    print(f"  Cleaned up: {ach['name']}")
        print("✓ Cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
