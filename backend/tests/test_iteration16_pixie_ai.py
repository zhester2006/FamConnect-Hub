"""
Iteration 16 - Pixie AI Assistant and Feature Verification Tests
Tests:
1. Pixie AI endpoint (POST /api/ai/pixie) - friendly family assistant
2. AI Meal Plan endpoint (POST /api/ai/meal-plan)
3. AI Chore Tips endpoint (POST /api/ai/chore-tips)
4. AI Family Activity endpoint (POST /api/ai/family-activity)
5. Points adjustment - add and deduct
6. Shopping list - add item
7. Chores - create, list, claim
8. Health check endpoint
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_check_returns_healthy(self):
        """Test health check endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
        assert data['service'] == 'famfocus-api'
        print(f"✅ Health check passed: {data}")


class TestDevLogin:
    """Dev login tests for authentication"""
    
    def test_dev_login_parent(self):
        """Test dev login as parent"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "test_parent@famfocus.demo",
            "name": "Test Parent",
            "role": "parent"
        })
        assert response.status_code == 200
        data = response.json()
        assert 'user' in data
        assert 'session_token' in data
        assert data['user']['role'] == 'parent'
        print(f"✅ Parent login successful: {data['user']['name']}")
        return data['session_token']
    
    def test_dev_login_child(self):
        """Test dev login as child"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "test_child@famfocus.demo",
            "name": "Test Child",
            "role": "child"
        })
        assert response.status_code == 200
        data = response.json()
        assert 'user' in data
        assert 'session_token' in data
        assert data['user']['role'] == 'child'
        print(f"✅ Child login successful: {data['user']['name']}")
        return data['session_token']


class TestPixieAIAssistant:
    """Pixie AI Assistant endpoint tests - the main focus of this iteration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "pixie_test@famfocus.demo",
            "name": "Pixie Tester",
            "role": "parent"
        })
        self.token = response.json().get('session_token')
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_pixie_basic_greeting(self):
        """Test Pixie responds to a basic greeting"""
        response = requests.post(
            f"{BASE_URL}/api/ai/pixie",
            headers=self.headers,
            json={
                "message": "Hello Pixie!",
                "user_name": "Test User",
                "user_role": "parent"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'response' in data
        assert len(data['response']) > 0
        print(f"✅ Pixie greeting response: {data['response'][:100]}...")
    
    def test_pixie_dinner_suggestion(self):
        """Test Pixie can suggest dinner ideas"""
        response = requests.post(
            f"{BASE_URL}/api/ai/pixie",
            headers=self.headers,
            json={
                "message": "What should we have for dinner tonight?",
                "user_name": "Mom",
                "user_role": "parent"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'response' in data
        assert len(data['response']) > 0
        print(f"✅ Pixie dinner suggestion: {data['response'][:150]}...")
    
    def test_pixie_chore_motivation(self):
        """Test Pixie can provide chore motivation for kids"""
        response = requests.post(
            f"{BASE_URL}/api/ai/pixie",
            headers=self.headers,
            json={
                "message": "I don't want to clean my room",
                "user_name": "Tommy",
                "user_role": "child"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'response' in data
        assert len(data['response']) > 0
        print(f"✅ Pixie chore motivation: {data['response'][:150]}...")
    
    def test_pixie_homework_help(self):
        """Test Pixie can provide homework help"""
        response = requests.post(
            f"{BASE_URL}/api/ai/pixie",
            headers=self.headers,
            json={
                "message": "Can you help me with my math homework?",
                "user_name": "Sarah",
                "user_role": "child"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'response' in data
        assert len(data['response']) > 0
        print(f"✅ Pixie homework help: {data['response'][:150]}...")
    
    def test_pixie_with_context(self):
        """Test Pixie can handle conversation context"""
        response = requests.post(
            f"{BASE_URL}/api/ai/pixie",
            headers=self.headers,
            json={
                "message": "What else can we do?",
                "user_name": "Family",
                "user_role": "parent",
                "context": [
                    {"role": "user", "content": "What are some fun family activities?"},
                    {"role": "assistant", "content": "You could try a board game night or go for a nature walk!"}
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'response' in data
        assert len(data['response']) > 0
        print(f"✅ Pixie with context: {data['response'][:150]}...")
    
    def test_pixie_requires_auth(self):
        """Test Pixie endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai/pixie",
            json={
                "message": "Hello!",
                "user_name": "Test",
                "user_role": "child"
            }
        )
        assert response.status_code == 401
        print("✅ Pixie correctly requires authentication")


class TestAIMealPlan:
    """AI Meal Plan endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "meal_test@famfocus.demo",
            "name": "Meal Tester",
            "role": "parent"
        })
        self.token = response.json().get('session_token')
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_meal_plan_basic(self):
        """Test basic meal plan generation"""
        response = requests.post(
            f"{BASE_URL}/api/ai/meal-plan",
            headers=self.headers,
            json={"servings": 4, "meal_type": "dinner"}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data or 'suggestion' in data or 'meal' in data
        print(f"✅ Meal plan generated successfully")
    
    def test_meal_plan_with_preferences(self):
        """Test meal plan with dietary preferences"""
        response = requests.post(
            f"{BASE_URL}/api/ai/meal-plan",
            headers=self.headers,
            json={
                "servings": 4,
                "meal_type": "dinner",
                "preferences": "vegetarian, kid-friendly"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data or 'suggestion' in data or 'meal' in data
        print(f"✅ Meal plan with preferences generated")


class TestAIChoreTips:
    """AI Chore Tips endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "chore_tips_test@famfocus.demo",
            "name": "Chore Tips Tester",
            "role": "parent"
        })
        self.token = response.json().get('session_token')
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_chore_tips_basic(self):
        """Test basic chore tips generation"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chore-tips",
            headers=self.headers,
            json={"title": "Clean bedroom", "child_age": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'tips' in data
        assert len(data['tips']) > 0
        print(f"✅ Chore tips generated: {data['tips'][:100]}...")
    
    def test_chore_tips_different_chore(self):
        """Test chore tips for different chore type"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chore-tips",
            headers=self.headers,
            json={"title": "Wash dishes", "child_age": 8}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'tips' in data
        print(f"✅ Chore tips for dishes generated")


class TestAIFamilyActivity:
    """AI Family Activity endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "activity_test@famfocus.demo",
            "name": "Activity Tester",
            "role": "parent"
        })
        self.token = response.json().get('session_token')
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_family_activity_basic(self):
        """Test basic family activity suggestion"""
        response = requests.post(
            f"{BASE_URL}/api/ai/family-activity",
            headers=self.headers,
            json={"num_kids": 2, "ages": [8, 12]}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data or 'suggestion' in data or 'data' in data
        print(f"✅ Family activity suggestions generated")
    
    def test_family_activity_indoor(self):
        """Test indoor family activity suggestion"""
        response = requests.post(
            f"{BASE_URL}/api/ai/family-activity",
            headers=self.headers,
            json={
                "num_kids": 2,
                "ages": [6, 10],
                "setting": "indoor",
                "weather": "rainy"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data or 'suggestion' in data or 'data' in data
        print(f"✅ Indoor family activity suggestions generated")


class TestPointsAdjustment:
    """Points adjustment tests - add and deduct"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login as parent
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "points_parent@famfocus.demo",
            "name": "Points Parent",
            "role": "parent"
        })
        self.parent_token = response.json().get('session_token')
        self.parent_headers = {"Authorization": f"Bearer {self.parent_token}"}
        
        # Login as child
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "points_child@famfocus.demo",
            "name": "Points Child",
            "role": "child"
        })
        self.child_data = response.json()
        self.child_token = self.child_data.get('session_token')
        self.child_id = self.child_data['user']['user_id']
        self.child_headers = {"Authorization": f"Bearer {self.child_token}"}
    
    def test_add_points(self):
        """Test adding points to a child"""
        response = requests.post(
            f"{BASE_URL}/api/users/{self.child_id}/points",
            headers=self.parent_headers,
            json={"amount": 25, "reason": "TEST_Good behavior"}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'points' in data
        assert data['change'] == 25
        print(f"✅ Points added: {data}")
    
    def test_deduct_points(self):
        """Test deducting points from a child"""
        # First add some points
        requests.post(
            f"{BASE_URL}/api/users/{self.child_id}/points",
            headers=self.parent_headers,
            json={"amount": 50, "reason": "TEST_Initial points"}
        )
        
        # Then deduct
        response = requests.post(
            f"{BASE_URL}/api/users/{self.child_id}/points",
            headers=self.parent_headers,
            json={"amount": -10, "reason": "TEST_Penalty"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data['change'] == -10
        print(f"✅ Points deducted: {data}")
    
    def test_child_cannot_modify_points(self):
        """Test that child cannot modify points"""
        response = requests.post(
            f"{BASE_URL}/api/users/{self.child_id}/points",
            headers=self.child_headers,
            json={"amount": 100, "reason": "TEST_Cheating attempt"}
        )
        assert response.status_code == 403
        print("✅ Child correctly forbidden from modifying points")


class TestShoppingList:
    """Shopping list tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "shopping_test@famfocus.demo",
            "name": "Shopping Tester",
            "role": "parent"
        })
        self.token = response.json().get('session_token')
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_add_shopping_item(self):
        """Test adding item to shopping list"""
        response = requests.post(
            f"{BASE_URL}/api/shopping",
            headers=self.headers,
            json={"name": f"TEST_Milk_{uuid.uuid4().hex[:6]}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'item_id' in data
        assert 'name' in data
        print(f"✅ Shopping item added: {data['name']}")
    
    def test_get_shopping_list(self):
        """Test getting shopping list"""
        response = requests.get(
            f"{BASE_URL}/api/shopping",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert 'items' in data
        print(f"✅ Shopping list retrieved: {len(data['items'])} items")


class TestChores:
    """Chores tests - create, list, claim"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login as parent
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "chores_parent@famfocus.demo",
            "name": "Chores Parent",
            "role": "parent"
        })
        self.parent_token = response.json().get('session_token')
        self.parent_headers = {"Authorization": f"Bearer {self.parent_token}"}
        
        # Login as child
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "chores_child@famfocus.demo",
            "name": "Chores Child",
            "role": "child"
        })
        self.child_token = response.json().get('session_token')
        self.child_headers = {"Authorization": f"Bearer {self.child_token}"}
    
    def test_list_chores(self):
        """Test listing chores"""
        response = requests.get(
            f"{BASE_URL}/api/chores",
            headers=self.parent_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert 'chores' in data
        print(f"✅ Chores listed: {len(data['chores'])} chores")
    
    def test_create_chore_as_parent(self):
        """Test creating a chore as parent"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/chores",
            headers=self.parent_headers,
            json={
                "title": f"TEST_Clean room_{uuid.uuid4().hex[:6]}",
                "description": "Clean and organize bedroom",
                "scheduled_date": today,
                "points": 15
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'chore_id' in data
        assert data['status'] == 'pending'
        print(f"✅ Chore created: {data['title']}")
        return data['chore_id']
    
    def test_child_cannot_create_chore(self):
        """Test that child cannot create chores"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/chores",
            headers=self.child_headers,
            json={
                "title": "TEST_Unauthorized chore",
                "scheduled_date": today,
                "points": 100
            }
        )
        assert response.status_code == 403
        print("✅ Child correctly forbidden from creating chores")
    
    def test_claim_unassigned_chore(self):
        """Test claiming an unassigned chore"""
        # First create an unassigned chore as parent
        today = datetime.now().strftime("%Y-%m-%d")
        create_response = requests.post(
            f"{BASE_URL}/api/chores",
            headers=self.parent_headers,
            json={
                "title": f"TEST_Unassigned chore_{uuid.uuid4().hex[:6]}",
                "scheduled_date": today,
                "points": 10
            }
        )
        chore_id = create_response.json()['chore_id']
        
        # Claim as child
        response = requests.put(
            f"{BASE_URL}/api/chores/{chore_id}/claim",
            headers=self.child_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get('assigned_to') is not None
        print(f"✅ Chore claimed successfully: {data['title']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
