"""
Test Suite for Iteration 15 - New AI Endpoints and Features
Tests:
1. AI Meal Plan endpoint (POST /ai/meal-plan) - structured JSON with meal_name, ingredients, steps
2. AI Chore Tips endpoint (POST /ai/chore-tips) - helpful tips
3. AI Family Activity endpoint (POST /ai/family-activity) - activities JSON
4. Points adjustment - add points (POST /users/{user_id}/points with positive amount)
5. Points deduction - remove points (POST /users/{user_id}/points with negative amount)
6. Shopping list - add item (POST /shopping)
7. Chores - list, create, claim
8. Health check endpoint
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test health check returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert data["service"] == "famfocus-api"
        print(f"✓ Health check passed: {data}")


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
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["role"] == "parent"
        print(f"✓ Dev login parent passed: user_id={data['user']['user_id']}")
        return data
    
    def test_dev_login_child(self):
        """Test dev login as child"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "test_child@famfocus.demo",
            "name": "Test Child",
            "role": "child"
        })
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["role"] == "child"
        print(f"✓ Dev login child passed: user_id={data['user']['user_id']}")
        return data


class TestAIMealPlan:
    """AI Meal Plan endpoint tests - POST /ai/meal-plan"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "ai_test@famfocus.demo",
            "name": "AI Test User",
            "role": "parent"
        })
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_ai_meal_plan_basic(self):
        """Test AI meal plan returns structured JSON"""
        response = requests.post(
            f"{BASE_URL}/api/ai/meal-plan",
            json={"meal_type": "dinner", "servings": 4},
            headers=self.headers,
            timeout=60  # AI calls can take time
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "success" in data
        
        if data["success"]:
            # Verify structured output
            assert "meal" in data
            meal = data["meal"]
            assert "meal_name" in meal, "Missing meal_name in response"
            assert "ingredients" in meal, "Missing ingredients in response"
            assert "steps" in meal, "Missing steps in response"
            assert isinstance(meal["ingredients"], list), "ingredients should be a list"
            assert isinstance(meal["steps"], list), "steps should be a list"
            print(f"✓ AI Meal Plan passed: {meal['meal_name']}")
            print(f"  - Ingredients count: {len(meal['ingredients'])}")
            print(f"  - Steps count: {len(meal['steps'])}")
        else:
            # Fallback to text response
            assert "suggestion" in data
            print(f"✓ AI Meal Plan returned text fallback: {data['suggestion'][:100]}...")
    
    def test_ai_meal_plan_with_preferences(self):
        """Test AI meal plan with dietary preferences"""
        response = requests.post(
            f"{BASE_URL}/api/ai/meal-plan",
            json={
                "meal_type": "lunch",
                "servings": 2,
                "preferences": "vegetarian, quick to prepare"
            },
            headers=self.headers,
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        print(f"✓ AI Meal Plan with preferences passed: success={data['success']}")
    
    def test_ai_meal_plan_unauthorized(self):
        """Test AI meal plan requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai/meal-plan",
            json={"meal_type": "dinner"}
        )
        assert response.status_code == 401
        print("✓ AI Meal Plan unauthorized test passed")


class TestAIChoreTips:
    """AI Chore Tips endpoint tests - POST /ai/chore-tips"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "chore_tips_test@famfocus.demo",
            "name": "Chore Tips Test",
            "role": "parent"
        })
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_ai_chore_tips_basic(self):
        """Test AI chore tips returns helpful tips"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chore-tips",
            json={"title": "Clean your room", "child_age": 8},
            headers=self.headers,
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "tips" in data, "Missing tips in response"
        assert len(data["tips"]) > 0, "Tips should not be empty"
        print(f"✓ AI Chore Tips passed: {data['tips'][:200]}...")
    
    def test_ai_chore_tips_different_chore(self):
        """Test AI chore tips for different chore types"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chore-tips",
            json={"title": "Do the dishes", "child_age": 12},
            headers=self.headers,
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert "tips" in data
        print(f"✓ AI Chore Tips for dishes passed")
    
    def test_ai_chore_tips_unauthorized(self):
        """Test AI chore tips requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chore-tips",
            json={"title": "Clean room"}
        )
        assert response.status_code == 401
        print("✓ AI Chore Tips unauthorized test passed")


class TestAIFamilyActivity:
    """AI Family Activity endpoint tests - POST /ai/family-activity"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "activity_test@famfocus.demo",
            "name": "Activity Test",
            "role": "parent"
        })
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_ai_family_activity_basic(self):
        """Test AI family activity returns structured JSON"""
        response = requests.post(
            f"{BASE_URL}/api/ai/family-activity",
            json={
                "num_kids": 2,
                "ages": [6, 10],
                "weather": "sunny",
                "duration": "1-2 hours",
                "setting": "outdoor"
            },
            headers=self.headers,
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "success" in data
        
        if data["success"]:
            assert "data" in data
            assert "activities" in data["data"], "Missing activities in response"
            activities = data["data"]["activities"]
            assert isinstance(activities, list), "activities should be a list"
            assert len(activities) > 0, "Should have at least one activity"
            
            # Check activity structure
            activity = activities[0]
            assert "name" in activity, "Activity missing name"
            assert "description" in activity, "Activity missing description"
            print(f"✓ AI Family Activity passed: {len(activities)} activities returned")
            for act in activities:
                print(f"  - {act.get('name', 'Unknown')}")
        else:
            assert "suggestion" in data
            print(f"✓ AI Family Activity returned text fallback")
    
    def test_ai_family_activity_indoor(self):
        """Test AI family activity for indoor setting"""
        response = requests.post(
            f"{BASE_URL}/api/ai/family-activity",
            json={
                "num_kids": 3,
                "weather": "rainy",
                "setting": "indoor"
            },
            headers=self.headers,
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        print(f"✓ AI Family Activity indoor passed: success={data['success']}")
    
    def test_ai_family_activity_unauthorized(self):
        """Test AI family activity requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai/family-activity",
            json={"num_kids": 2}
        )
        assert response.status_code == 401
        print("✓ AI Family Activity unauthorized test passed")


class TestPointsAdjustment:
    """Points adjustment tests - POST /users/{user_id}/points"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth tokens for parent and child"""
        # Parent login
        parent_resp = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "points_parent@famfocus.demo",
            "name": "Points Parent",
            "role": "parent"
        })
        self.parent_token = parent_resp.json()["session_token"]
        self.parent_headers = {"Authorization": f"Bearer {self.parent_token}"}
        self.parent_user = parent_resp.json()["user"]
        
        # Child login
        child_resp = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "points_child@famfocus.demo",
            "name": "Points Child",
            "role": "child"
        })
        self.child_token = child_resp.json()["session_token"]
        self.child_headers = {"Authorization": f"Bearer {self.child_token}"}
        self.child_user = child_resp.json()["user"]
    
    def test_add_points_positive(self):
        """Test adding points with positive amount"""
        child_id = self.child_user["user_id"]
        
        # Get current points
        initial_points = self.child_user.get("points", 0)
        
        # Add 25 points
        response = requests.post(
            f"{BASE_URL}/api/users/{child_id}/points",
            json={"amount": 25, "reason": "TEST_Good behavior"},
            headers=self.parent_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "points" in data
        assert data["change"] == 25
        print(f"✓ Add points passed: {initial_points} + 25 = {data['points']}")
    
    def test_deduct_points_negative(self):
        """Test deducting points with negative amount"""
        child_id = self.child_user["user_id"]
        
        # First add some points to ensure we have enough
        requests.post(
            f"{BASE_URL}/api/users/{child_id}/points",
            json={"amount": 50, "reason": "TEST_Setup for deduction"},
            headers=self.parent_headers
        )
        
        # Get current points
        user_resp = requests.get(
            f"{BASE_URL}/api/users/{child_id}",
            headers=self.parent_headers
        )
        current_points = user_resp.json().get("points", 0)
        
        # Deduct 15 points
        response = requests.post(
            f"{BASE_URL}/api/users/{child_id}/points",
            json={"amount": -15, "reason": "TEST_Penalty"},
            headers=self.parent_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "points" in data
        assert data["change"] == -15
        assert data["points"] == max(0, current_points - 15)
        print(f"✓ Deduct points passed: {current_points} - 15 = {data['points']}")
    
    def test_points_floor_at_zero(self):
        """Test points cannot go below zero"""
        child_id = self.child_user["user_id"]
        
        # Try to deduct more points than available
        response = requests.post(
            f"{BASE_URL}/api/users/{child_id}/points",
            json={"amount": -99999, "reason": "TEST_Large deduction"},
            headers=self.parent_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["points"] >= 0, "Points should not go below 0"
        print(f"✓ Points floor test passed: points={data['points']} (>= 0)")
    
    def test_child_cannot_modify_points(self):
        """Test child cannot modify points"""
        child_id = self.child_user["user_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/users/{child_id}/points",
            json={"amount": 100, "reason": "TEST_Child trying to add"},
            headers=self.child_headers
        )
        assert response.status_code == 403
        print("✓ Child cannot modify points test passed (403 Forbidden)")


class TestShoppingList:
    """Shopping list tests - POST /shopping, GET /shopping"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth tokens"""
        parent_resp = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "shopping_parent@famfocus.demo",
            "name": "Shopping Parent",
            "role": "parent"
        })
        self.parent_token = parent_resp.json()["session_token"]
        self.parent_headers = {"Authorization": f"Bearer {self.parent_token}"}
        
        child_resp = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "shopping_child@famfocus.demo",
            "name": "Shopping Child",
            "role": "child"
        })
        self.child_token = child_resp.json()["session_token"]
        self.child_headers = {"Authorization": f"Bearer {self.child_token}"}
    
    def test_add_shopping_item_parent(self):
        """Test parent adding shopping item (auto-approved)"""
        response = requests.post(
            f"{BASE_URL}/api/shopping",
            json={"name": "TEST_Milk"},
            headers=self.parent_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "item_id" in data
        assert data["name"] == "TEST_Milk"
        assert data["status"] == "approved", "Parent items should be auto-approved"
        print(f"✓ Parent add shopping item passed: {data['name']} (status={data['status']})")
    
    def test_add_shopping_item_child(self):
        """Test child adding shopping item (pending)"""
        response = requests.post(
            f"{BASE_URL}/api/shopping",
            json={"name": "TEST_Candy"},
            headers=self.child_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "item_id" in data
        assert data["name"] == "TEST_Candy"
        assert data["status"] == "pending", "Child items should be pending"
        print(f"✓ Child add shopping item passed: {data['name']} (status={data['status']})")
    
    def test_get_shopping_list(self):
        """Test getting shopping list"""
        response = requests.get(
            f"{BASE_URL}/api/shopping",
            headers=self.parent_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert isinstance(data["items"], list)
        print(f"✓ Get shopping list passed: {len(data['items'])} items")


class TestChores:
    """Chores tests - GET /chores, POST /chores, PUT /chores/{id}/claim"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth tokens"""
        parent_resp = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "chores_parent@famfocus.demo",
            "name": "Chores Parent",
            "role": "parent"
        })
        self.parent_token = parent_resp.json()["session_token"]
        self.parent_headers = {"Authorization": f"Bearer {self.parent_token}"}
        self.parent_user = parent_resp.json()["user"]
        
        child_resp = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "chores_child@famfocus.demo",
            "name": "Chores Child",
            "role": "child"
        })
        self.child_token = child_resp.json()["session_token"]
        self.child_headers = {"Authorization": f"Bearer {self.child_token}"}
        self.child_user = child_resp.json()["user"]
    
    def test_get_chores_list(self):
        """Test getting chores list"""
        response = requests.get(
            f"{BASE_URL}/api/chores",
            headers=self.parent_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "chores" in data
        assert isinstance(data["chores"], list)
        print(f"✓ Get chores list passed: {len(data['chores'])} chores")
    
    def test_create_chore_parent(self):
        """Test parent creating a chore"""
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/chores",
            json={
                "title": "TEST_Clean Room",
                "description": "Clean and organize bedroom",
                "scheduled_date": today,
                "points": 15
            },
            headers=self.parent_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "chore_id" in data
        assert data["title"] == "TEST_Clean Room"
        assert data["points"] == 15
        assert data["status"] == "pending"
        print(f"✓ Create chore passed: {data['title']} (points={data['points']})")
        return data["chore_id"]
    
    def test_create_chore_child_forbidden(self):
        """Test child cannot create chores"""
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/chores",
            json={
                "title": "TEST_Child Chore",
                "scheduled_date": today,
                "points": 10
            },
            headers=self.child_headers
        )
        assert response.status_code == 403
        print("✓ Child cannot create chores test passed (403 Forbidden)")
    
    def test_claim_unassigned_chore(self):
        """Test child claiming an unassigned chore"""
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        # First create an unassigned chore
        create_resp = requests.post(
            f"{BASE_URL}/api/chores",
            json={
                "title": "TEST_Unassigned Chore",
                "scheduled_date": today,
                "points": 20
            },
            headers=self.parent_headers
        )
        chore_id = create_resp.json()["chore_id"]
        
        # Child claims the chore
        response = requests.put(
            f"{BASE_URL}/api/chores/{chore_id}/claim",
            headers=self.child_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["assigned_to"] == self.child_user["user_id"]
        assert data.get("claimed_by_child") == True
        print(f"✓ Claim chore passed: {data['title']} claimed by child")


# Cleanup fixture
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests"""
    yield
    # Cleanup would happen here if needed
    print("\n✓ Test session completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
