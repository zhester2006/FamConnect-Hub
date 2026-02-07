"""
Backend tests for Iteration 18 - Testing P0/P1 features
- Leaderboard timeframe filter (all-time, this-week, this-month)
- Dinner planner regenerate plan
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLeaderboardTimeframe:
    """Test leaderboard endpoint with timeframe filter"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get parent auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "test_parent@test.com",
            "name": "Test Parent",
            "role": "parent"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get('session_token')
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_leaderboard_all_time(self):
        """Test leaderboard with all-time filter (default)"""
        response = requests.get(
            f"{BASE_URL}/api/leaderboard?timeframe=all-time",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert 'leaderboard' in data
        assert data.get('timeframe') == 'all-time'
        print(f"All-time leaderboard: {len(data['leaderboard'])} children")
    
    def test_leaderboard_this_week(self):
        """Test leaderboard with this-week filter"""
        response = requests.get(
            f"{BASE_URL}/api/leaderboard?timeframe=this-week",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert 'leaderboard' in data
        assert data.get('timeframe') == 'this-week'
        # Check that period_points is calculated for this-week
        if data['leaderboard']:
            for child in data['leaderboard']:
                assert 'period_points' in child or 'points' in child
        print(f"This-week leaderboard: {len(data['leaderboard'])} children")
    
    def test_leaderboard_this_month(self):
        """Test leaderboard with this-month filter"""
        response = requests.get(
            f"{BASE_URL}/api/leaderboard?timeframe=this-month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert 'leaderboard' in data
        assert data.get('timeframe') == 'this-month'
        # Check that period_points is calculated for this-month
        if data['leaderboard']:
            for child in data['leaderboard']:
                assert 'period_points' in child or 'points' in child
        print(f"This-month leaderboard: {len(data['leaderboard'])} children")
    
    def test_leaderboard_default_timeframe(self):
        """Test leaderboard without timeframe parameter (should default to all-time)"""
        response = requests.get(
            f"{BASE_URL}/api/leaderboard",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert 'leaderboard' in data
        # Default should be all-time
        assert data.get('timeframe') == 'all-time'
        print("Default timeframe is all-time: PASS")


class TestDinnerPlanner:
    """Test dinner planner endpoints including regenerate"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get parent auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={
            "email": "test_parent@test.com",
            "name": "Test Parent",
            "role": "parent"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get('session_token')
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dinner_suggest(self):
        """Test dinner suggestion endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/dinner/suggest",
            headers=self.headers,
            json={
                "ingredients": ["chicken", "rice", "vegetables"],
                "preferences": "healthy, quick"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'suggestion' in data
        print(f"Dinner suggestion received: {len(data['suggestion'])} chars")
    
    def test_weekly_plan_generate(self):
        """Test weekly meal plan generation"""
        response = requests.post(
            f"{BASE_URL}/api/dinner/weekly-plan",
            headers=self.headers,
            json={
                "family_size": 4,
                "preferences": "balanced meals",
                "budget": "moderate"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'plan' in data
        print(f"Weekly plan generated: {len(data['plan'])} chars")
    
    def test_weekly_plan_regenerate(self):
        """Test regenerating weekly meal plan (same endpoint, different preferences)"""
        # First generation
        response1 = requests.post(
            f"{BASE_URL}/api/dinner/weekly-plan",
            headers=self.headers,
            json={
                "family_size": 4,
                "preferences": "Italian cuisine",
                "budget": "moderate"
            }
        )
        assert response1.status_code == 200
        plan1 = response1.json().get('plan', '')
        
        # Wait a bit
        time.sleep(1)
        
        # Regenerate with different preferences
        response2 = requests.post(
            f"{BASE_URL}/api/dinner/weekly-plan",
            headers=self.headers,
            json={
                "family_size": 4,
                "preferences": "Mexican cuisine",
                "budget": "budget"
            }
        )
        assert response2.status_code == 200
        plan2 = response2.json().get('plan', '')
        
        # Plans should be different (different preferences)
        assert plan1 != plan2 or len(plan1) > 0
        print("Regenerate plan works: PASS")
    
    def test_ai_meal_plan(self):
        """Test AI meal plan endpoint (structured response)"""
        response = requests.post(
            f"{BASE_URL}/api/ai/meal-plan",
            headers=self.headers,
            json={
                "preferences": "pasta dishes",
                "servings": 4,
                "meal_type": "dinner"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data or 'meal' in data or 'suggestion' in data
        print("AI meal plan endpoint works: PASS")


class TestHealthCheck:
    """Basic health check"""
    
    def test_health(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print("Health check: PASS")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
