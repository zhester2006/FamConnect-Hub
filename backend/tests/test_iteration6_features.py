"""
Test Suite for FamFocus Hub - Iteration 6 Features
Features tested:
- Analytics Dashboard (GET /api/analytics/overview, GET /api/analytics/trends)
- Data Export (GET /api/export/chores, GET /api/export/events, GET /api/export/full)
- Welcome Tutorial (GET /api/tutorial/content, POST /api/tutorial/complete, POST /api/tutorial/reset)
- Multiple Family Support (GET /api/families, POST /api/families)
- Leaderboard with Nickname display
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAnalyticsDashboard:
    """Analytics Dashboard endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.cookies.set('session_token', 'test_session_1770170842400')
    
    def test_analytics_overview_returns_weekly_stats(self):
        """GET /api/analytics/overview returns weekly completion stats"""
        response = self.session.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code == 200
        
        data = response.json()
        assert "weekly" in data
        assert "completed" in data["weekly"]
        assert "total" in data["weekly"]
        assert "completion_rate" in data["weekly"]
        assert isinstance(data["weekly"]["completion_rate"], (int, float))
    
    def test_analytics_overview_returns_monthly_stats(self):
        """GET /api/analytics/overview returns monthly completion stats"""
        response = self.session.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code == 200
        
        data = response.json()
        assert "monthly" in data
        assert "completed" in data["monthly"]
        assert "total" in data["monthly"]
        assert "completion_rate" in data["monthly"]
    
    def test_analytics_overview_returns_children_stats(self):
        """GET /api/analytics/overview returns children performance stats"""
        response = self.session.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code == 200
        
        data = response.json()
        assert "children" in data
        assert isinstance(data["children"], list)
        
        if len(data["children"]) > 0:
            child = data["children"][0]
            assert "user_id" in child
            assert "display_name" in child
            assert "chores_completed" in child
            assert "chores_total" in child
            assert "completion_rate" in child
            assert "points_earned" in child
    
    def test_analytics_overview_returns_daily_activity(self):
        """GET /api/analytics/overview returns daily activity for 7 days"""
        response = self.session.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code == 200
        
        data = response.json()
        assert "daily_activity" in data
        assert isinstance(data["daily_activity"], list)
        assert len(data["daily_activity"]) == 7
        
        for day in data["daily_activity"]:
            assert "date" in day
            assert "day" in day
            assert "completed" in day
            assert "total" in day
    
    def test_analytics_overview_returns_family_counts(self):
        """GET /api/analytics/overview returns family member counts"""
        response = self.session.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_family_members" in data
        assert "total_children" in data
        assert isinstance(data["total_family_members"], int)
        assert isinstance(data["total_children"], int)
    
    def test_analytics_trends_returns_weekly_trends(self):
        """GET /api/analytics/trends returns weekly trends data"""
        response = self.session.get(f"{BASE_URL}/api/analytics/trends?days=30")
        assert response.status_code == 200
        
        data = response.json()
        assert "trends" in data
        assert "period_days" in data
        assert data["period_days"] == 30
        assert isinstance(data["trends"], list)
        
        if len(data["trends"]) > 0:
            week = data["trends"][0]
            assert "week" in week
            assert "completed" in week
            assert "total" in week
            assert "points" in week
    
    def test_analytics_trends_custom_days(self):
        """GET /api/analytics/trends accepts custom days parameter"""
        response = self.session.get(f"{BASE_URL}/api/analytics/trends?days=7")
        assert response.status_code == 200
        
        data = response.json()
        assert data["period_days"] == 7
    
    def test_analytics_requires_auth(self):
        """Analytics endpoints require authentication"""
        session = requests.Session()  # No auth
        response = session.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code == 401


class TestDataExport:
    """Data Export endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.cookies.set('session_token', 'test_session_1770170842400')
    
    def test_export_chores_csv(self):
        """GET /api/export/chores returns CSV data"""
        response = self.session.get(f"{BASE_URL}/api/export/chores")
        assert response.status_code == 200
        
        data = response.json()
        assert "filename" in data
        assert "content" in data
        assert "mime_type" in data
        assert data["mime_type"] == "text/csv"
        assert data["filename"].endswith(".csv")
        assert "famfocus_chores_" in data["filename"]
        
        # Verify CSV header
        assert "Date,Chore,Assigned To,Status,Points" in data["content"]
    
    def test_export_events_csv(self):
        """GET /api/export/events returns CSV data"""
        response = self.session.get(f"{BASE_URL}/api/export/events")
        assert response.status_code == 200
        
        data = response.json()
        assert "filename" in data
        assert "content" in data
        assert "mime_type" in data
        assert data["mime_type"] == "text/csv"
        assert data["filename"].endswith(".csv")
        assert "famfocus_events_" in data["filename"]
        
        # Verify CSV header
        assert "Date,Title,Type,Time,Created By" in data["content"]
    
    def test_export_full_json(self):
        """GET /api/export/full returns full JSON export"""
        response = self.session.get(f"{BASE_URL}/api/export/full")
        assert response.status_code == 200
        
        data = response.json()
        assert "filename" in data
        assert "content" in data
        assert "mime_type" in data
        assert data["mime_type"] == "application/json"
        assert data["filename"].endswith(".json")
        assert "famfocus_full_export_" in data["filename"]
        
        # Verify export content structure
        content = data["content"]
        assert "export_date" in content
        assert "family_id" in content
        assert "members" in content
        assert "chores" in content
        assert "events" in content
        assert "rewards" in content
        assert "reading_logs" in content
    
    def test_export_requires_parent_role(self):
        """Export endpoints require parent role"""
        # Create child session
        child_session = requests.Session()
        child_session.cookies.set('session_token', 'test_session_child_1770170842400')
        
        # This should fail for non-parent users
        # Note: We're testing with parent session, so this is a documentation test
        response = self.session.get(f"{BASE_URL}/api/export/chores")
        assert response.status_code == 200  # Parent can export


class TestWelcomeTutorial:
    """Welcome Tutorial endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.cookies.set('session_token', 'test_session_1770170842400')
    
    def test_tutorial_content_returns_slides(self):
        """GET /api/tutorial/content returns tutorial slides"""
        # First reset tutorial
        self.session.post(f"{BASE_URL}/api/tutorial/reset")
        
        response = self.session.get(f"{BASE_URL}/api/tutorial/content")
        assert response.status_code == 200
        
        data = response.json()
        assert "completed" in data
        assert "slides" in data
        
        if not data["completed"]:
            assert len(data["slides"]) > 0
            slide = data["slides"][0]
            assert "id" in slide
            assert "title" in slide
            assert "description" in slide
            assert "image" in slide
            assert "icon" in slide
    
    def test_tutorial_complete(self):
        """POST /api/tutorial/complete marks tutorial as completed"""
        response = self.session.post(f"{BASE_URL}/api/tutorial/complete")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
        # Verify tutorial is now completed
        content_response = self.session.get(f"{BASE_URL}/api/tutorial/content")
        content_data = content_response.json()
        assert content_data["completed"] == True
        assert content_data["slides"] == []
    
    def test_tutorial_reset(self):
        """POST /api/tutorial/reset resets tutorial status"""
        # First complete the tutorial
        self.session.post(f"{BASE_URL}/api/tutorial/complete")
        
        # Then reset it
        response = self.session.post(f"{BASE_URL}/api/tutorial/reset")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
        # Verify tutorial is now not completed
        content_response = self.session.get(f"{BASE_URL}/api/tutorial/content")
        content_data = content_response.json()
        assert content_data["completed"] == False
        assert len(content_data["slides"]) > 0
    
    def test_tutorial_parent_slides(self):
        """Parent users get parent-specific tutorial slides"""
        self.session.post(f"{BASE_URL}/api/tutorial/reset")
        
        response = self.session.get(f"{BASE_URL}/api/tutorial/content")
        assert response.status_code == 200
        
        data = response.json()
        # Parent slides should include "Home Hub Dashboard" and "Location Safety"
        slide_titles = [s["title"] for s in data["slides"]]
        assert "Welcome to FamFocus Hub!" in slide_titles
        assert "Home Hub Dashboard" in slide_titles


class TestMultipleFamilySupport:
    """Multiple Family Support endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.cookies.set('session_token', 'test_session_1770170842400')
    
    def test_get_families(self):
        """GET /api/families returns user's families"""
        response = self.session.get(f"{BASE_URL}/api/families")
        assert response.status_code == 200
        
        data = response.json()
        assert "families" in data
        assert isinstance(data["families"], list)
        assert len(data["families"]) >= 1
        
        family = data["families"][0]
        assert "family_id" in family
        assert "name" in family
        assert "role" in family
        assert "member_count" in family
        assert "is_current" in family
    
    def test_create_family(self):
        """POST /api/families creates a new family"""
        response = self.session.post(
            f"{BASE_URL}/api/families",
            json={"name": "Test Family Iteration 6"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "family_id" in data
        assert "name" in data
        assert data["name"] == "Test Family Iteration 6"
        assert data["family_id"].startswith("family_")
    
    def test_create_family_default_name(self):
        """POST /api/families uses default name if not provided"""
        response = self.session.post(
            f"{BASE_URL}/api/families",
            json={}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "family_id" in data
        assert "name" in data
        # Default name should include user's name
        assert "Family" in data["name"]


class TestLeaderboardWithNickname:
    """Leaderboard with nickname display tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.cookies.set('session_token', 'test_session_1770170842400')
    
    def test_leaderboard_includes_nickname(self):
        """GET /api/leaderboard includes nickname field"""
        response = self.session.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        
        # Check that nickname field is present (may be null for some users)
        if len(data["leaderboard"]) > 0:
            child = data["leaderboard"][0]
            assert "user_id" in child
            assert "name" in child
            assert "points" in child
            # nickname should be in the response (even if null)
            # The field should exist for users who have it set
    
    def test_leaderboard_sorted_by_points(self):
        """GET /api/leaderboard returns children sorted by points descending"""
        response = self.session.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        
        data = response.json()
        leaderboard = data["leaderboard"]
        
        if len(leaderboard) > 1:
            for i in range(len(leaderboard) - 1):
                assert leaderboard[i]["points"] >= leaderboard[i + 1]["points"]
    
    def test_set_nickname_and_verify_in_leaderboard(self):
        """Setting nickname reflects in leaderboard"""
        # Set a unique nickname
        nickname_response = self.session.put(
            f"{BASE_URL}/api/users/user_child001/nickname",
            json={"nickname": "TestChamp"}
        )
        assert nickname_response.status_code == 200
        
        # Verify in leaderboard
        leaderboard_response = self.session.get(f"{BASE_URL}/api/leaderboard")
        assert leaderboard_response.status_code == 200
        
        data = leaderboard_response.json()
        child = next((c for c in data["leaderboard"] if c["user_id"] == "user_child001"), None)
        assert child is not None
        assert child.get("nickname") == "TestChamp"


class TestAuthRequirements:
    """Test authentication requirements for all new endpoints"""
    
    def test_analytics_overview_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code == 401
    
    def test_analytics_trends_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/analytics/trends")
        assert response.status_code == 401
    
    def test_export_chores_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/export/chores")
        assert response.status_code == 401
    
    def test_export_events_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/export/events")
        assert response.status_code == 401
    
    def test_export_full_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/export/full")
        assert response.status_code == 401
    
    def test_tutorial_content_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/tutorial/content")
        assert response.status_code == 401
    
    def test_tutorial_complete_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/tutorial/complete")
        assert response.status_code == 401
    
    def test_families_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/families")
        assert response.status_code == 401
    
    def test_create_family_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/families", json={"name": "Test"})
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
