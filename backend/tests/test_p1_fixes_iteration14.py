"""
FamFocus Hub P1 Fixes Tests - Iteration 14
Focused tests for P1 fixes:
1. Points adjustment API - add points (POST /users/{user_id}/points with positive amount)
2. Points deduction API - remove points (POST /users/{user_id}/points with negative amount)
3. Shopping list - add item (POST /shopping)
4. Shopping list - get items (GET /shopping)
5. Dinner suggest - quick meal (POST /dinner/suggest with preferences)
6. Reading logs - submit with book_title (POST /reading-logs)
7. Dev login - parent and child roles
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Store session tokens for parent and child
PARENT_TOKEN = None
CHILD_TOKEN = None
PARENT_USER_ID = None
CHILD_USER_ID = None


class TestDevLoginP1:
    """Test dev login flow for both parent and child roles - P1 Fix"""
    
    def test_dev_login_parent_role(self):
        """Test POST /api/auth/dev-login with parent role"""
        global PARENT_TOKEN, PARENT_USER_ID
        
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": "p1_test_parent@famfocus.demo", "name": "P1 Test Parent", "role": "parent"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain 'user'"
        assert "session_token" in data, "Response should contain 'session_token'"
        assert data["user"]["role"] == "parent", f"Expected role 'parent', got {data['user']['role']}"
        
        PARENT_TOKEN = data["session_token"]
        PARENT_USER_ID = data["user"]["user_id"]
        print(f"✓ Parent dev login passed - user_id: {PARENT_USER_ID}")
    
    def test_dev_login_child_role(self):
        """Test POST /api/auth/dev-login with child role"""
        global CHILD_TOKEN, CHILD_USER_ID
        
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": "p1_test_child@famfocus.demo", "name": "P1 Test Child", "role": "child"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain 'user'"
        assert "session_token" in data, "Response should contain 'session_token'"
        assert data["user"]["role"] == "child", f"Expected role 'child', got {data['user']['role']}"
        
        CHILD_TOKEN = data["session_token"]
        CHILD_USER_ID = data["user"]["user_id"]
        print(f"✓ Child dev login passed - user_id: {CHILD_USER_ID}")


class TestPointsAdjustmentP1:
    """Test points adjustment API - P1 Fix for Award/Deduct toggle"""
    
    def test_add_points_positive_amount(self):
        """Test POST /api/users/{user_id}/points with positive amount adds points"""
        global PARENT_TOKEN, CHILD_USER_ID
        
        # First get current points
        user_response = requests.get(
            f"{BASE_URL}/api/users/{CHILD_USER_ID}",
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        initial_points = user_response.json().get("points", 0)
        
        # Add points
        response = requests.post(
            f"{BASE_URL}/api/users/{CHILD_USER_ID}/points",
            json={"amount": 25, "reason": "P1_TEST_Award for good behavior"},
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "points" in data, "Response should contain 'points'"
        assert data["change"] == 25, f"Expected change of 25, got {data['change']}"
        assert data["points"] == initial_points + 25, f"Expected points {initial_points + 25}, got {data['points']}"
        print(f"✓ Add points passed - added 25 points, new total: {data['points']}")
    
    def test_deduct_points_negative_amount(self):
        """Test POST /api/users/{user_id}/points with negative amount removes points - P1 Fix"""
        global PARENT_TOKEN, CHILD_USER_ID
        
        # First get current points
        user_response = requests.get(
            f"{BASE_URL}/api/users/{CHILD_USER_ID}",
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        initial_points = user_response.json().get("points", 0)
        
        # Deduct points
        response = requests.post(
            f"{BASE_URL}/api/users/{CHILD_USER_ID}/points",
            json={"amount": -10, "reason": "P1_TEST_Deduction for missed chore"},
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "points" in data, "Response should contain 'points'"
        assert data["change"] == -10, f"Expected change of -10, got {data['change']}"
        expected_points = max(0, initial_points - 10)  # Points can't go below 0
        assert data["points"] == expected_points, f"Expected points {expected_points}, got {data['points']}"
        print(f"✓ Deduct points passed - deducted 10 points, new total: {data['points']}")
    
    def test_points_cannot_go_below_zero(self):
        """Test that points cannot go below zero when deducting"""
        global PARENT_TOKEN, CHILD_USER_ID
        
        # Try to deduct a large amount
        response = requests.post(
            f"{BASE_URL}/api/users/{CHILD_USER_ID}/points",
            json={"amount": -99999, "reason": "P1_TEST_Large deduction test"},
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["points"] >= 0, f"Points should not go below 0, got {data['points']}"
        print(f"✓ Points floor at 0 passed - points: {data['points']}")
    
    def test_child_cannot_modify_own_points(self):
        """Test that child cannot modify their own points"""
        global CHILD_TOKEN, CHILD_USER_ID
        
        response = requests.post(
            f"{BASE_URL}/api/users/{CHILD_USER_ID}/points",
            json={"amount": 100, "reason": "P1_TEST_Unauthorized attempt"},
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert response.status_code == 403, f"Expected 403 Forbidden, got {response.status_code}"
        print("✓ Child cannot modify points - correctly returns 403")


class TestShoppingListP1:
    """Test shopping list API - P1 Fix"""
    
    def test_add_shopping_item_as_parent(self):
        """Test POST /api/shopping adds item (auto-approved for parent)"""
        global PARENT_TOKEN
        
        response = requests.post(
            f"{BASE_URL}/api/shopping",
            json={"name": "P1_TEST_Milk"},
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == "P1_TEST_Milk", f"Expected name 'P1_TEST_Milk', got {data['name']}"
        assert data["status"] == "approved", f"Parent items should be auto-approved, got {data['status']}"
        assert "item_id" in data, "Response should contain 'item_id'"
        print(f"✓ Add shopping item as parent passed - item_id: {data['item_id']}")
    
    def test_add_shopping_item_as_child(self):
        """Test POST /api/shopping adds item (pending for child)"""
        global CHILD_TOKEN
        
        response = requests.post(
            f"{BASE_URL}/api/shopping",
            json={"name": "P1_TEST_Candy"},
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == "P1_TEST_Candy", f"Expected name 'P1_TEST_Candy', got {data['name']}"
        assert data["status"] == "pending", f"Child items should be pending, got {data['status']}"
        print(f"✓ Add shopping item as child passed - item_id: {data['item_id']}")
    
    def test_get_shopping_list(self):
        """Test GET /api/shopping returns items"""
        global PARENT_TOKEN
        
        response = requests.get(
            f"{BASE_URL}/api/shopping",
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data, "Response should contain 'items'"
        assert isinstance(data["items"], list), "Items should be a list"
        
        # Verify our test items are in the list
        item_names = [item["name"] for item in data["items"]]
        assert "P1_TEST_Milk" in item_names or any("P1_TEST" in name for name in item_names), \
            "Test items should be in the shopping list"
        print(f"✓ Get shopping list passed - {len(data['items'])} items found")


class TestDinnerSuggestP1:
    """Test dinner suggest API - P1 Fix for Quick Meal Ideas"""
    
    def test_dinner_suggest_with_preferences(self):
        """Test POST /api/dinner/suggest with preferences returns AI suggestion"""
        global PARENT_TOKEN
        
        response = requests.post(
            f"{BASE_URL}/api/dinner/suggest",
            json={
                "ingredients": ["chicken", "rice", "vegetables"],
                "preferences": "quick and easy, family-friendly"
            },
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"},
            timeout=30  # AI calls may take longer
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "suggestion" in data, "Response should contain 'suggestion'"
        assert len(str(data["suggestion"])) > 10, "Suggestion should have meaningful content"
        print(f"✓ Dinner suggest passed - got AI suggestion")
    
    def test_dinner_suggest_quick_meal(self):
        """Test POST /api/dinner/suggest for quick meal ideas"""
        global PARENT_TOKEN
        
        response = requests.post(
            f"{BASE_URL}/api/dinner/suggest",
            json={
                "ingredients": [],
                "preferences": "quick 15-minute meal for busy weeknight"
            },
            headers={"Authorization": f"Bearer {PARENT_TOKEN}"},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "suggestion" in data, "Response should contain 'suggestion'"
        print(f"✓ Quick meal suggest passed - got AI suggestion")


class TestReadingLogsP1:
    """Test reading logs API - P1 Fix for book_title field"""
    
    def test_reading_log_with_book_title(self):
        """Test POST /api/reading-logs accepts book_title field"""
        global CHILD_TOKEN
        
        log_data = {
            "book_title": "P1_TEST_The Magic Treehouse",
            "pages_read": 45,
            "summary": "Jack and Annie travel to ancient Egypt",
            "date": datetime.now().date().isoformat()
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reading-logs",
            json=log_data,
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Backend should accept book_title and store it
        assert data.get("book_name") == "P1_TEST_The Magic Treehouse" or \
               data.get("book_title") == "P1_TEST_The Magic Treehouse", \
               f"Book title not stored correctly: {data}"
        assert data["status"] == "pending", f"Expected status 'pending', got {data['status']}"
        assert "log_id" in data, "Response should contain 'log_id'"
        print(f"✓ Reading log with book_title passed - log_id: {data['log_id']}")
    
    def test_reading_log_with_book_name(self):
        """Test POST /api/reading-logs accepts book_name field (backward compatibility)"""
        global CHILD_TOKEN
        
        log_data = {
            "book_name": "P1_TEST_Charlotte's Web",
            "pages_read": 30,
            "summary": "Wilbur meets Charlotte the spider",
            "date": datetime.now().date().isoformat()
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reading-logs",
            json=log_data,
            headers={"Authorization": f"Bearer {CHILD_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["book_name"] == "P1_TEST_Charlotte's Web", \
               f"Expected book_name 'P1_TEST_Charlotte's Web', got {data.get('book_name')}"
        print(f"✓ Reading log with book_name passed - log_id: {data['log_id']}")


# Cleanup test data after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup P1_TEST_ prefixed data after tests"""
    yield
    # Cleanup after tests
    import subprocess
    subprocess.run([
        'mongosh', '--quiet', '--eval', '''
        use('test_database');
        db.shopping_items.deleteMany({name: /^P1_TEST_/});
        db.reading_logs.deleteMany({book_name: /^P1_TEST_/});
        db.reading_logs.deleteMany({book_title: /^P1_TEST_/});
        db.points_history.deleteMany({reason: /^P1_TEST_/});
        print('P1 Test data cleaned up');
        '''
    ], capture_output=True, text=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
